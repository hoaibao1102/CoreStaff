import { hrRequest } from './hrService';

// ───────── Salary Profiles (TASK-031..032) ─────────

export interface EmployeeAssignedAllowance {
  allowanceId: string;
  amount: number;
}

export interface SalaryProfile {
  _id: string;
  organizationId: string;
  employeeProfileId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  baseSalary: number;
  insuranceSalary: number;
  probationJobSalary?: number;
  probationAgreedSalary?: number;
  probationRate?: number;
  organizationAllowanceIds: string[];
  allowances?: EmployeeAssignedAllowance[];
  attendanceBonusPolicyId?: string | null;
  currency: 'VND';
  roundingRule: string;
  version: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Resolved names for UI
  employeeFullName?: string | null;
  employeeCode?: string | null;
}

export interface CreateSalaryProfilePayload {
  employeeId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  baseSalary: number;
  /** @deprecated Lương đóng BHXH là số dẫn xuất — backend tự tính, gửi lên bị bỏ qua. */
  insuranceSalary?: number;
  probationJobSalary?: number;
  probationAgreedSalary?: number;
  organizationAllowanceIds?: string[];
  allowances?: EmployeeAssignedAllowance[];
  attendanceBonusPolicyId?: string;
}

export interface UpdateSalaryProfilePayload {
  effectiveFrom?: string;
  effectiveTo?: string | null;
  baseSalary?: number;
  /** @deprecated Lương đóng BHXH là số dẫn xuất — backend tự tính, gửi lên bị bỏ qua. */
  insuranceSalary?: number;
  probationJobSalary?: number;
  probationAgreedSalary?: number;
  organizationAllowanceIds?: string[];
  allowances?: EmployeeAssignedAllowance[];
  attendanceBonusPolicyId?: string | null;
}

/**
 * Lương đóng bảo hiểm = lương cơ bản − tổng phụ cấp (không âm).
 * Cùng công thức backend dùng khi ghi hồ sơ — dùng để hiển thị khớp payroll.
 */
export function deriveInsuranceSalary(
  baseSalary: number,
  allowances?: EmployeeAssignedAllowance[],
): number {
  const totalAllowances = (allowances ?? []).reduce((sum, item) => sum + (item?.amount ?? 0), 0);
  return Math.max(0, baseSalary - totalAllowances);
}

export async function listSalaryProfiles(base: string, employeeId?: string): Promise<SalaryProfile[]> {
  const query = new URLSearchParams();
  if (employeeId?.trim()) query.set('employeeId', employeeId.trim());
  return hrRequest<SalaryProfile[]>(base, `/api/hr/salary-profiles${query.size ? `?${query}` : ''}`, { method: 'GET' });
}

export async function getEffectiveSalaryProfile(base: string, employeeId: string, date: string): Promise<SalaryProfile | null> {
  const query = new URLSearchParams({ employeeId, date });
  return hrRequest<SalaryProfile | null>(base, `/api/hr/salary-profiles/effective?${query}`, { method: 'GET' });
}

export async function createSalaryProfile(base: string, payload: CreateSalaryProfilePayload): Promise<SalaryProfile> {
  return hrRequest<SalaryProfile>(base, '/api/hr/salary-profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSalaryProfile(base: string, id: string, payload: UpdateSalaryProfilePayload): Promise<SalaryProfile> {
  return hrRequest<SalaryProfile>(base, `/api/hr/salary-profiles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ───────── Allowances (TASK-033) ─────────

export interface AllowanceCatalogItem {
  _id: string;
  code: string;
  defaultName: string;
  description?: string;
  defaultTaxable: boolean;
  defaultInsuranceBased: boolean;
  active: boolean;
}

export interface OrganizationAllowance {
  _id: string;
  organizationId: string;
  catalogId?: string | null;
  code: string;
  name: string;
  description?: string;
  amount?: number;
  taxable: boolean;
  insuranceBased: boolean;
  prorated: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  version: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAllowancePayload {
  catalogId?: string;
  code?: string;
  name?: string;
  description?: string;
  amount?: number;
  taxable?: boolean;
  insuranceBased?: boolean;
  prorated?: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateAllowancePayload {
  code?: string;
  name?: string;
  description?: string;
  amount?: number;
  taxable?: boolean;
  insuranceBased?: boolean;
  prorated?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

export async function getAllowanceCatalog(base: string): Promise<AllowanceCatalogItem[]> {
  return hrRequest<AllowanceCatalogItem[]>(base, '/api/hr/allowance-catalog', { method: 'GET' });
}

export async function getOrganizationAllowances(base: string): Promise<OrganizationAllowance[]> {
  return hrRequest<OrganizationAllowance[]>(base, '/api/hr/organization-allowances', { method: 'GET' });
}

export async function createOrganizationAllowance(base: string, payload: CreateAllowancePayload): Promise<OrganizationAllowance> {
  return hrRequest<OrganizationAllowance>(base, '/api/hr/organization-allowances', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOrganizationAllowance(base: string, id: string, payload: UpdateAllowancePayload): Promise<OrganizationAllowance> {
  return hrRequest<OrganizationAllowance>(base, `/api/hr/organization-allowances/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ───────── Attendance Bonus Policies (TASK-034) ─────────

export type BonusMetric =
  | 'LATE_COUNT'
  | 'LATE_MINUTES'
  | 'EARLY_COUNT'
  | 'EARLY_MINUTES'
  | 'ABSENT_DAYS'
  | 'INCOMPLETE_DAYS';

export type BonusOperator = 'EQ' | 'LT' | 'LTE' | 'GT' | 'GTE';

export interface BonusCondition {
  metric: BonusMetric;
  operator: BonusOperator;
  value: number;
}

export interface BonusTier {
  order: number;
  percentage: number;
  conditions: BonusCondition[];
}

export interface AttendanceBonusTemplate {
  _id: string;
  code: string;
  name: string;
  tiers: BonusTier[];
  templateVersion: number;
  active: boolean;
}

export interface AttendanceBonusPolicy {
  _id: string;
  organizationId: string;
  templateId?: string | null;
  name: string;
  calculationBase: string;
  bonusAmount: number;
  scope?: 'ALL' | 'DEPARTMENT';
  departmentIds?: string[];
  tiers: BonusTier[];
  conditions?: BonusCondition[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  version: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBonusPolicyPayload {
  templateId?: string;
  name: string;
  bonusAmount: number;
  scope?: 'ALL' | 'DEPARTMENT';
  departmentIds?: string[];
  tiers: BonusTier[];
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface CloneBonusPolicyPayload {
  name: string;
  bonusAmount: number;
  scope?: 'ALL' | 'DEPARTMENT';
  departmentIds?: string[];
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateBonusPolicyPayload {
  name?: string;
  bonusAmount?: number;
  scope?: 'ALL' | 'DEPARTMENT';
  departmentIds?: string[];
  tiers?: BonusTier[];
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

export interface BonusPreviewPayload {
  policyId: string;
  metrics: Partial<Record<BonusMetric, number>>;
}

export interface BonusPreviewResult {
  matchedOrder: number | null;
  percentage: number;
  amount: number;
  trace: string[];
}

export async function getAttendanceBonusTemplates(base: string): Promise<AttendanceBonusTemplate[]> {
  return hrRequest<AttendanceBonusTemplate[]>(base, '/api/hr/attendance-bonus-templates', { method: 'GET' });
}

export async function getAttendanceBonusPolicies(base: string): Promise<AttendanceBonusPolicy[]> {
  return hrRequest<AttendanceBonusPolicy[]>(base, '/api/hr/attendance-bonus-policies', { method: 'GET' });
}

export async function createAttendanceBonusPolicy(base: string, payload: CreateBonusPolicyPayload): Promise<AttendanceBonusPolicy> {
  return hrRequest<AttendanceBonusPolicy>(base, '/api/hr/attendance-bonus-policies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cloneAttendanceBonusPolicy(base: string, templateId: string, payload: CloneBonusPolicyPayload): Promise<AttendanceBonusPolicy> {
  return hrRequest<AttendanceBonusPolicy>(base, `/api/hr/attendance-bonus-policies/clone/${encodeURIComponent(templateId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAttendanceBonusPolicy(base: string, id: string, payload: UpdateBonusPolicyPayload): Promise<AttendanceBonusPolicy> {
  return hrRequest<AttendanceBonusPolicy>(base, `/api/hr/attendance-bonus-policies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function previewAttendanceBonus(base: string, payload: BonusPreviewPayload): Promise<BonusPreviewResult> {
  return hrRequest<BonusPreviewResult>(base, '/api/hr/attendance-bonus-policies/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
