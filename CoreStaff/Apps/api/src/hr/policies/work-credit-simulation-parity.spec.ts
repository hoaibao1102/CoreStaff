import { evaluateWorkCreditDay, WorkCreditDayInput, WorkCreditPolicyRules } from './work-credit-domain';
import { evaluateWorkCreditSimulation, getWorkCreditMinuteRanges, resolveWorkCreditPreviewRules } from '../../../../web/src/screens/WorkCreditPolicy/work-credit-simulation';

const thresholds = [
  [0.5, 1], [0.5, 0.85], [0.5, 0.9], [0, 0.85],
  [1 / 3, 2 / 3], [0.33333333333333337, 0.85125],
  [0.5000000000000001, 0.5000000000000002], [0.01, 0.07],
];

describe('pure browser simulation / authoritative API parity', () => {
  it('resolves untouched form percentages to exact stored ratios for backend parity', () => {
    const original: WorkCreditPolicyRules = { halfDayMinimumRatio: 1 / 3, fullDayMinimumRatio: 5 / 6, paidLeaveCreditEnabled: true, incompleteDayRule: 'BLOCK' };
    const half = String(original.halfDayMinimumRatio * 100);
    const full = String(original.fullDayMinimumRatio * 100);
    for (const [halfPercent, fullPercent, expectedHalf, expectedFull] of [
      [half, full, original.halfDayMinimumRatio, original.fullDayMinimumRatio],
      ['32', full, 0.32, original.fullDayMinimumRatio],
      [half, '84', original.halfDayMinimumRatio, 0.84],
      ['50', '85', 0.5, 0.85],
      [half, full, original.halfDayMinimumRatio, original.fullDayMinimumRatio],
    ] as const) {
      const rules = resolveWorkCreditPreviewRules(halfPercent, fullPercent, false, original);
      const expected = { ...original, halfDayMinimumRatio: expectedHalf, fullDayMinimumRatio: expectedFull, paidLeaveCreditEnabled: false };
      expect(rules).toEqual(expected);
      for (let m = 0; m <= 480; m++) {
        const input: WorkCreditDayInput = { scheduledObligationMinutes: 480, workedScheduledMinutes: m, payableLeaveMinutes: 0, unpaidLeaveMinutes: 0, dayType: 'SCHEDULED', incompleteState: 'COMPLETE' };
        expect(evaluateWorkCreditSimulation(rules!, input)).toEqual(evaluateWorkCreditDay(expected, input));
      }
    }
    expect(resolveWorkCreditPreviewRules('', full, true, original)).toBeNull();
    expect(resolveWorkCreditPreviewRules('90', full, true, original)).toBeNull();
    expect(resolveWorkCreditPreviewRules('50', '85', true)).toEqual({ ...original, halfDayMinimumRatio: 0.5, fullDayMinimumRatio: 0.85 });
  });
  it.each([1, 2, 7, 100, 240, 450, 480, 1440])('matches every integer minute 0..%i across explicit decimal policies and leave/cap states', (scheduledObligationMinutes) => {
    let comparisons = 0;
    for (const [halfDayMinimumRatio, fullDayMinimumRatio] of thresholds) {
      for (const paidLeaveCreditEnabled of [false, true]) {
        const rules: WorkCreditPolicyRules = { halfDayMinimumRatio, fullDayMinimumRatio, paidLeaveCreditEnabled, incompleteDayRule: 'BLOCK' };
        for (let m = 0; m <= scheduledObligationMinutes; m++) {
          for (const [workedScheduledMinutes, payableLeaveMinutes, unpaidLeaveMinutes] of [
            [m, 0, 0], [m, scheduledObligationMinutes - m, 0], [m, 1440, 0],
            [1440, m, 0], [0, m, scheduledObligationMinutes],
          ]) {
            const input: WorkCreditDayInput = { scheduledObligationMinutes, workedScheduledMinutes, payableLeaveMinutes, unpaidLeaveMinutes, dayType: 'SCHEDULED', incompleteState: 'COMPLETE' };
            const expected = evaluateWorkCreditDay(rules, input);
            const actual = evaluateWorkCreditSimulation(rules, input);
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              expect({ rules, input, actual }).toEqual({ rules, input, actual: expected });
            }
            comparisons++;
          }
        }
      }
    }
    expect(comparisons).toBe(thresholds.length * 2 * (scheduledObligationMinutes + 1) * 5);
  });

  it.each([1, 2, 7, 25, 100, 240, 450, 480, 1440])('covers each integer 0..%i exactly once with backend-matching credited-minute ranges', (scheduledObligationMinutes) => {
    for (const [halfDayMinimumRatio, fullDayMinimumRatio] of [...thresholds, [0.28, 0.56]]) {
      const rules: WorkCreditPolicyRules = { halfDayMinimumRatio, fullDayMinimumRatio, paidLeaveCreditEnabled: false, incompleteDayRule: 'BLOCK' };
      const ranges = getWorkCreditMinuteRanges(rules, scheduledObligationMinutes);
      const observed: Record<string, number[]> = { zero: [], half: [], full: [] };
      for (let m = 0; m <= scheduledObligationMinutes; m++) {
        const input: WorkCreditDayInput = { scheduledObligationMinutes, workedScheduledMinutes: m, payableLeaveMinutes: 0, unpaidLeaveMinutes: 0, dayType: 'SCHEDULED', incompleteState: 'COMPLETE' };
        const credit = evaluateWorkCreditDay(rules, input).workCredit;
        observed[credit === 1 ? 'full' : credit === 0.5 ? 'half' : 'zero'].push(m);
      }
      for (const tier of ['zero', 'half', 'full'] as const) {
        const minutes = observed[tier];
        expect(ranges[tier]).toEqual(minutes.length ? { min: minutes[0], max: minutes[minutes.length - 1] } : null);
      }
      const firstHalfOrFull = [...observed.half, ...observed.full];
      expect(ranges.halfMinimumMinutes).toBe(firstHalfOrFull[0]);
      expect(ranges.fullMinimumMinutes).toBe(observed.full[0]);
    }
  });

  it('preserves special-state precedence including zero obligation, leave, and blocked days', () => {
    for (const [halfDayMinimumRatio, fullDayMinimumRatio] of thresholds) {
      for (const paidLeaveCreditEnabled of [false, true]) {
        const rules: WorkCreditPolicyRules = { halfDayMinimumRatio, fullDayMinimumRatio, paidLeaveCreditEnabled, incompleteDayRule: 'BLOCK' };
        for (const dayType of ['SCHEDULED', 'WEEKLY_OFF', 'PUBLIC_HOLIDAY'] as const) {
          for (const incompleteState of ['COMPLETE', 'UNRESOLVED', 'FORFEITED_MISSING_PUNCH'] as const) {
            for (const scheduledObligationMinutes of [0, 240, 450, 480, 1440]) {
              for (const workedScheduledMinutes of [0, 239, 240, 407, 408, 1440]) {
                const input = { scheduledObligationMinutes, workedScheduledMinutes, payableLeaveMinutes: 240, unpaidLeaveMinutes: 240, dayType, incompleteState };
                expect(evaluateWorkCreditSimulation(rules, input)).toEqual(evaluateWorkCreditDay(rules, input));
              }
            }
          }
        }
      }
    }
  });
});
