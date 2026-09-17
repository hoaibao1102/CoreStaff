import { hrRequest, mapHrError } from './hrService';

export interface Workplace { _id: string; organizationId?: string; code: string; name: string; address: string; latitude: number; longitude: number; allowedRadiusMeters: number; maximumAccuracyMeters: number; active: boolean; createdAt?: string; updatedAt?: string; }
export interface CreateWorkplacePayload { code: string; name: string; address: string; latitude: number; longitude: number; allowedRadiusMeters: number; maximumAccuracyMeters: number; }
export type UpdateWorkplacePayload = Partial<CreateWorkplacePayload>;
export interface WorkplaceFilters { active?: boolean; search?: string; }

function path(id: string) { return `/api/hr/workplaces/${encodeURIComponent(id)}`; }
export function getWorkplaces(base: string, filters: WorkplaceFilters = {}) {
  const params = new URLSearchParams();
  if (filters.active !== undefined) params.set('active', String(filters.active));
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  return hrRequest<Workplace[]>(base, `/api/hr/workplaces${params.size ? `?${params}` : ''}`, { method: 'GET' });
}
export function getWorkplaceById(base: string, id: string) { return hrRequest<Workplace>(base, path(id), { method: 'GET' }); }
export function createWorkplace(base: string, payload: CreateWorkplacePayload) { return hrRequest<Workplace>(base, '/api/hr/workplaces', { method: 'POST', body: JSON.stringify(payload) }); }
export function updateWorkplace(base: string, id: string, payload: UpdateWorkplacePayload) { return hrRequest<Workplace>(base, path(id), { method: 'PATCH', body: JSON.stringify(payload) }); }
export function activateWorkplace(base: string, id: string) { return hrRequest<Workplace>(base, `${path(id)}/activate`, { method: 'PATCH' }); }
export function deactivateWorkplace(base: string, id: string) { return hrRequest<Workplace>(base, `${path(id)}/deactivate`, { method: 'PATCH' }); }

export function workplaceErrorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const messages: Record<string, string> = {
    WORKPLACE_CODE_ALREADY_EXISTS: 'Mã nơi làm việc đã tồn tại. Vui lòng sử dụng mã khác.',
    WORKPLACE_COORDINATES_ALREADY_EXISTS: 'Tọa độ này đã được sử dụng cho một nơi làm việc khác.',
    WORKPLACE_NOT_FOUND: 'Không tìm thấy nơi làm việc.',
    CANNOT_DEACTIVATE_WORKPLACE_IN_USE_BY_ACTIVE_ASSIGNMENTS: 'Không thể ngưng hoạt động nơi làm việc vì vẫn còn nhân viên đang được phân công tại đây.',
    VALIDATION_FAILED: 'Thông tin nơi làm việc chưa hợp lệ. Vui lòng kiểm tra lại.',
  };
  return (code && messages[code]) || mapHrError(code, 'Không thể thực hiện thao tác. Vui lòng thử lại.');
}
