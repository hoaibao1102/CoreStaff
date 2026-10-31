import { ConflictException, NotFoundException } from '@nestjs/common';
import { buildWorkCreditSummaryProjection } from './timesheet-summary.service';

const policy = (id: string, version: number, half = 0.5, full = 1) => ({
  _id: id,
  version,
  effectiveFrom: new Date('2026-10-01T00:00:00Z'),
  halfDayMinimumRatio: half,
  fullDayMinimumRatio: full,
  paidLeaveCreditEnabled: true,
  incompleteDayRule: 'BLOCK' as const,
  active: true,
});

const day = (workDate: string, scheduled: number, worked: number, extra: any = {}) => ({
  employeeProfileId: 'profile-1', userId: 'user-1', departmentId: 'dept-1', workDate,
  calendarType: 'REGULAR' as const, scheduledObligationMinutes: scheduled,
  workedScheduledMinutes: worked, payableLeaveMinutes: 0, unpaidLeaveMinutes: 0,
  standardWorkUnits: scheduled > 0 ? 1 : 0, standardWorkMinutes: scheduled,
  overtimeMinutes: 0, blockers: [], source: { assignmentId: 'a1', shiftTemplateId: `s-${scheduled}`, shiftVersion: 2, leaveRequestIds: [], overtimeResultIds: [] },
  ...extra,
});

describe('buildWorkCreditSummaryProjection', () => {
  it('evaluates a mixed month and freezes policy, shift, calendar and source evidence', async () => {
    const policies: Record<string, any> = { '2026-10-01': policy('p1', 1), '2026-10-02': policy('p1', 1), '2026-10-03': policy('p2', 2, 0.4, 0.9), '2026-10-04': policy('p2', 2, 0.4, 0.9), '2026-10-05': policy('p2', 2, 0.4, 0.9) };
    const result = await buildWorkCreditSummaryProjection([
      day('2026-10-01', 480, 480),
      day('2026-10-02', 480, 240),
      day('2026-10-03', 360, 180, { payableLeaveMinutes: 180 }),
      day('2026-10-04', 360, 180, { unpaidLeaveMinutes: 180 }),
      day('2026-10-05', 0, 0, { calendarType: 'PUBLIC_HOLIDAY', overtimeMinutes: 120, standardWorkUnits: 0 }),
    ] as any, async (date: string) => policies[date]);

    expect(result).toMatchObject({ standardWorkUnits: 4, standardWorkMinutes: 1680, payableWorkUnits: 3 });
    expect(result.dailyWorkCredits.map((row: any) => row.workCredit)).toEqual([1, 0.5, 1, 0.5, 0]);
    expect(result.dailyWorkCredits[4]).toMatchObject({ reasonCode: 'PUBLIC_HOLIDAY', overtimeMinutes: 120, calendarClassification: 'PUBLIC_HOLIDAY' });
    expect(result.workCreditPolicySnapshots).toHaveLength(2);
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('blocks missing policy, missing attendance facts and unresolved days', async () => {
    await expect(buildWorkCreditSummaryProjection([day('2026-10-01', 480, 0)] as any, async () => null as any))
      .rejects.toThrow(new ConflictException('WORK_CREDIT_POLICY_MISSING'));
    await expect(buildWorkCreditSummaryProjection([day('2026-10-01', 480, 0, { blockers: ['MISSING_ATTENDANCE_DAY'] })] as any, async () => policy('p1', 1)))
      .rejects.toThrow(new ConflictException('MISSING_ATTENDANCE_DAY'));
    await expect(buildWorkCreditSummaryProjection([day('2026-10-01', 480, 0, { unresolvedIncomplete: true })] as any, async () => policy('p1', 1)))
      .rejects.toThrow(new ConflictException('WORK_CREDIT_DAY_UNRESOLVED'));
  });
});
