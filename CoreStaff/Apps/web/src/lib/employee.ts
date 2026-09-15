import type { AuthUser } from '../services/auth';

// Presentation data only; this is not an API response contract.
export const employmentStatuses = {
  PROBATION: 'Thử việc', ACTIVE: 'Đang làm việc', ON_LEAVE: 'Đang nghỉ phép',
  RESIGNED: 'Đã nghỉ việc', TERMINATED: 'Đã chấm dứt',
} as const;
export interface EmployeeView {
  id: string; userId: string; organizationId: string; employeeCode: string;
  fullName?: string | null; email?: string | null; phone?: string | null;
  department?: string | null; position?: string | null; manager?: string | null;
  workplace?: string | null; shift?: string | null;
  employmentStatus: keyof typeof employmentStatuses;
  joinDate?: string | null;
}
export type DataState<T> = { status: 'unavailable' | 'loading' | 'error' | 'forbidden' }
  | { status: 'ready'; data: T };
export function canViewEmployees(user: AuthUser) {
  return user.role === 'HR' && !!user.organizationId;
}
export function canViewProfile(user: AuthUser) {
  return !!(user._id ?? user.id);
}
export function directoryPage(rows: EmployeeView[], organizationId: string, query: string,
  department: string, status: string, page: number) {
  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = rows.filter(row => row.organizationId === organizationId
    && (!term || `${row.fullName ?? ''} ${row.employeeCode}`.toLocaleLowerCase('vi').includes(term))
    && (!department || row.department === department)
    && (!status || row.employmentStatus === status));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.max(1, Math.min(page, pages));
  return { rows: filtered.slice((current - 1) * 10, current * 10), total: filtered.length, pages, current };
}
export function isOwnProfile(user: AuthUser, profile: EmployeeView) {
  const id = user._id ?? user.id;
  return !!id && !!user.organizationId && profile.userId === id && profile.organizationId === user.organizationId;
}
