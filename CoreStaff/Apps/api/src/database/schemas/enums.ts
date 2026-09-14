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

/** FULL_TIME is the only supported value for the office-schedule MVP (SRS §15.2A). */
export const EmploymentType = {
  FULL_TIME: 'FULL_TIME',
} as const;
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType];

export const EmploymentStatus = {
  PROBATION: 'PROBATION',
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  RESIGNED: 'RESIGNED',
  TERMINATED: 'TERMINATED',
} as const;
export type EmploymentStatus = (typeof EmploymentStatus)[keyof typeof EmploymentStatus];

/**
 * SRS §176: an employee is only "working" in PROBATION/ACTIVE/ON_LEAVE.
 * RESIGNED/TERMINATED are terminal — kept for history, never transitioned out of.
 */
export const EMPLOYMENT_STATUS_TRANSITIONS: Record<EmploymentStatus, EmploymentStatus[]> = {
  PROBATION: [EmploymentStatus.ACTIVE, EmploymentStatus.RESIGNED, EmploymentStatus.TERMINATED],
  ACTIVE: [EmploymentStatus.ON_LEAVE, EmploymentStatus.RESIGNED, EmploymentStatus.TERMINATED],
  ON_LEAVE: [EmploymentStatus.ACTIVE, EmploymentStatus.RESIGNED, EmploymentStatus.TERMINATED],
  RESIGNED: [],
  TERMINATED: [],
};

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

/** Case-insensitive, trimmed email used for tenant-scoped uniqueness. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Case-insensitive, trimmed employee code. */
export function normalizeCode(code: string): string {
  return code.trim();
}