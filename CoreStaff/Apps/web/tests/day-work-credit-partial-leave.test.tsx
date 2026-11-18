/** @jest-environment jsdom */
import { calculateDayWorkCredit } from '../src/screens/Attendance/components/DayDetailModal';
import type { DayAttendance } from '../src/screens/Attendance/types';

/**
 * A half-day leave day keeps `workdayType = PAID_LEAVE` on the server, but only
 * half the shift is excused. It used to be credited as a whole 1.0 day.
 */
const day = (over: Record<string, unknown>): DayAttendance => ({
  workDate: '2026-11-19', status: 'NOT_CHECKED_IN', workdayType: 'PAID_LEAVE', ...over,
} as unknown as DayAttendance);

const morningHalf = (leaveType: 'PAID_LEAVE' | 'UNPAID_LEAVE' = 'PAID_LEAVE') => ({
  durationTypes: ['MORNING_HALF'], leaveTypes: [leaveType],
  approvedLeaveIntervals: [{ from: '08:00', to: '12:00' }], requiredWorkingIntervals: [{ from: '13:00', to: '17:00' }],
  approvedLeaveMinutes: 240, requiredWorkingMinutes: 240, effectiveCheckInTime: null, effectiveCheckOutTime: null,
});

describe('calculateDayWorkCredit with partial-day leave', () => {
  it('credits a paid half-day with no work yet as 0.5, not 1.0', () => {
    const r = calculateDayWorkCredit(day({ attendanceRequirements: morningHalf() }), 'NONE');
    expect(r.credit).toBe(0.5);
    expect(r.obligationMinutes).toBe(480);
  });

  it('credits a paid half-day plus a worked other half as 1.0', () => {
    const r = calculateDayWorkCredit(day({ workingMinutes: 240, status: 'COMPLETED', attendanceRequirements: morningHalf() }), 'ATTENDED');
    expect(r.credit).toBe(1);
  });

  it('does not count an UNPAID half-day as worked time', () => {
    const r = calculateDayWorkCredit(day({ workdayType: 'UNPAID_LEAVE', workingMinutes: 240, status: 'COMPLETED', attendanceRequirements: morningHalf('UNPAID_LEAVE') }), 'ATTENDED');
    expect(r.credit).toBe(0.5);
  });

  it('keeps a full-day paid leave at 1.0 and a full-day unpaid leave at 0', () => {
    const full = (leaveType: string) => ({ durationTypes: ['FULL_DAY'], leaveTypes: [leaveType], approvedLeaveIntervals: [], requiredWorkingIntervals: [], approvedLeaveMinutes: 480, requiredWorkingMinutes: 0, effectiveCheckInTime: null, effectiveCheckOutTime: null });
    expect(calculateDayWorkCredit(day({ attendanceRequirements: full('PAID_LEAVE') }), 'DAY_OFF').credit).toBe(1);
    expect(calculateDayWorkCredit(day({ workdayType: 'UNPAID_LEAVE', attendanceRequirements: full('UNPAID_LEAVE') }), 'DAY_OFF').credit).toBe(0);
  });
});
