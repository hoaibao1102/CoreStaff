import { apiRequest } from './auth';

export type AttendanceStatus = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED' | 'DAY_OFF' | 'LOCKED';

export interface AttendanceEvent {
  eventId: string;
  method: 'NETWORK' | 'GPS' | 'SELFIE';
  recordedAt: string;
  address?: string;
  approvalStatus: string;
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
  assignment: {
    shiftName: string;
    shiftHours: string;
    startTime: string;
    endTime: string;
    workplaceName: string;
    workplaceType: 'IN_OFFICE' | 'OUT_OFFICE';
    address: string;
  };
}

export interface AttendanceDay {
  _id: string;
  workDate: string;
  attendanceStatus: AttendanceStatus;
  workingMinutes?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  checkIn: AttendanceEvent | null;
  checkOut: AttendanceEvent | null;
  overtime?: { otMinutes?: number; status?: string } | null;
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
}

export type LeaveStatus = 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED' | 'HR_APPLIED';
export interface LeaveRequest {
  _id: string;
  startDate: string;
  endDate: string;
  leaveType: 'PAID_LEAVE' | 'UNPAID_LEAVE';
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
  earningBreakdown?: Array<{ label: string; amount: number }>;
  deductionBreakdown?: Array<{ label: string; amount: number }>;
  releasedAt?: string;
}

export const getTodayAttendance = (base: string) =>
  apiRequest<TodayAttendance>(base, '/api/attendance/today');

export const getAttendanceHistory = (base: string, month: string) =>
  apiRequest<AttendanceHistory>(base, `/api/attendance/history?month=${encodeURIComponent(month)}`);

export const punchAttendance = (base: string, action: 'CHECK_IN' | 'CHECK_OUT', workMode: 'IN_OFFICE' | 'OUT_OFFICE', note?: string) =>
  apiRequest<unknown>(base, action === 'CHECK_IN' ? '/api/attendance/check-in' : '/api/attendance/check-out', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(action === 'CHECK_IN' ? { workMode, note } : { note }),
  });

export const getMyLeaveRequests = (base: string) =>
  apiRequest<LeaveRequest[]>(base, '/api/leave-requests/mine');

export const createLeaveRequest = (base: string, payload: { startDate: string; endDate: string; leaveType: 'PAID_LEAVE' | 'UNPAID_LEAVE'; reason: string }) =>
  apiRequest<LeaveRequest>(base, '/api/leave-requests', { method: 'POST', body: JSON.stringify(payload) });

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
    SELFIE_REQUIRED: 'Ca này cần xác thực vị trí hoặc ảnh selfie trên phiên bản đầy đủ.',
    OUTSIDE_ALLOWED_AREA: 'Bạn đang ở ngoài phạm vi chấm công.',
    ATTENDANCE_LOCKED: 'Kỳ công đã khóa, không thể thay đổi.',
    LEAVE_DATE_RANGE_INVALID: 'Khoảng ngày nghỉ chưa hợp lệ.',
    OVERTIME_OVERLAPS_SCHEDULE: 'Khung giờ OT đang trùng với ca làm chính.',
    OVERTIME_REQUEST_WINDOW_INVALID: 'Giờ bắt đầu phải sớm hơn giờ kết thúc.',
    OVERTIME_OVERLAP: 'Khung giờ này đang trùng với một đăng ký tăng ca khác.',
    OVERTIME_RETROACTIVE_REASON_REQUIRED: 'Đăng ký tăng ca muộn cần nêu rõ lý do khai báo muộn.',
    EMPLOYEE_PROFILE_NOT_FOUND: 'Chưa tìm thấy hồ sơ nhân viên. Vui lòng liên hệ HR.',
    PAYSLIP_NOT_FOUND_OR_NOT_ACCESSIBLE: 'Phiếu lương không tồn tại hoặc bạn không có quyền xem.',
  };
  return messages[code] || messages[raw] || raw;
}
