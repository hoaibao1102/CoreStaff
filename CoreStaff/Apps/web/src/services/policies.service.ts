import { hrRequest, mapHrError } from './hrService';

/* ─────────────────────────────────────────────────────────────────────────
   Labor Compliance Policy (TASK-036) — effective-dated tenant policy.
   Mirrors the API contract in Apps/api/src/hr/policies (controller + DTOs).
   ───────────────────────────────────────────────────────────────────────── */

export interface LaborCompliancePolicy {
  _id: string;
  organizationId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  normalDailyMinutes: number;
  normalWeeklyMinutes: number;
  maxCombinedDailyMinutes: number;
  maxMonthlyOvertimeMinutes: number;
  maxAnnualOvertimeMinutes: number;
  exceptionalAnnualOvertimeMinutes: number;
  warningThresholdPercent: number;
  probationMinimumRate: number;
  legalReference: string;
  version: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLaborPolicyPayload {
  effectiveFrom: string;
  effectiveTo?: string;
  normalDailyMinutes: number;
  normalWeeklyMinutes: number;
  maxCombinedDailyMinutes: number;
  maxMonthlyOvertimeMinutes: number;
  maxAnnualOvertimeMinutes: number;
  exceptionalAnnualOvertimeMinutes: number;
  warningThresholdPercent: number;
  probationMinimumRate: number;
  legalReference: string;
  active?: boolean;
}

export type UpdateLaborPolicyPayload = Partial<CreateLaborPolicyPayload>;

function laborPath(id: string) {
  return `/api/hr/policies/labor/${encodeURIComponent(id)}`;
}

export function listLaborPolicies(base: string) {
  return hrRequest<LaborCompliancePolicy[]>(base, '/api/hr/policies/labor', { method: 'GET' });
}
export function getLaborPolicyById(base: string, id: string) {
  return hrRequest<LaborCompliancePolicy>(base, laborPath(id), { method: 'GET' });
}
export function createLaborPolicy(base: string, payload: CreateLaborPolicyPayload) {
  return hrRequest<LaborCompliancePolicy>(base, '/api/hr/policies/labor', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
export function updateLaborPolicy(base: string, id: string, payload: UpdateLaborPolicyPayload) {
  return hrRequest<LaborCompliancePolicy>(base, laborPath(id), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   Overtime Pay Policy (TASK-037) — effective-dated tenant policy.
   Rates are decimal multipliers (e.g. 1.5 = +150%) — never percentages.
   ───────────────────────────────────────────────────────────────────────── */

export interface OvertimePayPolicy {
  _id: string;
  organizationId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  workingDayRate: number;
  weeklyOffRate: number;
  publicHolidayRate: number;
  legalReference: string;
  version: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOvertimePolicyPayload {
  effectiveFrom: string;
  effectiveTo?: string;
  workingDayRate: number;
  weeklyOffRate: number;
  publicHolidayRate: number;
  legalReference: string;
  active?: boolean;
}

export type UpdateOvertimePolicyPayload = Partial<CreateOvertimePolicyPayload>;

function overtimePath(id: string) {
  return `/api/hr/policies/overtime/${encodeURIComponent(id)}`;
}

export function listOvertimePolicies(base: string) {
  return hrRequest<OvertimePayPolicy[]>(base, '/api/hr/policies/overtime', { method: 'GET' });
}
export function getOvertimePolicyById(base: string, id: string) {
  return hrRequest<OvertimePayPolicy>(base, overtimePath(id), { method: 'GET' });
}
export function createOvertimePolicy(base: string, payload: CreateOvertimePolicyPayload) {
  return hrRequest<OvertimePayPolicy>(base, '/api/hr/policies/overtime', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
export function updateOvertimePolicy(base: string, id: string, payload: UpdateOvertimePolicyPayload) {
  return hrRequest<OvertimePayPolicy>(base, overtimePath(id), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   Error mapping — backend codes surfaced to the end user in Vietnamese.
   ───────────────────────────────────────────────────────────────────────── */

export function policiesErrorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const messages: Record<string, string> = {
    EFFECTIVE_DATE_OVERLAP: 'Chính sách đã trùng khoảng thời gian hiệu lực với chính sách khác. Vui lòng chọn ngày hiệu lực khác.',
    EFFECTIVE_DATE_RANGE_INVALID: 'Ngày hết hiệu lực phải sau ngày hiệu lực.',
    LABOR_POLICY_NOT_FOUND: 'Không tìm thấy chính sách tuân thủ lao động.',
    OVERTIME_POLICY_NOT_FOUND: 'Không tìm thấy chính sách lương tăng ca.',
  };
  return (code && messages[code]) || mapHrError(code, 'Không thể thực hiện thao tác với chính sách. Vui lòng thử lại.');
}