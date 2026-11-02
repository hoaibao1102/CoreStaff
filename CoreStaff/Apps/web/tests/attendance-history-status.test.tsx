import { getAttendanceHistoryStatus, hasPartialDayLeave } from '../src/screens/Attendance/historyStatus';
import type { DayAttendance } from '../src/screens/Attendance/types';

function day(workdayType: string): DayAttendance {
  return {
    id: 'day-1', workDate: '2026-09-05', shiftName: '', shiftHours: '',
    workplace: '', workplaceAddress: '', status: 'DAY_OFF', availableAction: 'NONE',
    attendanceMethod: 'NETWORK', workdayType,
  };
}

describe('attendance history status for company schedule', () => {
  it('does not render a status for a weekly day off', () => {
    expect(getAttendanceHistoryStatus(day('WEEKLY_OFF'))).toBe('NONE');
  });

  it.each(['PUBLIC_HOLIDAY', 'PAID_LEAVE', 'UNPAID_LEAVE'])('keeps %s visible', (type) => {
    expect(getAttendanceHistoryStatus(day(type))).toBe('DAY_OFF');
  });

  it('keeps attendance as the primary status and exposes leave as a second status for half-day leave', () => {
    const partialDay = {
      ...day('PAID_LEAVE'),
      status: 'COMPLETED' as const,
      checkInAt: '2026-09-05T01:00:00.000Z',
      checkOutAt: '2026-09-05T05:00:00.000Z',
      attendanceRequirements: {
        durationTypes: ['AFTERNOON_HALF'],
        approvedLeaveIntervals: [{ from: '13:00', to: '17:00' }],
        requiredWorkingIntervals: [{ from: '08:00', to: '12:00' }],
        approvedLeaveMinutes: 240,
        requiredWorkingMinutes: 240,
        effectiveCheckInTime: '08:00',
        effectiveCheckOutTime: '12:00',
      },
    };

    expect(getAttendanceHistoryStatus(partialDay)).toBe('ATTENDED');
    expect(hasPartialDayLeave(partialDay)).toBe(true);
  });
});
