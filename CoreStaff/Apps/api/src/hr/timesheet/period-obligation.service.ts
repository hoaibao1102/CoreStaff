import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { ClientSession } from 'mongoose';

export type OvertimeClassificationStatus = 'PROVISIONAL' | 'FINAL' | 'REVIEWABLE';
export type CalendarType = 'WEEKLY_OFF' | 'PUBLIC_HOLIDAY' | 'SPECIAL_WORKING_DAY';

export interface PeriodEmployee { employeeProfileId: string; userId: string; departmentIds: string[] }
export interface PeriodAssignment { id: string; userId: string; departmentId: string; effectiveFrom?: string; effectiveTo?: string; active: boolean }
export interface PeriodShift { id: string; version?: number; scope: 'ORGANIZATION' | 'DEPARTMENT'; departmentId?: string; weekdays: number[]; effectiveFrom: string; effectiveTo?: string; startTime: string; endTime: string; breakMinutes: number; active: boolean }
export interface PeriodCalendarException { id: string; version?: number; date: string; type: CalendarType }
export interface PeriodLeave { id: string; userId: string; startDate: string; endDate: string; leaveType: 'PAID_LEAVE' | 'UNPAID_LEAVE'; status: string; calculatedMinutes?: number; approvedLeaveIntervals?: Array<{ from: string; to: string }> }
export interface PeriodEndpointProvenance { source: string; eventId?: string; requestId?: string }
export interface PeriodOvertimeEvidence {
  id: string;
  calculationContract: string;
  rawEligibleMinutes?: number;
  payableMinutes?: number;
  roundingDroppedMinutes?: number;
  minimumThresholdApplied?: boolean;
  reasons?: string[];
  policySnapshot?: Record<string, unknown>;
  provenanceSnapshot?: Record<string, unknown>;
  inputHash?: string;
}

export interface PeriodAttendance {
  id: string;
  userId: string;
  workDate: string;
  workingMinutes?: number;
  attendanceStatus?: string;
  dayResult?: string;
  resolutionType?: string;
  checkInAt?: string;
  checkOutAt?: string;
  lateMinutes?: number;
  earlyMinutes?: number;
  checkInProvenance?: PeriodEndpointProvenance;
  checkOutProvenance?: PeriodEndpointProvenance;
  overallApprovalStatus?: string;
}
export interface PeriodOvertime extends Omit<PeriodOvertimeEvidence, 'calculationContract'> { calculationContract?: string; id: string; userId: string; workDate: string; periodKey: string; classificationStatus: OvertimeClassificationStatus; eligibleMinutes: number }

export interface PeriodFactInput {
  organizationId: string;
  periodKey: string;
  startDate: string;
  endDate: string;
  employees: PeriodEmployee[];
  assignments: PeriodAssignment[];
  shifts: PeriodShift[];
  calendarExceptions: PeriodCalendarException[];
  leaveRequests: PeriodLeave[];
  attendanceDays: PeriodAttendance[];
  overtimeResults: PeriodOvertime[];
}

export interface PeriodObligationDay {
  employeeProfileId: string;
  userId: string;
  departmentId: string;
  workDate: string;
  calendarType: CalendarType | 'REGULAR';
  scheduledObligationMinutes: number;
  workedScheduledMinutes: number;
  payableLeaveMinutes: number;
  unpaidLeaveMinutes: number;
  standardWorkUnits: number;
  standardWorkMinutes: number;
  overtimeMinutes: number;
  checkInAt?: string;
  checkOutAt?: string;
  lateMinutes: number;
  earlyMinutes: number;
  attendanceState?: string;
  unresolvedIncomplete?: boolean;
  forfeitedMissingPunch?: boolean;
  blockers: Array<'MISSING_ATTENDANCE_DAY'>;
  source: {
    assignmentId: string;
    calendarExceptionId?: string;
    calendarVersion?: number;
    shiftTemplateId?: string;
    shiftVersion?: number;
    attendanceDayId?: string;
    leaveRequestIds: string[];
    overtimeResultIds: string[];
    overtimeEvidence?: PeriodOvertimeEvidence[];
    attendanceProvenance?: {
      checkInProvenance?: PeriodEndpointProvenance;
      checkOutProvenance?: PeriodEndpointProvenance;
      overallApprovalStatus?: string;
    };
  };
}

export interface PeriodObligationProjection {
  organizationId: string;
  periodKey: string;
  startDate: string;
  endDate: string;
  days: PeriodObligationDay[];
  totals: {
    scheduledObligationMinutes: number;
    workedScheduledMinutes: number;
    payableLeaveMinutes: number;
    unpaidLeaveMinutes: number;
    standardWorkUnits: number;
    standardWorkMinutes: number;
    overtimeMinutes: number;
  };
  canonicalPayload: string;
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let date = new Date(`${startDate}T00:00:00Z`); date <= new Date(`${endDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function effective(from: string | undefined, to: string | undefined, date: string): boolean {
  return (!from || from <= date) && (!to || to >= date);
}

function weekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function minutesBetween(from: string, to: string): number {
  const [fromHour, fromMinute] = from.split(':').map(Number);
  const [toHour, toMinute] = to.split(':').map(Number);
  let minutes = toHour * 60 + toMinute - (fromHour * 60 + fromMinute);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

function leaveMinutes(leave: PeriodLeave): number {
  if (leave.startDate !== leave.endDate && leave.calculatedMinutes !== undefined) {
    throw new Error('AMBIGUOUS_MULTI_DAY_LEAVE_MINUTES');
  }
  if (leave.calculatedMinutes !== undefined) return Math.max(0, leave.calculatedMinutes);
  return (leave.approvedLeaveIntervals ?? []).reduce((sum, interval) => sum + minutesBetween(interval.from, interval.to), 0);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function payloadFor(projection: Omit<PeriodObligationProjection, 'canonicalPayload'> | PeriodObligationProjection): string {
  const days = [...projection.days].sort((left, right) =>
    left.employeeProfileId.localeCompare(right.employeeProfileId) || left.workDate.localeCompare(right.workDate));
  return JSON.stringify(stableValue({
    organizationId: projection.organizationId,
    periodKey: projection.periodKey,
    startDate: projection.startDate,
    endDate: projection.endDate,
    days,
    totals: projection.totals,
  }));
}

export function buildPeriodObligationProjection(
  input: PeriodFactInput,
  options: { overtimeStatus: OvertimeClassificationStatus },
): PeriodObligationProjection {
  const days: PeriodObligationDay[] = [];
  for (const employee of [...input.employees].sort((a, b) => a.employeeProfileId.localeCompare(b.employeeProfileId))) {
    for (const workDate of datesBetween(input.startDate, input.endDate)) {
      const assignments = input.assignments.filter(row => row.userId === employee.userId && row.active && effective(row.effectiveFrom, row.effectiveTo, workDate));
      if (!assignments.length) continue;
      if (assignments.length > 1) throw new Error('OVERLAPPING_EFFECTIVE_ASSIGNMENTS');
      const assignment = assignments[0];
      const calendar = input.calendarExceptions.find(row => row.date === workDate);
      const off = calendar?.type === 'WEEKLY_OFF' || calendar?.type === 'PUBLIC_HOLIDAY';
      const matchingShifts = input.shifts.filter(row => row.active
        && effective(row.effectiveFrom, row.effectiveTo, workDate)
        && row.weekdays.includes(weekday(workDate))
        && (row.scope === 'ORGANIZATION' || row.departmentId === assignment.departmentId));
      const departmentShifts = matchingShifts.filter(row => row.scope === 'DEPARTMENT');
      const resolvedShifts = departmentShifts.length ? departmentShifts : matchingShifts.filter(row => row.scope === 'ORGANIZATION');
      if (resolvedShifts.length > 1) throw new Error('OVERLAPPING_EFFECTIVE_SHIFTS');
      const shift = resolvedShifts[0];
      if (!shift && !off) continue;
      const scheduled = off ? 0 : Math.max(0, minutesBetween(shift.startTime, shift.endTime) - shift.breakMinutes);
      const attendance = input.attendanceDays.find(row => row.userId === employee.userId && row.workDate === workDate);
      const leaves = input.leaveRequests.filter(row => row.userId === employee.userId
        && row.startDate <= workDate && row.endDate >= workDate
        && (row.status === 'APPROVED' || row.status === 'HR_APPLIED'))
        .sort((a, b) => a.id.localeCompare(b.id));
      const overtime = input.overtimeResults.filter(row => row.userId === employee.userId
        && row.workDate === workDate && row.periodKey === input.periodKey
        && (options.overtimeStatus === 'REVIEWABLE'
          ? row.classificationStatus === 'PROVISIONAL' || row.classificationStatus === 'FINAL'
          : row.classificationStatus === options.overtimeStatus))
        .sort((a, b) => a.id.localeCompare(b.id));
      const payableLeaveMinutes = Math.min(scheduled, leaves.filter(row => row.leaveType === 'PAID_LEAVE').reduce((sum, row) => sum + leaveMinutes(row), 0));
      const unpaidLeaveMinutes = Math.min(scheduled, leaves.filter(row => row.leaveType === 'UNPAID_LEAVE').reduce((sum, row) => sum + leaveMinutes(row), 0));
      const leaveCoveredMinutes = Math.min(scheduled, payableLeaveMinutes + unpaidLeaveMinutes);
      days.push({
        employeeProfileId: employee.employeeProfileId,
        userId: employee.userId,
        departmentId: assignment.departmentId,
        workDate,
        calendarType: calendar?.type ?? 'REGULAR',
        scheduledObligationMinutes: scheduled,
        workedScheduledMinutes: Math.min(scheduled, Math.max(0, attendance?.workingMinutes ?? 0)),
        payableLeaveMinutes,
        unpaidLeaveMinutes,
        standardWorkUnits: scheduled > 0 ? 1 : 0,
        standardWorkMinutes: scheduled,
        overtimeMinutes: overtime.reduce((sum, row) => sum + Math.max(0, row.eligibleMinutes), 0),
        checkInAt: attendance?.checkInAt,
        checkOutAt: attendance?.checkOutAt,
        lateMinutes: Math.max(0, attendance?.lateMinutes ?? 0),
        earlyMinutes: Math.max(0, attendance?.earlyMinutes ?? 0),
        attendanceState: attendance?.attendanceStatus ?? attendance?.dayResult,
        unresolvedIncomplete: Boolean(attendance && attendance.dayResult === 'INCOMPLETE' && attendance.resolutionType !== 'FORFEITED_MISSING_PUNCH'),
        forfeitedMissingPunch: attendance?.resolutionType === 'FORFEITED_MISSING_PUNCH',
        blockers: scheduled > 0 && !attendance && leaveCoveredMinutes < scheduled ? ['MISSING_ATTENDANCE_DAY'] : [],
        source: {
          assignmentId: assignment.id,
          calendarExceptionId: calendar?.id,
          calendarVersion: calendar?.version,
          shiftTemplateId: shift?.id,
          shiftVersion: shift?.version,
          attendanceDayId: attendance?.id,
          leaveRequestIds: leaves.map(row => row.id),
          overtimeResultIds: overtime.map(row => row.id),
          ...(overtime.some(row => row.calculationContract === 'OVERTIME_V2') ? {
            overtimeEvidence: overtime.filter(row => row.calculationContract === 'OVERTIME_V2').map(row => ({
              id: row.id, calculationContract: row.calculationContract!,
              rawEligibleMinutes: row.rawEligibleMinutes, payableMinutes: row.payableMinutes,
              roundingDroppedMinutes: row.roundingDroppedMinutes, minimumThresholdApplied: row.minimumThresholdApplied,
              reasons: row.reasons ? [...row.reasons].sort() : undefined,
              policySnapshot: row.policySnapshot ? JSON.parse(JSON.stringify(row.policySnapshot)) : undefined,
              provenanceSnapshot: row.provenanceSnapshot ? JSON.parse(JSON.stringify(row.provenanceSnapshot)) : undefined,
              inputHash: row.inputHash,
            })),
          } : {}),
          ...(attendance?.checkInProvenance || attendance?.checkOutProvenance ? {
            attendanceProvenance: {
              checkInProvenance: attendance.checkInProvenance ? { ...attendance.checkInProvenance } : undefined,
              checkOutProvenance: attendance.checkOutProvenance ? { ...attendance.checkOutProvenance } : undefined,
              overallApprovalStatus: attendance.overallApprovalStatus,
            },
          } : {}),
        },
      });
    }
  }
  const totals = days.reduce((result, day) => ({
    scheduledObligationMinutes: result.scheduledObligationMinutes + day.scheduledObligationMinutes,
    workedScheduledMinutes: result.workedScheduledMinutes + day.workedScheduledMinutes,
    payableLeaveMinutes: result.payableLeaveMinutes + day.payableLeaveMinutes,
    unpaidLeaveMinutes: result.unpaidLeaveMinutes + day.unpaidLeaveMinutes,
    standardWorkUnits: result.standardWorkUnits + day.standardWorkUnits,
    standardWorkMinutes: result.standardWorkMinutes + day.standardWorkMinutes,
    overtimeMinutes: result.overtimeMinutes + day.overtimeMinutes,
  }), { scheduledObligationMinutes: 0, workedScheduledMinutes: 0, payableLeaveMinutes: 0, unpaidLeaveMinutes: 0, standardWorkUnits: 0, standardWorkMinutes: 0, overtimeMinutes: 0 });
  const base = { organizationId: input.organizationId, periodKey: input.periodKey, startDate: input.startDate, endDate: input.endDate, days, totals };
  return { ...base, canonicalPayload: payloadFor(base) };
}

export function canonicalPeriodProjectionHash(projection: PeriodObligationProjection): string {
  return createHash('sha256').update(payloadFor(projection)).digest('hex');
}

export interface PeriodFactSource {
  load(request: Omit<LoadPeriodRequest, 'session' | 'overtimeStatus'>, session?: ClientSession): Promise<PeriodFactInput>;
}

export interface LoadPeriodRequest {
  organizationId: string;
  periodKey: string;
  startDate: string;
  endDate: string;
  overtimeStatus: OvertimeClassificationStatus;
  session?: ClientSession;
}

@Injectable()
export class PeriodObligationService {
  constructor(private readonly source: PeriodFactSource) {}

  async loadPeriod(request: LoadPeriodRequest): Promise<PeriodObligationProjection> {
    const { session, overtimeStatus, ...sourceRequest } = request;
    const input = await this.source.load(sourceRequest, session);
    return buildPeriodObligationProjection(input, { overtimeStatus });
  }
}
