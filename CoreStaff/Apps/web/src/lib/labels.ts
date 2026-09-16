import type { ApiSource } from '../config/api';
import type { Role } from '../services/auth';

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    SYSTEM_ADMIN: 'System Admin',
    HR: 'Nhân sự',
    DEPARTMENT_MANAGER: 'Quản lý phòng ban',
    EMPLOYEE: 'Nhân viên',
  };
  return labels[role] ?? role;
}

export function statusPill(source: ApiSource | null): string {
  if (source === 'local') return 'Local fallback';
  if (source === 'remote') return 'Remote API';
  return 'Đang kiểm tra';
}
