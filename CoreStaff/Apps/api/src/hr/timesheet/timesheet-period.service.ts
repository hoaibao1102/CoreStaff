import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TimesheetPeriodDocument, TimesheetPeriodStatus, VALID_TRANSITIONS } from '../../database/schemas/timesheet-period.schema';
import { CreateTimesheetPeriodDto } from './dto/create-timesheet-period.dto';
import { ReopenTimesheetPeriodDto } from './dto/reopen-timesheet-period.dto';
import { TimesheetSummaryService } from './timesheet-summary.service';
import { PayrollSnapshotService } from './payroll-snapshot.service';
import { ManagerScopeService } from '../manager/manager-scope.service';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { AttendanceDayDocument } from '../../database/schemas/attendance-day.schema';
import { AttendanceEventDocument } from '../../database/schemas/attendance-event.schema';
import { ManagerRequestDocument } from '../../database/schemas/manager-request.schema';
import { classifyDayBlockers, summarizeBlockers, PeriodBlockerRow, PeriodBlockerType } from './period-blockers';

const DUPLICATE_KEY_ERROR = 11000;
const MIN_PERIOD_DAYS = 28;
const MAX_PERIOD_DAYS = 31;
const REASON_MIN_LENGTH = 10;

/**
 * Manager-facing projection for department snapshot review.
 * Payroll snapshots are deliberately ignored so salary, insurance, tax, and
 * family data never cross the manager API boundary.
 */
export function buildManagerSnapshotReview(
	summaries: any[],
	_payrollSnapshots?: any[],
): { summaries: any[] } {
	return {
		summaries: summaries.map((summary) => ({
			employeeProfileId: String(summary.employeeProfileId),
			departmentId: summary.departmentId ? String(summary.departmentId) : undefined,
			departmentName: summary.departmentName,
			employeeCode: summary.employeeCode,
			fullName: summary.fullName,
			standardWorkingDays: summary.workingDays ?? 0,
			actualWorkingDays: summary.presentDays ?? 0,
			absentDays: summary.absentDays ?? 0,
			incompleteDays: summary.incompleteDays ?? 0,
			paidLeaveDays: summary.paidLeaveDays ?? 0,
			unpaidLeaveDays: summary.unpaidLeaveDays ?? 0,
			totalWorkingMinutes: summary.totalWorkingMinutes ?? 0,
			totalLateMinutes: summary.totalLateMinutes ?? 0,
			totalEarlyMinutes: summary.totalEarlyMinutes ?? 0,
			otWorkingDayMinutes: summary.otWorkingDayMinutes ?? 0,
			otWeeklyOffMinutes: summary.otWeeklyOffMinutes ?? 0,
			otPublicHolidayMinutes: summary.otPublicHolidayMinutes ?? 0,
			totalOvertimeMinutes: summary.totalOvertimeMinutes ?? 0,
		})),
	};
}

@Injectable()
export class TimesheetPeriodService {
	constructor(
		@InjectModel('TimesheetPeriod') private readonly periodModel: Model<TimesheetPeriodDocument>,
		@InjectModel('Department') private readonly departmentModel: Model<DepartmentDocument>,
		@InjectModel('EmployeeProfile') private readonly employeeProfileModel: Model<EmployeeProfileDocument>,
		@InjectModel('PayrollInputSnapshot') private readonly snapshotModel: Model<any>,
		@InjectModel('PayrollRun') private readonly payrollRunModel: Model<any>,
		private readonly summaryService: TimesheetSummaryService,
		private readonly snapshotService: PayrollSnapshotService,
		private readonly managerScopeService: ManagerScopeService,
		@InjectModel('AttendanceDay') private readonly attendanceDayModel: Model<AttendanceDayDocument>,
		@InjectModel('AttendanceEvent') private readonly attendanceEventModel: Model<AttendanceEventDocument>,
		@InjectModel('ManagerRequest') private readonly managerRequestModel: Model<ManagerRequestDocument>,
	) {}

	/**
	 * Create a new timesheet period for an organization.
	 * Only one period per (organization, month) is allowed.
	 * Validates that the period has between 28-31 days (inclusive).
	 * Blocks creation if there's already an active (OPEN/REVIEWING/READY_TO_CLOSE) period.
	 * Blocks creation if the period is in the past or overlaps with existing periods.
	 */
	async create(organizationId: string, dto: CreateTimesheetPeriodDto): Promise<any> {
		// Validate day range (28-31 days)
		const diffDays = this.calculateDayRange(dto.startDate, dto.endDate);
		if (diffDays < MIN_PERIOD_DAYS || diffDays > MAX_PERIOD_DAYS) {
			throw new BadRequestException(`INVALID_DAY_RANGE: Period must have between ${MIN_PERIOD_DAYS} and ${MAX_PERIOD_DAYS} days (actual: ${diffDays} days)`);
		}

		// Validate not in past
		this.validateNotInPast(dto.startDate);

		const newStartDate = new Date(dto.startDate);
		const newEndDate = new Date(dto.endDate);

		// Check if there's already an active period (OPEN, REVIEWING, or READY_TO_CLOSE)
		const existingActivePeriod = await this.periodModel.findOne({
			organizationId,
			status: { $in: [
				TimesheetPeriodStatus.OPEN,
				TimesheetPeriodStatus.REVIEWING,
				TimesheetPeriodStatus.READY_TO_CLOSE,
			]},
			active: true,
		});

		if (existingActivePeriod) {
			throw new BadRequestException(
				`PERIOD_ALREADY_ACTIVE: Cannot create a new period when there is already an active period (${existingActivePeriod.period} - ${existingActivePeriod.status}). Please close or reopen the existing period first.`
			);
		}

		// Check for overlap with any closed periods
		const allClosedPeriods = await this.periodModel.find({
			organizationId,
			status: TimesheetPeriodStatus.CLOSED,
			active: true,
		});

		if (allClosedPeriods.length > 0) {
			dto.validateNoOverlap(
				newStartDate,
				newEndDate,
				allClosedPeriods.map(p => ({
					startDate: new Date(p.startDate),
					endDate: new Date(p.endDate),
					status: p.status,
				}))
			);
		}

		try {
			const doc = await this.periodModel.create({
				...dto,
				organizationId,
				status: TimesheetPeriodStatus.OPEN,
				startDate: newStartDate,
				endDate: newEndDate,
			});
			return this.toResponse(doc.toObject());
		} catch (err: any) {
			if (err.code === DUPLICATE_KEY_ERROR || (err.message && err.message.includes('duplicate key'))) {
				throw new ConflictException('PERIOD_ALREADY_EXISTS');
			}
			if (err instanceof BadRequestException) throw err;
			throw err;
		}
	}

	/**
	 * List all periods for an organization, optionally filtered by status.
	 */
	async findAll(organizationId: string, status?: TimesheetPeriodStatus): Promise<any[]> {
		const filter: Record<string, unknown> = { organizationId, active: true };
		if (status) filter.status = status;
		return this.periodModel.find(filter).sort({ period: -1 }).lean();
	}

	/**
	 * Get a single period by id with full details.
	 */
	async findOne(organizationId: string, id: string): Promise<any> {
		const doc = await this.periodModel.findOne({ _id: id, organizationId, active: true }).lean();
		if (!doc) throw new NotFoundException('PERIOD_NOT_FOUND');
		return this.toResponse(doc);
	}

	/**
	 * Get review statistics for a timesheet period.
	 * TASK-074 — blockers are computed for real; `blockers` keeps the
	 * `{type,message,count}` shape the review screen already renders.
	 */
	async getReviewStats(
		organizationId: string,
		id: string,
		opts: { userId?: string; role?: string } = {},
	): Promise<any> {
		const period = await this.findById(organizationId, id);

		const summaries = await this.summaryService.findByPeriod(id);
		const snapshots = await this.snapshotService.findByPeriod(id);

		const totalEmployees = await this.employeeProfileModel?.countDocuments({
			organizationId: new Types.ObjectId(organizationId),
			employmentStatus: { $in: ['ACTIVE', 'PROBATION'] },
		}).catch(() => 0) ?? 0;

		const summariesGenerated = summaries.length;
		const snapshotsCreated = snapshots.length;
		const attendanceComplete = totalEmployees > 0
			? Math.round((snapshotsCreated / totalEmployees) * 100)
			: 0;

		// Managers only see blockers for departments they manage.
		const scopedEmployeeIds = await this.resolveScopeEmployeeIds(organizationId, period, opts);
		const blockers = await this.collectBlockers(organizationId, id, scopedEmployeeIds);

		return {
			periodId: id,
			period: period.period,
			status: period.status,
			version: period.version,
			totalEmployees,
			summariesGenerated,
			snapshotsCreated,
			attendanceComplete,
			pendingApprovals: blockers.filter(
				(b) => b.type === 'PENDING_APPROVAL' || b.type === 'PENDING_CLARIFICATION',
			).length,
			missingSummaries: Math.max(0, totalEmployees - summariesGenerated),
			blockers: summarizeBlockers(blockers),
		};
	}

	/**
	 * TASK-074 — paged blocker list for the drill-down.
	 */
	async getBlockers(
		organizationId: string,
		id: string,
		opts: {
			userId?: string;
			role?: string;
			type?: PeriodBlockerType;
			departmentId?: string;
			page?: number;
			limit?: number;
		} = {},
	): Promise<{ total: number; page: number; limit: number; items: PeriodBlockerRow[]; summary: ReturnType<typeof summarizeBlockers> }> {
		const period = await this.findById(organizationId, id);

		const scopedEmployeeIds = await this.resolveScopeEmployeeIds(organizationId, period, opts);
		let rows = await this.collectBlockers(organizationId, id, scopedEmployeeIds);

		if (opts.type) rows = rows.filter((row) => row.type === opts.type);
		if (opts.departmentId) rows = rows.filter((row) => row.employee.departmentId === opts.departmentId);

		rows.sort((a, b) => (a.date === b.date ? a.employee.code?.localeCompare(b.employee.code ?? '') ?? 0 : a.date.localeCompare(b.date)));

		const page = Math.max(1, opts.page ?? 1);
		const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
		const start = (page - 1) * limit;

		return {
			total: rows.length,
			page,
			limit,
			items: rows.slice(start, start + limit),
			summary: summarizeBlockers(rows),
		};
	}

	/**
	 * TASK-074 — drill-down detail for one attendance day inside the period.
	 * Returns the day, its punch events, and the linked approval request so the
	 * reviewer can see why the day is blocked.
	 */
	async getDayDetail(
		organizationId: string,
		id: string,
		dayId: string,
		opts: { userId?: string; role?: string } = {},
	): Promise<{ day: any; events: any[]; request: any | null }> {
		const period = await this.findById(organizationId, id);

		if (!Types.ObjectId.isValid(dayId)) throw new NotFoundException('ATTENDANCE_DAY_NOT_FOUND');

		const day = await this.attendanceDayModel
			.findOne({ _id: dayId, organizationId: new Types.ObjectId(organizationId), periodId: new Types.ObjectId(id) })
			.lean();
		if (!day) throw new NotFoundException('ATTENDANCE_DAY_NOT_FOUND');

		// Managers may only open days of employees inside their scope. 404 rather
		// than 403 so the endpoint does not leak whether the day exists.
		const scopedEmployeeIds = await this.resolveScopeEmployeeIds(organizationId, period, opts);
		if (scopedEmployeeIds && !scopedEmployeeIds.has(String(day.employeeId))) {
			throw new NotFoundException('ATTENDANCE_DAY_NOT_FOUND');
		}

		const [events, request] = await Promise.all([
			this.attendanceEventModel
				.find({ organizationId: new Types.ObjectId(organizationId), attendanceDayId: new Types.ObjectId(dayId) })
				.sort({ recordedAt: 1 })
				.lean(),
			this.managerRequestModel
				.findOne({ organizationId: new Types.ObjectId(organizationId), attendanceDayId: new Types.ObjectId(dayId) })
				.sort({ createdAt: -1 })
				.lean(),
		]);

		return { day, events, request };
	}

	/**
	 * TASK-074 — load and classify every attendance day in the period.
	 * `employeeIds` narrows the result for department-scoped callers.
	 */
	private async collectBlockers(
		organizationId: string,
		periodId: string,
		employeeIds?: Set<string>,
	): Promise<PeriodBlockerRow[]> {
		const days = await this.attendanceDayModel
			.find({
				organizationId: new Types.ObjectId(organizationId),
				periodId: new Types.ObjectId(periodId),
			})
			.lean();

		const rows: PeriodBlockerRow[] = [];
		for (const day of days) {
			if (employeeIds && !employeeIds.has(String(day.employeeId))) continue;
			rows.push(...classifyDayBlockers(day as any));
		}

		await this.fillMissingIdentity(organizationId, days, rows);
		return rows;
	}

	/**
	 * `employeeSnapshot` is written by the seeder, not by the app — older rows
	 * carry no snapshot at all and most carry only `departmentId`. Resolve the
	 * display values once per request so the drill-down never renders '—' for
	 * a department that does exist.
	 */
	private async fillMissingIdentity(
		organizationId: string,
		days: any[],
		rows: PeriodBlockerRow[],
	): Promise<void> {
		const orgObjectId = new Types.ObjectId(organizationId);

		const departmentIds = new Set<string>();
		const employeeIds = new Set<string>();
		for (const row of rows) {
			if (!row.employee.department && row.employee.departmentId) departmentIds.add(row.employee.departmentId);
			if (!row.employee.name || !row.employee.code) employeeIds.add(row.employeeId);
		}
		if (!departmentIds.size && !employeeIds.size) return;

		const [departments, profiles] = await Promise.all([
			departmentIds.size
				? this.departmentModel
						.find({ organizationId: orgObjectId, _id: { $in: [...departmentIds].map((d) => new Types.ObjectId(d)) } })
						.select('_id name')
						.lean()
				: Promise.resolve([] as any[]),
			employeeIds.size
				? this.employeeProfileModel
						.find({ organizationId: orgObjectId, userId: { $in: [...employeeIds].map((e) => new Types.ObjectId(e)) } })
						.select('userId employeeCode fullName')
						.lean()
				: Promise.resolve([] as any[]),
		]);

		const departmentNames = new Map(departments.map((d: any) => [String(d._id), d.name]));
		const profileByUser = new Map(profiles.map((p: any) => [String(p.userId), p]));

		for (const row of rows) {
			if (!row.employee.department && row.employee.departmentId) {
				row.employee.department = departmentNames.get(row.employee.departmentId);
			}
			if (!row.employee.name || !row.employee.code) {
				const profile = profileByUser.get(row.employeeId);
				if (profile) {
					row.employee.name = row.employee.name ?? profile.fullName;
					row.employee.code = row.employee.code ?? profile.employeeCode;
				}
			}
		}
	}

	/**
	 * Resolve the employee ids a caller may see. HR sees the whole organization
	 * (returns undefined); a DEPARTMENT_MANAGER is narrowed to managed departments.
	 */
	private async resolveScopeEmployeeIds(
		organizationId: string,
		period: any,
		opts: { userId?: string; role?: string },
	): Promise<Set<string> | undefined> {
		if (opts.role !== 'DEPARTMENT_MANAGER' || !opts.userId) return undefined;

		const departmentIds = await this.managerScopeService.getManagedDepartmentIds(organizationId, opts.userId);
		if (!departmentIds.length) return new Set();

		const employeeIds = await this.managerScopeService.resolveEmployeeIdsForDepartments(
			organizationId,
			departmentIds,
			new Date(period.endDate),
		);
		return new Set(employeeIds);
	}

	/**
	 * Get the current open/reviewing period for an organization and month.
	 * Returns null if no such period exists.
	 */
	async findByPeriod(organizationId: string, period: string): Promise<any | null> {
		const doc = await this.periodModel.findOne({ organizationId, period, active: true }).lean();
		return doc ? this.toResponse(doc) : null;
	}

	/**
	 * Update period status — validates state machine transitions.
	 * Only HR can trigger status changes.
	 */
	async updateStatus(
		organizationId: string,
		id: string,
		newStatus: TimesheetPeriodStatus,
		userId: string,
	): Promise<any> {
		const period = await this.findById(organizationId, id);

		// Validate transition
		const statusKey = period.status as TimesheetPeriodStatus;
		const allowed = VALID_TRANSITIONS[statusKey];
		if (!allowed?.includes(newStatus)) {
			throw new BadRequestException(
				`INVALID_TRANSITION: Cannot transition from ${period.status} to ${newStatus}`,
			);
		}

		const patch: Record<string, unknown> = { status: newStatus };

		// Track close metadata
		if (newStatus === TimesheetPeriodStatus.CLOSED) {
			patch.closedBy = userId;
			patch.closedAt = new Date();
		}

		const doc = await this.periodModel.findByIdAndUpdate(
			id,
			{ $set: patch },
			{ new: true, runValidators: true },
		).lean();

		if (!doc) throw new NotFoundException('PERIOD_NOT_FOUND');
		return this.toResponse(doc);
	}

	/**
	 * Manager closes snapshot for a specific department.
	 * Generates TimesheetSummary + PayrollInputSnapshot for employees in that department.
	 * Allowed when period is OPEN or REVIEWING. When all departments have closed,
	 * the period automatically transitions to READY_TO_CLOSE.
	 */
	async managerCloseSnapshot(
		organizationId: string,
		id: string,
		managerUserId: string,
		departmentId: string,
	): Promise<{
		period: any;
		departmentId: string;
		departmentName: string | null;
		employeesInSnapshot: number;
		totalDepartmentEmployees: number;
		summariesCreated: number;
		snapshotsCreated: number;
	}> {
		const period = await this.findById(organizationId, id);

		if (
			period.status !== TimesheetPeriodStatus.OPEN &&
			period.status !== TimesheetPeriodStatus.REVIEWING
		) {
			throw new BadRequestException(
				`CANNOT_CLOSE_SNAPSHOT: Period must be in OPEN or REVIEWING status (current: ${period.status})`,
			);
		}

		// Verify manager has scope over this department
		const managedDepartments = await this.managerScopeService.getManagedDepartmentIds(organizationId, managerUserId);
		if (!managedDepartments.includes(departmentId)) {
			throw new ForbiddenException('DEPARTMENT_SCOPE_VIOLATION');
		}

		// Check if department already closed snapshot
		const existing = period.departmentSnapshots?.find((d: any) => String(d.departmentId) === departmentId);
		if (existing) {
			throw new BadRequestException('DEPARTMENT_SNAPSHOT_ALREADY_CLOSED');
		}

		// Resolve the employees that belong to this department for reporting
		const departmentEmployeeIds = await this.managerScopeService.resolveEmployeeIdsForDepartments(
			organizationId,
			[departmentId],
			new Date(period.endDate),
		);

		const session = await this.periodModel.db.startSession();
		let summariesCreated = 0;
		let snapshotsCreated = 0;

		try {
			await session.withTransaction(async () => {
				// TASK-074 / FR-HR-04 — a department cannot close its snapshot while
				// its own days still have blockers.
				const blockers = await this.collectBlockers(
					organizationId,
					id,
					new Set(departmentEmployeeIds),
				);
				if (blockers.length) throw new ConflictException('BLOCKERS_REMAIN');

				// Generate summaries and snapshots for this department only
				summariesCreated = await this.summaryService.generateSummariesForDepartment(
					id,
					period.period,
					organizationId,
					departmentId,
					session,
				);

				snapshotsCreated = await this.snapshotService.generateSnapshotsForDepartment(
					id,
					period.period,
					organizationId,
					departmentId,
					session,
				);

				// Add department to closed snapshots
				await this.periodModel.findByIdAndUpdate(
					id,
					{
						$push: {
							departmentSnapshots: {
								departmentId,
								managerUserId,
								closedAt: new Date(),
							},
						},
					},
					{ session },
				);

				// Check if all departments are now closed
				const allDepartments = await this.getAllDepartmentIds(organizationId);
				const updatedPeriod = await this.periodModel.findById(id).session(session).lean();
				const closedDepartmentIds = new Set((updatedPeriod?.departmentSnapshots || []).map((d: any) => String(d.departmentId)));
				const allClosed = allDepartments.every(deptId => closedDepartmentIds.has(deptId));

				if (allClosed) {
					await this.periodModel.findByIdAndUpdate(
						id,
						{
							$set: {
								status: TimesheetPeriodStatus.READY_TO_CLOSE,
								managerSnapshotClosed: true,
								managerSnapshotClosedBy: managerUserId,
								managerSnapshotClosedAt: new Date(),
							},
						},
						{ session },
					);
				}
			});
		} catch (error) {
			// Re-throw so the controller can return a meaningful error instead of swallowing it
			console.error('[managerCloseSnapshot] Transaction failed:', error);
			throw error;
		} finally {
			await session.endSession();
		}

		const finalPeriod = await this.periodModel.findOne({ _id: id, organizationId }).lean();
		const department = await this.departmentModel.findById(departmentId).lean();

		return {
			period: this.toResponse(finalPeriod),
			departmentId,
			departmentName: department?.name ?? null,
			employeesInSnapshot: summariesCreated,
			totalDepartmentEmployees: departmentEmployeeIds.length,
			summariesCreated,
			snapshotsCreated,
		};
	}

	/**
	 * HR closes a timesheet period after all manager snapshots are closed.
	 */
	async hrClosePeriod(
		organizationId: string,
		id: string,
		userId: string,
	): Promise<{ period: any }> {
		const period = await this.findById(organizationId, id);

		if (period.status !== TimesheetPeriodStatus.READY_TO_CLOSE) {
			throw new BadRequestException(
				`CANNOT_CLOSE_PERIOD: Period must be in READY_TO_CLOSE status (current: ${period.status})`,
			);
		}

		// ponytail: manager-snapshot flow is intentionally optional; HR can close the period directly.

		// TASK-074 / FR-HR-04 — re-verify blockers inside the transaction; never
		// trust a frontend check.
		const session = await this.periodModel.db.startSession();
		let doc: any;
		try {
			await session.withTransaction(async () => {
				const blockers = await this.collectBlockers(organizationId, id);
				if (blockers.length) throw new ConflictException('BLOCKERS_REMAIN');

				doc = await this.periodModel.findByIdAndUpdate(
					id,
					{
						$set: {
							status: TimesheetPeriodStatus.CLOSED,
							closedBy: userId,
							closedAt: new Date(),
						},
					},
					{ new: true, runValidators: true, session },
				).lean();

				if (!doc) throw new NotFoundException('PERIOD_NOT_FOUND');
			});
		} finally {
			await session.endSession();
		}

		return { period: this.toResponse(doc) };
	}

	/**
	 * Reopen a closed period — increments version and requires a reason.
	 */
	async reopen(
		organizationId: string,
		id: string,
		dto: ReopenTimesheetPeriodDto,
		userId: string,
	): Promise<any> {
		if (!dto.reason || dto.reason.length < REASON_MIN_LENGTH) {
			throw new BadRequestException('REASON_TOO_SHORT');
		}

		const period = await this.findById(organizationId, id);

		// Can only reopen CLOSED periods
		if (period.status !== TimesheetPeriodStatus.CLOSED) {
			throw new BadRequestException('CANNOT_REOPEN_NON_CLOSED');
		}

		const session = await this.periodModel.db.startSession();
		let updated: any;
		try {
			await session.withTransaction(async () => {
				// Increment version
				// Invalidate confirmations (handled by TASK-076 caller)
				// Mark snapshots STALE (handled by TASK-083 caller)

				const doc = await this.periodModel.findByIdAndUpdate(
					id,
					{
						$inc: { version: 1 },
						$set: {
							status: TimesheetPeriodStatus.REVIEWING,
							reopenReason: dto.reason,
							reopenedBy: userId,
							reopenedAt: new Date(),
							managerSnapshotClosed: false,
							managerSnapshotClosedBy: undefined,
							managerSnapshotClosedAt: undefined,
							departmentSnapshots: [],
						},
					},
					{ new: true, runValidators: true, session },
				).lean();

				if (!doc) throw new NotFoundException('PERIOD_NOT_FOUND');

				await this.snapshotModel.updateMany(
					{ organizationId: new Types.ObjectId(organizationId), periodId: new Types.ObjectId(id) },
					{ $set: { status: 'STALE' } },
					{ session },
				);
				await this.payrollRunModel.updateMany(
					{ organizationId: new Types.ObjectId(organizationId), timesheetPeriodId: new Types.ObjectId(id), active: true },
					{ $set: { status: 'STALE' } },
					{ session },
				);
				updated = doc;
			});
		} finally {
			await session.endSession();
		}

		return this.toResponse(updated);
	}

	/**
	 * Preview the snapshot data for a department before closing.
	 * Returns only work data required for manager review. Payroll inputs are
	 * generated only during close and are never exposed to department managers.
	 */
	async previewManagerSnapshot(
		organizationId: string,
		id: string,
		managerUserId: string,
		departmentId: string,
	): Promise<{ summaries: any[] }> {
		const period = await this.findById(organizationId, id);

		if (
			period.status !== TimesheetPeriodStatus.OPEN &&
			period.status !== TimesheetPeriodStatus.REVIEWING
		) {
			throw new BadRequestException(
				`CANNOT_PREVIEW_SNAPSHOT: Period must be in OPEN or REVIEWING status (current: ${period.status})`,
			);
		}

		// Verify manager has scope over this department
		const managedDepartments = await this.managerScopeService.getManagedDepartmentIds(organizationId, managerUserId);
		if (!managedDepartments.includes(departmentId)) {
			throw new ForbiddenException('DEPARTMENT_SCOPE_VIOLATION');
		}

		// Generate department work summaries on-the-fly.
		const summaries = await this.summaryService.previewSummariesForDepartment(
			id,
			period.period,
			organizationId,
			departmentId,
		);

		return buildManagerSnapshotReview(summaries);
	}

	/**
	 * Helper: get all active department ids for an organization.
	 */
	private async getAllDepartmentIds(organizationId: string): Promise<string[]> {
		const departments = await this.departmentModel
			.find({ organizationId, active: true })
			.select('_id')
			.lean();
		return departments.map(d => String(d._id));
	}

	/**
	 * Helper: find by id with tenant check.
	 */
	private async findById(organizationId: string, id: string): Promise<any> {
		const doc = await this.periodModel.findOne({ _id: id, organizationId, active: true }).lean();
		if (!doc) throw new NotFoundException('PERIOD_NOT_FOUND');
		return this.toResponse(doc);
	}

	/**
	 * Format response — strip internal fields.
	 */
	private toResponse(doc: any): any {
		return {
			_id: doc._id,
			organizationId: doc.organizationId,
			period: doc.period,
			status: doc.status,
			version: doc.version,
			startDate: doc.startDate,
			endDate: doc.endDate,
			managerSnapshotClosed: doc.managerSnapshotClosed,
			managerSnapshotClosedBy: doc.managerSnapshotClosedBy,
			managerSnapshotClosedAt: doc.managerSnapshotClosedAt,
			departmentSnapshots: doc.departmentSnapshots,
			closedBy: doc.closedBy,
			closedAt: doc.closedAt,
			reopenReason: doc.reopenReason,
			reopenedBy: doc.reopenedBy,
			reopenedAt: doc.reopenedAt,
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
		};
	}

	private calculateDayRange(startDate: string, endDate: string): number {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const diffTime = Math.abs(end.getTime() - start.getTime());
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
	}

	private validateNotInPast(startDate: string): void {
		const start = new Date(startDate);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		if (start < today) {
			throw new BadRequestException('PERIOD_IN_PAST: Period start date cannot be in the past');
		}
	}
}

function mapDuplicateKey(err: unknown): unknown {
	if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
		return new ConflictException('PERIOD_ALREADY_EXISTS');
	}
	return err;
}

