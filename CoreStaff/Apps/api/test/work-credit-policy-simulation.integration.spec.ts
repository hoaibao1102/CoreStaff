import './env-guard';
import { Types } from 'mongoose';
import { clearDatabase, connection, createTestApp, TestApp } from './app-factory';
import { cookieFor, Fixture, resolveAndAcknowledgePeriod, seedTenant, vnToday } from './fixtures';

// Acceptance of existing policy persistence/lifecycle; simulation itself is pure/read-only.
let app: TestApp;
let http: ReturnType<TestApp['http']>;
let fixture: Fixture;
let hr: string;

beforeAll(async () => {
  if (process.env.TEST_MONGO_EPHEMERAL !== '1'
    || !/^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(process.env.TEST_MONGO_URI ?? '')) {
    throw new Error('EPHEMERAL_LOOPBACK_REQUIRED');
  }
  app = await createTestApp();
  http = app.http();
  expect(connection().name).toBe('corestaff_it');
  console.log('[work-credit acceptance] disposable loopback replica set / corestaff_it');
});
afterAll(async () => { if (app) await app.app.close(); });
beforeEach(async () => {
  await clearDatabase();
  fixture = await seedTenant();
  hr = await cookieFor(fixture.hrId, fixture.organizationId);
});
const policy = () => connection().model('WorkCreditPolicy').findOne({ organizationId: fixture.organizationId }).lean() as Promise<any>;
const update = (id: string, cookie = hr) => http.patch(`/api/hr/policies/work-credit/${id}`)
  .set('Cookie', cookie).send({ fullDayMinimumRatio: 0.85, businessReference: 'EXPLICIT_TEST_APPROVAL_ONLY' });

async function reviewedPeriod() {
  const startDate = vnToday();
  const end = new Date(`${startDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 27);
  const endDate = end.toISOString().slice(0, 10);
  const created = await http.post('/api/hr/timesheet-periods').set('Cookie', hr)
    .send({ period: startDate.slice(0, 7), startDate, endDate });
  expect(created.status).toBe(201);
  const id = created.body.data._id;
  await resolveAndAcknowledgePeriod(http, fixture, id, startDate, endDate);
  const employee = await cookieFor(fixture.employeeId, fixture.organizationId);
  const review = await http.get(`/api/hr/timesheet-periods/${id}/my-review`).set('Cookie', employee);
  expect(review.status).toBe(200);
  expect(review.body.data.state).toBe('ACKNOWLEDGED');
  return { id, employee, review: review.body.data };
}

it('HR explicit 85% update invalidates current acknowledgement exactly once and preserves its audit', async () => {
  const current = await reviewedPeriod();
  const beforePolicy = await policy();
  const beforeActions = await connection().model('EmployeeTimesheetAcknowledgement').find({ periodId: current.id }).lean();
  const changed = await update(String(beforePolicy._id));
  expect(changed.status).toBe(200);
  const stored = await policy();
  expect(stored.fullDayMinimumRatio).toBe(0.85);
  expect(stored.version).toBe(beforePolicy.version + 1);
  const period: any = await connection().model('TimesheetPeriod').findById(current.id).lean();
  expect(period.version).toBe(current.review.periodVersion + 1);
  const reread = await http.get(`/api/hr/timesheet-periods/${current.id}/my-review`).set('Cookie', current.employee);
  expect(reread.status).toBe(200);
  expect(reread.body.data.state).not.toBe('ACKNOWLEDGED');
  expect(reread.body.data.projectionHash).not.toBe(current.review.projectionHash);
  expect(await connection().model('EmployeeTimesheetAcknowledgement').find({ periodId: current.id }).lean()).toEqual(beforeActions);
  const stale = await http.post(`/api/hr/timesheet-periods/${current.id}/my-review/acknowledge`).set('Cookie', current.employee)
    .send({ expectedPeriodVersion: current.review.periodVersion, projectionHash: current.review.projectionHash });
  expect(stale.status).toBe(409);
});

it('real close freezes summary/payroll history across a subsequent live policy update', async () => {
  const current = await reviewedPeriod();
  const manager = await cookieFor(fixture.managerId, fixture.organizationId);
  const confirmed = await http.post(`/api/hr/timesheet-periods/${current.id}/department-confirmations`)
    .set('Cookie', manager).send({ departmentId: fixture.departmentId, expectedPeriodVersion: current.review.periodVersion });
  expect(confirmed.status).toBe(201);
  const closed = await http.post(`/api/hr/timesheet-periods/${current.id}/close`).set('Cookie', hr);
  expect(closed.status).toBe(201);
  const filter = { periodId: new Types.ObjectId(current.id) };
  const summaries = connection().model('TimesheetSummary');
  const snapshots = connection().model('PayrollInputSnapshot');
  const beforeSummaries = await summaries.find(filter).lean();
  const beforeSnapshots = await snapshots.find(filter).lean();
  expect(beforeSummaries).toHaveLength(1);
  expect(beforeSnapshots).toHaveLength(1);
  const beforePeriod: any = await connection().model('TimesheetPeriod').findById(current.id).lean();
  expect((await update(String((await policy())._id))).status).toBe(200);
  expect((await policy()).fullDayMinimumRatio).toBe(0.85);
  expect(await summaries.find(filter).lean()).toEqual(beforeSummaries);
  expect(await snapshots.find(filter).lean()).toEqual(beforeSnapshots);
  const afterPeriod: any = await connection().model('TimesheetPeriod').findById(current.id).lean();
  expect(afterPeriod.status).toBe('CLOSED');
  expect(afterPeriod.version).toBe(beforePeriod.version);
});

it('enforces HR-only mutation and tenant scope through real guards without writes', async () => {
  const own = await policy();
  for (const user of [fixture.employeeId, fixture.managerId]) {
    expect((await update(String(own._id), await cookieFor(user, fixture.organizationId))).status).toBe(403);
  }
  const other = await seedTenant();
  const foreignHR = await cookieFor(other.hrId, other.organizationId);
  expect((await update(String(own._id), foreignHR)).status).toBe(404);
  const list = await http.get('/api/hr/policies/work-credit').set('Cookie', foreignHR);
  expect(list.status).toBe(200);
  expect(list.body.data.every((row: any) => row.organizationId === other.organizationId)).toBe(true);
  expect(await policy()).toEqual(own);
});
