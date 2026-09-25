import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { AttendanceDayDocument } from '../../database/schemas/attendance-day.schema';
import { EmployeeAssignmentDocument } from '../../database/schemas/assignment.schema';
import { EmployeeDayOverrideDocument } from '../../database/schemas/employee-day-override.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { LeaveActionDocument } from '../../database/schemas/leave-action.schema';
import { LeaveRequestDocument } from '../../database/schemas/leave-request.schema';
import { LeaveRequestStatus, WorkdayType } from '../../database/schemas/enums';
import { ManagerScopeService } from '../manager/manager-scope.service';
import { dateOnly, enumerateDates } from '../../common/date-only';
import { CreateLeaveRequestDto, LeaveRequestQueryDto } from './dto/leave.dto';

const ACTIVE_LEAVE_STATUSES = [LeaveRequestStatus.PENDING_MANAGER, LeaveRequestStatus.APPROVED, LeaveRequestStatus.HR_APPLIED];

@Injectable()
export class LeaveService {
  constructor(
    @InjectModel('LeaveRequest') private readonly requests: Model<LeaveRequestDocument>,
    @InjectModel('EmployeeDayOverride') private readonly overrides: Model<EmployeeDayOverrideDocument>,
    @InjectModel('LeaveAction') private readonly actions: Model<LeaveActionDocument>,
    @InjectModel('EmployeeProfile') private readonly employees: Model<EmployeeProfileDocument>,
    @InjectModel('Assignment') private readonly assignments: Model<EmployeeAssignmentDocument>,
    @InjectModel('AttendanceDay') private readonly attendanceDays: Model<AttendanceDayDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly managerScope: ManagerScopeService,
  ) {}

  async create(org: string, employeeId: string, dto: CreateLeaveRequestDto) {
    const startDate = dateOnly(dto.startDate);
    const endDate = dateOnly(dto.endDate);
    if (endDate < startDate) throw new BadRequestException('LEAVE_DATE_RANGE_INVALID');
    if (enumerateDates(startDate, endDate).length > 366) throw new BadRequestException('LEAVE_RANGE_TOO_LARGE');

    const [profile, assignment] = await Promise.all([
      this.employees.findOne({ organizationId: org, userId: employeeId }).lean(),
      this.assignments.findOne({ organizationId: org, userId: employeeId, active: true, effectiveFrom: { $lte: startDate }, $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: startDate } }] }).sort({ effectiveFrom: -1 }).lean(),
    ]);
    if (!profile) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');
    const departmentId = assignment?.departmentId ?? profile.departmentId;
    if (!departmentId) throw new ConflictException('EMPLOYEE_DEPARTMENT_REQUIRED');

    const overlap = await this.requests.exists({
      organizationId: org, employeeId, status: { $in: ACTIVE_LEAVE_STATUSES },
      startDate: { $lte: endDate }, endDate: { $gte: startDate },
    });
    if (overlap) throw new ConflictException('LEAVE_REQUEST_OVERLAP');

    const row = await this.requests.create({ ...dto, reason: dto.reason.trim(), startDate, endDate, organizationId: org, employeeId, departmentId, status: LeaveRequestStatus.PENDING_MANAGER });
    await this.actions.create({ organizationId: org, leaveRequestId: row._id, actorId: employeeId, action: 'SUBMIT', previousStatus: 'NONE', newStatus: LeaveRequestStatus.PENDING_MANAGER });
    return row.toObject();
  }

  async mine(org: string, employeeId: string) {
    return this.requests.find({ organizationId: org, employeeId }).sort({ createdAt: -1 }).lean();
  }

  async getMine(org: string, employeeId: string, id: string) {
    const row = await this.requests.findOne({ _id: id, organizationId: org, employeeId }).lean();
    if (!row) throw new NotFoundException('LEAVE_REQUEST_NOT_FOUND');
    return row;
  }

  async managerQueue(org: string, managerId: string, query: LeaveRequestQueryDto) {
    const departmentIds = await this.managerScope.getManagedDepartmentIds(org, managerId);
    const filter: Record<string, unknown> = { organizationId: org, departmentId: { $in: departmentIds } };
    if (query.status) filter.status = query.status;
    if (query.employeeId) filter.employeeId = query.employeeId;
    if (query.departmentId) {
      await this.managerScope.requireDepartment(org, managerId, query.departmentId);
      filter.departmentId = query.departmentId;
    }
    return this.requests.find(filter).sort({ createdAt: -1 }).lean();
  }

  async managerDecision(org: string, managerId: string, id: string, approve: boolean, comment?: string) {
    const old = await this.requests.findOne({ _id: id, organizationId: org }).lean();
    if (!old) throw new NotFoundException('LEAVE_REQUEST_NOT_FOUND');
    await this.managerScope.requireDepartment(org, managerId, String(old.departmentId));
    if (String(old.employeeId) === managerId) throw new ForbiddenException('LEAVE_SELF_APPROVAL_FORBIDDEN');
    if (old.status !== LeaveRequestStatus.PENDING_MANAGER) throw new ConflictException('LEAVE_REQUEST_NOT_PENDING');
    if (!approve && (!comment || comment.trim().length < 3)) throw new BadRequestException('LEAVE_REJECTION_REASON_REQUIRED');
    const next = approve ? LeaveRequestStatus.APPROVED : LeaveRequestStatus.REJECTED;
    const row = await this.requests.findOneAndUpdate(
      { _id: id, organizationId: org, status: LeaveRequestStatus.PENDING_MANAGER },
      { $set: { status: next, reviewedBy: managerId, reviewedAt: new Date(), reviewComment: comment?.trim() } },
      { new: true },
    ).lean();
    if (!row) throw new ConflictException('LEAVE_REQUEST_ALREADY_DECIDED');
    await this.actions.create({ organizationId: org, leaveRequestId: id, actorId: managerId, action: approve ? 'APPROVE' : 'REJECT', previousStatus: old.status, newStatus: next, comment: comment?.trim() });
    return row;
  }

  async hrQueue(org: string, query: LeaveRequestQueryDto) {
    const filter: Record<string, unknown> = { organizationId: org };
    if (query.status) filter.status = query.status;
    if (query.employeeId) filter.employeeId = query.employeeId;
    if (query.departmentId) filter.departmentId = query.departmentId;
    return this.requests.find(filter).sort({ createdAt: -1 }).lean();
  }

  async apply(org: string, hrId: string, id: string) {
    const session = await this.connection.startSession();
    let applied: unknown;
    try {
      await session.withTransaction(async () => {
        const old = await this.requests.findOne({ _id: id, organizationId: org }).session(session).lean();
        if (!old) throw new NotFoundException('LEAVE_REQUEST_NOT_FOUND');
        if (String(old.employeeId) === hrId) throw new ForbiddenException('LEAVE_SELF_APPLY_FORBIDDEN');
        if (old.status !== LeaveRequestStatus.APPROVED) throw new ConflictException('LEAVE_REQUEST_NOT_APPROVED');
        const dates = enumerateDates(old.startDate, old.endDate);
        const conflicts = await this.overrides.find({ organizationId: org, employeeId: old.employeeId, date: { $in: dates }, leaveRequestId: { $ne: old._id } }).session(session).lean();
        if (conflicts.length) throw new ConflictException('LEAVE_DAY_ALREADY_OVERRIDDEN');

        await this.overrides.bulkWrite(dates.map((date) => ({ updateOne: {
          filter: { organizationId: org, employeeId: old.employeeId, date },
          update: { $setOnInsert: { organizationId: org, employeeId: old.employeeId, date, type: old.leaveType, leaveRequestId: old._id, reason: old.reason, createdBy: hrId } },
          upsert: true,
        } })) as never, { session, ordered: true });

        await this.attendanceDays.updateMany(
          { organizationId: org, employeeId: old.employeeId, workDate: { $in: dates } },
          { $set: { workdayType: old.leaveType as WorkdayType }, $unset: { dayResult: 1 } },
          { session },
        );
        const row = await this.requests.findOneAndUpdate(
          { _id: id, organizationId: org, status: LeaveRequestStatus.APPROVED },
          { $set: { status: LeaveRequestStatus.HR_APPLIED, appliedBy: hrId, appliedAt: new Date() } },
          { new: true, session },
        ).lean();
        if (!row) throw new ConflictException('LEAVE_REQUEST_ALREADY_APPLIED');
        await this.actions.create([{ organizationId: org, leaveRequestId: id, actorId: hrId, action: 'APPLY', previousStatus: old.status, newStatus: LeaveRequestStatus.HR_APPLIED, beforeData: { status: old.status }, afterData: { status: LeaveRequestStatus.HR_APPLIED, dates } }], { session });
        applied = row;
      });
      return applied;
    } finally { await session.endSession(); }
  }

  async listOverrides(org: string, employeeId?: string, from?: string, to?: string) {
    const filter: Record<string, unknown> = { organizationId: org };
    if (employeeId) filter.employeeId = employeeId;
    if (from || to) filter.date = { ...(from ? { $gte: dateOnly(from) } : {}), ...(to ? { $lte: dateOnly(to) } : {}) };
    return this.overrides.find(filter).sort({ date: 1 }).lean();
  }
}
