/**
 * AUD-H10 / H11 / H12 — read-check-write invariants must hold under concurrency.
 * Each case fires several identical requests at once; exactly one may win.
 */
import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, seedTenant, cookieFor, vnToday, collection } from './fixtures';

let testApp: TestApp;
let fixture: Fixture;

beforeAll(async () => { testApp = await createTestApp(); });
afterAll(async () => { await testApp.app.close(); });
beforeEach(async () => {
  await clearDatabase();
  fixture = await seedTenant();
});

const statuses = (results: Array<{ status: number }>) => results.map((r) => r.status).sort();

describe('AUD-H11 concurrent period creation', () => {
  it('lets only one of several different-key periods become active', async () => {
    const hr = await cookieFor(fixture.hrId, fixture.organizationId);
    const start = new Date(`${vnToday()}T00:00:00.000Z`);
    const body = (offset: number) => {
      const s = new Date(start); s.setUTCDate(s.getUTCDate() + offset);
      const e = new Date(s); e.setUTCDate(e.getUTCDate() + 30);
      const sd = s.toISOString().slice(0, 10);
      return { period: sd.slice(0, 7), startDate: sd, endDate: e.toISOString().slice(0, 10) };
    };
    const http = testApp.http();
    const results = await Promise.all([0, 62, 124, 186].map((o) =>
      http.post('/api/hr/timesheet-periods').set('Cookie', hr).send(body(o))));
    expect(results.filter((r) => r.status === 201 || r.status === 200)).toHaveLength(1);
    const active = await collection('TimesheetPeriod').countDocuments({ status: 'OPEN' });
    expect(active).toBe(1);
  });
});

describe('AUD-H12 concurrent manager assignment', () => {
  it('rejects overlapping duplicates created at the same time', async () => {
    const hr = await cookieFor(fixture.hrId, fixture.organizationId);
    const dept = await collection('Department').create({
      organizationId: fixture.organizationId, name: 'Race Dept', code: 'RACE', active: true,
    });
    const deptId = String(dept._id);
    const body = { managerUserId: fixture.employeeId, departmentId: deptId, effectiveFrom: '2026-01-01' };
    const http = testApp.http();
    const results = await Promise.all([1, 2, 3, 4].map(() =>
      http.post('/api/hr/manager-assignments').set('Cookie', hr).send(body)));
    const ok = results.filter((r) => r.status < 300);
    if (ok.length !== 1) throw new Error(JSON.stringify(results.map((r) => [r.status, r.body])));
    expect(ok).toHaveLength(1);
    const rows = await collection('ManagerAssignment').countDocuments({
      managerUserId: fixture.employeeId, departmentId: deptId,
    });
    expect(rows).toBeLessThanOrEqual(1);
  });
});

describe('AUD-H10 concurrent leave submission', () => {
  it('creates one request and one SUBMIT action for overlapping submissions', async () => {
    const employee = await cookieFor(fixture.employeeId, fixture.organizationId);
    const d = new Date(`${vnToday()}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 21);
    while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
    const day = d.toISOString().slice(0, 10);
    const body = { startDate: day, endDate: day, leaveType: 'PAID_LEAVE', reason: 'Concurrent leave submission test' };
    const http = testApp.http();
    const results = await Promise.all([1, 2, 3, 4].map(() =>
      http.post('/api/leave-requests').set('Cookie', employee).send(body)));
    const ok = results.filter((r) => r.status < 300);
    if (ok.length !== 1) throw new Error(JSON.stringify(results.map((r) => [r.status, r.body])));
    expect(await collection('LeaveRequest').countDocuments({})).toBe(1);
    expect(await collection('LeaveAction').countDocuments({ action: 'SUBMIT' })).toBe(1);
  });
});
