import { getAttendanceHistoryStatus } from '../src/screens/Attendance/historyStatus';
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
});
