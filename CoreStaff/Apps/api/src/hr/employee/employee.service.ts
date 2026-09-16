import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { PositionDocument } from '../../database/schemas/position.schema';
import { UserDocument } from '../../database/schemas/user.schema';
import { EmployeeProfile, EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { EmploymentHistoryDocument } from '../../database/schemas/employment-history.schema';
import { EMPLOYMENT_STATUS_TRANSITIONS, EmploymentStatus, Role, normalizeEmail, normalizeEmployeeCode } from '../../database/schemas/enums';
import { CreateEmployeeProfileDto } from './dto/create-employee-profile.dto';
import { UpdateEmployeeProfileDto } from './dto/update-employee-profile.dto';
import { UpdateEmploymentStatusDto } from './dto/update-employment-status.dto';
import { hashPassword } from '../../auth/strategies/bcrypt.strategy';
import { generateTempPassword } from '../../auth/strategies/password-policy';
import { provisionAccount, attachProfile, type AccountInput } from '../../database/seed/provision';

const DUPLICATE_KEY_ERROR = 11000;

interface RefFields {
	departmentId?: string;
	positionId?: string;
	directManagerId?: string;
}

@Injectable()
export class EmployeeService {
	constructor(
		@InjectModel('EmployeeProfile') private readonly profileModel: Model<EmployeeProfileDocument>,
		@InjectModel('EmploymentHistory') private readonly historyModel: Model<EmploymentHistoryDocument>,
		@InjectModel('Department') private readonly departmentModel: Model<DepartmentDocument>,
		@InjectModel('Position') private readonly positionModel: Model<PositionDocument>,
		@InjectModel('User') private readonly userModel: Model<UserDocument>,
		@InjectConnection() private readonly connection: Connection,
	) {}

	/**
	 * Link mode returns the profile; provisioning mode additionally returns
	 * `tempPassword` (once — it is never persisted, only its hash is).
	 */
	async create(organizationId: string, dto: CreateEmployeeProfileDto): Promise<Record<string, unknown>> {
		await this.assertRefsInTenant(organizationId, dto);
		if (dto.userId) return this.linkProfile(organizationId, dto);
		return this.provisionProfile(organizationId, dto);
	}

	/** SRS §15.2A — attach a profile to an account that already exists. */
	private async linkProfile(organizationId: string, dto: CreateEmployeeProfileDto): Promise<Record<string, unknown>> {
		await this.assertUserAvailable(organizationId, dto.userId as string);

		try {
			const doc = await this.profileModel.create({
				...dto,
				organizationId,
				employmentStatus: EmploymentStatus.PROBATION,
			});
			return doc.toObject() as unknown as Record<string, unknown>;
		} catch (err) {
			throw mapDuplicateKey(err);
		}
	}

	/**
	 * SRS §4.1:263-270 — HR adds an employee, which *creates the login account*
	 * (role EMPLOYEE) in the same call. The account and the HR record are one
	 * event: a user without a profile cannot be found in the directory, and a
	 * profile without a user owns an unusable login.
	 *
	 * The temporary password is returned once and never persisted or logged —
	 * only its hash reaches the database. The employee always starts on PROBATION
	 * because that is the state the promotion flow in changeStatus expects.
	 */
	/**
	 * `fullName` / `email` are required here rather than by the DTO because the same
	 * DTO also serves `createSelf`, which creates no account at all: its `userId`
	 * is the caller's and comes from the session, so a `!userId` condition in the
	 * validator would demand a name the route must not need.
	 */
	private async provisionProfile(organizationId: string, dto: CreateEmployeeProfileDto): Promise<Record<string, unknown>> {
		const email = dto.email?.trim();
		if (!email) throw new BadRequestException('EMAIL_REQUIRED');
		const fullName = dto.fullName?.trim();
		if (!fullName) throw new BadRequestException('FULLNAME_REQUIRED');
		// Pre-flight checks give a clear 409 on the common double-submit; the
		// unique indexes remain the source of truth under real concurrency.
		if (await this.userModel.exists({ organizationId, emailN: normalizeEmail(email) })) {
			throw new ConflictException('EMAIL_TAKEN');
		}
		if (await this.profileModel.exists({ organizationId, employeeCode: normalizeEmployeeCode(dto.employeeCode) })) {
			throw new ConflictException('EMPLOYEE_CODE_TAKEN');
		}

		// Generated and hashed outside the session: bcrypt is deliberately slow and
		// must not hold a transaction open.
		const tempPassword = generateTempPassword();
		const input: AccountInput = {
			organizationId,
			email,
			// Validated above: required whenever an account is created.
			fullName,
			phone: dto.phone,
			employeeCode: dto.employeeCode,
			passwordHash: await hashPassword(tempPassword),
			role: Role.EMPLOYEE,
			joinDate: dto.joinDate,
			employmentStatus: EmploymentStatus.PROBATION,
			departmentId: dto.departmentId,
			positionId: dto.positionId,
			directManagerId: dto.directManagerId,
			dateOfBirth: dto.dateOfBirth,
			gender: dto.gender,
			profileExtras: extraProfileFields(dto),
		};

		const session = await this.connection.startSession();
		try {
			let profile: Record<string, unknown> | undefined;
			await session.withTransaction(async () => {
				profile = (await provisionAccount(this.userModel, this.profileModel, input, session)).profile;
			});
			return { ...profile, tempPassword };
		} catch (err) {
			throw mapDuplicateKey(err);
		} finally {
			await session.endSession();
		}
	}

	/**
	 * Phase C — self-provisioning. HR and Department Manager are workforce-capable
	 * but nobody else can fill their record in: FR-SYS-02:631 mints only their
	 * login `User`, and FR-HRCFG-02:648 lets HR create "Employee và Department
	 * Manager" — not HR. So the account owner creates their own profile.
	 *
	 * `userId` is the caller's own, taken from the session by the controller and
	 * never from the body. Only one document is written (their `User` already
	 * exists), so no transaction is needed — unlike `provisionProfile`.
	 * `email`/`phone` are copied from the account, never from the payload: this is
	 * how the two documents stay consistent (TASK-120/A3) when the writer cannot
	 * supply the login fields.
	 */
	async createSelf(organizationId: string, userId: string, dto: CreateEmployeeProfileDto) {
		// The point of this route is that the profile is attached to *you*.
		if (dto.userId) throw new BadRequestException('USER_ID_NOT_ALLOWED');
		const user = await this.userModel.findOne({ _id: userId, organizationId }).lean().exec();
		if (!user) throw new NotFoundException('USER_NOT_FOUND');
		if (await this.profileModel.exists({ organizationId, userId })) {
			throw new ConflictException('EMPLOYEE_PROFILE_ALREADY_EXISTS');
		}
		await this.assertRefsInTenant(organizationId, dto);
		if (await this.profileModel.exists({ organizationId, employeeCode: normalizeEmployeeCode(dto.employeeCode) })) {
			throw new ConflictException('EMPLOYEE_CODE_TAKEN');
		}

		try {
			const { profile } = await attachProfile(
				this.profileModel,
				{
					organizationId,
					email: user.email,
					phone: user.phone,
					employeeCode: dto.employeeCode,
					joinDate: dto.joinDate,
					// Same starting state as provisioning an employee.
					employmentStatus: EmploymentStatus.PROBATION,
					departmentId: dto.departmentId,
					positionId: dto.positionId,
					directManagerId: dto.directManagerId,
					dateOfBirth: dto.dateOfBirth,
					gender: dto.gender,
					profileExtras: extraProfileFields(dto),
				},
				userId,
			);
			return profile;
		} catch (err) {
			throw mapDuplicateKey(err);
		}
	}

	async findAll(organizationId: string, filter: { status?: string; departmentId?: string } = {}) {
		const query: Record<string, unknown> = { organizationId };
		if (filter.status) query.employmentStatus = filter.status;
		if (filter.departmentId) query.departmentId = filter.departmentId;
		const rows = await this.profileModel.find(query).sort({ employeeCode: 1 }).lean();
		return this.resolveNames(organizationId, rows);
	}

	/** Accounts in the tenant that do not have an employee profile yet. */
	async listEligibleUsers(organizationId: string, excludeUserId?: string) {
		const linked = await this.profileModel.find({ organizationId }).select('userId').lean();
		const linkedIds = linked.map(row => row.userId);
		// HR appears in their own link picker otherwise — and once they have made
		// their own profile via /me they drop out anyway, so this only hides the
		// self-link option that Phase C exists to replace.
		if (excludeUserId) linkedIds.push(excludeUserId);
		return this.userModel
			.find({ organizationId, _id: { $nin: linkedIds }, status: 'ACTIVE' })
			.select('_id fullName email phone')
			.sort({ fullName: 1 })
			.lean();
	}

	async findOne(organizationId: string, id: string) {
		const doc = await this.profileModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');
		return (await this.resolveNames(organizationId, [doc]))[0];
	}

	async findByUserId(organizationId: string, userId: string) {
		const doc = await this.profileModel.findOne({ organizationId, userId }).lean();
		if (!doc) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');
		return (await this.resolveNames(organizationId, [doc]))[0];
	}

	async update(organizationId: string, id: string, dto: UpdateEmployeeProfileDto) {
		await this.assertRefsInTenant(organizationId, dto);

		try {
			const doc = await this.profileModel
				.findOneAndUpdate({ _id: id, organizationId }, { $set: dto }, { new: true, runValidators: true })
				.lean();
			if (!doc) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');
			return doc;
		} catch (err) {
			if (err instanceof NotFoundException) throw err;
			throw mapDuplicateKey(err);
		}
	}

	/**
	 * TASK-023: validated employmentStatus transition + append-only
	 * EmploymentHistory record, atomically (BR-HIST-01 — history must never
	 * drift from the profile's current status).
	 */
	async changeStatus(organizationId: string, id: string, changedBy: string, dto: UpdateEmploymentStatusDto) {
		const session = await this.connection.startSession();
		try {
			let result: (EmployeeProfile & { _id: unknown }) | undefined;

			await session.withTransaction(async () => {
				const profile = await this.profileModel.findOne({ _id: id, organizationId }).session(session);
				if (!profile) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');

				// AC-SELF-APPROVAL-01 / :249 — needed the moment an HR can hold a
				// profile they could promote themselves (Phase C self-provisioning).
				// The honest half of the fix: it refuses the violation rather than
				// routing it to "the org's shared HR queue", which in a single-HR
				// tenant is the same person.
				if (String(profile.userId) === String(changedBy)) {
					throw new ForbiddenException('SELF_APPROVAL_FORBIDDEN');
				}

				const previousStatus = profile.employmentStatus;
				const allowed = EMPLOYMENT_STATUS_TRANSITIONS[previousStatus];
				if (!allowed.includes(dto.newStatus)) {
					throw new ConflictException('EMPLOYMENT_STATUS_TRANSITION_INVALID');
				}

				profile.employmentStatus = dto.newStatus;
				if (dto.newStatus === EmploymentStatus.RESIGNED || dto.newStatus === EmploymentStatus.TERMINATED) {
					profile.endDate = new Date(dto.effectiveDate);
				}
				await profile.save({ session });

				await this.historyModel.create(
					[
						{
							organizationId,
							employeeProfileId: id,
							previousStatus,
							newStatus: dto.newStatus,
							effectiveDate: new Date(dto.effectiveDate),
							reason: dto.reason,
							changedBy,
						},
					],
					{ session },
				);

				result = profile.toObject() as EmployeeProfile & { _id: unknown };
			});

			return result!;
		} finally {
			await session.endSession();
		}
	}

	async listHistory(organizationId: string, employeeProfileId: string) {
		await this.findOne(organizationId, employeeProfileId);
		return this.historyModel.find({ organizationId, employeeProfileId }).sort({ createdAt: -1 }).lean();
	}

	/** Add display names without changing reference IDs or exposing auth fields. */
	private async resolveNames<T extends { userId: unknown; departmentId?: unknown; positionId?: unknown; directManagerId?: unknown }>(organizationId: string, rows: T[]) {
		if (!rows.length) return [];
		const ids = (values: unknown[]) => [...new Set(values.filter(Boolean).map(String))];
		const [users, departments, positions] = await Promise.all([
			this.userModel.find({ organizationId, _id: { $in: ids(rows.flatMap(r => [r.userId, r.directManagerId])) } }).select('_id fullName').lean(),
			this.departmentModel.find({ organizationId, _id: { $in: ids(rows.map(r => r.departmentId)) } }).select('_id name').lean(),
			this.positionModel.find({ organizationId, _id: { $in: ids(rows.map(r => r.positionId)) } }).select('_id name').lean(),
		]);
		const userNames = new Map(users.map(r => [String(r._id), r.fullName]));
		const departmentNames = new Map(departments.map(r => [String(r._id), r.name]));
		const positionNames = new Map(positions.map(r => [String(r._id), r.name]));
		return rows.map(row => ({ ...row,
			fullName: userNames.get(String(row.userId)) ?? null,
			departmentName: departmentNames.get(String(row.departmentId)) ?? null,
			positionName: positionNames.get(String(row.positionId)) ?? null,
			managerName: userNames.get(String(row.directManagerId)) ?? null,
		}));
	}

	private async assertUserAvailable(organizationId: string, userId: string): Promise<void> {
		const userExists = await this.userModel.exists({ _id: userId, organizationId });
		if (!userExists) throw new NotFoundException('USER_NOT_FOUND');

		const profileExists = await this.profileModel.exists({ organizationId, userId });
		if (profileExists) throw new ConflictException('EMPLOYEE_PROFILE_ALREADY_EXISTS');
	}

	private async assertRefsInTenant(organizationId: string, dto: RefFields): Promise<void> {
		if (dto.departmentId) {
			const exists = await this.departmentModel.exists({ _id: dto.departmentId, organizationId });
			if (!exists) throw new NotFoundException('DEPARTMENT_NOT_FOUND');
		}
		if (dto.positionId) {
			const exists = await this.positionModel.exists({ _id: dto.positionId, organizationId });
			if (!exists) throw new NotFoundException('POSITION_NOT_FOUND');
		}
		if (dto.directManagerId) {
			const exists = await this.userModel.exists({ _id: dto.directManagerId, organizationId });
			if (!exists) throw new NotFoundException('MANAGER_NOT_FOUND');
		}
	}
}

/**
 * EmployeeProfile fields the shared `AccountInput` shape doesn't name — seeded so
 * provisioning writes exactly the columns the link path would, and neither can
 * gain a field the other lacks. `userId`/`email`/`fullName` are excluded: they are
 * owned by the account half (or the whole point of this branch).
 */
const EXTRA_PROFILE_FIELDS = [
	'employmentType',
	'address',
	'citizenId',
	'taxCode',
	'socialInsuranceCode',
	'bankAccount',
	'workplaceId',
] as const;

function extraProfileFields(dto: CreateEmployeeProfileDto): Record<string, unknown> {
	const extras: Record<string, unknown> = {};
	for (const key of EXTRA_PROFILE_FIELDS) {
		if (dto[key] !== undefined) extras[key] = dto[key];
	}
	return extras;
}

/**
 * Turns a Mongo duplicate-key error into the tenant's business code. `keyPattern`
 * names the index that fired, so the two unique keys a single provisioning
 * transaction can trip (User.emailN and the profile's employeeCode/userId) each
 * get their own message instead of one generic conflict.
 */
function mapDuplicateKey(err: unknown): unknown {
	if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
		const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
		if (keyPattern?.emailN) return new ConflictException('EMAIL_TAKEN');
		if (keyPattern?.userId) return new ConflictException('EMPLOYEE_PROFILE_ALREADY_EXISTS');
		return new ConflictException('EMPLOYEE_CODE_TAKEN');
	}
	return err;
}
