import { createHash } from 'crypto';
import {
  canonicalPeriodProjectionHash,
  buildPeriodObligationProjection,
  PeriodObligationService,
  type PeriodFactInput,
} from './period-obligation.service';

const input: PeriodFactInput = {
  organizationId: 'org-1',
  periodKey: '2026-09',
  startDate: '2026-09-01',
  endDate: '2026-09-02',
  employees: [{ employeeProfileId: 'p1', userId: 'u1', departmentIds: ['d1'] }],
  assignments: [{ id: 'a1', userId: 'u1', departmentId: 'd1', effectiveFrom: '2026-01-01', active: true }],
  shifts: [{ id: 's1', version: 2, scope: 'DEPARTMENT', departmentId: 'd1', weekdays: [2, 3], effectiveFrom: '2026-01-01', startTime: '08:00', endTime: '17:00', breakMinutes: 60, active: true }],
  calendarExceptions: [],
  leaveRequests: [],
  attendanceDays: [{
    id: 'att1', userId: 'u1', workDate: '2026-09-01', workingMinutes: 420,
    checkInAt: '2026-09-01T01:05:00.000Z', checkOutAt: '2026-09-01T09:00:00.000Z',
    lateMinutes: 5, earlyMinutes: 0, attendanceStatus: 'CHECKED_OUT',
  }],
  overtimeResults: [
    { id: 'ot-ok', userId: 'u1', workDate: '2026-09-01', periodKey: '2026-09', classificationStatus: 'FINAL', eligibleMinutes: 60 },
    { id: 'ot-other-period', userId: 'u1', workDate: '2026-09-01', periodKey: '2026-08', classificationStatus: 'FINAL', eligibleMinutes: 90 },
    { id: 'ot-provisional', userId: 'u1', workDate: '2026-09-01', periodKey: '2026-09', classificationStatus: 'PROVISIONAL', eligibleMinutes: 30 },
  ],
};

describe('deterministic period obligation projection', () => {
  it('enumerates every eligible date and emits a blocker for a missing scheduled AttendanceDay', () => {
    const result = buildPeriodObligationProjection(input, { overtimeStatus: 'FINAL' });
    expect(result.days).toHaveLength(2);
    expect(result.days[0]).toMatchObject({
      workDate: '2026-09-01', scheduledObligationMinutes: 480, workedScheduledMinutes: 420,
      standardWorkUnits: 1, standardWorkMinutes: 480, overtimeMinutes: 60, blockers: [],
      checkInAt: '2026-09-01T01:05:00.000Z', checkOutAt: '2026-09-01T09:00:00.000Z',
      lateMinutes: 5, earlyMinutes: 0, attendanceState: 'CHECKED_OUT',
    });
    expect(result.days[1]).toMatchObject({ workDate: '2026-09-02', blockers: ['MISSING_ATTENDANCE_DAY'] });
  });

  it('applies calendar, shift, paid/unpaid leave and attendance precedence', () => {
    const result = buildPeriodObligationProjection({
      ...input,
      endDate: '2026-09-01',
      calendarExceptions: [{ id: 'c1', date: '2026-09-01', type: 'SPECIAL_WORKING_DAY', version: 1 }],
      leaveRequests: [
        { id: 'l1', userId: 'u1', startDate: '2026-09-01', endDate: '2026-09-01', leaveType: 'PAID_LEAVE', status: 'HR_APPLIED', calculatedMinutes: 120 },
        { id: 'l2', userId: 'u1', startDate: '2026-09-01', endDate: '2026-09-01', leaveType: 'UNPAID_LEAVE', status: 'HR_APPLIED', calculatedMinutes: 60 },
      ],
    }, { overtimeStatus: 'FINAL' });
    expect(result.days[0]).toMatchObject({
      scheduledObligationMinutes: 480, workedScheduledMinutes: 420,
      payableLeaveMinutes: 120, unpaidLeaveMinutes: 60,
      source: { calendarExceptionId: 'c1', shiftTemplateId: 's1', attendanceDayId: 'att1', leaveRequestIds: ['l1', 'l2'], overtimeResultIds: ['ot-ok'] },
    });
  });

  it('does not block a scheduled date fully covered by paid leave when no attendance row exists', () => {
    const result = buildPeriodObligationProjection({
      ...input,
      endDate: '2026-09-01',
      attendanceDays: [],
      leaveRequests: [{
        id: 'paid-full', userId: 'u1', startDate: '2026-09-01', endDate: '2026-09-01',
        leaveType: 'PAID_LEAVE', status: 'HR_APPLIED', calculatedMinutes: 480,
      }],
    }, { overtimeStatus: 'FINAL' });
    expect(result.days[0]).toMatchObject({ payableLeaveMinutes: 480, blockers: [] });
  });

  it('rejects one aggregate calculatedMinutes value spread across multiple leave dates', () => {
    expect(() => buildPeriodObligationProjection({
      ...input,
      attendanceDays: [],
      leaveRequests: [{
        id: 'multi-day', userId: 'u1', startDate: '2026-09-01', endDate: '2026-09-02',
        leaveType: 'PAID_LEAVE', status: 'HR_APPLIED', calculatedMinutes: 960,
      }],
    }, { overtimeStatus: 'FINAL' })).toThrow('AMBIGUOUS_MULTI_DAY_LEAVE_MINUTES');
  });

  it('makes weekly off and public holidays zero standard obligation', () => {
    for (const type of ['WEEKLY_OFF', 'PUBLIC_HOLIDAY'] as const) {
      const result = buildPeriodObligationProjection({
        ...input, endDate: '2026-09-01', calendarExceptions: [{ id: `c-${type}`, date: '2026-09-01', type }],
      }, { overtimeStatus: 'FINAL' });
      expect(result.days[0]).toMatchObject({ scheduledObligationMinutes: 0, standardWorkUnits: 0, standardWorkMinutes: 0, blockers: [] });
    }
  });

  it('rejects overlapping effective shifts instead of choosing nondeterministically', () => {
    expect(() => buildPeriodObligationProjection({ ...input, endDate: '2026-09-01', shifts: [...input.shifts, { ...input.shifts[0], id: 's2' }] }, { overtimeStatus: 'FINAL' }))
      .toThrow('OVERLAPPING_EFFECTIVE_SHIFTS');
  });

  it('uses canonical SHA-256 whose date/status detail cannot collapse to equal aggregate totals', () => {
    const first = buildPeriodObligationProjection(input, { overtimeStatus: 'FINAL' });
    const second = { ...first, days: first.days.map((day, index) => index === 0 ? { ...day, workDate: '2026-09-03' } : day) };
    const hash = canonicalPeriodProjectionHash(first);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(createHash('sha256').update(first.canonicalPayload).digest('hex'));
    expect(canonicalPeriodProjectionHash(second)).not.toBe(hash);
    expect(canonicalPeriodProjectionHash({ ...first, days: [...first.days].reverse() })).toBe(hash);
  });

  it('propagates session and expected OT status through the adapter', async () => {
    const session = { id: 'session' } as any;
    const source = { load: jest.fn(async () => input) };
    const service = new PeriodObligationService(source as any);
    const result = await service.loadPeriod({ organizationId: 'org-1', periodKey: '2026-09', startDate: '2026-09-01', endDate: '2026-09-02', overtimeStatus: 'PROVISIONAL', session });
    expect(source.load).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', periodKey: '2026-09' }), session);
    expect(result.days[0].overtimeMinutes).toBe(30);
  });

  it('keeps provisional and already-finalized approved OT visible during pre-close review', () => {
    const result = buildPeriodObligationProjection({ ...input, endDate: '2026-09-01' }, { overtimeStatus: 'REVIEWABLE' });
    expect(result.days[0].overtimeMinutes).toBe(90);
    expect(result.days[0].source.overtimeResultIds).toEqual(['ot-ok', 'ot-provisional']);
  });
});
