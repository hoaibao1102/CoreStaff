import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Types } from 'mongoose';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, collection, cookieFor, recentWorkDate, seedAttendanceDay, seedTenant, setLaborPolicy, vn } from './fixtures';

/**
 * TASK-070 — SRS §30B.2 enforcement, end to end.
 *
 * The point of this lane is that a BLOCKed approval leaves *nothing* behind: the
 * request is still PENDING at the same version, and no overtime result exists.
 * A unit spec with fake models cannot prove that ordering, because the fake
 * update always succeeds.
 *
 * Limits come from the seeded tenant's own policy, which each test lowers by one
 * number, so no test hard-codes a legal threshold §30K has not confirmed yet.
 */

type Http = ReturnType<TestApp['http']>;

let testApp: TestApp;
let http: Http;
let fixture: Fixture;
let employeeCookie: string;
let managerCookie: string;

// Derived, not hard-coded — see `recentWorkDate()` for why a fixed date goes stale.
let WORK_DATE: string;
const iso = (hhmm: string, day = WORK_DATE) => `${day}T${hhmm}:00+07:00`;

beforeAll(async () => {
  testApp = await createTestApp();
  http = testApp.http();
});

afterAll(async () => {
  await testApp.app.close();
});

beforeEach(async () => {
  await clearDatabase();
  WORK_DATE = recentWorkDate();
  fixture = await seedTenant();
  employeeCookie = await cookieFor(fixture.employeeId, fixture.organizationId);
  managerCookie = await cookieFor(fixture.managerId, fixture.organizationId);
  // 08:00→20:00 worked against an 08:00–17:00/60-break schedule ⇒ 120 eligible.
  await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
});

const results = () => collection('OvertimeResult');

async function filedRequest(day = WORK_DATE): Promise<string> {
  const filed = await http.post('/api/overtime').set('Cookie', employeeCookie).send({
    workDate: day,
    requestedStart: iso('18:00', day),
    requestedEnd: iso('20:00', day),
    reason: 'Cắt hệ thống định kỳ lúc 20:00, cần ở lại hỗ trợ',
  });
  expect(filed.status).toBe(201);
  return String(filed.body.data._id);
}

async function approve(id: string) {
  return http.post(`/api/manager/overtime/${id}/approve`).set('Cookie', managerCookie).send({ expectedVersion: 1 });
}

describe('labor limit enforcement (§30B.2)', () => {
  it('approves cleanly and stores the policy it was checked against', async () => {
    const id = await filedRequest();
    const response = await approve(id);
    expect(response.status).toBe(201);
    const [row] = await results().find({ organizationId: new Types.ObjectId(fixture.organizationId) }).lean();
    expect(row.policyVersion).toBe(fixture.policyVersion);
    expect(row.legalReference).toBeTruthy();
  });

  it('blocks a monthly overtime breach and leaves the request untouched', async () => {
    // One eligible period is 120 minutes; cap below that and no approval can pass.
    await setLaborPolicy(fixture.organizationId, { maxMonthlyOvertimeMinutes: 60 });
    const id = await filedRequest();
    const before = await collection('ManagerRequest').findById(id).lean() as any;
    const response = await approve(id);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('OVERTIME_MONTHLY_LIMIT_EXCEEDED');
    const after = await collection('ManagerRequest').findById(id).lean() as any;
    expect(after).toMatchObject({ status: 'PENDING', version: before.version });
    // The whole point of checking *before* the write.
    expect(await results().countDocuments({ organizationId: new Types.ObjectId(fixture.organizationId) })).toBe(0);
  });

  it('blocks a combined normal+OT daily breach', async () => {
    // Normal 480 + candidate 120 = 600 combined, so the cap has to sit *below*
    // that: `evaluateLaborLimits` blocks on `used > limit`, and 600 against 600
    // is at the limit, not over it.
    await setLaborPolicy(fixture.organizationId, { maxCombinedDailyMinutes: 500 });
    const id = await filedRequest();
    const response = await approve(id);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('OVERTIME_DAILY_LIMIT_EXCEEDED');
  });

  it('blocks an annual breach once the exceptional headroom is used too', async () => {
    await setLaborPolicy(fixture.organizationId, {
      maxAnnualOvertimeMinutes: 60,
      exceptionalAnnualOvertimeMinutes: 100,   // 120 > 100 ⇒ still blocked
    });
    const id = await filedRequest();
    const response = await approve(id);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('OVERTIME_ANNUAL_LIMIT_EXCEEDED');
  });

  it('allows the exceptional annual headroom to carry an overtime year', async () => {
    await setLaborPolicy(fixture.organizationId, {
      maxAnnualOvertimeMinutes: 60,
      exceptionalAnnualOvertimeMinutes: 6000,
      maxMonthlyOvertimeMinutes: 6000,
      maxCombinedDailyMinutes: 6000,
    });
    const id = await filedRequest();
    expect((await approve(id)).status).toBe(201);
  });

  it('warns at the threshold without blocking', async () => {
    // 120 eligible against a 150 monthly cap = 80% ⇒ warning, still approvable.
    // The day itself is a second warning: a full 480-minute normal day sits at
    // 100% of `normalDailyMinutes`, which is exactly what §30B.1 wants flagged
    // before overtime is ever considered.
    await setLaborPolicy(fixture.organizationId, {
      maxMonthlyOvertimeMinutes: 150, maxCombinedDailyMinutes: 3000, maxAnnualOvertimeMinutes: 3000,
    });
    const id = await filedRequest();
    const response = await approve(id);
    expect(response.status).toBe(201);
    expect(response.body.data.compliance.violations.map((v: any) => [v.key, v.severity]))
      .toEqual([['normalDaily', 'WARNING'], ['maxMonthlyOvertime', 'WARNING']]);
    expect(response.body.data.compliance.approvable).toBe(true);
    expect(await results().countDocuments({})).toBe(1);
  });

  it('never blocks at filing time, only warns', async () => {
    await setLaborPolicy(fixture.organizationId, { maxMonthlyOvertimeMinutes: 10 });
    const filed = await http.post('/api/overtime').set('Cookie', employeeCookie).send({
      workDate: WORK_DATE,
      requestedStart: iso('18:00'),
      requestedEnd: iso('20:00'),
      reason: 'Ở lại trực hệ thống tới 20:00 do có cảnh báo từ monitoring',
    });
    expect(filed.status).toBe(201);
    expect(filed.body.data.compliance.approvable).toBe(false);
    expect(filed.body.data.compliance.violations.some((v: any) => v.severity === 'BLOCK')).toBe(true);
  });

  it('reads the policy effective on the work date, not on today', async () => {
    // A *second* policy version starting next year, capped so low that reading it
    // would block. The version in force on the work date stays generous, so a
    // pass here proves the lookup is anchored to the work date.
    await collection('LaborCompliancePolicy').create({
      organizationId: fixture.organizationId,
      effectiveFrom: new Date(`${Number(WORK_DATE.slice(0, 4)) + 1}-01-01`),
      normalDailyMinutes: 480, normalWeeklyMinutes: 2880, maxCombinedDailyMinutes: 720,
      maxMonthlyOvertimeMinutes: 10, maxAnnualOvertimeMinutes: 20000,
      exceptionalAnnualOvertimeMinutes: 24000, warningThresholdPercent: 80,
      probationMinimumRate: 0.85, legalReference: 'BLLĐ 45/2019/QH14 điều 107',
      version: fixture.policyVersion + 1, active: true,
    });
    const id = await filedRequest();
    const response = await approve(id);
    expect(response.status).toBe(201);
    const [row] = await results().find({ organizationId: fixture.organizationId }).lean();
    expect(row.policyVersion).toBe(fixture.policyVersion);
  });

  it('counts a second approved overtime window of the same month toward the cap', async () => {
    // Adjacent windows, so no overlap guard. The second one sits *before* the
    // first (17:00–18:00): the day's last punch is 20:00, so anything after that
    // has no attendance to intersect and would come out eligible-free.
    await setLaborPolicy(fixture.organizationId, { maxMonthlyOvertimeMinutes: 150, maxCombinedDailyMinutes: 3000, maxAnnualOvertimeMinutes: 3000 });
    expect((await approve(await filedRequest())).status).toBe(201);

    const second = await http.post('/api/overtime').set('Cookie', employeeCookie).send({
      workDate: WORK_DATE,
      requestedStart: iso('17:00'),
      requestedEnd: iso('18:00'),
      reason: 'Ở lại hỗ trợ nghiệm thu từ 17:00 trước ca trực buổi tối',
    });
    expect(second.status).toBe(201);
    const response = await approve(String(second.body.data._id));
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('OVERTIME_MONTHLY_LIMIT_EXCEEDED');
  });

  it('refuses a tenant whose labor policy is missing entirely', async () => {
    await collection('LaborCompliancePolicy').deleteMany({ organizationId: new Types.ObjectId(fixture.organizationId) });
    const id = await filedRequest();
    const response = await approve(id);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('LABOR_POLICY_NOT_FOUND');
  });
});
