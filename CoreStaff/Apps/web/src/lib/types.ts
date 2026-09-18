/**
 * Employment status enum values from backend (employee-profile.schema.ts).
 * These are the canonical string values — never rename or add new ones.
 */
export const EMPLOYMENT_STATUS = {
    PROBATION: 'PROBATION',
    ACTIVE: 'ACTIVE',
    ON_LEAVE: 'ON_LEAVE',
    RESIGNED: 'RESIGNED',
    TERMINATED: 'TERMINATED',
} as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUS)[keyof typeof EMPLOYMENT_STATUS];

/** Vietnamese labels for employment status — centralized, not scattered. */
export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
    PROBATION: 'Thử việc',
    ACTIVE: 'Đang làm việc',
    ON_LEAVE: 'Đang nghỉ phép',
    RESIGNED: 'Đã nghỉ việc',
    TERMINATED: 'Đã chấm dứt',
};

/** Status badge CSS classes — single source of truth. */
export const EMPLOYMENT_STATUS_BADGE: Record<EmploymentStatus, string> = {
    PROBATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    ON_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    RESIGNED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    TERMINATED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/** Valid status transitions per backend state machine. */
export const EMPLOYMENT_STATUS_TRANSITIONS: Record<EmploymentStatus, EmploymentStatus[]> = {
    PROBATION: ['ACTIVE', 'RESIGNED', 'TERMINATED'],
    ACTIVE: ['ON_LEAVE', 'RESIGNED', 'TERMINATED'],
    ON_LEAVE: ['ACTIVE', 'RESIGNED', 'TERMINATED'],
    RESIGNED: [],
    TERMINATED: [],
};

/** Gender enum from backend. */
export const GENDER = {
    MALE: 'MALE',
    FEMALE: 'FEMALE',
    OTHER: 'OTHER',
} as const;

export type Gender = (typeof GENDER)[keyof typeof GENDER];

export const GENDER_LABELS: Record<Gender, string> = {
    MALE: 'Nam',
    FEMALE: 'Nữ',
    OTHER: 'Khác',
};

/** Employment type enum from backend. */
export const EMPLOYMENT_TYPE = {
    FULL_TIME: 'FULL_TIME',
    PART_TIME: 'PART_TIME',
    CONTRACT: 'CONTRACT',
    INTERNSHIP: 'INTERNSHIP',
} as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPE)[keyof typeof EMPLOYMENT_TYPE];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
    FULL_TIME: 'Toàn thời gian',
    PART_TIME: 'Bán thời gian',
    CONTRACT: 'Hợp đồng',
    INTERNSHIP: 'Thực tập',
};

/** Contract type enum from backend (employment-contract.schema.ts, TASK-028). */
export const CONTRACT_TYPE = {
    PROBATION: 'PROBATION',
    FIXED_TERM: 'FIXED_TERM',
    INDEFINITE_TERM: 'INDEFINITE_TERM',
} as const;

export type ContractType = (typeof CONTRACT_TYPE)[keyof typeof CONTRACT_TYPE];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
    PROBATION: 'Thử việc',
    FIXED_TERM: 'Có thời hạn',
    INDEFINITE_TERM: 'Không thời hạn',
};

/** Stored contract status (TASK-030). EXPIRING_SOON is derived, never stored. */
export const CONTRACT_STATUS = {
    DRAFT: 'DRAFT',
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    TERMINATED: 'TERMINATED',
} as const;

export type ContractStatus = (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS];

/** Vietnamese labels for contract status. */
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
    DRAFT: 'Nháp',
    ACTIVE: 'Đang hiệu lực',
    EXPIRED: 'Hết hiệu lực',
    TERMINATED: 'Đã chấm dứt',
};

export const CONTRACT_STATUS_BADGE: Record<ContractStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    EXPIRED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    TERMINATED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

/** Valid contract transitions per backend state machine (table lives server-side). */
export const CONTRACT_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
    DRAFT: ['ACTIVE', 'TERMINATED'],
    ACTIVE: ['TERMINATED', 'EXPIRED'],
    EXPIRED: ['ACTIVE'],
    TERMINATED: [],
};

/** Compliance finding labels (codes mirror the API; see hrService.ContractFindingCode). */
export const CONTRACT_FINDING_LABELS: Record<string, string> = {
    NO_CONTRACT: 'Chưa có hợp đồng',
    EXPIRED_NOT_RENEWED: 'Hết hạn chưa gia hạn',
    ACTIVE_PAST_EXPIRY: 'Vẫn "hiệu lực" quá ngày hết hạn',
    PROBATION_OVERDUE: 'Qua hạn thử việc chưa ký HĐ',
};

export const CONTRACT_FINDING_ORDER = ['NO_CONTRACT', 'EXPIRED_NOT_RENEWED', 'ACTIVE_PAST_EXPIRY', 'PROBATION_OVERDUE'] as const;
