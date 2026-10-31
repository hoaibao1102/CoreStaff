import { calculateAttendance, AttendanceInterval } from '../../attendance/services/attendance-calculator.service';
import { vnTimeToUtc } from '../../common/vietnam-time';

export interface ConfirmationContext {
  workDate: string;
  requiredWorkingIntervals: AttendanceInterval[];
  gracePeriodMinutes: number;
  checkInAt?: string;
  checkOutAt?: string;
  blockedReasons?: string[];
}

/** Pure proposal: never substitutes an existing endpoint or invents observed time. */
export function proposeAttendanceConfirmation(context: ConfirmationContext) {
  const required = context.requiredWorkingIntervals;
  const blocked = (reason: string[]) => ({ actionType: null, blockedReasons: reason, checkInAt: context.checkInAt, checkOutAt: context.checkOutAt, calculation: null });
  if (context.blockedReasons?.length) return blocked(context.blockedReasons);
  if (context.checkInAt && context.checkOutAt) return blocked(['ALREADY_COMPLETE']);
  if (!required.length) return blocked(['NO_WORK_OBLIGATION']);
  if (required.some(interval => interval.to <= interval.from)) return blocked(['UNSUPPORTED_OVERNIGHT_SHIFT']);
  const checkInAt = context.checkInAt ?? new Date(vnTimeToUtc(context.workDate, required[0].from)).toISOString();
  const checkOutAt = context.checkOutAt ?? new Date(vnTimeToUtc(context.workDate, required[required.length - 1].to)).toISOString();
  if (!(new Date(checkInAt).getTime() < new Date(checkOutAt).getTime())) return blocked(['NEEDS_MANUAL_REVIEW']);
  return {
    actionType: context.checkInAt ? 'CHECK_OUT' : context.checkOutAt ? 'CHECK_IN' : 'FULL_DAY',
    blockedReasons: [], checkInAt, checkOutAt,
    calculation: calculateAttendance(context.workDate, new Date(checkInAt), new Date(checkOutAt), {
      startTime: required[0].from, endTime: required[required.length - 1].to, breakMinutes: 0,
      gracePeriodMinutes: context.gracePeriodMinutes, requiredWorkingIntervals: required,
    }),
  };
}
