import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { PositionDocument } from '../../database/schemas/position.schema';
import { UserDocument } from '../../database/schemas/user.schema';
import { EmployeeProfile, EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { EmploymentHistoryDocument } from '../../database/schemas/employment-history.schema';
import { EMPLOYMENT_STATUS_TRANSITIONS, EmploymentStatus } from '../../database/schemas/enums';
import { CreateEmployeeProfileDto } from './dto/create-employee-profile.dto';
import { UpdateEmployeeProfileDto } from './dto/update-employee-profile.dto';
import { UpdateEmploymentStatusDto } from './dto/update-employment-status.dto';

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

	async create(organizationId: string, dto: CreateEmployeeProfileDto) {
		await this.assertUserAvailable(organizationId, dto.userId);
		await this.assertRefsInTenant(organizationId, dto);

		try {
			const doc = await this.profileModel.create({
				...dto,
				organizationId,
				employmentStatus: EmploymentStatus.PROBATION,
			});
			return doc.toObject();
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

function mapDuplicateKey(err: unknown): unknown {
	if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
		return new ConflictException('EMPLOYEE_CODE_TAKEN');
	}
	return err;
}
