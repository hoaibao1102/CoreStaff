import {
  evaluateWorkCreditDay,
  validateWorkCreditPolicyRules,
  WorkCreditPolicyRules,
} from './work-credit-domain';

const rules: WorkCreditPolicyRules = {
  halfDayMinimumRatio: 0.5,
  fullDayMinimumRatio: 0.9,
  paidLeaveCreditEnabled: true,
  incompleteDayRule: 'BLOCK',
};

const evaluate = (overrides: Partial<Parameters<typeof evaluateWorkCreditDay>[1]> = {}) =>
  evaluateWorkCreditDay(rules, {
    scheduledObligationMinutes: 480,
    workedScheduledMinutes: 0,
    payableLeaveMinutes: 0,
    unpaidLeaveMinutes: 0,
    dayType: 'SCHEDULED',
    incompleteState: 'COMPLETE',
    ...overrides,
  });

describe('evaluateWorkCreditDay', () => {
  it('awards full credit at the configured full-day ratio', () => {
    expect(evaluate({ workedScheduledMinutes: 432 })).toMatchObject({ workCredit: 1, creditedMinutes: 432, reasonCode: 'FULL_CREDIT', blocking: false });
  });

  it('awards half credit when only the half-day ratio is met', () => {
    expect(evaluate({ workedScheduledMinutes: 240 })).toMatchObject({ workCredit: 0.5, reasonCode: 'HALF_CREDIT' });
  });

  it('awards zero below the half-day ratio', () => {
    expect(evaluate({ workedScheduledMinutes: 239 })).toMatchObject({ workCredit: 0, reasonCode: 'BELOW_HALF_DAY' });
  });

  it('combines worked minutes with payable leave when paid-leave credit is enabled', () => {
    expect(evaluate({ workedScheduledMinutes: 240, payableLeaveMinutes: 240 })).toMatchObject({ workCredit: 1, creditedMinutes: 480, reasonCode: 'FULL_CREDIT' });
  });

  it('does not credit payable leave when the toggle is disabled or unpaid leave', () => {
    expect(evaluateWorkCreditDay({ ...rules, paidLeaveCreditEnabled: false }, {
      scheduledObligationMinutes: 480, workedScheduledMinutes: 240, payableLeaveMinutes: 240,
      unpaidLeaveMinutes: 0, dayType: 'SCHEDULED', incompleteState: 'COMPLETE',
    })).toMatchObject({ workCredit: 0.5, creditedMinutes: 240 });
    expect(evaluate({ unpaidLeaveMinutes: 480 })).toMatchObject({ workCredit: 0, creditedMinutes: 0, reasonCode: 'UNPAID_LEAVE' });
  });

  it.each(['WEEKLY_OFF', 'PUBLIC_HOLIDAY'] as const)('awards zero standard credit for %s', (dayType) => {
    expect(evaluate({ dayType, workedScheduledMinutes: 480 })).toMatchObject({ workCredit: 0, creditedMinutes: 0, reasonCode: dayType, blocking: false });
  });

  it('returns a blocking result for an unresolved incomplete day', () => {
    expect(evaluate({ incompleteState: 'UNRESOLVED' })).toMatchObject({ workCredit: 0, reasonCode: 'INCOMPLETE_DAY_BLOCKED', blocking: true });
  });

  it('returns zero for a manager-forfeited missing punch', () => {
    expect(evaluate({ incompleteState: 'FORFEITED_MISSING_PUNCH', workedScheduledMinutes: 400 })).toMatchObject({ workCredit: 0, creditedMinutes: 0, reasonCode: 'FORFEITED_MISSING_PUNCH', blocking: false });
  });

  it('handles zero obligation without division by zero', () => {
    expect(evaluate({ scheduledObligationMinutes: 0, workedScheduledMinutes: 100 })).toMatchObject({ workCredit: 0, creditedMinutes: 0, creditRatio: 0, reasonCode: 'NO_SCHEDULED_OBLIGATION' });
  });

  it('clamps credited minutes and daily credit to the scheduled maximum', () => {
    expect(evaluate({ workedScheduledMinutes: 600, payableLeaveMinutes: 200 })).toMatchObject({ workCredit: 1, creditedMinutes: 480, creditRatio: 1 });
  });
});

describe('explicit 50–85 and 50–100 policy regression contracts (existing evaluator)', () => {
  const run = (full: number, worked: number, scheduled = 480, extra: any = {}, policyExtra: any = {}) =>
    evaluateWorkCreditDay({ ...rules, fullDayMinimumRatio: full, ...policyExtra }, {
      scheduledObligationMinutes: scheduled, workedScheduledMinutes: worked,
      payableLeaveMinutes: 0, unpaidLeaveMinutes: 0, dayType: 'SCHEDULED', incompleteState: 'COMPLETE', ...extra,
    });

  it.each([
    [475, 1, 0.5], [420, 1, 0.5], [408, 1, 0.5], [407, 0.5, 0.5],
    [240, 0.5, 0.5], [239, 0, 0], [480, 1, 1], [0, 0, 0],
  ])('W=%s keeps independent 85%%=%s and 100%%=%s outcomes', (worked, at85, at100) => {
    expect(run(0.85, worked).workCredit).toBe(at85);
    expect(run(1, worked).workCredit).toBe(at100);
  });

  it('does not round 382/450 up to 85%; the first full minute is 383', () => {
    expect(run(0.85, 382, 450)).toMatchObject({ workCredit: 0.5, creditedMinutes: 382, creditRatio: 382 / 450 });
    expect(run(0.85, 383, 450)).toMatchObject({ workCredit: 1, creditedMinutes: 383, creditRatio: 383 / 450 });
  });

  it.each([0.85, 1])('preserves the pre-leave denominator at full=%s', full => {
    expect(run(full, 240, 480, { payableLeaveMinutes: 240 })).toMatchObject({ workCredit: 1, creditedMinutes: 480, creditRatio: 1 });
    expect(run(full, 240, 480, { payableLeaveMinutes: 240 }, { paidLeaveCreditEnabled: false })).toMatchObject({ workCredit: 0.5, creditedMinutes: 240, creditRatio: 0.5 });
    expect(run(full, 240, 480, { unpaidLeaveMinutes: 240 })).toMatchObject({ workCredit: 0.5, creditedMinutes: 240, creditRatio: 0.5 });
  });

  it('accepts half=0 without silently clamping it', () => {
    expect(run(0.85, 0, 480, {}, { halfDayMinimumRatio: 0 })).toMatchObject({ workCredit: 0.5, reasonCode: 'HALF_CREDIT' });
  });

  it('keeps special-case precedence ahead of threshold evaluation', () => {
    expect(run(0.85, 480, 480, { incompleteState: 'UNRESOLVED' })).toMatchObject({ blocking: true, workCredit: 0 });
    expect(run(0.85, 480, 480, { incompleteState: 'FORFEITED_MISSING_PUNCH' })).toMatchObject({ blocking: false, workCredit: 0, reasonCode: 'FORFEITED_MISSING_PUNCH' });
    for (const dayType of ['WEEKLY_OFF', 'PUBLIC_HOLIDAY']) {
      expect(run(0.85, 480, 480, { dayType, incompleteState: 'UNRESOLVED' })).toMatchObject({ blocking: false, creditedMinutes: 0, workCredit: 0, reasonCode: dayType });
    }
    expect(run(0.85, 0, 0, {}, { halfDayMinimumRatio: 0 })).toMatchObject({ workCredit: 0, creditRatio: 0, reasonCode: 'NO_SCHEDULED_OBLIGATION' });
  });
});

describe('validateWorkCreditPolicyRules', () => {
  it.each([
    { ...rules, halfDayMinimumRatio: -0.1 },
    { ...rules, halfDayMinimumRatio: 0.9 },
    { ...rules, fullDayMinimumRatio: 1.1 },
  ])('rejects invalid or non-monotonic thresholds', (invalid) => {
    expect(() => validateWorkCreditPolicyRules(invalid)).toThrow('WORK_CREDIT_POLICY_THRESHOLDS_INVALID');
  });
});
