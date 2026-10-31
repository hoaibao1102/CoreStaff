export const IncompleteDayRule = {
  BLOCK: 'BLOCK',
} as const;
export type IncompleteDayRule = (typeof IncompleteDayRule)[keyof typeof IncompleteDayRule];

export interface WorkCreditPolicyRules {
  halfDayMinimumRatio: number;
  fullDayMinimumRatio: number;
  paidLeaveCreditEnabled: boolean;
  incompleteDayRule: IncompleteDayRule;
}

export type WorkCreditDayType = 'SCHEDULED' | 'WEEKLY_OFF' | 'PUBLIC_HOLIDAY';
export type WorkCreditIncompleteState = 'COMPLETE' | 'UNRESOLVED' | 'FORFEITED_MISSING_PUNCH';
export type WorkCreditReasonCode =
  | 'FULL_CREDIT'
  | 'HALF_CREDIT'
  | 'BELOW_HALF_DAY'
  | 'UNPAID_LEAVE'
  | 'WEEKLY_OFF'
  | 'PUBLIC_HOLIDAY'
  | 'INCOMPLETE_DAY_BLOCKED'
  | 'FORFEITED_MISSING_PUNCH'
  | 'NO_SCHEDULED_OBLIGATION';

export interface WorkCreditDayInput {
  scheduledObligationMinutes: number;
  workedScheduledMinutes: number;
  payableLeaveMinutes: number;
  unpaidLeaveMinutes: number;
  dayType: WorkCreditDayType;
  incompleteState: WorkCreditIncompleteState;
}

export interface WorkCreditDayResult {
  scheduledObligationMinutes: number;
  workedScheduledMinutes: number;
  payableLeaveMinutes: number;
  unpaidLeaveMinutes: number;
  creditedMinutes: number;
  creditRatio: number;
  workCredit: 0 | 0.5 | 1;
  reasonCode: WorkCreditReasonCode;
  blocking: boolean;
}

export function validateWorkCreditPolicyRules(rules: WorkCreditPolicyRules): void {
  if (
    !Number.isFinite(rules.halfDayMinimumRatio)
    || !Number.isFinite(rules.fullDayMinimumRatio)
    || rules.halfDayMinimumRatio < 0
    || rules.halfDayMinimumRatio >= rules.fullDayMinimumRatio
    || rules.fullDayMinimumRatio > 1
    || rules.incompleteDayRule !== IncompleteDayRule.BLOCK
  ) {
    throw new Error('WORK_CREDIT_POLICY_THRESHOLDS_INVALID');
  }
}

function result(
  input: WorkCreditDayInput,
  creditedMinutes: number,
  creditRatio: number,
  workCredit: 0 | 0.5 | 1,
  reasonCode: WorkCreditReasonCode,
  blocking = false,
): WorkCreditDayResult {
  return { ...input, creditedMinutes, creditRatio, workCredit, reasonCode, blocking };
}

export function evaluateWorkCreditDay(
  rules: WorkCreditPolicyRules,
  input: WorkCreditDayInput,
): WorkCreditDayResult {
  validateWorkCreditPolicyRules(rules);
  const obligation = Math.max(0, input.scheduledObligationMinutes);

  if (input.dayType === 'WEEKLY_OFF' || input.dayType === 'PUBLIC_HOLIDAY') {
    return result(input, 0, 0, 0, input.dayType);
  }
  if (input.incompleteState === 'UNRESOLVED') {
    return result(input, 0, 0, 0, 'INCOMPLETE_DAY_BLOCKED', true);
  }
  if (input.incompleteState === 'FORFEITED_MISSING_PUNCH') {
    return result(input, 0, 0, 0, 'FORFEITED_MISSING_PUNCH');
  }
  if (obligation === 0) {
    return result(input, 0, 0, 0, 'NO_SCHEDULED_OBLIGATION');
  }

  const workedMinutes = Math.max(0, input.workedScheduledMinutes);
  const leaveMinutes = rules.paidLeaveCreditEnabled ? Math.max(0, input.payableLeaveMinutes) : 0;
  const creditedMinutes = Math.min(obligation, workedMinutes + leaveMinutes);
  const creditRatio = creditedMinutes / obligation;
  if (creditRatio >= rules.fullDayMinimumRatio) {
    return result(input, creditedMinutes, creditRatio, 1, 'FULL_CREDIT');
  }
  if (creditRatio >= rules.halfDayMinimumRatio) {
    return result(input, creditedMinutes, creditRatio, 0.5, 'HALF_CREDIT');
  }
  const reasonCode = input.unpaidLeaveMinutes > 0 && creditedMinutes === 0
    ? 'UNPAID_LEAVE'
    : 'BELOW_HALF_DAY';
  return result(input, creditedMinutes, creditRatio, 0, reasonCode);
}
