import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UserDocument } from '../database/schemas/user.schema';
import { UserSessionDocument } from '../database/schemas/user-session.schema';
import { UserStatus } from '../database/schemas/enums';
import { comparePassword, hashPassword } from './strategies/bcrypt.strategy';
import { generateSessionToken, hashToken } from './strategies/token-strategy';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const FAILED_LOGIN_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;

/** Escape a string for safe embedding in a RegExp (prevents regex injection). */
function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Convert a User doc to a plain object with passwordHash stripped. */
function toSafeUser(doc: UserDocument): Record<string, unknown> {
	const { passwordHash, ...rest } = doc.toObject();
	return rest;
}

@Injectable()
export class AuthService {
	constructor(
		@InjectModel('User') private readonly userModel: Model<UserDocument>,
		@InjectModel('UserSession') private readonly sessionModel: Model<UserSessionDocument>,
	) {}

	async login(dto: LoginDto): Promise<{
		user: Record<string, unknown>;
		mustChangePassword: boolean;
		sessionId: string;
	}> {
		const normalizedId = dto.identifier.trim().toLowerCase();

		// Match by normalized email OR case-insensitive exact employeeCode
		// (SRS §4.2). Identifier is regex-escaped so user input can't inject.
		const candidate = await this.userModel.findOne({
			$or: [
				{ emailN: normalizedId },
				{ employeeCode: { $regex: `^${escapeRegex(dto.identifier.trim())}$`, $options: 'i' } },
			],
		}).exec();

		if (!candidate) throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');

		if (candidate.status === UserStatus.DISABLED) {
			throw new UnauthorizedException('AUTH_ACCOUNT_DISABLED');
		}

		if (candidate.status === UserStatus.LOCKED && candidate.lockedUntil && candidate.lockedUntil > new Date()) {
			throw new UnauthorizedException('AUTH_ACCOUNT_LOCKED');
		}

		const valid = await comparePassword(dto.password, candidate.passwordHash);

		if (!valid) {
			await this._handleLoginFailure(candidate);
			throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
		}

		if (candidate.failedLoginCount > 0) {
			candidate.failedLoginCount = 0;
			delete candidate.lockedUntil;
			await candidate.save();
		}

		const rawToken = generateSessionToken();
		const tokenHash = hashToken(rawToken);

		await this.sessionModel.create({
			userId: candidate._id,
			organizationId: candidate.organizationId ?? undefined,
			tokenHash,
			expiresAt: new Date(Date.now() + SESSION_TTL_MS),
		});

		return {
			user: toSafeUser(candidate),
			mustChangePassword: !!candidate.mustChangePassword,
			sessionId: rawToken,
		};
	}

	async logout(sessionId: string): Promise<void> {
		await this.sessionModel.updateOne(
			{ tokenHash: hashToken(sessionId) },
			{ revokedAt: new Date() },
		);
	}

	async getMe(userId: string): Promise<Record<string, unknown>> {
		const doc = await this.userModel.findById(userId).exec();
		if (!doc || doc.status !== UserStatus.ACTIVE) {
			throw new UnauthorizedException('AUTH_SESSION_EXPIRED');
		}
		return toSafeUser(doc);
	}

	async changePassword(userId: string, dto: ChangePasswordDto, keepToken?: string): Promise<{ success: true }> {
		if (dto.newPassword !== dto.confirmPassword) {
			throw new BadRequestException('New password and confirmation do not match.');
		}

		const user = await this.userModel.findById(userId).orFail();

		if (!(await comparePassword(dto.currentPassword, user.passwordHash))) {
			throw new BadRequestException('AUTH_CURRENT_PASSWORD_INVALID');
		}

		if (await comparePassword(dto.newPassword, user.passwordHash)) {
			throw new BadRequestException('AUTH_PASSWORD_POLICY_FAILED');
		}

		user.passwordHash = await hashPassword(dto.newPassword);
		user.mustChangePassword = false;
		user.failedLoginCount = 0;
		delete user.lockedUntil;
		await user.save();

		// Revoke other sessions (tombstone), keep the current one alive.
		const filter: Record<string, unknown> = { userId, revokedAt: null };
		if (keepToken) filter.tokenHash = { $ne: hashToken(keepToken) };
		await this.sessionModel.updateMany(filter, { revokedAt: new Date() }).exec();

		return { success: true };
	}

	/** SHOULD — stub. Real implementation: generate reset token, send email. */
	async forgotPassword(_email: string): Promise<{ success: true }> {
		return { success: true };
	}

	/** SHOULD — stub. */
	async resetPassword(_token: string, _newPassword: string): Promise<{ success: true }> {
		return { success: true };
	}

	/** Admin reset — System Admin sets temp password + mustChangePassword=true + revoke sessions */
	async adminResetPassword(userId: string, tempPassword: string): Promise<{ success: true }> {
		const hashed = await hashPassword(tempPassword);

		await this.userModel.findByIdAndUpdate(userId, {
			passwordHash: hashed,
			mustChangePassword: true,
		}).exec();

		await this.sessionModel.updateMany(
			{ userId, revokedAt: null },
			{ revokedAt: new Date() },
		).exec();

		return { success: true };
	}

	private async _handleLoginFailure(user: UserDocument): Promise<void> {
		user.failedLoginCount += 1;
		if (user.failedLoginCount >= FAILED_LOGIN_THRESHOLD) {
			user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
		}
		await user.save();
	}
}
