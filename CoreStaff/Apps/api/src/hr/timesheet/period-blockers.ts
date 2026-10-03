import { AttendanceApprovalStatus, DayResult, WorkdayType } from '../../database/schemas/enums';

/**
 * TASK-074 — SRS FR-HR-02 / FR-HR-02A.
 *
 * A blocker is a reason a timesheet period cannot be closed. `READY_TO_CLOSE`
 * is derived from "zero blockers", and close re-verifies them in-transaction.
 */
export const BLOCKER_TYPES = [
  'MISSING_CHECK_IN',
  'MISSING_CHECK_OUT',
  'PENDING_APPROVAL',
  'PENDING_CLARIFICATION',
  'REJECTED',
] as const;

export type PeriodBlockerType = (typeof BLOCKER_TYPES)[number];

export const BLOCKER_MESSAGES: Record<PeriodBlockerType, string> = {
  MISSING_CHECK_IN: 'Thiếu check-in',
  MISSING_CHECK_OUT: 'Thiếu check-out',
  PENDING_APPROVAL: 'Approval còn PENDING',
  PENDING_CLARIFICATION: 'Chờ giải trình',
  REJECTED: 'Ngày công bị REJECTED',
};

/** Minimal shape of an AttendanceDay needed for classification. */
export interface AttendanceDayLike {
  _id: unknown;
  employeeId: unknown;
  workDate: string;
  workdayType?: string;
  dayResult?: string;
  attendanceStatus?: string;
  overallApprovalStatus?: string;
  checkInAt?: Date | string | null;
  checkOutAt?: Date | string | null;
  resolution?: { type?: string };
  employeeSnapshot?: {
    employeeCode?: string;
    fullName?: string;
    departmentId?: string;
    departmentName?: string;
  };
}

export interface PeriodBlockerRow {
  /** Stable per (day, type) so the UI can key rows. */
  id: string;
  type: PeriodBlockerType;
  attendanceDayId: string;
  employeeId: string;
  employee: { code?: string; name?: string; departmentId?: string; department?: string };
  /** workDate, 'YYYY-MM-DD'. */
  date: string;
  note: string;
  dayResult?: string;
  attendanceStatus?: string;
  overallApprovalStatus?: string;
  checkInAt?: Date | string | null;
  checkOutAt?: Date | string | null;
}

/**
 * Classify one attendance day into zero or more blockers.
 *
 * Days that carry no attendance obligation are exempt: WEEKLY_OFF and
 * PUBLIC_HOLIDAY have no expected punch, and PAID_LEAVE/UNPAID_LEAVE were
 * written by HR leave-apply — a missing punch on any of these is correct.
 */
export function classifyDayBlockers(day: AttendanceDayLike): PeriodBlockerRow[] {
  const workdayType = day.workdayType ?? WorkdayType.WORKING_DAY;
  if (workdayType !== WorkdayType.WORKING_DAY) return [];
  // A manager may explicitly accept a missing punch as a lost workday. It
  // remains ABSENT for payroll, but is no longer an unresolved period blocker.
  if (day.resolution?.type === 'FORFEITED_MISSING_PUNCH' && day.dayResult === DayResult.ABSENT) return [];

  const types: PeriodBlockerType[] = [];

  // Punch state. A day with neither punch emits MISSING_CHECK_IN only —
  // nothing can check out before checking in, so emitting both would
  // double-count a single problem.
  if (!day.checkInAt) {
    types.push('MISSING_CHECK_IN');
  } else if (!day.checkOutAt) {
    types.push('MISSING_CHECK_OUT');
  }

  // Approval state, read from the day itself — ManagerRequestService.decide()
  // writes overallApprovalStatus, so no request lookup is needed.
  switch (day.overallApprovalStatus) {
    case AttendanceApprovalStatus.PENDING:
      types.push('PENDING_APPROVAL');
      break;
    case AttendanceApprovalStatus.CLARIFICATION_REQUESTED:
      types.push('PENDING_CLARIFICATION');
      break;
    case AttendanceApprovalStatus.REJECTED:
      types.push('REJECTED');
      break;
    default:
      break;
  }

  const attendanceDayId = String(day._id);
  const snapshot = day.employeeSnapshot ?? {};

  return types.map((type) => ({
    id: `${attendanceDayId}:${type}`,
    type,
    attendanceDayId,
    employeeId: String(day.employeeId),
    employee: {
      code: snapshot.employeeCode,
      name: snapshot.fullName,
      departmentId: snapshot.departmentId,
      department: snapshot.departmentName,
    },
    date: day.workDate,
    note: BLOCKER_MESSAGES[type],
    dayResult: day.dayResult ?? (day.attendanceStatus === 'COMPLETED' ? DayResult.PRESENT : undefined),
    attendanceStatus: day.attendanceStatus,
    overallApprovalStatus: day.overallApprovalStatus,
    checkInAt: day.checkInAt ?? null,
    checkOutAt: day.checkOutAt ?? null,
  }));
}

/** Aggregate blocker rows into the `{type,message,count}` shape the review screen already consumes. */
export function summarizeBlockers(rows: PeriodBlockerRow[]): Array<{ type: PeriodBlockerType; message: string; count: number }> {
  const counts = new Map<PeriodBlockerType, number>();
  for (const row of rows) counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
  return BLOCKER_TYPES
    .filter((type) => counts.has(type))
    .map((type) => ({ type, message: BLOCKER_MESSAGES[type], count: counts.get(type)! }));
}
