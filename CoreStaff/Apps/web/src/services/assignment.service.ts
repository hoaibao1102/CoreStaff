import { hrRequest, mapHrError } from './hrService';

export interface Assignment {
  _id: string;
  organizationId?: string;
  userId: string;
  departmentId: string;
  workplaceId?: string;
  effectiveFrom: string;
  effectiveTo: string;
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

/** Public mapper for assignment screens; technical backend messages stay hidden. */
export function assignmentErrorMessage(error: unknown): string {
  const err = error as { code?: string; status?: number; message?: string } | null;
  const raw = `${err?.code || ''} ${err?.message || ''}`;

  if (raw.includes('EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST')) {
    return 'Ngày bắt đầu phân công không thể ở trong quá khứ.';
  }
  if (raw.includes('EFFECTIVE_TO_MUST_BE_AFTER_EFFECTIVE_FROM')) {
    return 'Ngày kết thúc phân công phải sau ngày bắt đầu.';
  }
  if (raw.includes('OVERLAPPING_ASSIGNMENT_EXISTS') || err?.status === 409) {
    return 'Khoảng thời gian phân công của nhân viên đang bị trùng. Hãy chọn ngày khác hoặc ngưng phân công cũ trước.';
  }
  if (raw.includes('WORKPLACE_NOT_FOUND')) {
    return 'Nơi làm việc được chọn không tồn tại hoặc đã ngừng hoạt động.';
  }
  if (raw.includes('DEPARTMENT_NOT_FOUND')) {
    return 'Phòng ban được chọn không tồn tại hoặc đã ngừng hoạt động.';
  }
  if (raw.includes('USER_NOT_FOUND')) {
    return 'Không tìm thấy thông tin nhân viên trong tổ chức.';
  }

  return mapHrError(err?.code, err?.message || 'Không thể xử lý phân công. Vui lòng thử lại.');
}

