/** Read-only illustration only. The backend evaluator remains authoritative. */
export interface WorkCreditPolicyRules {
  halfDayMinimumRatio: number;
  fullDayMinimumRatio: number;
  paidLeaveCreditEnabled: boolean;
  incompleteDayRule: 'BLOCK';
}
export type WorkCreditDayType = 'SCHEDULED' | 'WEEKLY_OFF' | 'PUBLIC_HOLIDAY';
export type WorkCreditIncompleteState = 'COMPLETE' | 'UNRESOLVED' | 'FORFEITED_MISSING_PUNCH';
export type WorkCreditReasonCode = 'FULL_CREDIT' | 'HALF_CREDIT' | 'BELOW_HALF_DAY' | 'UNPAID_LEAVE'
  | 'WEEKLY_OFF' | 'PUBLIC_HOLIDAY' | 'INCOMPLETE_DAY_BLOCKED' | 'FORFEITED_MISSING_PUNCH' | 'NO_SCHEDULED_OBLIGATION';
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

function validateRules(rules: WorkCreditPolicyRules): void {
  if (!Number.isFinite(rules.halfDayMinimumRatio) || !Number.isFinite(rules.fullDayMinimumRatio)
    || rules.halfDayMinimumRatio < 0 || rules.halfDayMinimumRatio >= rules.fullDayMinimumRatio
    || rules.fullDayMinimumRatio > 1 || rules.incompleteDayRule !== 'BLOCK') {
    throw new Error('WORK_CREDIT_POLICY_THRESHOLDS_INVALID');
  }
}

function isScenarioMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 1440;
}

export function evaluateWorkCreditSimulation(rules: WorkCreditPolicyRules, input: WorkCreditDayInput): WorkCreditDayResult {
  validateRules(rules);
  if (![input.scheduledObligationMinutes, input.workedScheduledMinutes, input.payableLeaveMinutes, input.unpaidLeaveMinutes].every(isScenarioMinutes)
    || !['SCHEDULED', 'WEEKLY_OFF', 'PUBLIC_HOLIDAY'].includes(input.dayType)
    || !['COMPLETE', 'UNRESOLVED', 'FORFEITED_MISSING_PUNCH'].includes(input.incompleteState)) {
    throw new Error('WORK_CREDIT_SIMULATION_INPUT_INVALID');
  }
  const result = (creditedMinutes: number, creditRatio: number, workCredit: 0 | 0.5 | 1,
    reasonCode: WorkCreditReasonCode, blocking = false): WorkCreditDayResult =>
    ({ ...input, creditedMinutes, creditRatio, workCredit, reasonCode, blocking });
  const obligation = Math.max(0, input.scheduledObligationMinutes);
  if (input.dayType === 'WEEKLY_OFF' || input.dayType === 'PUBLIC_HOLIDAY') return result(0, 0, 0, input.dayType);
  if (input.incompleteState === 'UNRESOLVED') return result(0, 0, 0, 'INCOMPLETE_DAY_BLOCKED', true);
  if (input.incompleteState === 'FORFEITED_MISSING_PUNCH') return result(0, 0, 0, 'FORFEITED_MISSING_PUNCH');
  if (obligation === 0) return result(0, 0, 0, 'NO_SCHEDULED_OBLIGATION');
  const creditedMinutes = Math.min(obligation, Math.max(0, input.workedScheduledMinutes)
    + (rules.paidLeaveCreditEnabled ? Math.max(0, input.payableLeaveMinutes) : 0));
  const creditRatio = creditedMinutes / obligation;
  if (creditRatio >= rules.fullDayMinimumRatio) return result(creditedMinutes, creditRatio, 1, 'FULL_CREDIT');
  if (creditRatio >= rules.halfDayMinimumRatio) return result(creditedMinutes, creditRatio, 0.5, 'HALF_CREDIT');
  return result(creditedMinutes, creditRatio, 0,
    input.unpaidLeaveMinutes > 0 && creditedMinutes === 0 ? 'UNPAID_LEAVE' : 'BELOW_HALF_DAY');
}
/** Inclusive ranges of credited minutes for a COMPLETE, SCHEDULED day. Null means no integer tier. */
export interface WorkCreditMinuteRange { min: number; max: number }
export interface WorkCreditMinuteRanges {
  halfMinimumMinutes: number | null;
  fullMinimumMinutes: number | null;
  zero: WorkCreditMinuteRange | null;
  half: WorkCreditMinuteRange | null;
  full: WorkCreditMinuteRange | null;
}

export function getWorkCreditMinuteRanges(rules: WorkCreditPolicyRules, obligation: number): WorkCreditMinuteRanges {
  validateRules(rules);
  if (!isScenarioMinutes(obligation)) throw new Error('WORK_CREDIT_SIMULATION_INPUT_INVALID');
  if (obligation === 0) return { halfMinimumMinutes: null, fullMinimumMinutes: null, zero: null, half: null, full: null };
  const minimum = (threshold: number): number => {
    let minute = Math.ceil(obligation * threshold);
    // Multiplication can round differently from division: use the evaluator's exact comparator, never epsilon.
    while (minute > 0 && (minute - 1) / obligation >= threshold) minute--;
    while (minute < obligation && minute / obligation < threshold) minute++;
    return minute;
  };
  const halfMinimumMinutes = minimum(rules.halfDayMinimumRatio);
  const fullMinimumMinutes = minimum(rules.fullDayMinimumRatio);
  const range = (min: number, max: number): WorkCreditMinuteRange | null => min <= max ? { min, max } : null;
  return {
    halfMinimumMinutes, fullMinimumMinutes,
    zero: range(0, halfMinimumMinutes - 1),
    half: range(halfMinimumMinutes, fullMinimumMinutes - 1),
    full: range(fullMinimumMinutes, obligation),
  };
}

export function parseScenarioMinutes(value: string): number | null {
  if (value.trim() === '') return null;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440 ? minutes : null;
}
/** Retain stored IEEE-754 ratios when their original display strings are unchanged or restored. */
export function resolveWorkCreditPreviewRules(
  halfPercent: string, fullPercent: string, paidLeaveCreditEnabled: boolean,
  original?: WorkCreditPolicyRules,
): WorkCreditPolicyRules | null {
  const half = original && halfPercent === String(original.halfDayMinimumRatio * 100)
    ? original.halfDayMinimumRatio : parsePercent(halfPercent);
  const full = original && fullPercent === String(original.fullDayMinimumRatio * 100)
    ? original.fullDayMinimumRatio : parsePercent(fullPercent);
  if (half === null || full === null || !Number.isFinite(half) || !Number.isFinite(full)
    || half < 0 || half >= full || full > 1) return null;
  return { halfDayMinimumRatio: half, fullDayMinimumRatio: full, paidLeaveCreditEnabled, incompleteDayRule: 'BLOCK' };
}

export function parsePercent(value: string): number | null {
  if (value.trim() === '') return null;
  const percent = Number(value);
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent / 100 : null;
}
