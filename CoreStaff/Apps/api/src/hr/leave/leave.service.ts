import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { AttendanceDayDocument } from '../../database/schemas/attendance-day.schema';
import { CalendarExceptionDocument } from '../../database/schemas/calendar-exception.schema';
import { EmployeeAssignmentDocument } from '../../database/schemas/assignment.schema';
import { EmployeeDayOverrideDocument } from '../../database/schemas/employee-day-override.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { LeaveActionDocument } from '../../database/schemas/leave-action.schema';
import { LeaveRequestDocument } from '../../database/schemas/leave-request.schema';
import { CalendarExceptionType, LeaveDurationType, LeaveRequestStatus, WorkdayType } from '../../database/schemas/enums';
import { ManagerScopeService } from '../manager/manager-scope.service';
import { PeriodVersionService } from '../timesheet/period-version.service';
import { dateOnly, enumerateDates } from '../../common/date-only';
import { CreateLeaveRequestDto, LeaveRequestQueryDto, PreviewLeaveRequestDto } from './dto/leave.dto';
import { EventsGateway } from '../../events/events.gateway';
import { ShiftResolverService } from '../shift-template/shift-resolver.service';
import { calculateAttendance } from '../../attendance/services/attendance-calculator.service';

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
    @InjectModel('CalendarException') private readonly calendar: Model<CalendarExceptionDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly managerScope: ManagerScopeService,
    private readonly periodVersion: PeriodVersionService,
    private readonly shiftResolver: ShiftResolverService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  async preview(org: string, employeeId: string, dto: PreviewLeaveRequestDto) {
    const startDate = dateOnly(dto.startDate);
    const endDate = dateOnly(dto.endDate);
    if (endDate < startDate) throw new BadRequestException('LEAVE_DATE_RANGE_INVALID');
    const dates = enumerateDates(startDate, endDate);
    if (dates.length > 366) throw new BadRequestException('LEAVE_RANGE_TOO_LARGE');
    if (dto.durationType !== LeaveDurationType.FULL_DAY && dates.length !== 1) {
      throw new BadRequestException('PARTIAL_LEAVE_SINGLE_DAY_REQUIRED');
    }
    const days: Array<ReturnType<typeof calculateLeaveDay>> = [];
    for (const date of dates) {
      const [shift, exception] = await Promise.all([
        this.shiftResolver.resolveForEmployeeDate(org, employeeId, date),
        this.calendar.findOne({ organizationId: org, date }).lean(),
      ]);
      const nonWorkingException = exception?.type === CalendarExceptionType.PUBLIC_HOLIDAY || exception?.type === CalendarExceptionType.WEEKLY_OFF;
      if (nonWorkingException) {
        if (dto.durationType !== LeaveDurationType.FULL_DAY) throw new BadRequestException('LEAVE_NON_WORKING_DAY');
        continue;
      }
      if (!shift) {
        if (dto.durationType !== LeaveDurationType.FULL_DAY) throw new BadRequestException('LEAVE_WORK_SCHEDULE_REQUIRED');
        continue;
      }
      days.push(calculateLeaveDay(date, shift.startTime, shift.endTime, shift.breakMinutes, dto.durationType, dto.requestedStart, dto.requestedEnd, shift.breakStartTime, shift.breakEndTime));
    }
    if (!days.length) throw new BadRequestException('LEAVE_WORK_SCHEDULE_REQUIRED');
    return {
      durationType: dto.durationType,
      requestedStart: days.length === 1 ? days[0].requestedStart : undefined,
      requestedEnd: days.length === 1 ? days[0].requestedEnd : undefined,
      calculatedMinutes: days.reduce((sum, day) => sum + day.calculatedMinutes, 0),
      leaveEquivalent: days.reduce((sum, day) => sum + day.leaveEquivalent, 0),
      days,
    };
  }

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

    const durationType = dto.durationType ?? LeaveDurationType.FULL_DAY;
    const calculation = await this.preview(org, employeeId, { startDate, endDate, durationType, requestedStart: dto.requestedStart, requestedEnd: dto.requestedEnd });

    const overlapCandidates = await this.requests.find({
      organizationId: org, employeeId, status: { $in: ACTIVE_LEAVE_STATUSES },
      startDate: { $lte: endDate }, endDate: { $gte: startDate },
    }).lean();
    const overlap = overlapCandidates.some(existing => {
      if (durationType === LeaveDurationType.FULL_DAY || !existing.durationType || existing.durationType === LeaveDurationType.FULL_DAY) return true;
      if (existing.startDate !== startDate || existing.endDate !== endDate) return true;
      return leaveIntervalsOverlap(calculation.requestedStart, calculation.requestedEnd, existing.requestedStart, existing.requestedEnd);
    });
    if (overlap) throw new ConflictException('LEAVE_REQUEST_OVERLAP');

    const row = await this.requests.create({ ...dto, durationType, requestedStart: calculation.requestedStart, requestedEnd: calculation.requestedEnd, calculatedMinutes: calculation.calculatedMinutes, leaveEquivalent: calculation.leaveEquivalent, approvedLeaveIntervals: calculation.days[0]?.approvedLeaveIntervals, requiredWorkingIntervals: calculation.days[0]?.requiredWorkingIntervals, reason: dto.reason.trim(), startDate, endDate, organizationId: org, employeeId, departmentId, status: LeaveRequestStatus.PENDING_MANAGER });
    await this.actions.create({ organizationId: org, leaveRequestId: row._id, actorId: employeeId, action: 'SUBMIT', previousStatus: 'NONE', newStatus: LeaveRequestStatus.PENDING_MANAGER });
    this.eventsGateway?.notifyLeaveCreated(org, departmentId, {
      requestId: String(row._id), employeeUserId: employeeId, departmentId: String(departmentId),
      startDate, endDate, leaveType: row.leaveType, status: row.status,
    });
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

  async cancelMine(org: string, employeeId: string, id: string) {
    const session = await this.connection.startSession();
    try {
      let cancelled: unknown;
      await session.withTransaction(async () => {
        const old = await this.requests.findOne({ _id: id, organizationId: org, employeeId }).session(session).lean();
        if (!old) throw new NotFoundException('LEAVE_REQUEST_NOT_FOUND');
        if (old.status !== LeaveRequestStatus.PENDING_MANAGER) throw new ConflictException('LEAVE_REQUEST_CANNOT_CANCEL');
        const row = await this.requests.findOneAndUpdate(
          { _id: id, organizationId: org, employeeId, status: LeaveRequestStatus.PENDING_MANAGER },
          { $set: { status: LeaveRequestStatus.CANCELLED } },
          { new: true, session },
        ).lean();
        if (!row) throw new ConflictException('LEAVE_REQUEST_ALREADY_DECIDED');
        await this.actions.create([{ organizationId: org, leaveRequestId: id, actorId: employeeId, action: 'CANCEL', previousStatus: old.status, newStatus: LeaveRequestStatus.CANCELLED }], { session });
        cancelled = row;
      });
      return cancelled;
    } finally {
      await session.endSession();
    }
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
    if (!approve && (!comment || comment.trim().length < 3)) throw new BadRequestException('LEAVE_REJECTION_REASON_REQUIRED');
    const session = await this.connection.startSession();
    const next = approve ? LeaveRequestStatus.APPROVED : LeaveRequestStatus.REJECTED;
    let decided: unknown;
    let employeeId = '';
    let departmentId = '';
    try {
      await session.withTransaction(async () => {
        const old = await this.requests.findOne({ _id: id, organizationId: org }).session(session).lean();
        if (!old) throw new NotFoundException('LEAVE_REQUEST_NOT_FOUND');
        await this.managerScope.requireDepartment(org, managerId, String(old.departmentId));
        if (String(old.employeeId) === managerId) throw new ForbiddenException('LEAVE_SELF_APPROVAL_FORBIDDEN');
        if (old.status !== LeaveRequestStatus.PENDING_MANAGER) throw new ConflictException('LEAVE_REQUEST_NOT_PENDING');

        const reviewedAt = new Date();
        const row = await this.requests.findOneAndUpdate(
          { _id: id, organizationId: org, status: LeaveRequestStatus.PENDING_MANAGER },
          { $set: { status: next, reviewedBy: managerId, reviewedAt, reviewComment: comment?.trim() } },
          { new: true, session },
        ).lean();
        if (!row) throw new ConflictException('LEAVE_REQUEST_ALREADY_DECIDED');
        await this.actions.create([{
          organizationId: org,
          leaveRequestId: id,
          actorId: managerId,
          action: approve ? 'APPROVE' : 'REJECT',
          previousStatus: old.status,
          newStatus: next,
          comment: comment?.trim(),
          beforeData: { status: old.status },
          afterData: { status: next, reviewedBy: managerId, reviewedAt },
        }], { session });
        decided = row;
        employeeId = String(old.employeeId);
        departmentId = String(old.departmentId);
      });
      this.eventsGateway?.notifyLeaveChanged(employeeId, org, departmentId, {
        requestId: id, employeeUserId: employeeId, departmentId, status: next,
      });
      return decided;
    } finally {
      await session.endSession();
    }
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
        const hasConflict = conflicts.some(existing => {
          if (!old.durationType || old.durationType === LeaveDurationType.FULL_DAY || !existing.durationType || existing.durationType === LeaveDurationType.FULL_DAY) return true;
          return leaveIntervalsOverlap(old.requestedStart, old.requestedEnd, existing.requestedStart, existing.requestedEnd);
        });
        if (hasConflict) throw new ConflictException('LEAVE_DAY_ALREADY_OVERRIDDEN');

        await this.overrides.bulkWrite(dates.map((date) => ({ updateOne: {
          filter: { organizationId: org, employeeId: old.employeeId, date, leaveRequestId: old._id },
          update: { $setOnInsert: { organizationId: org, employeeId: old.employeeId, date, type: old.leaveType, durationType: old.durationType ?? LeaveDurationType.FULL_DAY, requestedStart: old.requestedStart, requestedEnd: old.requestedEnd, calculatedMinutes: old.calculatedMinutes, leaveEquivalent: old.leaveEquivalent, approvedLeaveIntervals: old.approvedLeaveIntervals, requiredWorkingIntervals: old.requiredWorkingIntervals, leaveRequestId: old._id, reason: old.reason, createdBy: hrId } },
          upsert: true,
        } })) as never, { session, ordered: true });

        const recordedDays = await this.attendanceDays.find({ organizationId: org, employeeId: old.employeeId, workDate: { $in: dates } }).session(session).lean();
        for (const attendanceDay of recordedDays) {
          if (!attendanceDay.checkInAt || !attendanceDay.shiftSnapshot?.startTime || !attendanceDay.shiftSnapshot?.endTime) continue;
          const dateOverrides = await this.overrides.find({ organizationId: org, employeeId: old.employeeId, date: attendanceDay.workDate }).session(session).lean();
          const requiredSets = dateOverrides.map(item => item.requiredWorkingIntervals ?? []);
          const requiredWorkingIntervals = requiredSets.length ? requiredSets.reduce((current, next) => intersectLeaveIntervals(current, next)) : undefined;
          const approvedLeaveIntervals = dateOverrides.flatMap(item => item.approvedLeaveIntervals ?? []);
          const calculation = calculateAttendance(attendanceDay.workDate, new Date(attendanceDay.checkInAt), attendanceDay.checkOutAt ? new Date(attendanceDay.checkOutAt) : undefined, {
            startTime: attendanceDay.shiftSnapshot.startTime,
            endTime: attendanceDay.shiftSnapshot.endTime,
            breakMinutes: attendanceDay.shiftSnapshot.breakMinutes ?? 0,
            gracePeriodMinutes: attendanceDay.shiftSnapshot.gracePeriodMinutes ?? 0,
            requiredWorkingIntervals,
            approvedLeaveIntervals,
          });
          await this.attendanceDays.updateOne({ _id: attendanceDay._id, organizationId: org }, { $set: {
            lateMinutes: calculation.lateMinutes,
            earlyMinutes: calculation.earlyMinutes,
            ...(calculation.workingMinutes !== null ? { workingMinutes: calculation.workingMinutes } : {}),
            approvedLeaveMinutes: calculation.approvedLeaveMinutes,
            requiredWorkingMinutes: calculation.requiredWorkingMinutes,
            effectiveCheckInTime: calculation.effectiveCheckInTime,
            effectiveCheckOutTime: calculation.effectiveCheckOutTime,
            'shiftSnapshot.requiredWorkingIntervals': requiredWorkingIntervals,
            'shiftSnapshot.approvedLeaveIntervals': approvedLeaveIntervals,
          } }, { session });
        }

        if (!old.durationType || old.durationType === LeaveDurationType.FULL_DAY) {
          await this.attendanceDays.updateMany(
            { organizationId: org, employeeId: old.employeeId, workDate: { $in: dates } },
            { $set: { workdayType: old.leaveType as WorkdayType }, $unset: { dayResult: 1 } },
            { session },
          );
        }
        // TASK-073 — applying leave changes in-period data: bump version + drop old confirmations.
        await this.periodVersion.bumpForWorkDates(org, dates, session);
        const row = await this.requests.findOneAndUpdate(
          { _id: id, organizationId: org, status: LeaveRequestStatus.APPROVED },
          { $set: { status: LeaveRequestStatus.HR_APPLIED, appliedBy: hrId, appliedAt: new Date() } },
          { new: true, session },
        ).lean();
        if (!row) throw new ConflictException('LEAVE_REQUEST_ALREADY_APPLIED');
        await this.actions.create([{ organizationId: org, leaveRequestId: id, actorId: hrId, action: 'APPLY', previousStatus: old.status, newStatus: LeaveRequestStatus.HR_APPLIED, beforeData: { status: old.status }, afterData: { status: LeaveRequestStatus.HR_APPLIED, dates } }], { session });
        applied = row;
      });
      if (applied) {
        const row = applied as any;
        this.eventsGateway?.notifyLeaveChanged(row.employeeId, org, row.departmentId, {
          requestId: id, employeeUserId: String(row.employeeId), departmentId: String(row.departmentId), status: LeaveRequestStatus.HR_APPLIED,
        });
      }
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

function timeMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) throw new BadRequestException('LEAVE_WORK_SCHEDULE_INVALID');
  return hours * 60 + minutes;
}

function minuteTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function calculateLeaveDay(date: string, startTime: string, endTime: string, breakMinutes: number, durationType: LeaveDurationType, customStart?: string, customEnd?: string, configuredBreakStart?: string, configuredBreakEnd?: string) {
  const start = timeMinutes(startTime), end = timeMinutes(endTime);
  const gross = end - start;
  const rest = Math.max(0, breakMinutes ?? 0);
  const working = gross - rest;
  if (gross <= 0 || working <= 0 || rest >= gross) throw new BadRequestException('LEAVE_WORK_SCHEDULE_INVALID');
  let breakStart: number, breakEnd: number;
  if (rest === 0) {
    breakStart = breakEnd = start + Math.ceil(working / 2);
  } else if (configuredBreakStart && configuredBreakEnd) {
    breakStart = timeMinutes(configuredBreakStart); breakEnd = timeMinutes(configuredBreakEnd);
    if (breakStart < start || breakEnd > end || breakEnd - breakStart !== rest) throw new BadRequestException('LEAVE_WORK_SCHEDULE_INVALID');
  } else {
    // Backward-compatible policy for legacy shifts that only store a duration:
    // place the unpaid break between the two net-working portions, never at a hardcoded clock time.
    breakStart = start + Math.ceil(working / 2); breakEnd = breakStart + rest;
  }
  const workingIntervals = [{ from: start, to: breakStart }, { from: breakEnd, to: end }].filter(interval => interval.to > interval.from);
  const requestedStart = durationType === LeaveDurationType.AFTERNOON_HALF ? breakEnd : durationType === LeaveDurationType.CUSTOM_HOURS ? timeMinutes(customStart ?? '') : start;
  const requestedEnd = durationType === LeaveDurationType.MORNING_HALF ? breakStart : durationType === LeaveDurationType.CUSTOM_HOURS ? timeMinutes(customEnd ?? '') : end;
  if (requestedStart >= requestedEnd || requestedStart < start || requestedEnd > end) throw new BadRequestException('LEAVE_REQUEST_INTERVAL_INVALID');
  const approved = workingIntervals.map(interval => ({ from: Math.max(interval.from, requestedStart), to: Math.min(interval.to, requestedEnd) })).filter(interval => interval.to > interval.from);
  const calculatedMinutes = approved.reduce((sum, interval) => sum + interval.to - interval.from, 0);
  if (!calculatedMinutes) throw new BadRequestException('LEAVE_INTERVAL_OUTSIDE_WORKING_TIME');
  const required = workingIntervals.flatMap(interval => subtractInterval(interval, { from: requestedStart, to: requestedEnd }));
  return {
    date, shiftStart: startTime, shiftEnd: endTime, breakMinutes: rest,
    breakStart: minuteTime(breakStart), breakEnd: minuteTime(breakEnd),
    requestedStart: minuteTime(requestedStart), requestedEnd: minuteTime(requestedEnd), calculatedMinutes,
    leaveEquivalent: durationType === LeaveDurationType.FULL_DAY ? 1 : durationType === LeaveDurationType.CUSTOM_HOURS ? calculatedMinutes / working : 0.5,
    approvedLeaveIntervals: approved.map(interval => ({ from: minuteTime(interval.from), to: minuteTime(interval.to) })),
    requiredWorkingIntervals: required.map(interval => ({ from: minuteTime(interval.from), to: minuteTime(interval.to) })),
  };
}

function subtractInterval(source: { from: number; to: number }, removed: { from: number; to: number }) {
  if (removed.to <= source.from || removed.from >= source.to) return [source];
  return [
    ...(removed.from > source.from ? [{ from: source.from, to: Math.min(removed.from, source.to) }] : []),
    ...(removed.to < source.to ? [{ from: Math.max(removed.to, source.from), to: source.to }] : []),
  ];
}

export function leaveIntervalsOverlap(startA?: string, endA?: string, startB?: string, endB?: string) {
  if (!startA || !endA || !startB || !endB) return true;
  return timeMinutes(startA) < timeMinutes(endB) && timeMinutes(startB) < timeMinutes(endA);
}

function intersectLeaveIntervals(left: Array<{ from: string; to: string }>, right: Array<{ from: string; to: string }>) {
  return left.flatMap(a => right.map(b => ({ from: Math.max(timeMinutes(a.from), timeMinutes(b.from)), to: Math.min(timeMinutes(a.to), timeMinutes(b.to)) })))
    .filter(interval => interval.to > interval.from)
    .map(interval => ({ from: minuteTime(interval.from), to: minuteTime(interval.to) }));
}
