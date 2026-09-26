import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Types } from 'mongoose';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, addCalendarException, collection, cookieFor, recentWorkDate, seedAttendanceDay, seedTenant, vn } from './fixtures';

/**
 * TASK-071 — the overtime happy path and the §17 trust boundary, driven over real
 * HTTP against a real replica set. What only this lane can catch: the unique
 * `(organizationId, overtimeRequestId)` index that makes the result write
 * idempotent, the tenant index that answers an IDOR with a 404, the validation
 * pipe that must 400 an unknown field, and the exception filter that must lift a
 * thrown `OVERTIME_*` message into `error.code`.
 */

type Http = ReturnType<TestApp['http']>;

let testApp: TestApp;
let http: Http;
let fixture: Fixture;
let employeeCookie: string;
let managerCookie: string;
let hrCookie: string;

// Everything below is derived, never hard-coded: a fixed work date would age out
// of the retroactive grace window and turn this whole file red for a reason that
// has nothing to do with the code under test.
let WORK_DATE: string;
let PERIOD_KEY: string;
let YEAR_KEY: string;
let MONTH_FROM: string;
let MONTH_TO: string;

/** `at` = wall-clock `hhmm` of `WORK_DATE` as the ISO instant with VN offset. */
const iso = (hhmm: string, day = WORK_DATE) => `${day}T${hhmm}:00+07:00`;

/** Last day of the month `workDate` falls in, as 'YYYY-MM-DD'. */
function endOfMonth(workDate: string): string {
  const [year, month] = workDate.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

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
  PERIOD_KEY = WORK_DATE.slice(0, 7);
  YEAR_KEY = WORK_DATE.slice(0, 4);
  MONTH_FROM = `${PERIOD_KEY}-01`;
  MONTH_TO = endOfMonth(WORK_DATE);
  fixture = await seedTenant();
  employeeCookie = await cookieFor(fixture.employeeId, fixture.organizationId);
  managerCookie = await cookieFor(fixture.managerId, fixture.organizationId);
  hrCookie = await cookieFor(fixture.hrId, fixture.organizationId);
});

const REQUEST_BODY = () => ({
  workDate: WORK_DATE,
  requestedStart: iso('18:00'),
  requestedEnd: iso('20:00'),
  reason: 'Hoàn tất phát hành bản vá khẩn cấp lúc 20:00',
});

const results = () => collection('OvertimeResult');

async function fileOvertime(body: Record<string, unknown> = REQUEST_BODY()) {
  return http.post('/api/overtime').set('Cookie', employeeCookie).send(body);
}

async function approve(requestId: string, body: Record<string, unknown> = {}) {
  return http.post(`/api/manager/overtime/${requestId}/approve`)
    .set('Cookie', managerCookie)
    .send({ expectedVersion: 1, ...body });
}

describe('overtime flow (AC-OT-01..06)', () => {
  it('computes eligible minutes as (approved ∩ punch) − schedule on approval', async () => {
    // 08:00→20:00 worked against an 08:00–17:00/60-break schedule.
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    expect(filed.body.data.status).toBe('PENDING');
    // The system, not the employee, decides the type — and says nothing yet.
    expect(filed.body.data.overtimeType).toBeUndefined();

    const approved = await approve(String(filed.body.data._id));
    expect(approved.status).toBe(201);

    const [row] = await results().find({ organizationId: fixture.organizationId }).lean();
    // Ids compared through `String`: a `lean()` document carries them as ObjectIds,
    // and `toMatchObject` compares an ObjectId with a string and fails.
    expect(row).toMatchObject({
      workDate: WORK_DATE,
      periodKey: PERIOD_KEY,
      yearKey: YEAR_KEY,
      overtimeType: 'OT_WORKING_DAY',
      classificationStatus: 'PROVISIONAL',
      requestedMinutes: 120,
      approvedMinutes: 120,
      actualMinutes: 720,
      // 18:00–20:00 is entirely outside 08:00–17:00, so all of it is eligible.
      eligibleMinutes: 120,
      // 08:00–17:00 gross 540 minus the 60-minute break = 480, the same
      // `normalDailyMinutes: 480` the labor policy seeds (§30B.1).
      scheduledMinutes: 480,
      policyVersion: fixture.policyVersion,
    });
    expect({
      overtimeRequestId: String(row.overtimeRequestId),
      employeeId: String(row.employeeId),
      departmentId: String(row.departmentId),
      organizationId: String(row.organizationId),
    }).toEqual({
      overtimeRequestId: String(filed.body.data._id),
      employeeId: fixture.employeeId,
      departmentId: fixture.departmentId,
      organizationId: fixture.organizationId,
    });
    expect(row.legalReference).toContain('BLLĐ');
    expect(row.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(row.eligibleIntervals[0].from).getTime()).toBe(vn(WORK_DATE, '18:00').getTime());
  });

  it('pays nothing for an approved window nobody actually worked (AC-OT-03)', async () => {
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    const approved = await approve(String(filed.body.data._id));
    expect(approved.status).toBe(201);
    const [row] = await results().find({ organizationId: fixture.organizationId }).lean();
    expect(row.eligibleMinutes).toBe(0);
    expect(row.actualMinutes).toBe(0);
    expect(row.calculationNote).toContain('NO_ACTUAL_ATTENDANCE');
  });

  it('caps eligible at the minutes actually worked (AC-OT-04)', async () => {
    // Approved 18:00→22:00 (240) but the last punch is 20:00 → 120.
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    await approve(String(filed.body.data._id), { approvedStart: iso('18:00'), approvedEnd: iso('22:00') });
    const [row] = await results().find({ organizationId: fixture.organizationId }).lean();
    expect(row.approvedMinutes).toBe(240);
    expect(row.eligibleMinutes).toBe(120);
  });

  it('classifies the same request as a public holiday from the calendar alone', async () => {
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 720);
    await addCalendarException(fixture, WORK_DATE, 'PUBLIC_HOLIDAY', 'Quốc khánh nước CHXHCN Việt Nam');
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    await approve(String(filed.body.data._id));
    const [row] = await results().find({ organizationId: fixture.organizationId }).lean();
    // A holiday has no scheduled span to subtract: the whole worked window counts.
    expect(row.overtimeType).toBe('OT_PUBLIC_HOLIDAY');
    expect(row.eligibleMinutes).toBe(120);
    expect(row.calendarSnapshot.type).toBe('PUBLIC_HOLIDAY');
  });

  it('refuses a client that sent its own overtime type (AC-OT-01, §17)', async () => {
    const response = await fileOvertime({ ...REQUEST_BODY(), overtimeType: 'OT_PUBLIC_HOLIDAY' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('OVERTIME_SELF_TYPE_FORBIDDEN');
    expect(await collection('ManagerRequest').countDocuments({})).toBe(0);
  });

  it('rejects an unknown field before touching the database', async () => {
    const response = await fileOvertime({ ...REQUEST_BODY(), eligibleMinutes: 9999 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects a second request overlapping the first (BR-OT-04)', async () => {
    const first = await fileOvertime();
    expect(first.status).toBe(201);
    const overlap = await fileOvertime({
      ...REQUEST_BODY(), requestedStart: iso('19:00'), requestedEnd: iso('21:00'),
    });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('OVERTIME_OVERLAP');
    // An adjacent window is fine.
    const adjacent = await fileOvertime({
      ...REQUEST_BODY(), requestedStart: iso('20:00'), requestedEnd: iso('21:00'),
    });
    expect(adjacent.status).toBe(201);
  });

  it('lets the manager approve through the pre-existing generic route too', async () => {
    // The web app posts to /api/requests + /api/manager/approvals — same engine.
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
    const filed = await http.post('/api/requests').set('Cookie', employeeCookie).send({
      type: 'OVERTIME', ...REQUEST_BODY(),
    });
    expect(filed.status).toBe(201);
    const approved = await http.post(`/api/manager/approvals/${filed.body.data._id}/approve`)
      .set('Cookie', managerCookie).send({ expectedVersion: 1 });
    expect(approved.status).toBe(201);
    const [row] = await results().find({ organizationId: fixture.organizationId }).lean();
    expect(row.eligibleMinutes).toBe(120);
  });

  it('refuses an employee approving their own report', async () => {
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    const self = await http.post(`/api/manager/overtime/${filed.body.data._id}/approve`)
      .set('Cookie', employeeCookie).send({ expectedVersion: 1 });
    expect(self.status).toBeGreaterThanOrEqual(400);
    expect(self.status).toBeLessThan(500);
  });

  it('turns a stale expectedVersion into 409, not a double approval', async () => {
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    const id = String(filed.body.data._id);
    expect((await approve(id)).status).toBe(201);
    const replay = await approve(id, { expectedVersion: 1 });
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe('REQUEST_STATE_CHANGED');
    // One request, one result — the unique index is the last line of defence.
    expect(await results().countDocuments({ organizationId: fixture.organizationId })).toBe(1);
  });

  it('reports the derived figures back to the employee on /overtime/mine', async () => {
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    await approve(String(filed.body.data._id));
    const mine = await http.get(`/api/overtime/mine?month=${PERIOD_KEY}`).set('Cookie', employeeCookie);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0]).toMatchObject({
      status: 'APPROVED', overtimeType: 'OT_WORKING_DAY', eligibleMinutes: 120, classificationStatus: 'PROVISIONAL',
    });
  });

  it('shows eligible (not wall-clock) overtime in the attendance history', async () => {
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    // Approved far wider than what was worked: wall-clock would say 240+.
    await approve(String(filed.body.data._id), { approvedStart: iso('18:00'), approvedEnd: iso('22:00') });
    const history = await http.get(`/api/attendance/history?month=${PERIOD_KEY}`).set('Cookie', employeeCookie);
    expect(history.status).toBe(200);
    const day = history.body.data.items.find((item: any) => item.workDate === WORK_DATE);
    expect(day.overtime.otMinutes).toBe(120);
    expect(day.overtime.overtimeType).toBe('OT_WORKING_DAY');
    expect(history.body.data.summary.otMinutes).toBe(120);
  });

  it('keeps one tenant’s data out of another’s reach (AC-TENANT-03)', async () => {
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    const id = String(filed.body.data._id);
    await approve(id);

    const other = await seedTenant();
    const otherManager = await cookieFor(other.managerId, other.organizationId);
    const stolen = await http.get(`/api/manager/approvals/${id}`).set('Cookie', otherManager);
    expect(stolen.status).toBe(404);
    expect(stolen.body.error.code).toBe('REQUEST_NOT_FOUND');
    const stolenDecision = await http.post(`/api/manager/overtime/${id}/approve`).set('Cookie', otherManager).send({ expectedVersion: 1 });
    expect(stolenDecision.status).toBe(404);
    // Untouched: the result still belongs to the first tenant.
    const stored = await results().find({}).lean();
    expect(stored).toHaveLength(1);
    expect(String(stored[0].organizationId)).toBe(fixture.organizationId);
  });

  it('lists results for HR and flags a stale one after a calendar edit (AC-OT-05)', async () => {
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    await approve(String(filed.body.data._id));

    const listUrl = `/api/hr/overtime-results?from=${MONTH_FROM}&to=${MONTH_TO}`;
    const fresh = await http.get(listUrl).set('Cookie', hrCookie);
    expect(fresh.status).toBe(200);
    expect(fresh.body.data).toHaveLength(1);
    expect(fresh.body.data[0].recalculationRequired).toBe(false);

    await addCalendarException(fixture, WORK_DATE, 'PUBLIC_HOLIDAY', 'Ngày lễ bổ sung');
    const stale = await http.get(listUrl).set('Cookie', hrCookie);
    expect(stale.body.data[0].recalculationRequired).toBe(true);

    const recalc = await http.post('/api/hr/overtime-results/recalculate')
      .set('Cookie', hrCookie)
      .send({ from: MONTH_FROM, to: MONTH_TO });
    expect(recalc.status).toBe(201);
    expect(recalc.body.data).toEqual({ scanned: 1, changed: 1 });

    const after = await http.get(listUrl).set('Cookie', hrCookie);
    expect(after.body.data[0]).toMatchObject({ overtimeType: 'OT_PUBLIC_HOLIDAY', recalculationRequired: false });
    // Idempotent: running it again changes nothing.
    const again = await http.post('/api/hr/overtime-results/recalculate')
      .set('Cookie', hrCookie).send({ from: MONTH_FROM, to: MONTH_TO });
    expect(again.body.data).toEqual({ scanned: 1, changed: 0 });
  });

  it('refuses a non-HR the results list', async () => {
    const response = await http.get('/api/hr/overtime-results').set('Cookie', employeeCookie);
    expect(response.status).toBe(403);
  });

  it('aggregates the period by type the way Sprint 6 will (AC-OT-06)', async () => {
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
    const filed = await fileOvertime();
    expect(filed.status).toBe(201);
    await approve(String(filed.body.data._id));
    // The same $group TimesheetSummary will run — one document per request,
    // bucketed by the type the backend derived.
    const totals = await results().aggregate([
      { $match: { organizationId: new Types.ObjectId(fixture.organizationId), periodKey: PERIOD_KEY } },
      { $group: { _id: '$overtimeType', minutes: { $sum: '$eligibleMinutes' } } },
    ]);
    expect(totals).toEqual([{ _id: 'OT_WORKING_DAY', minutes: 120 }]);
  });
});
