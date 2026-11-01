import { hrRequest } from './hrService';

export interface OvertimeWindow { workDate: string; requestedStart: string; requestedEnd: string }
export interface OvertimePreview {
  workDate: string;
  calculationContract?: 'OVERTIME_V2' | 'LEGACY_V1';
  rawEligibleMinutes?: number;
  payableMinutes?: number;
  eligibleMinutes?: number;
  roundingDroppedMinutes?: number;
  minimumThresholdApplied?: boolean;
  contextHash?: string;
  canFile: boolean;
  blockedReasons: string[];
  reasons?: string[];
  policy?: { id: string; version: number; minimumOvertimeMinutes: number; overtimeRoundingMinutes: number };
}
export interface OvertimeSuggestion extends OvertimePreview { from: string; to: string }
export interface OvertimeSchedule {
  workDate: string;
  scheduled: { from: string; to: string; startTime: string; endTime: string; breakMinutes: number } | null;
  overtimeType: string;
  calendarType: string | null;
  overrideType: string | null;
  calculationContract?: 'OVERTIME_V2';
  canFile?: boolean;
  blockedReasons?: string[];
  suggestedOvertimeIntervals?: OvertimeSuggestion[];
}
export const previewOvertime = (base: string, payload: OvertimeWindow) => hrRequest<OvertimePreview>(base, '/api/overtime/preview', { method: 'POST', body: JSON.stringify(payload) });
export const getOvertimeSchedule = (base: string, date: string) => hrRequest<OvertimeSchedule>(base, `/api/overtime/schedule?date=${encodeURIComponent(date)}`, { method: 'GET' });

export function overtimeErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    OVERTIME_ATTENDANCE_INCOMPLETE: 'Chưa đủ dữ liệu xác minh OT. Xác nhận theo ca chỉ bổ sung công trong ca, không xác nhận thời gian OT; nếu có OT cần HR xác minh giờ thực tế.',
    OVERTIME_ATTENDANCE_NOT_VERIFIED: 'Dữ liệu chấm công chưa được xác minh. Vui lòng chờ duyệt hoặc liên hệ HR.',
    OVERTIME_ATTENDANCE_SOURCE_UNSUPPORTED: 'Mốc bổ sung theo lịch hoặc chưa rõ nguồn không chứng minh OT. Vui lòng liên hệ HR.',
    OVERTIME_BELOW_MINIMUM: 'Thời gian OT thực tế của đơn chưa đạt ngưỡng tối thiểu theo chính sách.',
    POLICY_CONFIGURATION_REQUIRED: 'HR cần cấu hình đầy đủ chính sách OT cho ngày làm việc này.',
    OVERTIME_PREVIEW_STALE: 'Dữ liệu đã thay đổi. Vui lòng xem lại dự tính OT trước khi gửi.',
    UNSUPPORTED_OVERNIGHT_SHIFT: 'Chưa hỗ trợ ca qua đêm. Vui lòng liên hệ HR.',
    PERIOD_CLOSED_OR_PAYROLL_CLAIMED: 'Kỳ công đã khóa hoặc đã được sử dụng cho bảng lương.',
    PERIOD_REQUIRED: 'Chưa có kỳ công phù hợp. Vui lòng liên hệ HR.',
  };
  return messages[code] ?? code;
}
