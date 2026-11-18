import { hrRequest, mapHrError } from './hrService';
import { isoDatesToVN } from '@/lib/datetime';

export interface Assignment {
  _id: string;
  organizationId?: string;
  userId: string;
  departmentId: string;
  workplaceId?: string;
  effectiveFrom?: string;
  /** Absent for open-ended (seeded) assignments. */
  effectiveTo?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAssignmentPayload {
  userId: string;
  departmentId: string;
  workplaceId?: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface UpdateAssignmentPayload {
  userId?: string;
  departmentId?: string;
  workplaceId?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface AssignmentListParams {
  workplaceId?: string;
  active?: boolean;
}

/** The API rejects an unfiltered list, so keep that invariant at the service boundary. */
export async function getAssignments(
  base: string,
  params: AssignmentListParams = { active: true },
): Promise<Assignment[]> {
  const query = new URLSearchParams();
  if (params.workplaceId?.trim()) query.set('workplaceId', params.workplaceId.trim());
  if (params.active !== undefined) query.set('active', String(params.active));
  if (!query.size) {
    const error = new Error('At least one assignment filter is required.');
    (error as Error & { code: string; status: number }).code = 'AT_LEAST_ONE_FILTER_REQUIRED';
    (error as Error & { code: string; status: number }).status = 400;
    throw error;
  }
  return hrRequest<Assignment[]>(base, `/api/hr/assignments?${query.toString()}`, { method: 'GET' });
}

export function getAssignmentById(base: string, id: string): Promise<Assignment> {
  return hrRequest<Assignment>(base, `/api/hr/assignments/${encodeURIComponent(id)}`, { method: 'GET' });
}

export function createAssignment(base: string, payload: CreateAssignmentPayload): Promise<Assignment> {
  return hrRequest<Assignment>(base, '/api/hr/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAssignment(base: string, id: string, payload: UpdateAssignmentPayload): Promise<Assignment> {
  return hrRequest<Assignment>(base, `/api/hr/assignments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function activateAssignment(base: string, id: string): Promise<Assignment> {
  return hrRequest<Assignment>(base, `/api/hr/assignments/${encodeURIComponent(id)}/activate`, { method: 'PATCH' });
}

export function deactivateAssignment(base: string, id: string): Promise<Assignment> {
  return hrRequest<Assignment>(base, `/api/hr/assignments/${encodeURIComponent(id)}/deactivate`, { method: 'PATCH' });
}

/** SRS §176: only PROBATION / ACTIVE / ON_LEAVE employees are still working. */
export const WORKING_EMPLOYMENT_STATUSES: readonly string[] = ['PROBATION', 'ACTIVE', 'ON_LEAVE'];

export function isWorkingEmployee(status?: string | null): boolean {
  return !!status && WORKING_EMPLOYMENT_STATUSES.includes(status);
}

/** Today as YYYY-MM-DD in Vietnam time — the lower bound for an assignment start date. */
export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

const ASSIGNMENT_CODE_MESSAGES: Record<string, string> = {
  EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST: 'Ngày bắt đầu phân công phải từ hôm nay trở đi, không thể chọn ngày trong quá khứ.',
  EFFECTIVE_TO_MUST_BE_AFTER_EFFECTIVE_FROM: 'Ngày kết thúc phân công không được trước ngày bắt đầu.',
  OVERLAPPING_ASSIGNMENT_EXISTS: 'Nhân viên đã có phân công trùng khoảng thời gian này ở cùng phòng ban. Hãy chọn ngày khác hoặc ngưng phân công cũ trước.',
  ASSIGNMENT_ALREADY_EXISTS: 'Phân công này đã tồn tại (trùng nhân viên, phòng ban và thời gian).',
  ASSIGNMENT_NOT_FOUND: 'Không tìm thấy phân công này. Có thể phân công đã bị xóa, hãy tải lại danh sách.',
  WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT: 'Nơi làm việc được chọn không còn tồn tại trong tổ chức.',
  DEPARTMENT_NOT_FOUND_OR_NOT_IN_TENANT: 'Phòng ban được chọn không còn tồn tại trong tổ chức.',
  EMPLOYEE_PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ nhân viên trong tổ chức nên không thể phân công.',
  EMPLOYEE_NOT_WORKING: 'Chỉ phân công được nhân viên đang làm việc. Nhân viên này đã nghỉ việc hoặc không còn làm việc.',
  AT_LEAST_ONE_USER_REQUIRED: 'Vui lòng chọn ít nhất một nhân viên để phân công.',
  AT_LEAST_ONE_FILTER_REQUIRED: 'Cần chọn bộ lọc (trạng thái hoặc nơi làm việc) để xem danh sách phân công.',
};

/**
 * The API sends `CODE: chi tiết tiếng Việt` (several joined by "; "). Show the
 * detail — it names the employee, dates and department — and only fall back to
 * a per-code sentence when the server sent a bare code.
 */
function specificApiMessages(message: string): string[] {
  const found: string[] = [];
  for (const part of message.split(';')) {
    const match = part.match(/\b[A-Z][A-Z0-9_]{3,}:\s+(.+)$/);
    if (match?.[1]) found.push(isoDatesToVN(match[1].trim()));
  }
  return found;
}

/** Public mapper for assignment screens: always tells HR what exactly went wrong. */
export function assignmentErrorMessage(error: unknown): string {
  const err = error as { code?: string; status?: number; message?: string; details?: unknown } | null;
  const message = err?.message ?? '';

  const specific = specificApiMessages(message);
  if (specific.length) return specific.join(' ');

  // DTO validation (class-validator) sends its Vietnamese messages in `details`.
  if (Array.isArray(err?.details)) {
    const lines = (err!.details as unknown[]).map(item => typeof item === 'string'
      ? item
      : (item as { message?: string } | null)?.message).filter((line): line is string => !!line);
    const detailed = lines.flatMap(line => specificApiMessages(line).length ? specificApiMessages(line) : [line]);
    if (detailed.length) return detailed.join(' ');
  }

  const raw = `${err?.code || ''} ${message}`;
  for (const [code, text] of Object.entries(ASSIGNMENT_CODE_MESSAGES)) {
    if (raw.includes(code)) return text;
  }

  if (err?.status === 400) return `Thông tin phân công chưa hợp lệ${message && message !== 'Bad Request' ? `: ${message}` : '. Vui lòng kiểm tra lại các trường đã nhập.'}`;
  if (err?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (err?.status === 403) return 'Bạn không có quyền thực hiện thao tác phân công này (chỉ HR được phép).';
  if (err?.status === 404) return 'Không tìm thấy dữ liệu phân công được yêu cầu. Hãy tải lại danh sách.';
  if (err?.status === 409) return 'Phân công xung đột với dữ liệu hiện có (nhân viên đã có phân công trùng). Hãy tải lại danh sách rồi thử lại.';
  if (err?.status && err.status >= 500) return `Máy chủ gặp lỗi khi xử lý phân công${err.code ? ` (mã ${err.code})` : ''}. Vui lòng thử lại sau hoặc báo bộ phận kỹ thuật.`;
  if (!err?.status) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.';

  return mapHrError(err?.code, message || 'Không thể xử lý phân công. Vui lòng thử lại.');
}
