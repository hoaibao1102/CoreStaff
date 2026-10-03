import type { DayAttendance } from './types';

export type AttendanceHistoryStatus = 'FORGOTTEN' | 'FORFEITED' | 'DAY_OFF' | 'LATE' | 'ATTENDED' | 'NONE';

export function getAttendanceHistoryStatus(
  day: DayAttendance,
  today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
): AttendanceHistoryStatus {
  if (day.resolution?.type === 'FORFEITED_MISSING_PUNCH') return 'FORFEITED';
  if (day.status === 'DAY_OFF' || ['WEEKLY_OFF', 'PUBLIC_HOLIDAY', 'PAID_LEAVE', 'UNPAID_LEAVE'].includes(day.workdayType ?? '')) {
    return 'DAY_OFF';
  }

  const hasCheckIn = Boolean(day.checkInAt ?? day.checkIn?.recordedAt);
  const hasCheckOut = Boolean(day.checkOutAt ?? day.checkOut?.recordedAt);
  if (day.workDate < today && (!hasCheckIn || !hasCheckOut) && day.status !== 'COMPLETED' && day.dayResult !== 'PRESENT') {
    return 'FORGOTTEN';
  }
  if ((day.lateMinutes ?? 0) > 0 || day.status === 'LATE') return 'LATE';
  if (hasCheckIn || day.status === 'COMPLETED' || day.dayResult === 'PRESENT') return 'ATTENDED';
  return 'NONE';
}
