import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrganizationDocument } from '../database/schemas/organization.schema';
import { UserDocument } from '../database/schemas/user.schema';
import { UserSessionDocument } from '../database/schemas/user-session.schema';
import { OrganizationStatus, Role, normalizeEmail } from '../database/schemas/enums';
import { hashPassword } from '../auth/strategies/bcrypt.strategy';
import { generateTempPassword } from '../auth/strategies/password-policy';
import { userFields } from '../database/seed/provision';
import { CreateOrganizationDto, CreateInitialHrDto } from './dto/platform.dto';

const DUPLICATE_KEY_ERROR = 11000;

/**
 * FR-SYS-01/02 — platform-local tenant lifecycle. Every route here is
 * `@PlatformOnly()`, so an HR or manager can never reach it, and the
 * organizationId it acts on comes from the URL, never from a session (the admin
 * session has none by design).
 */
@Injectable()
export class PlatformService {
	constructor(
		@InjectModel('Organization') private readonly orgModel: Model<OrganizationDocument>,
		@InjectModel('User') private readonly userModel: Model<UserDocument>,
		@InjectModel('UserSession') private readonly sessionModel: Model<UserSessionDocument>,
	) {}

	/**
	 * Plain list. FR-SYS-03's per-tenant user counts / storage monitoring are not
	 * built, and an untested $aggregate for them would be speculative.
	 */
	async listOrganizations() {
		return this.orgModel.find().sort({ code: 1 }).lean();
	}

	async createOrganization(dto: CreateOrganizationDto, createdBy: string) {
		try {
			const doc = await this.orgModel.create({
				code: dto.code.trim().toUpperCase(),
				name: dto.name.trim(),
				status: OrganizationStatus.ACTIVE,
				createdBy,
			});
			return doc.toObject();
		} catch (err) {
			if (isDuplicate(err)) throw new ConflictException('ORGANIZATION_CODE_TAKEN');
			throw err;
		}
	}

	/**
	 * FR-SYS-02 — mint the tenant's first HR login. The response carries
	 * `tempPassword` once; only its hash is stored, and it is never logged.
	 * No EmployeeProfile is created here: that record is HR's own to make, and
	 * auto-creating it would silently grant attendance eligibility (SRS §162).
	 */
	async createInitialHr(organizationId: string, dto: CreateInitialHrDto) {
		await this.assertOrganization(organizationId);
		const email = dto.email.trim();
		if (await this.userModel.exists({ organizationId, emailN: normalizeEmail(email) })) {
			throw new ConflictException('EMAIL_TAKEN');
		}

		const tempPassword = generateTempPassword();
		let user: Record<string, unknown>;
		try {
			const created = await this.userModel.create(
				userFields({
					organizationId,
					email,
					fullName: dto.fullName.trim(),
					passwordHash: await hashPassword(tempPassword),
					role: Role.HR,
				}) as never,
			);
			user = stripSecrets(created);
		} catch (err) {
			if (isDuplicate(err)) throw new ConflictException('EMAIL_TAKEN');
			throw err;
		}
		return { ...user, tempPassword };
	}

	/**
	 * AC-SYS-02 / BR-AUTH-03. Status first, then revoke every live session of the
	 * tenant: outstanding cookies stop working at their next request, and
	 * `AuthService.login` refuses new ones with 423 TENANT_SUSPENDED. Revocation
	 * is not repeated on activate — that direction has nothing to invalidate.
	 *
	 * ponytail: ordering leaves a window of well under a second in which a request
	 * that started after the status flip but before the revoke succeeds. Closing it
	 * needs the tenant check in AuthGuard, i.e. one org lookup per request — the
	 * cost this plan deliberately trims.
	 */
	async setOrganizationStatus(organizationId: string, status: OrganizationStatus) {
		const org = await this.orgModel.findOneAndUpdate(
			{ _id: organizationId },
			{ status },
			{ new: true },
		).lean();
		if (!org) throw new NotFoundException('ORGANIZATION_NOT_FOUND');
		if (status !== OrganizationStatus.ACTIVE) {
			await this.sessionModel.updateMany({ organizationId, revokedAt: null }, { revokedAt: new Date() }).exec();
		}
		return org;
	}

	private async assertOrganization(organizationId: string): Promise<void> {
		const exists = await this.orgModel.exists({ _id: organizationId });
		if (!exists) throw new NotFoundException('ORGANIZATION_NOT_FOUND');
	}
}

function isDuplicate(err: unknown): boolean {
	return Boolean(err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR);
}

/** Password material never leaves the service, whatever the caller returns. */
function stripSecrets(doc: unknown): Record<string, unknown> {
	const { passwordHash, ...rest } = (doc as { toObject?: () => Record<string, unknown> }).toObject?.() ?? (doc as Record<string, unknown>);
	return rest;
}
