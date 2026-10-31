import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DEFAULT_MAX_RETROACTIVE_FILING_DAYS, OvertimeService } from './overtime.service';
import { OvertimeType } from '../policies/policies-domain';

/**
 * TASK-071 — the service layer with the five collections it reads replaced by
 * fakes that honour just enough of the Mongoose query surface (`lean`, `select`,
 * `sort`, `$in`, `$ne`, `$gte/$lte`). The arithmetic lives in
 * `overtime-domain.spec.ts`; what is tested here is that the service feeds it the
 * right ids, persists the §15.11 fields and refuses what §17/§30B.2 say to refuse.
 */

const ORG = 'o1';
const USER = 'u1';            // User id — the one punches are keyed on
const WORK_DATE = '2026-09-22';   // Tuesday
// Vietnam is UTC+7 with no DST, so every instant below is written as it is stored.
const PUNCH_IN = '2026-09-22T01:00:00.000Z';   // 08:00 VN
const PUNCH_OUT = '2026-09-22T13:00:00.000Z';  // 20:00 VN

const LABOR_POLICY = {
  version: 3,
  legalReference: ' BLLĐ 45/2019/QH14 điều 107',
  normalDailyMinutes: 480,
  normalWeeklyMinutes: 2880,
  maxCombinedDailyMinutes: 720,
  maxMonthlyOvertimeMinutes: 2400,
  maxAnnualOvertimeMinutes: 20000,
  exceptionalAnnualOvertimeMinutes: 24000,
  warningThresholdPercent: 80,
};

type Doc = Record<string, any>;

function matches(doc: Doc, query: Doc): boolean {
  return Object.entries(query).every(([key, condition]) => {
    const value = doc[key];
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      const c = condition as Doc;
      if ('$in' in c) return c.$in.some((x: any) => String(x) === String(value));
      if ('$ne' in c) return String(value) !== String(c.$ne);
      let ok = true;
      if ('$gte' in c) ok = ok && String(value) >= String(c.$gte);
      if ('$lte' in c) ok = ok && String(value) <= String(c.$lte);
      if ('$lt' in c) ok = ok && String(value) < String(c.$lt);
      if ('$exists' in c) ok = ok && (value !== undefined) === c.$exists;
      return ok;
    }
    return String(value) === String(condition);
  });
}

/** The smallest thing that behaves like a `Model` for the reads in this service. */
function collection(rows: Doc[]) {
  const find = jest.fn((query: Doc) => {
    const found = () => rows.filter((row) => matches(row, query));
    const chain: any = {
      lean: async () => found(),
      select: () => chain,
      sort: () => chain,
    };
    return chain;
  });
  const findOne = jest.fn((query: Doc) => {
    const hit = rows.find((row) => matches(row, query)) ?? null;
    const chain: any = { lean: async () => hit, select: () => chain };
    return chain;
  });
  return Object.assign(find, {
    rows,
    findOne,
    find,
    // Only the `$match`/`$group` pair `totalsByType` runs is interpreted.
    aggregate: async (pipeline: Array<{ $match?: Doc; $group?: { _id: string; minutes: { $sum: string } } }>) => {
      const match = pipeline[0]?.$match ?? {};
      const group = pipeline[1]?.$group;
      if (!group) throw new Error('unsupported pipeline');
      const field = (name: string) => name.replace(/^\$/, '');
      const key = field(group._id);
      const sumKey = field(group.minutes.$sum);
      const buckets = new Map<string, number>();
      for (const row of rows.filter((r) => matches(r, match))) {
        buckets.set(String(row[key]), (buckets.get(String(row[key])) ?? 0) + Number(row[sumKey] ?? 0));
      }
      return [...buckets].map(([_id, minutes]) => ({ _id, minutes }));
    },
    updateOne: async (query: Doc, update: Doc) => {
      const existing = rows.find((row) => matches(row, query));
      if (existing) Object.assign(existing, update.$set);
      else rows.push({ ...update.$set });
      return { matchedCount: existing ? 1 : 0, modifiedCount: existing ? 1 : 0 };
    },
  });
}

function build(options: {
  attendance?: Doc[];
  calendar?: Doc[];
  overrides?: Doc[];
  requests?: Doc[];
  results?: Doc[];
  shift?: Doc | null;
  laborPolicy?: Doc;
} = {}) {
  const days = options.attendance ?? [
    { _id: 'ad1', organizationId: ORG, employeeId: USER, workDate: WORK_DATE, checkInAt: new Date(PUNCH_IN), checkOutAt: new Date(PUNCH_OUT), workingMinutes: 600, shiftSnapshot: { startTime: '08:00', endTime: '17:00', breakMinutes: 120 }, employeeSnapshot: { departmentId: 'd1' } },
  ];
  const models = {
    requests: collection(options.requests ?? []),
    attendanceDays: collection(days),
    calendar: collection(options.calendar ?? []),
    overrides: collection(options.overrides ?? []),
    results: collection(options.results ?? []),
  };
  // FINAL results without a uniquely resolved owning period stay immutable.
  (models.results as any).db = { model: () => collection([]) };
  const shifts = { resolveForEmployeeDate: jest.fn(async () => options.shift === null ? null : (options.shift ?? { _id: 's1', startTime: '08:00', endTime: '17:00', breakMinutes: 120 })) };
  const policies = { laborAt: jest.fn(async (_org: string, _at: Date) => options.laborPolicy ?? LABOR_POLICY), overtimeAt: jest.fn(async (_org: string, _at: Date) => ({ version: 2, legalReference: 'x' })) };
  const periodVersion = { bumpForWorkDates: jest.fn(async () => 1) };
  const service = new OvertimeService(
    models.requests as any, models.attendanceDays as any, models.calendar as any,
    models.overrides as any, models.results as any, shifts as any, policies as any, periodVersion as any,
  );
  return { service, models, shifts, policies, periodVersion };
}

/** A filed OT report for 18:00–20:00, approved in full. */
function request(overrides: Doc = {}): any {
  return {
    _id: 'ot1',
    organizationId: ORG,
    type: 'OVERTIME',
    status: 'APPROVED',
    employeeUserId: USER,
    departmentId: 'd1',
    // UTC midnight, the way `createMine` actually stores it — `dayAsDate` has to
    // match that instant exactly or the overlap guard reads "no existing request".
    workDate: new Date(`${WORK_DATE}T00:00:00.000Z`),
    requestedStart: '2026-09-22T11:00:00.000Z',   // 18:00 VN
    requestedEnd: '2026-09-22T13:00:00.000Z',     // 20:00 VN
    approvedStart: '2026-09-22T11:00:00.000Z',
    approvedEnd: '2026-09-22T13:00:00.000Z',
    ...overrides,
  };
}

describe('OvertimeService', () => {
  it('propagates the precheck session through all compliance reads', async () => {
    const { service, models, shifts, policies } = build();
    const session = {};
    Object.values(models).forEach(model => {
      for (const method of ['find', 'findOne']) {
        const fn = (model as any)[method]; const original = fn.getMockImplementation();
        fn.mockImplementation((...args: any[]) => { const q = original(...args); q.session = jest.fn(() => q); return q; });
      }
    });
    await service.precheckApproval(ORG, request(), session as any);
    expect(shifts.resolveForEmployeeDate).toHaveBeenCalledWith(ORG, USER, WORK_DATE, session);
    expect(policies.laborAt).toHaveBeenCalledWith(ORG, expect.any(Date), session);
    for (const model of [models.attendanceDays, models.results]) {
      for (const call of model.find.mock.results) expect(call.value.session).toHaveBeenCalledWith(session);
    }
  });
  it('retains full-day actual span while unsupported evidence zeros payable OT', async () => {
    const { service } = build({ laborPolicy: { ...LABOR_POLICY, minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 } });
    const result = await service.computeForRequest(ORG, request({ metadata: { calculationContract: 'OVERTIME_V2' } }), undefined, true);
    expect(result.computation).toMatchObject({ actualMinutes: 720, eligibleMinutes: 0, payableMinutes: 0 });
  });
  it('does not warn about unreported V2 overtime from unsupported punches', async () => {
    const { service } = build();
    jest.spyOn(service, 'isV2Enabled').mockResolvedValue(true);
    await expect(service.unreportedOvertimeMinutes(ORG, USER, WORK_DATE)).resolves.toBeNull();
  });
  it('pre-cutover preview explicitly stays LEGACY_V1 without V2 policy defaults', async () => {
    const { service } = build();
    const result = await service.preview(ORG, USER, WORK_DATE, { from: Date.parse('2026-09-22T10:00:00Z'), to: Date.parse('2026-09-22T10:45:00Z') });
    expect(result).toMatchObject({ calculationContract: 'LEGACY_V1', eligibleMinutes: 45, canFile: true });
  });
  it('passes an approval session through computation, policy and result writes', async () => {
    const { service, models, shifts, policies } = build();
    const session = {};
    Object.values(models).forEach(model => {
      for (const method of ['find', 'findOne']) {
        const fn = (model as any)[method]; const original = fn.getMockImplementation();
        fn.mockImplementation((...args: any[]) => { const q = original(...args); q.session = jest.fn(() => q); return q; });
      }
    });
    await (service.onApproved as any)(ORG, request(), session);
    expect(shifts.resolveForEmployeeDate).toHaveBeenCalledWith(ORG, USER, WORK_DATE, session);
    expect(policies.laborAt).toHaveBeenCalledWith(ORG, expect.any(Date), session);
  });
  it('recomputes a V2 request to zero with a reason after evidence becomes unsupported', async () => {
    const { service, models } = build({ laborPolicy: { ...LABOR_POLICY, minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 }, requests: [request({ metadata: { calculationContract: 'OVERTIME_V2' } })] });
    Object.assign(models.attendanceDays.rows[0], { checkInProvenance: { source: 'OBSERVED' }, checkOutProvenance: { source: 'OBSERVED' }, overallApprovalStatus: 'APPROVED' });
    await service.recompute(ORG, WORK_DATE, WORK_DATE);
    models.attendanceDays.rows[0].checkOutProvenance = { source: 'CONFIRMED_SCHEDULE' };
    await service.recompute(ORG, WORK_DATE, WORK_DATE);
    expect(models.results.rows[0]).toMatchObject({ eligibleMinutes: 0, reasons: ['OVERTIME_ATTENDANCE_SOURCE_UNSUPPORTED'] });
    await expect(service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' })).rejects.toThrow('OVERTIME_UNRESOLVED');
    expect(models.results.rows[0].classificationStatus).toBe('PROVISIONAL');
  });
  it('hashes V2 policy values and provenance, not just the policy version', async () => {
    const policy = { ...LABOR_POLICY, _id: 'policy', minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 };
    const { service, models } = build({ laborPolicy: policy });
    Object.assign(models.attendanceDays.rows[0], { checkInProvenance: { source: 'OBSERVED' }, checkOutProvenance: { source: 'OBSERVED' }, overallApprovalStatus: 'APPROVED' });
    await service.onApproved(ORG, request({ metadata: { calculationContract: 'OVERTIME_V2' } }));
    expect((await service.listResults(ORG))[0].recalculationRequired).toBe(false);
    policy.overtimeRoundingMinutes = 0;
    expect((await service.listResults(ORG))[0].recalculationRequired).toBe(true);
  });
  it('V2 compliance counts observed unrequested minutes once rather than rounded results', async () => {
    const { service, models } = build({ results: [{ organizationId: ORG, employeeId: USER, workDate: WORK_DATE, periodKey: '2026-09', yearKey: '2026', calculationContract: 'OVERTIME_V2', rawEligibleMinutes: 95, eligibleMinutes: 90 }] });
    Object.assign(models.attendanceDays.rows[0], { checkInProvenance: { source: 'OBSERVED' }, checkOutProvenance: { source: 'OBSERVED' }, overallApprovalStatus: 'APPROVED' });
    const usage = await (service.usageFor as any)(ORG, USER, WORK_DATE, 60, true);
    expect(usage.overtimeMonthlyMinutes).toBe(180);
    expect(usage.overtimeAnnualMinutes).toBe(180);
  });
  it('V2 filing requires a transaction and claims the shared period and attendance day', async () => {
    const { service, models, periodVersion } = build({ laborPolicy: { ...LABOR_POLICY, minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 } });
    Object.assign(models.attendanceDays.rows[0], { checkInProvenance: { source: 'OBSERVED' }, checkOutProvenance: { source: 'OBSERVED' }, overallApprovalStatus: 'APPROVED' });
    const window = { from: Date.parse('2026-09-22T10:00:00Z'), to: Date.parse('2026-09-22T12:00:00Z') };
    await expect((service.assertFilingAllowed as any)(ORG, USER, window, WORK_DATE, new Date('2026-09-22T14:00:00Z'), undefined, { v2Enabled: true })).rejects.toThrow('OVERTIME_TRANSACTION_REQUIRED');
    const claim = jest.fn(async () => ({ periodId: 'p1', version: 2 }));
    Object.assign(periodVersion, { claimForWorkDate: claim });
    const session = { inTransaction: () => true };
    Object.values(models).forEach(model => {
      for (const method of ['find', 'findOne']) {
        const fn = (model as any)[method];
        const original = fn.getMockImplementation();
        fn.mockImplementation((...args: any[]) => { const q = original(...args); q.session = () => q; return q; });
      }
    });
    await expect((service.assertFilingAllowed as any)(ORG, USER, window, WORK_DATE, new Date('2026-09-22T14:00:00Z'), undefined, { v2Enabled: true, session })).resolves.toMatchObject({ calculationContract: 'OVERTIME_V2' });
    expect(claim).toHaveBeenCalledWith(ORG, WORK_DATE, session);
  });
  it('suggests unclaimed observed intervals with raw and payable minutes', async () => {
    const { service, models } = build({ laborPolicy: { ...LABOR_POLICY, minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 }, requests: [request({ status: 'PENDING' })] });
    Object.assign(models.attendanceDays.rows[0], { checkInProvenance: { source: 'OBSERVED' }, checkOutProvenance: { source: 'OBSERVED' }, overallApprovalStatus: 'APPROVED' });
    const result = await (service as any).scheduleSuggestions(ORG, USER, WORK_DATE);
    expect(result.suggestedOvertimeIntervals).toMatchObject([{ from: '2026-09-22T10:00:00.000Z', to: '2026-09-22T11:00:00.000Z', rawEligibleMinutes: 60, payableMinutes: 60 }]);
  });
  it('never rewrites an existing FINAL result during recompute', async () => {
    const { service, models } = build({ requests: [request()] });
    await service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' });
    const before = JSON.stringify(models.results.rows[0]);
    models.calendar.rows.push({ organizationId: ORG, date: WORK_DATE, type: 'PUBLIC_HOLIDAY' });
    await service.recompute(ORG, WORK_DATE, WORK_DATE);
    expect(JSON.stringify(models.results.rows[0])).toBe(before);
  });
  it('shared filing guard requires V2 verification only after explicit tenant cutover', async () => {
    const { service } = build();
    const window = { from: Date.parse('2026-09-22T10:00:00Z'), to: Date.parse('2026-09-22T12:00:00Z') };
    await expect((service.assertFilingAllowed as any)(ORG, USER, window, WORK_DATE, new Date('2026-09-22T14:00:00Z'), undefined, { v2Enabled: true })).rejects.toThrow('OVERTIME_ATTENDANCE_NOT_VERIFIED');
    await expect(service.assertFilingAllowed(ORG, USER, window, WORK_DATE, new Date('2026-09-22T14:00:00Z'))).resolves.toEqual({ isRetroactive: false });
  });
  it('V2 rejects unsupported endpoint provenance while V1 remains legacy', async () => {
    const { service } = build();
    const context = await service.dayContext(ORG, USER, WORK_DATE);
    expect(() => service.assertVerifiedAttendance({ ...context, overallApprovalStatus: 'NOT_REQUIRED' })).toThrow('OVERTIME_ATTENDANCE_SOURCE_UNSUPPORTED');
    await expect(service.computeForRequest(ORG, request({ metadata: { calculationContract: 'OVERTIME_V2' } }))).rejects.toThrow('OVERTIME_ATTENDANCE_NOT_VERIFIED');
    expect((await service.computeForRequest(ORG, request())).computation.eligibleMinutes).toBe(120);
  });
  it('V2 stores raw/payable and explicit policy evidence', async () => {
    const { service, models } = build({ laborPolicy: { ...LABOR_POLICY, _id: 'policy', minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 } });
    Object.assign(models.attendanceDays.rows[0], { checkInProvenance: { source: 'OBSERVED', eventId: 'in' }, checkOutProvenance: { source: 'OBSERVED', eventId: 'out' }, overallApprovalStatus: 'NOT_REQUIRED' });
    const r = request({ metadata: { calculationContract: 'OVERTIME_V2' }, approvedEnd: '2026-09-22T12:35:00Z' });
    const row = await service.onApproved(ORG, r) as any;
    expect(row).toMatchObject({ calculationContract: 'OVERTIME_V2', rawEligibleMinutes: 95, payableMinutes: 90, eligibleMinutes: 90, roundingDroppedMinutes: 5, policySnapshot: { id: 'policy', minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 } });
  });
  describe('trust boundary (§17, BR-OT-01)', () => {
    it('refuses a client that sent its own overtime type', () => {
      const { service } = build();
      expect(() => service.assertNoClientType({ workDate: WORK_DATE, overtimeType: 'OT_PUBLIC_HOLIDAY' }))
        .toThrow(BadRequestException);
      expect(() => service.assertNoClientType({ eligibleMinutes: 9999 })).toThrow('OVERTIME_SELF_TYPE_FORBIDDEN');
      expect(() => service.assertNoClientType({ reason: 'Làm thêm tối' })).not.toThrow();
    });

    it('rejects an overlapping window for the same employee and date', async () => {
      const { service } = build({ requests: [request()] });
      await expect(service.assertNoOverlap(ORG, USER, { from: Date.parse('2026-09-22T12:00:00Z'), to: Date.parse('2026-09-22T14:00:00Z') }, WORK_DATE))
        .rejects.toBeInstanceOf(ConflictException);
      // Adjacent, not overlapping → allowed.
      await expect(service.assertNoOverlap(ORG, USER, { from: Date.parse('2026-09-22T13:00:00Z'), to: Date.parse('2026-09-22T14:00:00Z') }, WORK_DATE))
        .resolves.toBeUndefined();
      // A rejected request no longer reserves its minutes.
      await expect(service.assertNoOverlap(ORG, USER, { from: Date.parse('2026-09-22T11:00:00Z'), to: Date.parse('2026-09-22T13:00:00Z') }, WORK_DATE, 'ot1'))
        .resolves.toBeUndefined();
    });
  });

  describe('retroactive grace window (FR-OT-01)', () => {
    it('treats a report filed the day after as ordinary', () => {
      const { service } = build();
      expect(service.deriveRetroactive(WORK_DATE, new Date('2026-09-23T04:00:00Z'))).toEqual({ isRetroactive: false });
    });
    it('demands a reason once the grace window has passed', () => {
      const { service } = build();
      const late = new Date('2026-09-25T04:00:00Z');
      expect(() => service.deriveRetroactive(WORK_DATE, late)).toThrow('OVERTIME_RETROACTIVE_REASON_REQUIRED');
      expect(service.deriveRetroactive(WORK_DATE, late, 'Đi công tác về muộn, báo bổ sung'))
        .toEqual({ isRetroactive: true, retroactiveReason: 'Đi công tác về muộn, báo bổ sung' });
    });

    // D39 — the grace window stops being "late but forgiven" at a hard ceiling.
    describe('filing cutoff (D39)', () => {
      // `WORK_DATE` is a Tuesday; its VN day ends 2026-09-22T17:00Z.
      const dayAfter = new Date('2026-09-23T17:00:00.000Z');

      it('refuses a report past the default ceiling even with a reason', () => {
        const { service } = build();
        const veryLate = new Date(dayAfter.getTime() + 8 * 86_400_000);
        expect(() => service.deriveRetroactive(WORK_DATE, veryLate, 'Lý do rất dài và hợp lý'))
          .toThrow('OVERTIME_FILING_WINDOW_CLOSED');
      });

      it('keeps a report between grace and ceiling retroactive rather than refused', () => {
        const { service } = build();
        const within = new Date(dayAfter.getTime() + 3 * 86_400_000);   // 4 days late, under 7
        expect(service.deriveRetroactive(WORK_DATE, within, 'Sếp giao đột xuất, báo bổ sung sau'))
          .toEqual({ isRetroactive: true, retroactiveReason: 'Sếp giao đột xuất, báo bổ sung sau' });
      });

      it('takes the ceiling from the policy, not a constant', async () => {
        const { service } = build({ laborPolicy: { ...LABOR_POLICY, maxRetroactiveFilingDays: 0 } });
        // A policy that allows no lateness refuses the day-after report outright.
        const days = await service.maxFilingDays(ORG, WORK_DATE);
        expect(days).toBe(0);
        expect(() => service.deriveRetroactive(WORK_DATE, dayAfter, 'Lý do đủ dài để hợp lệ', days))
          .toThrow('OVERTIME_FILING_WINDOW_CLOSED');
        // Same instant, a generous ceiling: retroactive but admissible.
        expect(() => service.deriveRetroactive(WORK_DATE, dayAfter, 'Lý do đủ dài để hợp lệ', 7))
          .not.toThrow();
      });

      it('falls back to the default when the tenant has no policy row', async () => {
        const { service, policies } = build();
        policies.laborAt.mockRejectedValue(new NotFoundException('LABOR_POLICY_NOT_FOUND'));
        // Missing configuration must not refuse a real report of real hours (D38).
        await expect(service.maxFilingDays(ORG, WORK_DATE)).resolves.toBe(DEFAULT_MAX_RETROACTIVE_FILING_DAYS);
      });
    });
  });

  describe('scheduled-shift encroachment (D39)', () => {
    // The seeded shift is 08:00–17:00 VN ⇒ [01:00Z, 10:00Z].
    const window = (from: string, to: string) => ({ from: Date.parse(from), to: Date.parse(to) });

    it('refuses a window that reaches into the assigned shift', async () => {
      const { service } = build();
      await expect(service.assertOutsideSchedule(ORG, USER, window('2026-09-22T09:00:00Z', '2026-09-22T12:00:00Z'), WORK_DATE))
        .rejects.toThrow('OVERTIME_OVERLAPS_SCHEDULE');   // 16:00–19:00 VN, straddles 17:00
      await expect(service.assertOutsideSchedule(ORG, USER, window('2026-09-22T02:00:00Z', '2026-09-22T04:00:00Z'), WORK_DATE))
        .rejects.toThrow('OVERTIME_OVERLAPS_SCHEDULE');   // fully inside the shift
    });

    it('allows a window that only touches the shift boundary', async () => {
      const { service } = build();
      // Half-open [from,to): 17:00–19:00 VN shares no minute with an 08:00–17:00 shift.
      await expect(service.assertOutsideSchedule(ORG, USER, window('2026-09-22T10:00:00Z', '2026-09-22T12:00:00Z'), WORK_DATE))
        .resolves.toBeUndefined();
    });

    it('says nothing when the day resolves to no shift', async () => {
      const { service } = build({ shift: null });
      await expect(service.assertOutsideSchedule(ORG, USER, window('2026-09-22T02:00:00Z', '2026-09-22T04:00:00Z'), WORK_DATE))
        .resolves.toBeUndefined();
    });

    it('does not subtract the assigned shift when the organization calendar marks a public holiday', async () => {
      const { service } = build({
        calendar: [{ organizationId: ORG, date: WORK_DATE, type: 'PUBLIC_HOLIDAY', name: 'Quốc khánh' }],
      });

      const context = await service.dayContext(ORG, USER, WORK_DATE);

      expect(service.scheduledIntervals(context)).toEqual([]);
    });

    it('applies the same rule to the manager-approved window', async () => {
      const { service } = build();
      await expect(service.precheckApproval(ORG, request({ approvedStart: '2026-09-22T09:00:00.000Z', approvedEnd: '2026-09-22T12:00:00.000Z' })))
        .rejects.toThrow('OVERTIME_OVERLAPS_SCHEDULE');
    });

    it('runs the filing guards in order and returns the retroactive fields', async () => {
      const { service } = build({ requests: [request({ _id: 'other', status: 'PENDING' })] });
      // Overlap first (an existing 18:00–20:00 window), before any timing rule.
      await expect(service.assertFilingAllowed(
        ORG, USER, window('2026-09-22T11:00:00Z', '2026-09-22T13:00:00Z'), WORK_DATE, new Date('2026-09-22T12:30:00Z'),
      )).rejects.toThrow('OVERTIME_OVERLAP');
    });

    it('accepts a clean filing and reports it as ordinary', async () => {
      const { service } = build();
      await expect(service.assertFilingAllowed(
        ORG, USER, window('2026-09-22T10:00:00Z', '2026-09-22T12:00:00Z'), WORK_DATE, new Date('2026-09-22T08:00:00Z'),
      )).resolves.toEqual({ isRetroactive: false });
    });
  });

  describe('unreported overtime (D39 — the cap the punch reveals)', () => {
    it('measures worked time outside the shift that no request claims', async () => {
      // Punches run 08:00→20:00 VN against an 08:00–17:00 shift: 180 minutes of
      // real OT, of which a filed 18:00–20:00 window claims 120.
      const { service } = build({ requests: [request({ status: 'APPROVED' })] });
      await expect(service.unreportedOvertimeMinutes(ORG, USER, WORK_DATE))
        .resolves.toEqual({ unreportedMinutes: 60, workedTo: new Date(PUNCH_OUT) });
    });

    it('reports nothing when the whole overflow is claimed', async () => {
      const { service } = build({
        requests: [request({ approvedStart: '2026-09-22T10:00:00.000Z', approvedEnd: '2026-09-22T13:00:00.000Z' })],
      });
      await expect(service.unreportedOvertimeMinutes(ORG, USER, WORK_DATE)).resolves.toBeNull();
    });

    it('reports nothing with no punches to measure', async () => {
      const { service } = build({ attendance: [] });
      await expect(service.unreportedOvertimeMinutes(ORG, USER, WORK_DATE)).resolves.toBeNull();
    });

    it('counts a still-pending window as claimed', async () => {
      // The flag answers "hours nobody has asked about", not "hours unpaid".
      const { service } = build({ requests: [request({ status: 'PENDING' })] });
      const flagged = await service.unreportedOvertimeMinutes(ORG, USER, WORK_DATE);
      expect(flagged?.unreportedMinutes).toBe(60);
    });
  });

  describe('TASK-068 classification', () => {
    it('derives OT_WORKING_DAY from a scheduled weekday', async () => {
      const { service } = build();
      const { overtimeType } = await service.computeForRequest(ORG, request());
      expect(overtimeType).toBe(OvertimeType.WORKING_DAY);
    });
    it('derives OT_PUBLIC_HOLIDAY from the calendar, not the employee', async () => {
      const { service } = build({ calendar: [{ organizationId: ORG, date: WORK_DATE, type: 'PUBLIC_HOLIDAY', name: 'Quốc khánh' }] });
      const { overtimeType } = await service.computeForRequest(ORG, request());
      expect(overtimeType).toBe(OvertimeType.PUBLIC_HOLIDAY);
    });
    it('derives OT_WEEKLY_OFF when there is no schedule and no calendar exception', async () => {
      const { service } = build({ shift: null });
      const { overtimeType } = await service.computeForRequest(ORG, request());
      expect(overtimeType).toBe(OvertimeType.WEEKLY_OFF);
    });
    it('looks up punches by the User id even when employeeUserId arrives populated', async () => {
      const { service, models } = build();
      await service.computeForRequest(ORG, request({ employeeUserId: { _id: USER, fullName: 'Nguyễn Văn A' } }));
      expect(models.attendanceDays.findOne.mock.calls[0][0].employeeId).toBe(USER);
    });
  });

  describe('TASK-069 eligible minutes', () => {
    it('is approved ∩ attendance − schedule', async () => {
      const { service } = build();
      const { computation } = await service.computeForRequest(ORG, request());
      expect(computation).toMatchObject({ requestedMinutes: 120, approvedMinutes: 120, actualMinutes: 720, eligibleMinutes: 120 });
      expect(computation.calculationNote).toBe('OK');
    });
    it('is zero without punches (AC-OT-03)', async () => {
      const { service } = build({ attendance: [] });
      const { computation } = await service.computeForRequest(ORG, request());
      expect(computation.eligibleMinutes).toBe(0);
      expect(computation.calculationNote).toContain('NO_ACTUAL_ATTENDANCE');
    });
    it('drops the part of an approved window that was not worked (AC-OT-04)', async () => {
      const { service } = build();
      const { computation } = await service.computeForRequest(ORG, request({
        approvedEnd: '2026-09-22T16:00:00.000Z',   // approved to 23:00, punched to 20:00
      }));
      expect(computation.approvedMinutes).toBe(300);
      expect(computation.eligibleMinutes).toBe(120);
    });
    it('counts nothing for a window that sits inside the schedule', async () => {
      const { service } = build();
      const { computation } = await service.computeForRequest(ORG, request({
        approvedStart: '2026-09-22T03:00:00.000Z', approvedEnd: '2026-09-22T05:00:00.000Z',
      }));
      expect(computation.eligibleMinutes).toBe(0);
      expect(computation.calculationNote).toContain('FULLY_WITHIN_SCHEDULE');
    });
  });

  describe('result persistence (§15.11, §30B.2)', () => {
    it('writes the full record on approval', async () => {
      const { service, models } = build();
      const row = await service.onApproved(ORG, request());
      expect(row).toMatchObject({
        organizationId: ORG, overtimeRequestId: 'ot1', employeeId: USER, departmentId: 'd1',
        workDate: WORK_DATE, periodKey: '2026-09', yearKey: '2026',
        overtimeType: 'OT_WORKING_DAY', classificationStatus: 'PROVISIONAL',
        requestedMinutes: 120, approvedMinutes: 120, actualMinutes: 720, eligibleMinutes: 120,
        scheduledMinutes: 420, policyVersion: LABOR_POLICY.version, legalReference: LABOR_POLICY.legalReference,
      });
      expect(row.attendanceDayId).toBe('ad1');
      expect(row.eligibleIntervals).toHaveLength(1);
      expect(new Date(row.eligibleIntervals[0].from).toISOString()).toBe('2026-09-22T11:00:00.000Z');
      expect(row.inputHash).toMatch(/^[0-9a-f]{64}$/);
      expect(models.results.rows).toHaveLength(1);
    });

    it('replaces rather than duplicates when the same request is recomputed', async () => {
      const { service, models } = build();
      await service.onApproved(ORG, request());
      await service.onApproved(ORG, request());
      expect(models.results.rows).toHaveLength(1);
    });

    it('refuses to bank OT for an employee with no known department', async () => {
      const { service } = build({ attendance: [{ _id: 'ad1', organizationId: ORG, employeeId: USER, workDate: WORK_DATE, checkInAt: new Date(PUNCH_IN), checkOutAt: new Date(PUNCH_OUT), workingMinutes: 600 }] });
      await expect(service.onApproved(ORG, request({ departmentId: undefined })))
        .rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe.each(['LEGACY_V1', 'OVERTIME_V2'])('FINAL lifecycle (%s)', (contract) => {
    function fixture() {
      const req = request({ metadata: { calculationContract: contract } });
      const setup = build({ requests: [req], laborPolicy: { ...LABOR_POLICY, minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 } });
      Object.assign(setup.models.attendanceDays.rows[0], { checkInProvenance: { source: 'OBSERVED' }, checkOutProvenance: { source: 'OBSERVED' }, overallApprovalStatus: 'APPROVED' });
      const period = { organizationId: ORG, active: true, startDate: WORK_DATE, endDate: WORK_DATE, status: 'READY_TO_CLOSE', version: 1 } as Doc;
      const periods = collection([period]);
      (setup.models.results as any).db = { model: jest.fn((name: string) => { if (name !== 'TimesheetPeriod') throw new Error(name); return periods; }) };
      return { ...setup, req, period, periods };
    }

    it('refreshes FINAL after authorized reopen and reclose without changing historical artifacts', async () => {
      const { service, models, period } = fixture();
      await service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' });
      period.status = 'CLOSED';
      const historicalSnapshot = structuredClone(models.results.rows[0]);
      period.status = 'REVIEWING';
      period.version += 1;
      models.attendanceDays.rows[0].checkOutAt = new Date('2026-09-22T12:00:00.000Z');
      expect(await service.isStale(ORG, models.results.rows[0] as any)).toBe(true);
      expect(await service.recompute(ORG, WORK_DATE, WORK_DATE)).toEqual({ scanned: 1, changed: 1 });
      expect(models.results.rows[0]).toMatchObject({ classificationStatus: 'PROVISIONAL', eligibleMinutes: 60 });
      await service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' });
      expect(models.results.rows[0]).toMatchObject({ classificationStatus: 'FINAL', eligibleMinutes: 60 });
      expect(historicalSnapshot).toMatchObject({ classificationStatus: 'FINAL', eligibleMinutes: 120 });
    });

    it('refreshes FINAL directly at reclose even without an intermediate PROVISIONAL refresh', async () => {
      const { service, models, period } = fixture();
      await service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' });
      period.status = 'REVIEWING';
      period.version += 1;
      models.attendanceDays.rows[0].checkOutAt = new Date('2026-09-22T12:00:00.000Z');
      period.status = 'READY_TO_CLOSE';
      expect(await service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' })).toEqual({ scanned: 1, changed: 1 });
      expect(models.results.rows[0]).toMatchObject({ classificationStatus: 'FINAL', eligibleMinutes: 60 });
    });

    it.each(['CLOSED', 'PAYROLL_CLAIMED'])('preserves %s results across recompute and direct persistence', async (state) => {
      const { service, models, period, req } = fixture();
      await service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' });
      if (state === 'CLOSED') period.status = 'CLOSED';
      else { period.status = 'REVIEWING'; period.payrollRunId = 'run-1'; }
      const frozen = structuredClone(models.results.rows[0]);
      models.attendanceDays.rows[0].checkOutAt = new Date('2026-09-22T12:00:00.000Z');
      expect(await service.isStale(ORG, models.results.rows[0] as any)).toBe(false);
      expect(await service.recompute(ORG, WORK_DATE, WORK_DATE)).toEqual({ scanned: 1, changed: 0 });
      await service.onApproved(ORG, req);
      expect(models.results.rows[0]).toEqual(frozen);
    });

    it('allows direct persistence to refresh a reopened FINAL', async () => {
      const { service, models, period, req } = fixture();
      await service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' });
      period.status = 'REVIEWING';
      period.version += 1;
      models.attendanceDays.rows[0].checkOutAt = new Date('2026-09-22T12:00:00.000Z');
      await service.onApproved(ORG, req);
      expect(models.results.rows[0]).toMatchObject({ classificationStatus: 'PROVISIONAL', eligibleMinutes: 60 });
    });
  });

  describe('staleness (BR-OT-05, AC-OT-05)', () => {
    it('flags a result whose calendar changed underneath it', async () => {
      const { service, models } = build();
      await service.onApproved(ORG, request());
      expect((await service.listResults(ORG))[0].recalculationRequired).toBe(false);
      models.calendar.rows.push({ organizationId: ORG, date: WORK_DATE, type: 'PUBLIC_HOLIDAY', name: 'Quốc khánh' });
      const [row] = await service.listResults(ORG);
      expect(row.recalculationRequired).toBe(true);
    });
    it('flags a result whose labor policy version moved', async () => {
      const { service, models } = build();
      await service.onApproved(ORG, request());
      models.results.rows[0].inputHash = 'stale';
      expect((await service.listResults(ORG))[0].recalculationRequired).toBe(true);
    });
    it('promotes the type when recomputed after the calendar edit', async () => {
      const { service, models, periodVersion } = build({ requests: [request()] });
      await service.onApproved(ORG, request());
      models.calendar.rows.push({ organizationId: ORG, date: WORK_DATE, type: 'PUBLIC_HOLIDAY', name: 'Quốc khánh' });
      const outcome = await service.recompute(ORG, WORK_DATE, WORK_DATE);
      expect(outcome).toEqual({ scanned: 1, changed: 1 });
      expect(models.results.rows[0].overtimeType).toBe(OvertimeType.PUBLIC_HOLIDAY);
      expect(periodVersion.bumpForWorkDates).toHaveBeenCalledTimes(1);
      expect(periodVersion.bumpForWorkDates).toHaveBeenCalledWith(ORG, [WORK_DATE]);
      // Idempotent: a second run finds nothing left to move.
      expect(await service.recompute(ORG, WORK_DATE, WORK_DATE)).toEqual({ scanned: 1, changed: 0 });
      expect(periodVersion.bumpForWorkDates).toHaveBeenCalledTimes(1);
    });
    it('fails closed when reclassification invalidation fails', async () => {
      const { service, models, periodVersion } = build({ requests: [request()] });
      await service.onApproved(ORG, request());
      models.calendar.rows.push({ organizationId: ORG, date: WORK_DATE, type: 'PUBLIC_HOLIDAY', name: 'Quốc khánh' });
      periodVersion.bumpForWorkDates.mockRejectedValueOnce(new Error('version unavailable'));
      await expect(service.recompute(ORG, WORK_DATE, WORK_DATE)).rejects.toThrow('version unavailable');
    });
    it('can be promoted to FINAL, which is what Sprint 6 will call', async () => {
      const { service, models, periodVersion } = build();
      models.requests.rows.push(request());
      await service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' });
      expect(models.results.rows[0].classificationStatus).toBe('FINAL');
      periodVersion.bumpForWorkDates.mockClear();
      models.results.rows[0].classificationStatus = 'PROVISIONAL';
      await service.recompute(ORG, WORK_DATE, WORK_DATE, { targetStatus: 'FINAL' });
      expect(periodVersion.bumpForWorkDates).not.toHaveBeenCalled();
    });
    it('refuses an over-long recalculation window', async () => {
      const { service } = build();
      await expect(service.recompute(ORG, '2024-01-01', '2026-01-01')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('TASK-070 labor limits (§30B.2)', () => {
    it('passes an approval well inside the caps', async () => {
      const { service } = build();
      const { labor } = await service.precheckApproval(ORG, request());
      expect(labor.approvable).toBe(true);
      expect(labor.violations.filter((v) => v.severity === 'BLOCK')).toHaveLength(0);
    });
    it('blocks on the monthly cap and names the accumulated usage', async () => {
      const { service } = build({ results: [{ organizationId: ORG, employeeId: USER, workDate: '2026-09-01', periodKey: '2026-09', eligibleMinutes: 2350 }] });
      await expect(service.precheckApproval(ORG, request()))
        .rejects.toThrow('OVERTIME_MONTHLY_LIMIT_EXCEEDED');
    });
    it('warns at 80% without blocking', async () => {
      const { service } = build({ results: [{ organizationId: ORG, employeeId: USER, workDate: '2026-09-01', periodKey: '2026-09', eligibleMinutes: 1800 }] });
      const { labor } = await service.precheckApproval(ORG, request());
      expect(labor.approvable).toBe(true);
      expect(labor.violations.map((v) => v.severity)).toContain('WARNING');
      expect(labor.policyVersion).toBe(LABOR_POLICY.version);
    });
    it('rejects a policy row missing a limit rather than comparing against undefined', async () => {
      const broken = { ...LABOR_POLICY } as Doc;
      delete broken.maxMonthlyOvertimeMinutes;
      const { service } = build({ laborPolicy: broken });
      await expect(service.precheckApproval(ORG, request())).rejects.toThrow('LABOR_POLICY_FIELD_MISSING');
    });
    it('caps normal minutes at the schedule, then adds banked OT and the candidate', async () => {
      // Punch 08:00→20:00 = 600 worked, but the schedule is 08:00→17:00 − 120 break.
      const { service } = build({ results: [{ organizationId: ORG, employeeId: USER, workDate: WORK_DATE, periodKey: '2026-09', yearKey: '2026', overtimeRequestId: 'ot1', eligibleMinutes: 120 }] });
      const usage = await service.usageFor(ORG, USER, WORK_DATE, 120);
      expect(usage.normalDailyMinutes).toBe(420);
      // A 12-hour punch must not, on its own, breach the 480 normal-day cap.
      expect(usage.combinedDailyMinutes).toBe(420 + 120 + 120);
      expect(usage.overtimeMonthlyMinutes).toBe(240);
    });
    it('reads the policy effective on the work date, not today', async () => {
      const { service, policies } = build();
      await service.precheckApproval(ORG, request({ workDate: new Date('2026-03-10T12:00:00Z') }));
      expect((policies.laborAt.mock.calls[0][1] as Date).toISOString().slice(0, 10)).toBe('2026-03-10');
    });
  });

  describe('per-type totals (FR-OT-03, AC-OT-06)', () => {
    it('buckets eligible minutes by type', async () => {
      const { service } = build({ results: [
        { organizationId: ORG, employeeId: USER, workDate: WORK_DATE, periodKey: '2026-09', overtimeType: 'OT_WORKING_DAY', eligibleMinutes: 120 },
        { organizationId: ORG, employeeId: USER, workDate: '2026-09-05', periodKey: '2026-09', overtimeType: 'OT_WEEKLY_OFF', eligibleMinutes: 240 },
        { organizationId: ORG, employeeId: USER, workDate: '2026-09-02', periodKey: '2026-09', overtimeType: 'OT_PUBLIC_HOLIDAY', eligibleMinutes: 300 },
        { organizationId: ORG, employeeId: USER, workDate: '2026-08-02', periodKey: '2026-08', overtimeType: 'OT_WORKING_DAY', eligibleMinutes: 999 },
      ] });
      expect(await service.totalsByType(ORG, '2026-09')).toEqual({
        otWorkingDayMinutes: 120, otWeeklyOffMinutes: 240, otPublicHolidayMinutes: 300, totalEligibleOvertimeMinutes: 660,
      });
    });
  });

  describe('check-out refresh', () => {
    it('recomputes every approved request of the day', async () => {
      const { service, models } = build({ requests: [request(), request({ _id: 'ot2', approvedStart: '2026-09-22T13:00:00.000Z', approvedEnd: '2026-09-22T14:00:00.000Z', requestedStart: '2026-09-22T13:00:00.000Z', requestedEnd: '2026-09-22T14:00:00.000Z' })] });
      expect(await service.recomputeForDay(ORG, USER, WORK_DATE)).toBe(2);
      expect(models.results.rows).toHaveLength(2);
    });
  });
});
