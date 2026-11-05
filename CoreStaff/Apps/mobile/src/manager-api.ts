import { apiRequest } from './auth';
import type { LeaveInterval, LeaveRequest, LeaveDurationType } from './employee-api';

/** Nhân viên thuộc phòng ban mà quản lý phụ trách (GET /api/manager/employees). */
export interface TeamMember {
  id: string;
  userId: string;
  employeeCode: string;
  fullName?: string | null;
  email?: string | null;
  positionName?: string | null;
  workplaceName?: string | null;
  employmentStatus: string;
  todayAttendance?: {
    attendanceStatus: string;
    checkInAt?: string | null;
    checkOutAt?: string | null;
    workMode?: string | null;
  } | null;
}

/** Đơn nghỉ phép trong hàng chờ của quản lý: server chỉ trả employeeId (= userId), tên phải ghép từ TeamMember. */
export interface ManagerLeaveRequest extends LeaveRequest {
  employeeId: string;
  departmentId?: string;
  durationType?: LeaveDurationType;
  approvedLeaveIntervals?: LeaveInterval[];
}

export type ApprovalType = 'ATTENDANCE' | 'OVERTIME';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED';

/** Đơn chấm công/OT trong hàng chờ (GET /api/manager/approvals). */
export interface ManagerApproval {
  _id: string;
  employeeId?: unknown;
  employeeUserId?: unknown;
  type: ApprovalType;
  requestKind?: 'ATTENDANCE_CONFIRMATION';
  source?: string;
  workDate: string;
  reason: string;
  requestedStart?: string;
  requestedEnd?: string;
  status: ApprovalStatus;
  reviewComment?: string;
  workDescription?: string;
  isRetroactive?: boolean;
  retroactiveReason?: string;
  version: number;
  createdAt?: string;
  metadata?: { address?: string; workMode?: string; actionType?: string; adjustmentSource?: string; [key: string]: unknown };
  compliance?: { violations?: Array<{ code: string; severity: string; message: string }> };
}

export const getTeam = (base: string) =>
  apiRequest<TeamMember[]>(base, '/api/manager/employees');

export const getPendingApprovals = (base: string) =>
  apiRequest<ManagerApproval[]>(base, '/api/manager/approvals?status=PENDING');

export const getPendingLeaveRequests = (base: string) =>
  apiRequest<ManagerLeaveRequest[]>(base, '/api/manager/leave-requests?status=PENDING_MANAGER');

export const approveLeave = (base: string, id: string) =>
  apiRequest<ManagerLeaveRequest>(base, `/api/manager/leave-requests/${encodeURIComponent(id)}/approve`, { method: 'POST' });

export const rejectLeave = (base: string, id: string, reason: string) =>
  apiRequest<ManagerLeaveRequest>(base, `/api/manager/leave-requests/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });

export type ApprovalAction = 'approve' | 'reject' | 'request-clarification';

export const decideApproval = (base: string, item: ManagerApproval, action: ApprovalAction, reason?: string) =>
  apiRequest<ManagerApproval>(base, `/api/manager/approvals/${encodeURIComponent(item._id)}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion: item.version, reason: reason || undefined, approvedStart: item.requestedStart, approvedEnd: item.requestedEnd }),
  });

/** Đơn xác nhận công theo lịch cần kiểm tra ngữ cảnh/kỳ công nên chỉ duyệt được trên web. */
export const isWebOnlyApproval = (item: ManagerApproval) =>
  item.requestKind === 'ATTENDANCE_CONFIRMATION' || item.source === 'ATTENDANCE_CONFIRMATION' || item.metadata?.adjustmentSource === 'ATTENDANCE_CONFIRMATION';

export function approvalLabel(item: ManagerApproval) {
  if (item.type === 'OVERTIME') return 'Tăng ca (OT)';
  if (isWebOnlyApproval(item)) return 'Xác nhận công theo lịch';
  return item.metadata?.adjustmentSource === 'MANUAL_ADJUSTMENT' ? 'Điều chỉnh công' : 'Chấm công selfie';
}

/** Lấy userId từ trường populate hoặc id thô, để ghép tên nhân viên. */
export function approvalEmployeeKey(item: ManagerApproval): string {
  const pick = (value: unknown): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') { const v = value as { _id?: unknown; id?: unknown }; return String(v._id ?? v.id ?? ''); }
    return '';
  };
  return pick(item.employeeUserId) || pick(item.employeeId);
}
