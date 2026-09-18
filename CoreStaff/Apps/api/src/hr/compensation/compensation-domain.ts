import { BadRequestException, ConflictException } from '@nestjs/common';

export interface EffectiveRow {
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export function assertNoEffectiveOverlap(
  rows: EffectiveRow[],
  effectiveFrom: Date,
  effectiveTo?: Date,
): void {
  if (effectiveTo && effectiveTo.getTime() <= effectiveFrom.getTime()) {
    throw new BadRequestException('EFFECTIVE_DATE_RANGE_INVALID');
  }
  const end = effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const overlaps = rows.some((row) => {
    const rowEnd = row.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
    return effectiveFrom.getTime() < rowEnd && row.effectiveFrom.getTime() < end;
  });
  if (overlaps) throw new ConflictException('EFFECTIVE_DATE_OVERLAP');
}

export function calculateProbationRate(
  probationJobSalary: number,
  probationAgreedSalary: number,
  minimumRate: number,
): number {
  if (!Number.isSafeInteger(probationJobSalary) || probationJobSalary <= 0 ||
      !Number.isSafeInteger(probationAgreedSalary) || probationAgreedSalary <= 0 ||
      !Number.isFinite(minimumRate) || minimumRate <= 0 || minimumRate > 1) {
    throw new BadRequestException('INVALID_PROBATION_SALARY');
  }
  if (probationAgreedSalary < Math.ceil(probationJobSalary * minimumRate)) {
    throw new BadRequestException('PROBATION_SALARY_BELOW_MINIMUM');
  }
  return probationAgreedSalary / probationJobSalary;
}

export type BonusMetric =
  | 'LATE_COUNT' | 'LATE_MINUTES' | 'EARLY_COUNT' | 'EARLY_MINUTES'
  | 'ABSENT_DAYS' | 'INCOMPLETE_DAYS';
export type BonusOperator = 'EQ' | 'LT' | 'LTE' | 'GT' | 'GTE';

export interface BonusCondition { metric: BonusMetric; operator: BonusOperator; value: number }
export interface BonusTier { order: number; percentage: number; conditions: BonusCondition[] }
export interface BonusPolicyInput { bonusAmount: number; tiers: BonusTier[] }

function compare(actual: number, operator: BonusOperator, expected: number): boolean {
  switch (operator) {
    case 'EQ': return actual === expected;
    case 'LT': return actual < expected;
    case 'LTE': return actual <= expected;
    case 'GT': return actual > expected;
    case 'GTE': return actual >= expected;
  }
}

export function evaluateAttendanceBonus(
  policy: BonusPolicyInput,
  metrics: Partial<Record<BonusMetric, number>>,
): { matchedOrder: number | null; percentage: number; amount: number; trace: string[] } {
  if (!Number.isSafeInteger(policy.bonusAmount) || policy.bonusAmount < 0) {
    throw new BadRequestException('ATTENDANCE_BONUS_AMOUNT_INVALID');
  }
  const sorted = [...policy.tiers].sort((a, b) => a.order - b.order);
  for (const tier of sorted) {
    if (tier.percentage < 0 || tier.percentage > 100) {
      throw new BadRequestException('ATTENDANCE_BONUS_PERCENTAGE_INVALID');
    }
    const trace = tier.conditions.map((condition) => {
      const actual = metrics[condition.metric] ?? 0;
      return `${condition.metric} ${condition.operator} ${condition.value}: ${actual}`;
    });
    if (tier.conditions.every((condition) => compare(metrics[condition.metric] ?? 0, condition.operator, condition.value))) {
      return {
        matchedOrder: tier.order,
        percentage: tier.percentage,
        amount: Math.round(policy.bonusAmount * tier.percentage / 100),
        trace,
      };
    }
  }
  return { matchedOrder: null, percentage: 0, amount: 0, trace: ['NO_MATCHING_TIER'] };
}

export function resolveConfirmedKpiAmount(input?: { status: string; amount: number }): number {
  return input?.status === 'CONFIRMED' ? input.amount : 0;
}
