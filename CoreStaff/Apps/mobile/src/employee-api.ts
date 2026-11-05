import { apiRequest } from './auth';

export type AttendanceStatus = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED' | 'DAY_OFF' | 'LOCKED';

export interface AttendanceEvent {
  eventId: string;
  method: 'NETWORK' | 'GPS' | 'SELFIE';
  recordedAt: string;
  address?: string;
  approvalStatus: string;
  accuracyMeters?: number;
  distanceMeters?: number;
  workplaceName?: string;
  evidenceUrl?: string;
  location?: { address?: string; accuracyMeters?: number };
}

export interface TodayAttendance {
  workDate: string;
  serverTime: string;
  attendanceStatus: AttendanceStatus;
  availableAction: 'CHECK_IN' | 'CHECK_OUT' | 'NONE';
  workMode: 'IN_OFFICE' | 'OUT_OFFICE' | null;
  checkIn: AttendanceEvent | null;
  checkOut: AttendanceEvent | null;
  workingMinutes: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  overallApprovalStatus: string;
  attendanceRequirements: {
    durationTypes: LeaveDurationType[];
    leaveTypes: Array<'PAID_LEAVE' | 'UNPAID_LEAVE'>;
    approvedLeaveIntervals: LeaveInterval[];
    requiredWorkingIntervals: LeaveInterval[];
    approvedLeaveMinutes: number;
    requiredWorkingMinutes: number;
    effectiveCheckInTime: string | null;
    effectiveCheckOutTime: string | null;
  } | null;
  pendingLeave: {
    durationType: LeaveDurationType;
    requestedStart?: string;
    requestedEnd?: string;
  } | null;
  assignment: {
    shiftName: string;
    shiftHours: string;
    startTime: string;
    endTime: string;
    workplaceName: string;
    workplaceType: 'IN_OFFICE' | 'OUT_OFFICE';
    address: string;
    allowWifiAttendance?: boolean;
    allowGpsAttendance?: boolean;
    allowSelfieFallback?: boolean;
    hasWifiNetworks?: boolean;
  };
}

export interface WorkCreditPolicy {
  halfDayMinimumRatio?: number;
  fullDayMinimumRatio?: number;
}

export interface AttendanceDay {
  _id: string;
  workDate: string;
  attendanceStatus: AttendanceStatus;
  status?: string;
  shiftName?: string;
  workdayType?: 'WEEKLY_OFF' | 'PUBLIC_HOLIDAY' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | string;
  dayResult?: string;
  workingMinutes?: number;
  totalWorkingMinutes?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  checkIn: AttendanceEvent | null;
  checkOut: AttendanceEvent | null;
  resolution?: { type?: string; reason?: string } | null;
  attendanceRequirements?: { requiredWorkingMinutes?: number; approvedLeaveMinutes?: number; durationTypes?: string[] } | null;
  overtime?: { otMinutes?: number; status?: string; approvedStart?: string; approvedEnd?: string; requestedStart?: string; requestedEnd?: string; reason?: string; reviewComment?: string } | null;
}

export interface AttendanceHistory {
  month: string;
  totalDays: number;
  summary: {
    workingDays: number;
    totalWorkingMinutes: number;
    lateDays: number;
    earlyDays: number;
    otMinutes: number;
    otDays: number;
  };
  items: AttendanceDay[];
  workCreditPolicy?: WorkCreditPolicy | null;
}

export type LeaveStatus = 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'HR_APPLIED';
export type LeaveDurationType = 'FULL_DAY' | 'MORNING_HALF' | 'AFTERNOON_HALF' | 'CUSTOM_HOURS';
export interface LeaveInterval { from: string; to: string }
export interface LeavePreviewDay {
  date: string;
  shiftStart: string;
  shiftEnd: string;
  breakMinutes: number;
  breakStart: string;
  breakEnd: string;
  requestedStart: string;
  requestedEnd: string;
  calculatedMinutes: number;
  leaveEquivalent: number;
  approvedLeaveIntervals: LeaveInterval[];
  requiredWorkingIntervals: LeaveInterval[];
}
export interface LeavePreview {
  durationType: LeaveDurationType;
  requestedStart?: string;
  requestedEnd?: string;
  calculatedMinutes: number;
  leaveEquivalent: number;
  days: LeavePreviewDay[];
}
export interface LeaveRequest {
  _id: string;
  startDate: string;
  endDate: string;
  leaveType: 'PAID_LEAVE' | 'UNPAID_LEAVE';
  durationType?: LeaveDurationType;
  requestedStart?: string;
  requestedEnd?: string;
  calculatedMinutes?: number;
  leaveEquivalent?: number;
  approvedLeaveIntervals?: LeaveInterval[];
  requiredWorkingIntervals?: LeaveInterval[];
  reason: string;
  status: LeaveStatus;
  reviewComment?: string;
  createdAt?: string;
}

export interface OvertimeRequest {
  _id: string;
  workDate: string;
  requestedStart?: string;
  requestedEnd?: string;
  reason: string;
  workDescription?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED';
  reviewComment?: string;
  overtimeResult?: { eligibleMinutes?: number; overtimeType?: string } | null;
  createdAt?: string;
}

export interface EmployeeProfile {
  _id: string;
  fullName?: string | null;
  employeeCode: string;
  employmentType: string;
  employmentStatus: string;
  phone?: string;
  email?: string;
  address?: string;
  joinDate: string;
  departmentName?: string | null;
  positionName?: string | null;
  managerName?: string | null;
  workplaceName?: string | null;
}

export interface Payslip {
  _id: string;
  periodLabel: string;
  status: 'GENERATED' | 'RELEASED' | 'VIEWED';
  grossEarnings: number;
  netSalary: number;
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  pitAmount: number;
  otherDeductions: number;
  earningBreakdown?: Array<{ label: string; amount: number; type?: string }>;
  allowanceBreakdown?: Array<{ label: string; amount: number }>;
  otBreakdown?: { breakdown?: Array<{ label: string; hours?: number; coefficient?: number; amount: number }> } | null;
  deductionBreakdown?: Array<{ label: string; amount: number }>;
  taxableIncome?: number;
  personalDeduction?: number;
  dependentDeduction?: number;
  payableWorkingDays?: number;
  standardWorkingDays?: number;
  employeeCode?: string;
  taxCode?: string;
  releasedAt?: string;
}

export const getTodayAttendance = (base: string) =>
  apiRequest<TodayAttendance>(base, '/api/attendance/today');

export const getAttendanceHistory = (base: string, month: string) =>
  apiRequest<AttendanceHistory>(base, `/api/attendance/history?month=${encodeURIComponent(month)}`);

export interface PunchLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  address?: string;
}

/**
 * Mirrors the web client: GPS proves IN_OFFICE presence, a selfie proves
 * OUT_OFFICE (or falls back when the server answers SELFIE_REQUIRED). The
 * selfie goes as multipart so the server's FileInterceptor picks it up.
 */
export const punchAttendance = (
  base: string,
  action: 'CHECK_IN' | 'CHECK_OUT',
  payload: { workMode?: 'IN_OFFICE' | 'OUT_OFFICE'; location?: PunchLocation; selfieUri?: string; note?: string; wifi?: { ssid?: string; bssid?: string } },
) => {
  const path = action === 'CHECK_IN' ? '/api/attendance/check-in' : '/api/attendance/check-out';
  const headers = { 'Idempotency-Key': newIdempotencyKey() };
  const wifiSsid = payload.wifi?.ssid;
  const wifiBssid = payload.wifi?.bssid;
  if (!payload.selfieUri) {
    return apiRequest<unknown>(base, path, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...(action === 'CHECK_IN' ? { workMode: payload.workMode } : {}),
        location: payload.location,
        note: payload.note,
        ...(wifiSsid ? { wifiSsid } : {}),
        ...(wifiBssid ? { wifiBssid } : {}),
      }),
    });
  }
  const form = new FormData();
  if (action === 'CHECK_IN' && payload.workMode) form.append('workMode', payload.workMode);
  // Server chỉ nhận jpeg/png/webp: luôn gửi kiểu MIME tường minh, không suy từ đuôi file (ảnh camera có thể không có đuôi).
  const ext = /\.(png|webp)$/i.exec(payload.selfieUri)?.[1]?.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  form.append('selfie', { uri: payload.selfieUri, name: `selfie.${ext || 'jpg'}`, type: mime } as unknown as Blob);
  if (payload.location) {
    form.append('latitude', String(payload.location.latitude));
    form.append('longitude', String(payload.location.longitude));
    if (payload.location.accuracyMeters != null) form.append('accuracyMeters', String(payload.location.accuracyMeters));
    if (payload.location.address) form.append('address', payload.location.address);
  }
  if (payload.note) form.append('note', payload.note);
  if (wifiSsid) form.append('wifiSsid', wifiSsid);
  if (wifiBssid) form.append('wifiBssid', wifiBssid);
  return apiRequest<unknown>(base, path, { method: 'POST', headers, body: form });
};

export const getMyLeaveRequests = (base: string) =>
  apiRequest<LeaveRequest[]>(base, '/api/leave-requests/mine');

export const previewLeaveRequest = (base: string, payload: { startDate: string; endDate: string; durationType: LeaveDurationType; requestedStart?: string; requestedEnd?: string }) =>
  apiRequest<LeavePreview>(base, '/api/leave-requests/preview', { method: 'POST', body: JSON.stringify(payload) });

export const createLeaveRequest = (base: string, payload: { startDate: string; endDate: string; leaveType: 'PAID_LEAVE' | 'UNPAID_LEAVE'; durationType?: LeaveDurationType; requestedStart?: string; requestedEnd?: string; reason: string }) =>
  apiRequest<LeaveRequest>(base, '/api/leave-requests', { method: 'POST', body: JSON.stringify(payload) });

export const getMyLeaveRequest = (base: string, id: string) =>
  apiRequest<LeaveRequest>(base, `/api/leave-requests/mine/${encodeURIComponent(id)}`);

export const cancelMyLeaveRequest = (base: string, id: string) =>
  apiRequest<LeaveRequest>(base, `/api/leave-requests/mine/${encodeURIComponent(id)}/cancel`, { method: 'POST' });

export const getMyOvertimeRequests = (base: string) =>
  apiRequest<OvertimeRequest[]>(base, '/api/overtime/mine');

export const createOvertimeRequest = (base: string, payload: { workDate: string; requestedStart: string; requestedEnd: string; reason: string; workDescription?: string; retroactiveReason?: string }) =>
  apiRequest<OvertimeRequest>(base, '/api/overtime', { method: 'POST', body: JSON.stringify(payload) });

export const getMyProfile = (base: string) =>
  apiRequest<EmployeeProfile>(base, '/api/hr/employees/me');

export const getMyPayslips = (base: string) =>
  apiRequest<Payslip[]>(base, '/api/payslips/me');

export const markPayslipViewed = (base: string, id: string) =>
  apiRequest<void>(base, `/api/payslips/me/${encodeURIComponent(id)}/viewed`, { method: 'POST' });

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function friendlyEmployeeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.';
  const code = 'code' in Object(error) ? String((error as { code?: unknown }).code || '') : '';
  const messages: Record<string, string> = {
    ASSIGNMENT_NOT_CONFIGURED: 'Bạn chưa được phân ca hoặc nơi làm việc. Vui lòng liên hệ HR.',
    ALREADY_CHECKED_IN: 'Bạn đã vào ca hôm nay.',
    ALREADY_CHECKED_OUT: 'Bạn đã hoàn thành ca hôm nay.',
    NETWORK_NOT_ALLOWED: 'Mạng hiện tại không thuộc mạng công ty.',
    SELFIE_REQUIRED: 'Không xác thực được vị trí công ty. Vui lòng chấm công bằng ảnh selfie.',
    UNSUPPORTED_FILE_TYPE: 'Ảnh không đúng định dạng (chỉ nhận JPG, PNG hoặc WebP). Vui lòng chụp lại.',
    FILE_TOO_LARGE: 'Ảnh quá lớn (tối đa 5MB). Vui lòng chụp lại.',
    OUTSIDE_ALLOWED_AREA: 'Bạn đang ở ngoài phạm vi chấm công.',
    LOW_LOCATION_ACCURACY: 'Tín hiệu GPS chưa đủ chính xác. Hãy ra nơi thoáng hơn và thử lại.',
    ATTENDANCE_LOCKED: 'Kỳ công đã khóa, không thể thay đổi.',
    LEAVE_DATE_RANGE_INVALID: 'Khoảng ngày nghỉ chưa hợp lệ.',
    LEAVE_WORK_SCHEDULE_REQUIRED: 'Ngày này bạn không có lịch làm việc (có thể là ngày nghỉ). Hãy chọn ngày khác.',
    LEAVE_WORK_SCHEDULE_INVALID: 'Lịch làm việc của ngày này chưa hợp lệ. Vui lòng liên hệ HR.',
    LEAVE_NON_WORKING_DAY: 'Ngày này là ngày nghỉ, không cần xin nghỉ phép.',
    LEAVE_INTERVAL_OUTSIDE_WORKING_TIME: 'Khoảng giờ xin nghỉ nằm ngoài giờ làm việc của ca.',
    LEAVE_RANGE_TOO_LARGE: 'Khoảng ngày xin nghỉ quá dài. Hãy chia thành nhiều đơn.',
    LEAVE_REQUEST_OVERLAP: 'Bạn đã có đơn nghỉ trùng thời gian này.',
    LEAVE_REQUEST_INTERVAL_INVALID: 'Khoảng giờ xin nghỉ chưa hợp lệ.',
    LEAVE_DAY_ALREADY_OVERRIDDEN: 'Ngày này đã được HR điều chỉnh, không thể gửi thêm đơn.',
    REVIEW_REASON_REQUIRED: 'Vui lòng nhập ý kiến xử lý (tối thiểu vài ký tự).',
    LEAVE_REJECTION_REASON_REQUIRED: 'Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự).',
    REQUEST_STATE_CHANGED: 'Đơn này vừa được cập nhật ở nơi khác. Hãy kéo để tải lại danh sách.',
    LEAVE_REQUEST_NOT_PENDING: 'Đơn này đã được xử lý.',
    LEAVE_REQUEST_ALREADY_DECIDED: 'Đơn này đã được xử lý.',
    SELF_APPROVAL_FORBIDDEN: 'Bạn không thể tự duyệt đơn của chính mình.',
    LEAVE_SELF_APPROVAL_FORBIDDEN: 'Bạn không thể tự duyệt đơn của chính mình.',
    DEPARTMENT_SCOPE_VIOLATION: 'Đơn này không thuộc phòng ban bạn phụ trách.',
    PERIOD_CLOSED_OR_PAYROLL_CLAIMED: 'Kỳ công đã khóa hoặc đã chốt lương, không thể thay đổi.',
    REQUEST_NOT_FOUND: 'Không tìm thấy đơn này.',
    DEPARTMENT_MANAGER_NOT_FOUND: 'Bạn chưa được gán phụ trách phòng ban nào. Vui lòng liên hệ HR.',
    OVERTIME_ANNUAL_LIMIT_EXCEEDED: 'Bạn đã vượt giới hạn tăng ca trong năm.',
    OVERTIME_MONTHLY_LIMIT_EXCEEDED: 'Bạn đã vượt giới hạn tăng ca trong tháng.',
    OVERTIME_DAILY_LIMIT_EXCEEDED: 'Bạn đã vượt giới hạn tăng ca trong ngày.',
    OVERTIME_ATTENDANCE_INCOMPLETE: 'Chưa thể đăng ký tăng ca: ngày này bạn chưa có bản ghi chấm công vào/ra hoàn chỉnh.',
    OVERTIME_ATTENDANCE_NOT_VERIFIED: 'Chấm công của ngày này chưa được xác thực nên chưa thể đăng ký tăng ca.',
    OVERTIME_BELOW_MINIMUM: 'Thời lượng tăng ca chưa đạt mức tối thiểu theo chính sách.',
    OVERTIME_FILING_WINDOW_CLOSED: 'Đã quá thời hạn đăng ký tăng ca cho ngày này.',
    OVERTIME_WINDOW_INVALID: 'Khung giờ tăng ca chưa hợp lệ.',
    OVERTIME_POLICY_NOT_FOUND: 'Công ty chưa cấu hình chính sách tăng ca. Vui lòng liên hệ HR.',
    OVERTIME_OVERLAPS_SCHEDULE: 'Khung giờ OT đang trùng với ca làm chính.',
    OVERTIME_REQUEST_WINDOW_INVALID: 'Giờ bắt đầu phải sớm hơn giờ kết thúc.',
    OVERTIME_OVERLAP: 'Khung giờ này đang trùng với một đăng ký tăng ca khác.',
    OVERTIME_RETROACTIVE_REASON_REQUIRED: 'Đăng ký tăng ca muộn cần nêu rõ lý do khai báo muộn.',
    EMPLOYEE_PROFILE_NOT_FOUND: 'Chưa tìm thấy hồ sơ nhân viên. Vui lòng liên hệ HR.',
    PAYSLIP_NOT_FOUND_OR_NOT_ACCESSIBLE: 'Phiếu lương không tồn tại hoặc bạn không có quyền xem.',
  };
  return messages[code] || messages[raw] || raw;
}
