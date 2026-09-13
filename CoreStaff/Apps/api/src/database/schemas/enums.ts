export const Role = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  HR: 'HR',
  DEPARTMENT_MANAGER: 'DEPARTMENT_MANAGER',
  EMPLOYEE: 'EMPLOYEE',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  DISABLED: 'DISABLED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const OrganizationStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DISABLED: 'DISABLED',
} as const;
export type OrganizationStatus = (typeof OrganizationStatus)[keyof typeof OrganizationStatus];

/** Case-insensitive, trimmed email used for tenant-scoped uniqueness. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Case-insensitive, trimmed employee code. */
export function normalizeCode(code: string): string {
  return code.trim();
}