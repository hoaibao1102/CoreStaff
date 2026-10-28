import { Injectable } from '@nestjs/common';
import { vnTimeToUtc } from '../../common/vietnam-time';

export interface AttendanceInterval { from: string; to: string }
export interface ShiftInfo {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  gracePeriodMinutes: number;
  requiredWorkingIntervals?: AttendanceInterval[];
  approvedLeaveIntervals?: AttendanceInterval[];
}
export interface CalculationResult {
  lateMinutes: number;
  earlyMinutes: number;
  workingMinutes: number | null;
  effectiveCheckInTime: string | null;
  effectiveCheckOutTime: string | null;
  approvedLeaveMinutes: number;
  requiredWorkingMinutes: number;
}

@Injectable()
export class AttendanceCalculatorService {
  calculate(workDate: string, checkInAt: Date, checkOutAt: Date | undefined, shift: ShiftInfo): CalculationResult {
    return calculateAttendance(workDate, checkInAt, checkOutAt, shift);
  }
}

export function calculateAttendance(workDate: string, checkInAt: Date, checkOutAt: Date | undefined, shift: ShiftInfo): CalculationResult {
  const at = (time: string) => new Date(vnTimeToUtc(workDate, time));
  const required = shift.requiredWorkingIntervals;
  const effectiveCheckInTime = required ? required[0]?.from ?? null : shift.startTime;
  const effectiveCheckOutTime = required ? required[required.length - 1]?.to ?? null : shift.endTime;
  const scheduleStart = effectiveCheckInTime ? at(effectiveCheckInTime) : null;
  const scheduleEnd = effectiveCheckOutTime ? at(effectiveCheckOutTime) : null;
  const allowedCheckInTime = scheduleStart ? new Date(scheduleStart.getTime() + (shift.gracePeriodMinutes || 0) * 60000) : null;
  const lateMinutes = allowedCheckInTime && checkInAt > allowedCheckInTime
    ? Math.floor((checkInAt.getTime() - allowedCheckInTime.getTime()) / 60000)
    : 0;
  let earlyMinutes = 0;
  let workingMinutes: number | null = null;
  if (checkOutAt) {
    if (scheduleEnd && checkOutAt < scheduleEnd) earlyMinutes = Math.floor((scheduleEnd.getTime() - checkOutAt.getTime()) / 60000);
    if (required) {
      workingMinutes = required.reduce((sum, interval) => {
        const from = Math.max(checkInAt.getTime(), at(interval.from).getTime());
        const to = Math.min(checkOutAt.getTime(), at(interval.to).getTime());
        return sum + Math.max(0, Math.floor((to - from) / 60000));
      }, 0);
    } else {
      const span = Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000);
      workingMinutes = span >= (shift.breakMinutes || 0) ? span - (shift.breakMinutes || 0) : span;
    }
  }
  return {
    lateMinutes,
    earlyMinutes,
    workingMinutes,
    effectiveCheckInTime,
    effectiveCheckOutTime,
    approvedLeaveMinutes: intervalMinutes(shift.approvedLeaveIntervals),
    requiredWorkingMinutes: required ? intervalMinutes(required) : Math.max(0, clockMinutes(shift.endTime) - clockMinutes(shift.startTime) - (shift.breakMinutes || 0)),
  };
}

function intervalMinutes(intervals?: AttendanceInterval[]) {
  return (intervals ?? []).reduce((sum, interval) => sum + Math.max(0, clockMinutes(interval.to) - clockMinutes(interval.from)), 0);
}
function clockMinutes(value: string) { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes; }
