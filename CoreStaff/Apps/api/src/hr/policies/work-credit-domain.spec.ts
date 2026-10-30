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

describe('validateWorkCreditPolicyRules', () => {
  it.each([
    { ...rules, halfDayMinimumRatio: -0.1 },
    { ...rules, halfDayMinimumRatio: 0.9 },
    { ...rules, fullDayMinimumRatio: 1.1 },
  ])('rejects invalid or non-monotonic thresholds', (invalid) => {
    expect(() => validateWorkCreditPolicyRules(invalid)).toThrow('WORK_CREDIT_POLICY_THRESHOLDS_INVALID');
  });
});
