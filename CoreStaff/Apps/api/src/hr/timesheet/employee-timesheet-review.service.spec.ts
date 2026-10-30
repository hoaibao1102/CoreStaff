import { ConflictException } from '@nestjs/common';
import { mapEmployeeTimesheetReview } from './employee-timesheet-review.mapper';
import { EmployeeTimesheetReviewService } from './employee-timesheet-review.service';

describe('employee timesheet review', () => {
  it('whitelists employee-safe fields and strips every sensitive/raw field', () => {
    const value = mapEmployeeTimesheetReview({
      periodId: 'p1', periodKey: '2026-10', periodVersion: 2, projectionHash: 'hash', state: 'PENDING',
      standardWorkUnits: 1, payableWorkUnits: 1,
      salary: 100, tax: {}, insurance: {}, dependents: [], ipAddress: '1.2.3.4', wifi: {}, gps: {}, address: 'x', evidenceId: 'e', userAgent: 'ua', metadata: {}, workplaceCoordinates: {},
      days: [{ workDate: '2026-10-01', checkInAt: '08:00', checkOutAt: '17:00', scheduledObligationMinutes: 480, workedScheduledMinutes: 480, payableLeaveMinutes: 0, unpaidLeaveMinutes: 0, lateMinutes: 5, earlyMinutes: 3, overtimeMinutes: 0, attendanceState: 'PRESENT', workCredit: 1, reasonCode: 'FULL_CREDIT', ipAddress: 'secret', sourceReferences: { evidenceId: 'secret' } }],
      history: [{ action: 'DISPUTED', actedAt: new Date('2026-10-02'), disputeReason: 'Sai giờ ra', actorId: 'u1', metadata: { ip: 'secret' } }],
    } as any);
    expect(value).toEqual(expect.objectContaining({ periodId: 'p1', projectionHash: 'hash', state: 'PENDING' }));
    expect(value.days[0]).toEqual(expect.objectContaining({
      checkInAt: '08:00', checkOutAt: '17:00', lateMinutes: 5, earlyMinutes: 3,
      attendanceState: 'PRESENT',
    }));
    const serialized = JSON.stringify(value);
    for (const forbidden of ['salary','tax','insurance','dependents','ipAddress','wifi','gps','address','evidence','userAgent','metadata','workplaceCoordinates','sourceReferences','actorId']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('rejects stale versions and changed hashes before appending an acknowledgement', async () => {
    const service = new EmployeeTimesheetReviewService({} as any, {} as any, {} as any, {} as any, {} as any);
    jest.spyOn(service as any, 'buildOwnReview').mockResolvedValue({ periodVersion: 3, projectionHash: 'current' });
    await expect(service.acknowledge('org', 'period', 'user', { expectedPeriodVersion: 2, projectionHash: 'current' } as any))
      .rejects.toThrow('PERIOD_VERSION_CONFLICT');
    await expect(service.acknowledge('org', 'period', 'user', { expectedPeriodVersion: 3, projectionHash: 'old' } as any))
      .rejects.toThrow('TIMESHEET_REVIEW_CHANGED');
  });

  it('blocks manager coverage when any current employee is pending or disputed', () => {
    expect(() => EmployeeTimesheetReviewService.requireCompleteCoverage([
      { state: 'ACKNOWLEDGED' }, { state: 'PENDING' },
    ] as any)).toThrow(new ConflictException('EMPLOYEE_ACKNOWLEDGEMENT_PENDING'));
    expect(() => EmployeeTimesheetReviewService.requireCompleteCoverage([
      { state: 'ACKNOWLEDGED' }, { state: 'DISPUTED' },
    ] as any)).toThrow(new ConflictException('EMPLOYEE_TIMESHEET_DISPUTED'));
  });

  it('builds pre-close employee review from provisional OT values', async () => {
    const periods = { findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ _id: 'period', period: '2026-10', version: 1, startDate: '2026-10-01', endDate: '2026-10-31' }) })) };
    const profiles = { findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ _id: 'profile' }) })) };
    const actions = { find: jest.fn(() => ({ sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) })) };
    const obligations = { loadPeriod: jest.fn().mockResolvedValue({ days: [{
      employeeProfileId: 'profile', userId: 'user', departmentId: 'dept', workDate: '2026-10-01',
      calendarType: 'REGULAR', scheduledObligationMinutes: 480, workedScheduledMinutes: 480,
      payableLeaveMinutes: 0, unpaidLeaveMinutes: 0, standardWorkUnits: 1, standardWorkMinutes: 480,
      overtimeMinutes: 60, lateMinutes: 0, earlyMinutes: 0, blockers: [],
      source: { assignmentId: 'assignment', leaveRequestIds: [], overtimeResultIds: ['ot'] },
    }] }) };
    const policies = { workCreditAt: jest.fn().mockResolvedValue({
      _id: 'policy', version: 1, effectiveFrom: new Date('2026-01-01'), active: true,
      halfDayMinimumRatio: 0.5, fullDayMinimumRatio: 1, paidLeaveCreditEnabled: true,
      incompleteDayRule: 'BLOCK',
    }) };
    const service = new EmployeeTimesheetReviewService(periods as any, actions as any, profiles as any, obligations as any, policies as any);

    await service.getOwnReview('org', 'period', 'user');
    expect(obligations.loadPeriod).toHaveBeenCalledWith(expect.objectContaining({ overtimeStatus: 'REVIEWABLE' }));
  });

  it('uses the previous action identity so a later opposite transition is appendable and retries stay idempotent', async () => {
    const actions = { create: jest.fn().mockResolvedValue({}) };
    const service = new EmployeeTimesheetReviewService({} as any, actions as any, {} as any, {} as any, {} as any);
    const base = {
      periodId: '507f1f77bcf86cd799439011', periodVersion: 3,
      profileId: '507f1f77bcf86cd799439012', userId: '507f1f77bcf86cd799439013',
      departmentId: '507f1f77bcf86cd799439014', projectionHash: 'a'.repeat(64),
    };

    await (service as any).appendAction('507f1f77bcf86cd799439015', {
      ...base, history: [{ _id: '507f1f77bcf86cd799439016', action: 'DISPUTED' }],
    }, base.userId, 'ACKNOWLEDGED');
    await (service as any).appendAction('507f1f77bcf86cd799439015', {
      ...base, history: [{ _id: '507f1f77bcf86cd799439017', action: 'ACKNOWLEDGED' }],
    }, base.userId, 'DISPUTED', { disputeReason: 'Sai dữ liệu chấm công' });

    const firstKey = actions.create.mock.calls[0][0].idempotencyKey;
    const secondKey = actions.create.mock.calls[1][0].idempotencyKey;
    expect(firstKey).toContain('507f1f77bcf86cd799439016');
    expect(secondKey).toContain('507f1f77bcf86cd799439017');
    expect(firstKey).not.toBe(secondKey);
    expect(firstKey.length).toBeLessThanOrEqual(200);
    expect(secondKey.length).toBeLessThanOrEqual(200);
  });
});
