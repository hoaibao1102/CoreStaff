/**
 * AUD-H09 (period slice) + period read access.
 *
 * - closing and reopening a period commit an AuditLog row in the same
 *   transaction (so the HR audit screen is not empty after a close);
 * - employees cannot read the period list/detail, which carry department-wide
 *   aggregates and manager ids (they use `/:id/my-review` instead).
 */

import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { clearDatabase, connection, createTestApp, TestApp } from './app-factory';
import { Fixture, cookieFor, resolveAndAcknowledgePeriod, seedTenant, vnToday } from './fixtures';

let testApp: TestApp;
let http: ReturnType<TestApp['http']>;
let fixture: Fixture;
let hrCookie: string;
let managerCookie: string;
let employeeCookie: string;

beforeAll(async () => {
  testApp = await createTestApp();
  http = testApp.http();
});

afterAll(async () => {
  await testApp.app.close();
});

beforeEach(async () => {
  await clearDatabase();
  fixture = await seedTenant();
  hrCookie = await cookieFor(fixture.hrId, fixture.organizationId);
  managerCookie = await cookieFor(fixture.managerId, fixture.organizationId);
  employeeCookie = await cookieFor(fixture.employeeId, fixture.organizationId);
});

async function createReadyPeriod(): Promise<string> {
  const today = vnToday();
  const [year, month, day] = today.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1, day + 30));
  const created = await http.post('/api/hr/timesheet-periods').set('Cookie', hrCookie).send({
    period: today.slice(0, 7), startDate: today, endDate: end.toISOString().slice(0, 10),
  });
  expect(created.status).toBe(201);
  const periodId: string = created.body.data._id;
  const period = (await connection().model('TimesheetPeriod').findById(periodId).lean()) as any;
  await resolveAndAcknowledgePeriod(
    http, fixture, periodId,
    period.startDate.toISOString().slice(0, 10), period.endDate.toISOString().slice(0, 10),
  );
  const confirmed = await http
    .post(`/api/hr/timesheet-periods/${periodId}/department-confirmations`)
    .set('Cookie', managerCookie)
    .send({ departmentId: fixture.departmentId, expectedPeriodVersion: 1 });
  expect(confirmed.status).toBe(201);
  return periodId;
}

const auditRows = (action: string) =>
  connection().model('AuditLog').find({ action }).lean() as Promise<any[]>;

describe('period audit trail', () => {
  it('records CLOSE_PERIOD with the actor when HR closes a period', async () => {
    const periodId = await createReadyPeriod();
    expect(await auditRows('CLOSE_PERIOD')).toHaveLength(0);

    const res = await http.post(`/api/hr/timesheet-periods/${periodId}/close`).set('Cookie', hrCookie);
    expect(res.status).toBe(201);

    const rows = await auditRows('CLOSE_PERIOD');
    expect(rows).toHaveLength(1);
    expect(String(rows[0].actorId)).toBe(fixture.hrId);
    expect(rows[0].actorRoleSnapshot).toBe('HR');
    expect(rows[0].targetType).toBe('TIMESHEET_PERIOD');
    expect(rows[0].targetId).toBe(periodId);
    expect(String(rows[0].organizationId)).toBe(fixture.organizationId);
  });

  it('records REOPEN_PERIOD with the reason, and nothing when the reopen is rejected', async () => {
    const periodId = await createReadyPeriod();
    await http.post(`/api/hr/timesheet-periods/${periodId}/close`).set('Cookie', hrCookie).expect(201);

    const tooShort = await http.patch(`/api/hr/timesheet-periods/${periodId}/reopen`).set('Cookie', hrCookie).send({ reason: 'x' });
    expect(tooShort.status).toBe(400);
    expect(await auditRows('REOPEN_PERIOD')).toHaveLength(0);

    const reason = 'Điều chỉnh công ngày 15 cần xem xét lại';
    const res = await http.patch(`/api/hr/timesheet-periods/${periodId}/reopen`).set('Cookie', hrCookie).send({ reason });
    expect(res.status).toBe(200);
    const rows = await auditRows('REOPEN_PERIOD');
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe(reason);
  });

  it('does not record CLOSE_PERIOD when the close fails', async () => {
    const today = vnToday();
    const [year, month, day] = today.split('-').map(Number);
    const end = new Date(Date.UTC(year, month - 1, day + 30));
    const created = await http.post('/api/hr/timesheet-periods').set('Cookie', hrCookie).send({
      period: today.slice(0, 7), startDate: today, endDate: end.toISOString().slice(0, 10),
    });
    const res = await http.post(`/api/hr/timesheet-periods/${created.body.data._id}/close`).set('Cookie', hrCookie);
    expect(res.status).toBe(400);
    expect(await auditRows('CLOSE_PERIOD')).toHaveLength(0);
  });

  it('exposes the entries through the HR audit endpoint, scoped to the tenant', async () => {
    const periodId = await createReadyPeriod();
    await http.post(`/api/hr/timesheet-periods/${periodId}/close`).set('Cookie', hrCookie).expect(201);

    const list = await http.get('/api/hr/audit-logs?action=CLOSE_PERIOD').set('Cookie', hrCookie);
    expect(list.status).toBe(200);
    const total = list.body.total ?? list.body.data?.total ?? list.body.data?.length;
    expect(total).toBe(1);
  });
});

describe('period read access', () => {
  it('forbids an employee from listing or reading periods', async () => {
    const periodId = await createReadyPeriod();
    expect((await http.get('/api/hr/timesheet-periods').set('Cookie', employeeCookie)).status).toBe(403);
    expect((await http.get(`/api/hr/timesheet-periods/${periodId}`).set('Cookie', employeeCookie)).status).toBe(403);
  });

  it('still lets HR and the department manager read them', async () => {
    const periodId = await createReadyPeriod();
    for (const cookie of [hrCookie, managerCookie]) {
      expect((await http.get('/api/hr/timesheet-periods').set('Cookie', cookie)).status).toBe(200);
      expect((await http.get(`/api/hr/timesheet-periods/${periodId}`).set('Cookie', cookie)).status).toBe(200);
    }
  });

  it('keeps the employee self-review endpoint available', async () => {
    const periodId = await createReadyPeriod();
    const res = await http.get(`/api/hr/timesheet-periods/${periodId}/my-review`).set('Cookie', employeeCookie);
    expect(res.status).not.toBe(403);
  });
});
