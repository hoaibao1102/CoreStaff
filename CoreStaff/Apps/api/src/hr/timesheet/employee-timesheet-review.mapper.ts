export interface EmployeeTimesheetReviewDto {
  periodId: string; periodKey: string; periodVersion: number; projectionHash: string;
  state: 'PENDING' | 'ACKNOWLEDGED' | 'DISPUTED';
  standardWorkUnits: number; standardWorkMinutes?: number; payableWorkUnits: number;
  days: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
}

/** Dedicated allowlist: raw documents and unknown keys never cross this boundary. */
export function mapEmployeeTimesheetReview(input: any): EmployeeTimesheetReviewDto {
  return {
    periodId: String(input.periodId), periodKey: input.periodKey, periodVersion: input.periodVersion,
    projectionHash: input.projectionHash, state: input.state,
    standardWorkUnits: Number(input.standardWorkUnits ?? 0),
    standardWorkMinutes: Number(input.standardWorkMinutes ?? 0),
    payableWorkUnits: Number(input.payableWorkUnits ?? 0),
    days: (input.days ?? []).map((day: any) => ({
      workDate: day.workDate,
      checkInAt: day.checkInAt ?? null,
      checkOutAt: day.checkOutAt ?? null,
      scheduledObligationMinutes: Number(day.scheduledObligationMinutes ?? 0),
      workedScheduledMinutes: Number(day.workedScheduledMinutes ?? 0),
      payableLeaveMinutes: Number(day.payableLeaveMinutes ?? 0),
      unpaidLeaveMinutes: Number(day.unpaidLeaveMinutes ?? 0),
      lateMinutes: Number(day.lateMinutes ?? 0),
      earlyMinutes: Number(day.earlyMinutes ?? 0),
      overtimeMinutes: Number(day.overtimeMinutes ?? 0),
      attendanceState: day.attendanceState ?? null,
      workCredit: Number(day.workCredit ?? 0),
      reasonCode: day.reasonCode,
      calendarClassification: day.calendarClassification,
    })),
    history: (input.history ?? []).map((action: any) => ({
      action: action.action,
      actedAt: action.actedAt,
      disputeReason: action.disputeReason,
      disputedWorkDates: action.disputedWorkDates,
      transitionReason: action.transitionReason,
    })),
  };
}
