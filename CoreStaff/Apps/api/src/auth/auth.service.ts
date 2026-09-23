import {
	Injectable,
	Inject,
	BadRequestException,
	UnauthorizedException,
	ForbiddenException,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UserDocument } from '../database/schemas/user.schema';
import { UserSessionDocument } from '../database/schemas/user-session.schema';
import { EmployeeProfileDocument } from '../database/schemas/employee-profile.schema';
import { OrganizationDocument } from '../database/schemas/organization.schema';
import { OrganizationStatus, UserStatus, normalizeEmail, normalizeEmployeeCode } from '../database/schemas/enums';
import { comparePassword, hashPassword } from './strategies/bcrypt.strategy';
import { isWeakPassword } from './strategies/password-policy';
import { generateSessionToken, hashToken } from './strategies/token-strategy';
import { REFRESH_TTL_MS, SESSION_TTL_MS } from './session-ttl';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordResetTokenDocument } from '../database/schemas/password-reset-token.schema';
import { ResetMailer, RESET_MAILER } from './strategies/reset-mailer';

const FAILED_LOGIN_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
/** FR-AUTH-05 / SRS §4.8: one-time reset tokens expire after 15 minutes. */
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Convert a User doc to a plain object with passwordHash stripped.
 * `employeeCode` is passed in rather than read off the User: the identifier is
 * owned by EmployeeProfile (TASK-120), and clients still expect it on the
 * account payload (attendance bar, profile header, directory filters).
 */
function toSafeUser(doc: UserDocument, employeeCode?: string): Record<string, unknown> {
	const { passwordHash, ...rest } = doc.toObject();
	return { ...rest, employeeCode };
}

@Injectable()
export class AuthService {
	constructor(
		@InjectModel('User') private readonly userModel: Model<UserDocument>,
		@InjectModel('UserSession') private readonly sessionModel: Model<UserSessionDocument>,
		@InjectModel('PasswordResetToken') private readonly resetTokenModel: Model<PasswordResetTokenDocument>,
		@InjectModel('EmployeeProfile') private readonly profileModel: Model<EmployeeProfileDocument>,
		@InjectModel('Organization') private readonly orgModel: Model<OrganizationDocument>,
		@Inject(RESET_MAILER) private readonly resetMailer: ResetMailer,
	) {}

	async login(dto: LoginDto): Promise<{
		user: Record<string, unknown>;
		mustChangePassword: boolean;
		sessionId: string;
		refreshToken: string;
	}> {
		const resolved = await this.resolveLoginUser(dto.identifier);
		const candidate = resolved?.user;
		if (!candidate) throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');

		if (candidate.status === UserStatus.DISABLED) {
			throw new ForbiddenException('AUTH_ACCOUNT_DISABLED'); // SRS §17 → 403
		}

		if (candidate.status === UserStatus.LOCKED && candidate.lockedUntil && candidate.lockedUntil > new Date()) {
			throw new HttpException('AUTH_ACCOUNT_LOCKED', HttpStatus.LOCKED); // SRS §17 → 423
		}

		// AC-SYS-02 / BR-AUTH-03 — a suspended tenant cannot start a new session.
		// Its live sessions were already revoked by the suspend route, so this
		// lookup is the other half of that switch. Checked before the password so
		// the login screen can show SRS §17.2's "Organization đã bị khóa" without
		// burning bcrypt on a tenant that is closed anyway; that ordering is a
		// deliberate, spec-requested disclosure.
		await this.assertNotTenantLocked(candidate.organizationId);

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
		const refreshToken = generateSessionToken();

		await this.sessionModel.create({
			userId: candidate._id,
			organizationId: candidate.organizationId ?? undefined,
			tokenHash: hashToken(rawToken),
			refreshTokenHash: hashToken(refreshToken),
			expiresAt: new Date(Date.now() + SESSION_TTL_MS),
			refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
		});

		return {
			user: toSafeUser(candidate, resolved.employeeCode),
			mustChangePassword: !!candidate.mustChangePassword,
			sessionId: rawToken,
			refreshToken,
		};
	}

	/**
	 * SRS §4.4 — exchange the `rt` cookie for a new session cookie so a
	 * returning user is not bounced to the login screen every 30 minutes.
	 * Deliberately NOT behind AuthGuard: the whole point is being callable once
	 * the access cookie has expired. Tenant context comes from the session row,
	 * never from the client (BR-TENANT-01).
	 *
	 * ponytail: the refresh token is NOT rotated — one per login until it
	 * expires or the session is revoked. Rotation would invalidate every other
	 * tab's token mid-flight; if this ever needs it, do it with a grace window
	 * and reuse detection, not a plain swap.
	 */
	async refreshSession(refreshToken: string): Promise<{ sessionId: string; user: Record<string, unknown> }> {
		const session = await this.sessionModel
			.findOne({
				refreshTokenHash: hashToken(refreshToken),
				revokedAt: null,
				refreshExpiresAt: { $gte: new Date() },
			})
			.lean();

		if (!session) throw new UnauthorizedException('AUTH_SESSION_EXPIRED');

		// Parity with login: the suspend route revokes live sessions, but a
		// refresh must not be a way back in for a tenant that is closed.
		await this.assertNotTenantLocked(session.organizationId);

		// Lean, like AuthGuard: `-passwordHash` is applied by the query, so
		// `toSafeUser`'s `toObject()` is not available and nothing needs
		// stripping — the payload is the plain doc.
		const doc = await this.userModel.findById(session.userId).select('-passwordHash').lean();
		if (!doc || doc.status !== UserStatus.ACTIVE) {
			throw new UnauthorizedException('AUTH_SESSION_EXPIRED');
		}

		const rawToken = generateSessionToken();
		await this.sessionModel.updateOne(
			{ _id: session._id },
			{ tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
		);

		const profile = await this.profileModel
			.findOne({ organizationId: doc.organizationId, userId: doc._id })
			.lean()
			.exec();

		return { sessionId: rawToken, user: { ...doc, employeeCode: profile?.employeeCode } };
	}

	/**
	 * SRS §4.2 — resolve a login identifier to exactly one User.
	 * Email matches on User.emailN; employeeCode matches on EmployeeProfile,
	 * which owns the code (TASK-120), then loads the linked User scoped to the
	 * profile's tenant. LoginDto carries no tenant yet (OQ-02), so an address
	 * shared across tenants fails closed instead of picking an arbitrary row.
	 */
	private async resolveLoginUser(identifier: string): Promise<{ user: UserDocument; employeeCode?: string } | null> {
		const trimmed = identifier.trim();

		const byEmail = await this.userModel.find({ emailN: normalizeEmail(trimmed) }).exec();
		if (byEmail.length > 1) throw new UnauthorizedException('AUTH_AMBIGUOUS_IDENTIFIER');
		if (byEmail.length === 1) {
			const profile = await this.profileModel
				.findOne({ organizationId: byEmail[0].organizationId, userId: byEmail[0]._id })
				.lean()
				.exec();
			return { user: byEmail[0], employeeCode: profile?.employeeCode };
		}

		const profile = await this.profileModel.findOne({ employeeCode: normalizeEmployeeCode(trimmed) }).lean().exec();
		if (!profile) return null;
		const user = await this.userModel.findOne({ _id: profile.userId, organizationId: profile.organizationId }).exec();
		return user ? { user, employeeCode: profile.employeeCode } : null;
	}

	/**
	 * One `_id` lookup, only on the login path — no per-request cost (the plan's
	 * explicit trim of AC-SYS-02). A platform-local session has no
	 * organizationId, so it is never tenant-locked. Anything not ACTIVE counts:
	 * SRS §17.2 gives SUSPENDED the code, and a DISABLED tenant is strictly
	 * harder, so it gets the same refusal rather than a second error code.
	 */
	private async assertNotTenantLocked(organizationId: unknown): Promise<void> {
		if (!organizationId) return;
		const org = await this.orgModel
			.findOne({ _id: organizationId })
			.select('status')
			.lean()
			.exec();
		if (org && org.status !== OrganizationStatus.ACTIVE) {
			throw new HttpException('TENANT_SUSPENDED', HttpStatus.LOCKED); // SRS §17.2 → 423
		}
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
		const profile = await this.profileModel
			.findOne({ organizationId: doc.organizationId, userId: doc._id })
			.lean()
			.exec();
		return toSafeUser(doc, profile?.employeeCode);
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

	/**
	 * FR-AUTH-05 — issue a single-use reset token (hashed at rest, 15 min TTL).
	 * Response is identical whether or not the email exists (SRS §4.8:
	 * "không tiết lộ email có tồn tại hay không"), and delivery failures are
	 * swallowed for the same reason.
	 *
	 * emailN is unique only WITHIN a tenant (SRS §4.2), so every ACTIVE account
	 * holding the address gets its own token — the reset link a user receives
	 * always resolves to exactly one user. Mail failures are swallowed (same
	 * no-enumeration rule covers no-delivery vs no-account).
	 */
	async forgotPassword(email: string): Promise<{ success: true }> {
		const users = await this.userModel.find({ emailN: normalizeEmail(email), status: UserStatus.ACTIVE }).exec();

		for (const user of users) {
			const rawToken = generateSessionToken();
			await this.resetTokenModel.create({
				userId: user._id,
				tokenHash: hashToken(rawToken),
				expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
			});
			await this.resetMailer.sendResetEmail(user.email, rawToken).catch(() => undefined);
		}

		return { success: true };
	}

	/**
	 * FR-AUTH-05 — consume a reset token. Single-use via `findOneAndUpdate`
	 * atomic claim (usedAt + revokedAt set before any further check), so a
	 * concurrent double-submit cannot use the token twice. All invalid inputs
	 * share one code/message: reset tokens must not be an oracle.
	 * On success: new hash, mustChangePassword cleared, lock counters reset,
	 * ALL sessions revoked (the caller has proven they can't use their cookie),
	 * and every outstanding reset token for the user burned.
	 */
	async resetPassword(token: string, newPassword: string): Promise<{ success: true }> {
		const now = new Date();
		const claimed = await this.resetTokenModel
			.findOneAndUpdate(
				{ tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: now } },
				{ usedAt: now },
				{ new: true },
			)
			.exec();

		if (!claimed) {
			throw new UnauthorizedException('AUTH_RESET_TOKEN_INVALID');
		}

		const user = await this.userModel.findById(claimed.userId).exec();
		if (!user || user.status !== UserStatus.ACTIVE) {
			throw new UnauthorizedException('AUTH_RESET_TOKEN_INVALID');
		}

		// Same policy as the DTO (§4.3), enforced server-side — a reset is not
		// a bypass around it. Reuse of the current hash is also a policy fail.
		if (isWeakPassword(newPassword) || (await comparePassword(newPassword, user.passwordHash))) {
			throw new BadRequestException('AUTH_PASSWORD_POLICY_FAILED');
		}

		user.passwordHash = await hashPassword(newPassword);
		user.mustChangePassword = false;
		user.failedLoginCount = 0;
		delete user.lockedUntil;
		await user.save();

		await this.sessionModel.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: now }).exec();
		await this.resetTokenModel.updateMany({ userId: user._id, usedAt: null }, { usedAt: now }).exec();

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
