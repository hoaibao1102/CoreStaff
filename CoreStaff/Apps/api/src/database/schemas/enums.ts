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

/** The same §176 fact as a value: employees these systems still owe a contract to. */
export const WORKING_EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  EmploymentStatus.PROBATION,
  EmploymentStatus.ACTIVE,
  EmploymentStatus.ON_LEAVE,
];

/** SRS §30A.2 — contract type enum. */
export const ContractType = {
  PROBATION: 'PROBATION',
  FIXED_TERM: 'FIXED_TERM',
  INDEFINITE_TERM: 'INDEFINITE_TERM',
} as const;
export type ContractType = (typeof ContractType)[keyof typeof ContractType];

/**
 * Contract lifecycle (TASK-028/030). `EXPIRING_SOON` is deliberately NOT here:
 * it is derived on-read from `status === ACTIVE` + `expiryDate` inside the
 * 30-day warning window (see `computeExpiryWarning`), never stored.
 */
export const ContractStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  TERMINATED: 'TERMINATED',
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

/** Allowed contract status transitions (SRS §30A.2, TASK-030). */
export const CONTRACT_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: [ContractStatus.ACTIVE, ContractStatus.TERMINATED],
  ACTIVE: [ContractStatus.TERMINATED, ContractStatus.EXPIRED],
  // Renewal — HR must supply a new effectiveDate + expiryDate on this transition.
  EXPIRED: [ContractStatus.ACTIVE],
  TERMINATED: [],
};

/** Window (days) within which an ACTIVE contract is flagged "expiring soon". */
export const CONTRACT_EXPIRY_WARNING_DAYS = 30;

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

/**
 * Canonical form for `EmployeeProfile.employeeCode`. Case-folded because login
 * matches the code case-insensitively (SRS §4.2): with a trim-only normalizer,
 * `TVS-0001` and `tvs-0001` would be two distinct rows in one tenant that no
 * login could disambiguate. `EmployeeProfile` is the sole owner of this
 * identifier (see TASK-120 in Docs/DOCS_DECISION_LOG.md).
 */
export function normalizeEmployeeCode(code: string): string {
  return normalizeCode(code).toUpperCase();
}