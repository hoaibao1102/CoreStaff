import { OvertimeType } from '../../database/schemas/compensation.schema';

// Re-exported so consumers (and specs) reach it through this module, not the schema layer.
export { OvertimeType };

/**
 * TASK-036/037 — pure, testable policy domain logic. No database access, no
 * HTTP concerns. Enforcement reads the effective `policyVersion` + `legalReference`
 * and returns them alongside every result (SRS §30B.2:2524, §30K).
 */

/** A limit key the labor-compliance engine checks. */
export type LaborLimitKey =
  | 'normalDaily'
  | 'normalWeekly'
  | 'maxCombinedDaily'
  | 'maxMonthlyOvertime'
  | 'maxAnnualOvertime';

/** Error code mapped to each limit (§30H). `exceptionalAnnualOvertime` reuses the annual code. */
export const LABOR_LIMIT_ERROR_CODE: Record<LaborLimitKey, string> = {
  normalDaily: 'NORMAL_HOURS_LIMIT_EXCEEDED',
  normalWeekly: 'NORMAL_HOURS_LIMIT_EXCEEDED',
  maxCombinedDaily: 'OVERTIME_DAILY_LIMIT_EXCEEDED',
  maxMonthlyOvertime: 'OVERTIME_MONTHLY_LIMIT_EXCEEDED',
  maxAnnualOvertime: 'OVERTIME_ANNUAL_LIMIT_EXCEEDED',
};

/** Metrics the caller supplies from the attendance/timesheet snapshot (minutes). */
export interface LaborUsage {
  normalDailyMinutes?: number;
  normalWeeklyMinutes?: number;
  combinedDailyMinutes?: number;
  overtimeMonthlyMinutes?: number;
  overtimeAnnualMinutes?: number;
}

export interface LaborPolicyLimits {
  normalDailyMinutes: number;
  normalWeeklyMinutes: number;
  maxCombinedDailyMinutes: number;
  maxMonthlyOvertimeMinutes: number;
  maxAnnualOvertimeMinutes: number;
  exceptionalAnnualOvertimeMinutes: number;
  warningThresholdPercent: number;
}

/**
 * TASK-068/070 — project a stored `LaborCompliancePolicy` row onto the limit
 * shape this module consumes. Single source for the §30B.1 field list, so no
 * caller re-lists it (SRS §30B.1:2619 — the values must not be scattered
 * through calculation services). Throws rather than feeding `undefined` into a
 * comparison: a missing column means an under-seeded policy, not an infinite
 * allowance.
 */
export function laborLimitsFromPolicy(row: {
  normalDailyMinutes?: number | null;
  normalWeeklyMinutes?: number | null;
  maxCombinedDailyMinutes?: number | null;
  maxMonthlyOvertimeMinutes?: number | null;
  maxAnnualOvertimeMinutes?: number | null;
  exceptionalAnnualOvertimeMinutes?: number | null;
  warningThresholdPercent?: number | null;
}): LaborPolicyLimits {
  const pick = (value: number | null | undefined, field: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`LABOR_POLICY_FIELD_MISSING:${field}`);
    return value;
  };
  return {
    normalDailyMinutes: pick(row.normalDailyMinutes, 'normalDailyMinutes'),
    normalWeeklyMinutes: pick(row.normalWeeklyMinutes, 'normalWeeklyMinutes'),
    maxCombinedDailyMinutes: pick(row.maxCombinedDailyMinutes, 'maxCombinedDailyMinutes'),
    maxMonthlyOvertimeMinutes: pick(row.maxMonthlyOvertimeMinutes, 'maxMonthlyOvertimeMinutes'),
    maxAnnualOvertimeMinutes: pick(row.maxAnnualOvertimeMinutes, 'maxAnnualOvertimeMinutes'),
    exceptionalAnnualOvertimeMinutes: pick(row.exceptionalAnnualOvertimeMinutes, 'exceptionalAnnualOvertimeMinutes'),
    warningThresholdPercent: pick(row.warningThresholdPercent, 'warningThresholdPercent'),
  };
}

export type LaborViolationSeverity = 'BLOCK' | 'WARNING';
export interface LaborViolation {
  key: LaborLimitKey;
  code: string;
  severity: LaborViolationSeverity;
  /** `BLOCK` when usage is at/over the limit, `WARNING` from warningThreshold% up. */
  message: string;
  usedMinutes: number;
  limitMinutes: number;
}

export interface LaborEvaluationResult {
  policyVersion: number;
  legalReference: string;
  violations: LaborViolation[];
  /** True when no BLOCK violation exists (approvable under the policy). */
  approvable: boolean;
}

/**
 * SRS §30B.1/30B.2 — simultaneous day/week/month/year checks (AC-LABOR-01).
 * Every records policyVersion + legalReference. Limit semantics:
 * - normalDaily/normalWeekly: normal working minutes must not exceed the policy cap.
 * - maxCombinedDaily: normal + overtime minutes in a day must not exceed the cap.
 * - maxMonthlyOvertime / maxAnnualOvertime: OT minutes against their own caps.
 * `exceptionalAnnualOvertimeMinutes` accepts an annual OT overage — it is checked
 * against the annual cap only when exceeded (exceptional headroom), never read as
 * a blocking floor.
 */
export function evaluateLaborLimits(
  policy: LaborPolicyLimits & { version: number; legalReference: string },
  usage: LaborUsage,
): LaborEvaluationResult {
  const threshold = policy.warningThresholdPercent / 100;
  const violations: LaborViolation[] = [];

  const check = (key: LaborLimitKey, used: number | undefined, limit: number, label: string, allowExceptional = false): void => {
    if (used === undefined) return;
    if (!Number.isFinite(used) || used < 0) throw new Error(`INVALID_LABOR_USAGE:${key}`);
    const effectiveLimit = (allowExceptional && used > limit) ? policy.exceptionalAnnualOvertimeMinutes : limit;
    if (used > effectiveLimit) {
      violations.push({
        key,
        code: LABOR_LIMIT_ERROR_CODE[key],
        severity: 'BLOCK',
        message: label,
        usedMinutes: used,
        limitMinutes: effectiveLimit,
      });
    } else if (used >= limit * threshold) {
      violations.push({
        key,
        code: LABOR_LIMIT_ERROR_CODE[key],
        severity: 'WARNING',
        message: `${label} (warning threshold ${policy.warningThresholdPercent}%)`,
        usedMinutes: used,
        limitMinutes: limit,
      });
    }
  };

  check('normalDaily', usage.normalDailyMinutes, policy.normalDailyMinutes, 'Normal hours per day');
  check('normalWeekly', usage.normalWeeklyMinutes, policy.normalWeeklyMinutes, 'Normal hours per week');
  check('maxCombinedDaily', usage.combinedDailyMinutes, policy.maxCombinedDailyMinutes, 'Combined normal + OT per day');
  check('maxMonthlyOvertime', usage.overtimeMonthlyMinutes, policy.maxMonthlyOvertimeMinutes, 'Overtime per month');
  check('maxAnnualOvertime', usage.overtimeAnnualMinutes, policy.maxAnnualOvertimeMinutes, 'Overtime per year', true);

  return {
    policyVersion: policy.version,
    legalReference: policy.legalReference,
    violations,
    approvable: !violations.some((v) => v.severity === 'BLOCK'),
  };
}

/** A single OT day to classify for rate resolution. */
export interface OvertimeDay {
  /** YYYY-MM-DD date key — only used for trace, not classification. */
  date?: string;
  isWeeklyOff?: boolean;
  isPublicHoliday?: boolean;
}

export interface OvertimeRateEntry {
  date?: string;
  type: OvertimeType;
  rate: number;
}

export interface OvertimeRateResult {
  policyVersion: number;
  legalReference: string;
  rates: OvertimeRateEntry[];
}

/**
 * SRS §30D.2:2610 — resolve the rate for each OT day from the effective policy.
 * Classification rules (AC-OT-PAY-01):
 * - working day → OT_WORKING_DAY
 * - weekly off (not a public holiday) → OT_WEEKLY_OFF
 * - public holiday (even when it is also a weekly off) → OT_PUBLIC_HOLIDAY only,
 *   so a public holiday landing on a day off is never double-counted.
 */
export function resolveOvertimeRates(
  policy: { workingDayRate: number; weeklyOffRate: number; publicHolidayRate: number; version: number; legalReference: string },
  days: OvertimeDay[],
): OvertimeRateResult {
  if (policy.workingDayRate < 0 || policy.weeklyOffRate < 0 || policy.publicHolidayRate < 0) {
    throw new Error('INVALID_OVERTIME_RATE');
  }
  const rates = days.map((day) => {
    const type = day.isPublicHoliday
      ? OvertimeType.PUBLIC_HOLIDAY
      : day.isWeeklyOff
        ? OvertimeType.WEEKLY_OFF
        : OvertimeType.WORKING_DAY;
    const rate =
      type === OvertimeType.PUBLIC_HOLIDAY ? policy.publicHolidayRate
        : type === OvertimeType.WEEKLY_OFF ? policy.weeklyOffRate
        : policy.workingDayRate;
    return { date: day.date, type, rate };
  });
  return { policyVersion: policy.version, legalReference: policy.legalReference, rates };
}