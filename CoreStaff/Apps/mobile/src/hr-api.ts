import { apiRequest } from './auth';

/**
 * API của HR, khớp web/src/services/hrService.ts và leave.service.ts.
 * Mobile chỉ dùng phần đọc cùng thao tác "áp dụng đơn nghỉ".
 */
export interface HrEmployee {
  _id: string;
  userId?: string;
  employeeCode: string;
  fullName?: string | null;
  email?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  positionName?: string | null;
  directManagerId?: string | null;
  managerName?: string | null;
  employmentStatus: string;
  employmentType?: string | null;
  joinDate?: string | null;
  createdAt?: string | null;
  dependents?: unknown[];
}

export interface HrDepartment { _id: string; name: string; active?: boolean }

export interface HrContract {
  _id: string;
  employeeFullName?: string | null;
  employeeCode?: string | null;
  contractType?: string | null;
  status: string;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  expiryWarningDays?: number | null;
  isExpiringSoon?: boolean;
  isExpired?: boolean;
}

export interface ComplianceFinding { code: string; employeeFullName?: string | null; employeeCode?: string | null }

export interface HrLeave {
  _id: string;
  employeeId: string;
  leaveType?: string;
  status: string;
  startDate: string;
  endDate: string;
  durationType?: string;
  requestedStart?: string | null;
  requestedEnd?: string | null;
  calculatedMinutes?: number | null;
  leaveEquivalent?: number | null;
  reason?: string | null;
  createdAt?: string | null;
}

export interface TimesheetPeriod { _id?: string; period: string; startDate: string; endDate: string; status: string }

export const getHrEmployees = (base: string) => apiRequest<HrEmployee[]>(base, '/api/hr/employees');
export const getHrDepartments = (base: string) => apiRequest<HrDepartment[]>(base, '/api/hr/departments');
export const getHrContracts = (base: string) => apiRequest<HrContract[]>(base, '/api/hr/contracts');
export const getHrCompliance = (base: string) => apiRequest<{ findings?: ComplianceFinding[] }>(base, '/api/hr/contracts/compliance');
export const getHrLeaves = (base: string) => apiRequest<HrLeave[]>(base, '/api/hr/leave-requests');
export const getTimesheetPeriods = (base: string) => apiRequest<TimesheetPeriod[]>(base, '/api/hr/timesheet-periods');
export const applyHrLeave = (base: string, id: string) =>
  apiRequest<HrLeave>(base, `/api/hr/leave-requests/${encodeURIComponent(id)}/apply`, { method: 'POST' });

type Tone = 'success' | 'warning' | 'info' | 'neutral' | 'danger';
const pick = (map: Record<string, string>, key?: string | null) => (key && map[key]) || key || '-';

export const employmentStatusLabel = (s?: string | null) => pick({ PROBATION: 'Thử việc', ACTIVE: 'Đang làm việc', ON_LEAVE: 'Đang nghỉ phép', RESIGNED: 'Đã nghỉ việc', TERMINATED: 'Đã chấm dứt' }, s);
export const employmentStatusTone = (s?: string | null): Tone => s === 'ACTIVE' ? 'success' : s === 'PROBATION' ? 'warning' : s === 'ON_LEAVE' ? 'info' : 'neutral';
export const employmentTypeLabel = (s?: string | null) => pick({ FULL_TIME: 'Toàn thời gian', PART_TIME: 'Bán thời gian', INTERN: 'Thực tập', CONTRACTOR: 'Cộng tác viên' }, s);
export const contractTypeLabel = (s?: string | null) => pick({ PROBATION: 'Thử việc', FIXED_TERM: 'Có thời hạn', INDEFINITE_TERM: 'Không thời hạn' }, s);
export const contractStatusLabel = (s?: string | null) => pick({ DRAFT: 'Nháp', ACTIVE: 'Đang hiệu lực', EXPIRED: 'Hết hiệu lực', TERMINATED: 'Đã chấm dứt' }, s);
export const contractStatusTone = (s?: string | null): Tone => s === 'ACTIVE' ? 'success' : s === 'EXPIRED' ? 'danger' : 'neutral';
export const complianceLabel = (code?: string | null) => pick({ NO_CONTRACT: 'Chưa có hợp đồng', ACTIVE_PAST_EXPIRY: 'Hợp đồng quá hạn vẫn đang làm', EXPIRED_NOT_RENEWED: 'Hợp đồng hết hạn chưa gia hạn' }, code);
export const periodStatusLabel = (s?: string | null) => pick({ OPEN: 'Đang mở', REVIEWING: 'Đang rà soát', READY_TO_CLOSE: 'Sẵn sàng chốt', CLOSED: 'Đã chốt', LOCKED: 'Đã khóa' }, s);
export const leaveStatusLabel = (s?: string | null) => pick({ PENDING: 'Chờ duyệt', PENDING_MANAGER: 'Chờ quản lý', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy', HR_APPLIED: 'Đã áp dụng', CLARIFICATION_REQUESTED: 'Cần bổ sung' }, s);
export const leaveDurationLabel = (s?: string | null) => pick({ FULL_DAY: 'Cả ngày', MORNING_HALF: 'Buổi sáng', AFTERNOON_HALF: 'Buổi chiều', CUSTOM_HOURS: 'Theo giờ' }, s || 'FULL_DAY');
