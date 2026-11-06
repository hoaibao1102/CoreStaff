import type { AttendanceDay, WorkCreditPolicy } from './employee-api';
import { todayKey } from './components/ui';

export type HistoryStatus = 'FORGOTTEN' | 'FORFEITED' | 'DAY_OFF' | 'LATE' | 'EARLY_LEAVE' | 'ATTENDED' | 'NONE';

export interface DayCredit {
  credit: number;
  label: string;
  provisional: boolean;
  obligation: number;
  worked: number;
  ratioPercent: number;
  explanation: string;
  fullPct: string;
  halfPct: string;
  fullMin: number;
  halfMin: number;
}

const pct = (v: number) => { const p = Math.round(v * 1000) / 10; return `${p}%`; };
const dayStatus = (d: AttendanceDay): string | undefined => d.attendanceStatus ?? d.status;

/** Trạng thái hiển thị của ngày — khớp getAttendanceHistoryStatus bên web. */
export function dayHistoryStatus(d: AttendanceDay): HistoryStatus {
  if (d.workdayType === 'WEEKLY_OFF') return 'NONE';
  if (d.resolution?.type === 'FORFEITED_MISSING_PUNCH') return 'FORFEITED';
  const req = d.attendanceRequirements;
  const partial = ['PAID_LEAVE', 'UNPAID_LEAVE'].includes(d.workdayType ?? '')
    && ((req?.requiredWorkingMinutes ?? 0) > 0 || (req?.durationTypes ?? []).some(t => t !== 'FULL_DAY'));
  const status = dayStatus(d);
  if (!partial && (status === 'DAY_OFF' || ['PUBLIC_HOLIDAY', 'PAID_LEAVE', 'UNPAID_LEAVE'].includes(d.workdayType ?? ''))) return 'DAY_OFF';
  const hasIn = !!d.checkIn?.recordedAt;
  const hasOut = !!d.checkOut?.recordedAt;
  if (d.workDate < todayKey() && (!hasIn || !hasOut) && status !== 'COMPLETED' && d.dayResult !== 'PRESENT') return 'FORGOTTEN';
  if ((d.lateMinutes ?? 0) > 0 || status === 'LATE') return 'LATE';
  if ((d.earlyMinutes ?? 0) > 0 || status === 'EARLY_LEAVE') return 'EARLY_LEAVE';
  if (hasIn || status === 'COMPLETED' || d.dayResult === 'PRESENT') return 'ATTENDED';
  return 'NONE';
}

/** Quy đổi công của một ngày — khớp calculateDayWorkCredit bên web. */
export function calculateDayCredit(d: AttendanceDay, hs: HistoryStatus, policy?: WorkCreditPolicy | null): DayCredit {
  const obligation = Math.round(d.attendanceRequirements?.requiredWorkingMinutes ?? 480);
  const leave = Math.round(d.attendanceRequirements?.approvedLeaveMinutes ?? 0);
  let worked = Math.round(d.totalWorkingMinutes ?? d.workingMinutes ?? 0);
  if (hs === 'FORFEITED') worked = 0;
  else if (worked === 0 && d.checkIn?.recordedAt && d.checkOut?.recordedAt) {
    worked = Math.max(0, Math.floor((new Date(d.checkOut.recordedAt).getTime() - new Date(d.checkIn.recordedAt).getTime()) / 60000));
  }
  const full = typeof policy?.fullDayMinimumRatio === 'number' ? policy.fullDayMinimumRatio : 0.875;
  const half = typeof policy?.halfDayMinimumRatio === 'number' ? policy.halfDayMinimumRatio : 0.5;
  const fp = pct(full), hp = pct(half);
  const base = { fullPct: fp, halfPct: hp, fullMin: Math.round(obligation * full), halfMin: Math.round(obligation * half) };
  const ratioOf = (w: number, o: number) => (o > 0 ? Math.min(100, Math.round((w / o) * 100)) : 0);
  const make = (credit: number, label: string, explanation: string, o: Partial<Pick<DayCredit, 'provisional' | 'obligation' | 'worked' | 'ratioPercent'>> = {}): DayCredit => ({
    credit, label, explanation, provisional: false, obligation, worked, ratioPercent: ratioOf(worked, obligation), ...base, ...o,
  });

  switch (d.workdayType) {
    case 'WEEKLY_OFF': return make(0, '0 công', 'Ngày nghỉ hàng tuần theo quy định, không phát sinh nghĩa vụ làm việc.', { obligation: 0, worked: 0, ratioPercent: 0 });
    case 'PUBLIC_HOLIDAY': return make(1, '1.0 công', 'Nghỉ lễ theo quy định Nhà nước, được hưởng nguyên lương (1.0 ngày công).', { ratioPercent: 100 });
    case 'PAID_LEAVE': return make(1, '1.0 công', 'Nghỉ phép hưởng lương đã được duyệt, tính đủ 1.0 ngày công.', { ratioPercent: 100 });
    case 'UNPAID_LEAVE': return make(0, '0 công', 'Nghỉ không hưởng lương theo đơn đề nghị đã phê duyệt.', { worked: 0, ratioPercent: 0 });
  }
  if (hs === 'FORFEITED') return make(0, '0 công', 'Đã xác nhận vắng (không tính công do thiếu mốc chấm công và không giải trình).', { worked: 0, ratioPercent: 0 });
  if (hs === 'FORGOTTEN') return make(0, '0 công', 'Chưa đủ 2 mốc vào/ra. Theo chính sách công ty, ngày công tạm tính là 0 công cho đến khi gửi đơn Xác nhận công và được Quản lý duyệt.', { provisional: true });
  if (dayStatus(d) === 'CHECKED_IN') return make(0, 'Đang làm việc', 'Ca làm việc đang diễn ra. Ngày công sẽ được chốt sau khi bạn hoàn tất ra ca.', { provisional: true });
  const credited = Math.min(obligation, worked + leave);
  const ratio = obligation > 0 ? credited / obligation : 0;
  const rp = Math.min(100, Math.round(ratio * 100));
  if (ratio >= full - 0.0001) return make(1, '1.0 công', `Thời gian làm việc đạt ${rp}% ca quy định (yêu cầu tối thiểu ${fp}), được ghi nhận trọn vẹn 1.0 ngày công.`, { ratioPercent: rp });
  if (ratio >= half - 0.0001) return make(0.5, '0.5 công', `Thời gian làm việc đạt ${rp}% ca quy định (từ ${hp} đến dưới ${fp}), được ghi nhận 0.5 ngày công.`, { ratioPercent: rp });
  return make(0, '0 công', `Thời gian làm việc đạt ${rp}% ca (dưới ${hp}), không đủ điều kiện ghi nhận ngày công.`, { ratioPercent: rp });
}
