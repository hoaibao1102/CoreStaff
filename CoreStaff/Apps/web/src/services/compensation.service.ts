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
  insuranceSalary: number;
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
  insuranceSalary?: number;
  probationJobSalary?: number;
  probationAgreedSalary?: number;
  organizationAllowanceIds?: string[];
  allowances?: EmployeeAssignedAllowance[];
  attendanceBonusPolicyId?: string | null;
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

// ───────── KPI Policies & Tiers ─────────

export type KpiPolicyType = 'PASS_FAIL' | 'GRADE' | 'SCORE_RANGE';

export interface KpiTier {
  name: string;
  percentage: number;
  minScore?: number;
  maxScore?: number;
  order: number;
}

export interface KpiPolicy {
  _id: string;
  organizationId: string;
  name: string;
  policyType: KpiPolicyType;
  baseAmount: number;
  tiers: KpiTier[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  version: number;
  active: boolean;
  scope?: 'ALL' | 'DEPARTMENT';
  departmentIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateKpiPolicyPayload {
  name: string;
  policyType: KpiPolicyType;
  baseAmount: number;
  tiers: KpiTier[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  scope?: 'ALL' | 'DEPARTMENT';
  departmentIds?: string[];
}

export interface UpdateKpiPolicyPayload extends Partial<CreateKpiPolicyPayload> {
  active?: boolean;
}

export async function getKpiPolicies(base: string): Promise<KpiPolicy[]> {
  return hrRequest<KpiPolicy[]>(base, '/api/hr/kpi-policies', { method: 'GET' });
}

export async function createKpiPolicy(base: string, payload: CreateKpiPolicyPayload): Promise<KpiPolicy> {
  return hrRequest<KpiPolicy>(base, '/api/hr/kpi-policies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateKpiPolicy(base: string, id: string, payload: UpdateKpiPolicyPayload): Promise<KpiPolicy> {
  return hrRequest<KpiPolicy>(base, `/api/hr/kpi-policies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getApplicableKpiPolicy(base: string, departmentId?: string): Promise<KpiPolicy | null> {
  const query = new URLSearchParams();
  if (departmentId?.trim()) query.set('departmentId', departmentId.trim());
  return hrRequest<KpiPolicy | null>(base, `/api/hr/kpi-policies/applicable${query.size ? `?${query}` : ''}`, { method: 'GET' });
}

// ───────── KPI Payroll Inputs (TASK-035) ─────────

export type KpiStatus = 'DRAFT' | 'CONFIRMED';
export type KpiSource = 'MANUAL' | 'IMPORT';

export interface KpiPayrollInput {
  _id: string;
  organizationId: string;
  employeeProfileId: string;
  departmentId?: string | null;
  policyId?: string | null;
  period: string;
  score?: number;
  tierName?: string;
  tierPercentage?: number;
  baseAmount?: number;
  amount: number;
  source: KpiSource;
  note?: string;
  status: KpiStatus;
  version: number;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  evaluatedBy?: string | null;
  evaluatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Resolved name
  employeeFullName?: string | null;
  employeeCode?: string | null;
}

export interface CreateKpiInputPayload {
  employeeId: string;
  period: string;
  policyId?: string;
  tierName?: string;
  tierPercentage?: number;
  baseAmount?: number;
  score?: number;
  amount: number;
  source?: KpiSource;
  note?: string;
}

export interface UpdateKpiInputPayload {
  score?: number;
  tierName?: string;
  tierPercentage?: number;
  baseAmount?: number;
  amount?: number;
  note?: string;
}

export async function getKpiInputs(base: string, period?: string, departmentId?: string): Promise<KpiPayrollInput[]> {
  const query = new URLSearchParams();
  if (period?.trim()) query.set('period', period.trim());
  if (departmentId?.trim()) query.set('departmentId', departmentId.trim());
  return hrRequest<KpiPayrollInput[]>(base, `/api/hr/kpi-inputs${query.size ? `?${query}` : ''}`, { method: 'GET' });
}

export async function createKpiInput(base: string, payload: CreateKpiInputPayload): Promise<KpiPayrollInput> {
  return hrRequest<KpiPayrollInput>(base, '/api/hr/kpi-inputs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateKpiInput(base: string, id: string, payload: UpdateKpiInputPayload): Promise<KpiPayrollInput> {
  return hrRequest<KpiPayrollInput>(base, `/api/hr/kpi-inputs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function confirmKpiInput(base: string, id: string): Promise<KpiPayrollInput> {
  return hrRequest<KpiPayrollInput>(base, `/api/hr/kpi-inputs/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
  });
}
