import { parsePercent, parseScenarioMinutes, evaluateWorkCreditSimulation, getWorkCreditMinuteRanges, type WorkCreditPolicyRules, type WorkCreditDayInput } from '../src/screens/WorkCreditPolicy/work-credit-simulation';

const rules: WorkCreditPolicyRules = { halfDayMinimumRatio: 0.5, fullDayMinimumRatio: 0.85, paidLeaveCreditEnabled: true, incompleteDayRule: 'BLOCK' };
const input: WorkCreditDayInput = { scheduledObligationMinutes: 480, workedScheduledMinutes: 407, payableLeaveMinutes: 0, unpaidLeaveMinutes: 0, dayType: 'SCHEDULED', incompleteState: 'COMPLETE' };

describe('integer credited-minute ranges (not worked-minute promises)', () => {
  it('reports explicit ranges and the 407/408 cliff for 480 minutes at 50–85', () => {
    expect(getWorkCreditMinuteRanges(rules, 480)).toEqual({
      halfMinimumMinutes: 240, fullMinimumMinutes: 408,
      zero: { min: 0, max: 239 }, half: { min: 240, max: 407 }, full: { min: 408, max: 480 },
    });
  });
  it('adjusts multiplication rounding against the exact backend comparator', () => {
    expect(getWorkCreditMinuteRanges({ ...rules, halfDayMinimumRatio: 0.28, fullDayMinimumRatio: 0.56 }, 25)).toEqual({
      halfMinimumMinutes: 7, fullMinimumMinutes: 14,
      zero: { min: 0, max: 6 }, half: { min: 7, max: 13 }, full: { min: 14, max: 25 },
    });
    const narrow = getWorkCreditMinuteRanges({ ...rules, halfDayMinimumRatio: 0.5000000000000001, fullDayMinimumRatio: 0.5000000000000002 }, 480);
    expect(narrow.halfMinimumMinutes).toBe(241);
    expect(narrow.fullMinimumMinutes).toBe(241);
    expect(narrow.half).toBeNull();
    expect(getWorkCreditMinuteRanges({ ...rules, halfDayMinimumRatio: 0 }, 480).zero).toBeNull();
  });
  it('returns no division or fabricated tiers for zero obligation and rejects invalid obligations', () => {
    expect(getWorkCreditMinuteRanges(rules, 0)).toEqual({ halfMinimumMinutes: null, fullMinimumMinutes: null, zero: null, half: null, full: null });
    for (const value of [NaN, Infinity, -1, 0.5, 1441]) expect(() => getWorkCreditMinuteRanges(rules, value)).toThrow('WORK_CREDIT_SIMULATION_INPUT_INVALID');
    expect(() => getWorkCreditMinuteRanges({ ...rules, fullDayMinimumRatio: 0.5 }, 480)).toThrow('WORK_CREDIT_POLICY_THRESHOLDS_INVALID');
  });
});

describe('simulation input validation', () => {
  it('rejects invalid policy thresholds before even special-day evaluation', () => {
    for (const invalid of [
      { halfDayMinimumRatio: NaN }, { fullDayMinimumRatio: Infinity },
      { halfDayMinimumRatio: -0.1 }, { fullDayMinimumRatio: 1.01 },
      { halfDayMinimumRatio: 0.85 }, { halfDayMinimumRatio: 0.9 },
      { incompleteDayRule: 'ALLOW' },
    ]) {
      expect(() => evaluateWorkCreditSimulation({ ...rules, ...invalid } as WorkCreditPolicyRules, { ...input, dayType: 'PUBLIC_HOLIDAY' })).toThrow('WORK_CREDIT_POLICY_THRESHOLDS_INVALID');
    }
  });
  it('rejects noninteger, nonfinite and out-of-range scenario fields without defaulting', () => {
    for (const field of ['scheduledObligationMinutes', 'workedScheduledMinutes', 'payableLeaveMinutes', 'unpaidLeaveMinutes'] as const) {
      for (const value of [NaN, Infinity, -1, 0.5, 1441, undefined]) {
        expect(() => evaluateWorkCreditSimulation(rules, { ...input, [field]: value } as WorkCreditDayInput)).toThrow('WORK_CREDIT_SIMULATION_INPUT_INVALID');
      }
    }
    expect(() => evaluateWorkCreditSimulation(rules, { ...input, dayType: 'OTHER' } as unknown as WorkCreditDayInput)).toThrow('WORK_CREDIT_SIMULATION_INPUT_INVALID');
    expect(() => evaluateWorkCreditSimulation(rules, { ...input, incompleteState: 'OTHER' } as unknown as WorkCreditDayInput)).toThrow('WORK_CREDIT_SIMULATION_INPUT_INVALID');
  });
  it('does not mutate policy or facts and retains unrounded ratios', () => {
    const result = evaluateWorkCreditSimulation(Object.freeze(rules), Object.freeze(input));
    expect(result.creditRatio).toBe(407 / 480);
    expect(result.workCredit).toBe(0.5);
    expect(result.workedScheduledMinutes).toBe(407);
  });
});

describe('simulation percentage parser', () => {
  it('parses only explicit scenario integers from zero through 1440', () => {
    for (const value of ['', ' ', 'NaN', 'Infinity', '-1', '1441', '1.5']) {
      expect(parseScenarioMinutes(value)).toBeNull();
    }
    for (const value of ['0', '240', '450', '480', '1440']) {
      expect(parseScenarioMinutes(value)).toBe(Number(value));
    }
  });
  it('rejects blank, non-finite and out-of-range inputs without treating blank as zero', () => {
    for (const value of ['', ' ', 'NaN', 'Infinity', '-1', '100.01', 'abc']) {
      expect(parsePercent(value)).toBeNull();
    }
    expect(parsePercent('0')).toBe(0);
    expect(parsePercent(' 85 ')).toBe(0.85);
    expect(parsePercent('85.125')).toBe(0.85125);
    expect(parsePercent('100')).toBe(1);
  });
});
