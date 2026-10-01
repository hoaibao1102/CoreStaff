import { scenarioForIndex, standardWorkdays } from './september-workforce-fixtures';

describe('September workforce fixture plan', () => {
  it('derives 20 standard workdays after the two organization holidays', () => {
    const days = standardWorkdays('2026-09');
    expect(days).toHaveLength(20);
    expect(days).not.toContain('2026-09-01');
    expect(days).not.toContain('2026-09-02');
  });

  it('maps eleven employees to eleven deterministic scenarios', () => {
    const scenarios = Array.from({ length: 11 }, (_, index) => scenarioForIndex(index));
    expect(new Set(scenarios.map((item) => item.key)).size).toBe(11);
    expect(scenarios.map((item) => item.key)).toEqual([
      'FULL', 'LATE', 'EARLY', 'LATE_EARLY', 'PAID_LEAVE', 'UNPAID_LEAVE',
      'ABSENT', 'INCOMPLETE', 'OT_WORKING_DAY', 'OT_WEEKLY_OFF', 'OT_PUBLIC_HOLIDAY',
    ]);
  });

  it('defines the expected overtime category and minutes for each OT scenario', () => {
    expect(scenarioForIndex(8).overtime).toMatchObject({ type: 'OT_WORKING_DAY', minutes: 120 });
    expect(scenarioForIndex(9).overtime).toMatchObject({ type: 'OT_WEEKLY_OFF', minutes: 240 });
    expect(scenarioForIndex(10).overtime).toMatchObject({ type: 'OT_PUBLIC_HOLIDAY', minutes: 480 });
  });
});
