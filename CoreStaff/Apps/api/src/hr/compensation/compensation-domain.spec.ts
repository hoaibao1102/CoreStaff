import {
  assertNoEffectiveOverlap,
  calculateProbationRate,
  evaluateAttendanceBonus,
  resolveConfirmedKpiAmount,
} from './compensation-domain';

describe('compensation domain (TASK-031..035)', () => {
  it('validates probation salary against a supplied policy rate without hard-coding 85%', () => {
    expect(calculateProbationRate(10_000_000, 9_000_000, 0.9)).toBe(0.9);
    expect(() => calculateProbationRate(10_000_000, 8_999_999, 0.9)).toThrow('PROBATION_SALARY_BELOW_MINIMUM');
  });

  it('allows touching half-open effective windows and rejects an overlap', () => {
    const rows = [{ effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-07-01') }];
    expect(() => assertNoEffectiveOverlap(rows, new Date('2026-07-01'), undefined)).not.toThrow();
    expect(() => assertNoEffectiveOverlap(rows, new Date('2026-06-30'), undefined)).toThrow('EFFECTIVE_DATE_OVERLAP');
  });

  it('evaluates the first matching ordered attendance bonus tier and returns a trace', () => {
    const result = evaluateAttendanceBonus(
      {
        bonusAmount: 1_000_000,
        tiers: [
          { order: 2, percentage: 70, conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 2 }] },
          { order: 1, percentage: 100, conditions: [{ metric: 'LATE_COUNT', operator: 'EQ', value: 0 }] },
        ],
      },
      { LATE_COUNT: 0 },
    );
    expect(result).toMatchObject({ percentage: 100, amount: 1_000_000, matchedOrder: 1 });
    expect(result.trace[0]).toContain('LATE_COUNT');
  });

  it('uses confirmed KPI only and defaults missing/draft input to zero', () => {
    expect(resolveConfirmedKpiAmount(undefined)).toBe(0);
    expect(resolveConfirmedKpiAmount({ status: 'DRAFT', amount: 500_000 })).toBe(0);
    expect(resolveConfirmedKpiAmount({ status: 'CONFIRMED', amount: 500_000 })).toBe(500_000);
  });
});
