/**
 * TASK-074 — Blocker calculation + drill-down integration tests.
 *
 * Coverage:
 * - review-stats reports real blockers (was hard-coded [])
 * - GET :id/blockers returns drill-down rows with employee/date/type
 * - GET :id/days/:dayId is HR-visible and scoped for managers
 * - close refuses while blockers remain (FR-HR-04)
 */

import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, seedTenant, cookieFor, collection, vnToday } from './fixtures';

type Http = ReturnType<TestApp['http']>;

let testApp: TestApp;
let http: Http;
let fixture: Fixture;
let hrCookie: string;
let managerCookie: string;

const API_PREFIX = '/api/hr/timesheet-periods';

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
});

/**
 * Create a 31-day period starting today, so today falls inside it.
 * (Starting on the 1st trips `validateNotInPast`, which compares a UTC-parsed
 * date-only string against local midnight.)
 */
async function createCurrentPeriod(): Promise<string> {
  const today = vnToday();
  const [year, month, day] = today.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1, day + 30));
  const res = await http
    .post(API_PREFIX)
    .set('Cookie', hrCookie)
    .send({
      period: today.slice(0, 7),
      startDate: today,
      endDate: end.toISOString().slice(0, 10),
    });
  expect(res.status).toBe(201);
  return res.body.data._id;
}

/** A WORKING_DAY attendance row inside the period with no punches → MISSING_CHECK_IN. */
async function seedBlockedDay(periodId: string, overrides: Record<string, unknown> = {}) {
  return collection('AttendanceDay').create({
    organizationId: fixture.organizationId,
    employeeId: fixture.employeeId,
    periodId,
    workDate: vnToday(),
    workdayType: 'WORKING_DAY',
    attendanceStatus: 'NOT_CHECKED_IN',
    overallApprovalStatus: 'NOT_REQUIRED',
    employeeSnapshot: {
      employeeCode: 'NV-IT-1',
      fullName: 'Nguyễn Văn An',
      departmentId: fixture.departmentId,
      departmentName: 'Kỹ thuật',
    },
    ...overrides,
  });
}

describe('TASK-074 — review-stats blockers', () => {
  it('reports MISSING_CHECK_IN for a working day with no punches', async () => {
    const periodId = await createCurrentPeriod();
    await seedBlockedDay(periodId);

    const res = await http.get(`${API_PREFIX}/${periodId}/review-stats`).set('Cookie', hrCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.blockers).toEqual([
      { type: 'MISSING_CHECK_IN', message: 'Thiếu check-in', count: 1 },
    ]);
    expect(res.body.data.pendingApprovals).toBe(0);
  });

  it('counts pending approvals separately from punch blockers', async () => {
    const periodId = await createCurrentPeriod();
    await seedBlockedDay(periodId, {
      checkInAt: new Date(),
      checkOutAt: new Date(),
      attendanceStatus: 'COMPLETED',
      overallApprovalStatus: 'PENDING',
    });

    const res = await http.get(`${API_PREFIX}/${periodId}/review-stats`).set('Cookie', hrCookie);

    expect(res.body.data.pendingApprovals).toBe(1);
    expect(res.body.data.blockers).toEqual([
      { type: 'PENDING_APPROVAL', message: 'Approval còn PENDING', count: 1 },
    ]);
  });

  it('reports no blockers for a clean period', async () => {
    const periodId = await createCurrentPeriod();

    const res = await http.get(`${API_PREFIX}/${periodId}/review-stats`).set('Cookie', hrCookie);

    expect(res.body.data.blockers).toEqual([]);
    expect(res.body.data.pendingApprovals).toBe(0);
  });
});

describe('TASK-074 — blocker drill-down', () => {
  it('returns drill-down rows with employee, date and type', async () => {
    const periodId = await createCurrentPeriod();
    const day = await seedBlockedDay(periodId);

    const res = await http.get(`${API_PREFIX}/${periodId}/blockers`).set('Cookie', hrCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    const [row] = res.body.data.items;
    expect(row.type).toBe('MISSING_CHECK_IN');
    expect(row.attendanceDayId).toBe(String(day._id));
    expect(row.date).toBe(vnToday());
    expect(row.employee).toMatchObject({ code: 'NV-IT-1', name: 'Nguyễn Văn An' });
  });

  it('filters by blocker type', async () => {
    const periodId = await createCurrentPeriod();
    await seedBlockedDay(periodId);
    await seedBlockedDay(periodId, {
      employeeId: (await collection('User').create({
        organizationId: fixture.organizationId,
        email: `other.${Date.now()}@example.test`,
        emailN: `other.${Date.now()}@example.test`,
        passwordHash: 'x',
        fullName: 'Trần Thị B',
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        mustChangePassword: false,
      }))._id,
      employeeSnapshot: { employeeCode: 'NV-IT-2', fullName: 'Trần Thị B', departmentId: fixture.departmentId },
      overallApprovalStatus: 'REJECTED',
    });

    const res = await http
      .get(`${API_PREFIX}/${periodId}/blockers?type=REJECTED`)
      .set('Cookie', hrCookie);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].type).toBe('REJECTED');
  });

  it('resolves the department name when the day snapshot only carries a departmentId', async () => {
    const periodId = await createCurrentPeriod();
    await seedBlockedDay(periodId, {
      employeeSnapshot: { employeeCode: 'NV-IT-3', fullName: 'Lê Văn C', departmentId: fixture.departmentId },
    });

    const res = await http.get(`${API_PREFIX}/${periodId}/blockers`).set('Cookie', hrCookie);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].employee.departmentId).toBe(String(fixture.departmentId));
    expect(res.body.data.items[0].employee.department).toBeTruthy();
  });

  it('opens the day detail for HR', async () => {
    const periodId = await createCurrentPeriod();
    const day = await seedBlockedDay(periodId);

    const res = await http
      .get(`${API_PREFIX}/${periodId}/days/${day._id}`)
      .set('Cookie', hrCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.day.workDate).toBe(vnToday());
    expect(res.body.data.events).toEqual([]);
    expect(res.body.data.request).toBeNull();
  });

  it('hides a day belonging to another period (404)', async () => {
    const periodId = await createCurrentPeriod();
    const day = await seedBlockedDay(periodId);

    const res = await http
      .get(`${API_PREFIX}/64f1a2b3c4d5e6f7a8b9c0ff/days/${day._id}`)
      .set('Cookie', hrCookie);

    expect(res.status).toBe(404);
  });

  it('scopes a manager to their own departments', async () => {
    const periodId = await createCurrentPeriod();
    const day = await seedBlockedDay(periodId);

    // The manager manages the fixture department, so the day is visible.
    const inScope = await http
      .get(`${API_PREFIX}/${periodId}/days/${day._id}`)
      .set('Cookie', managerCookie);
    expect(inScope.status).toBe(200);

    // An employee outside any managed department is hidden from the manager.
    const outsider = await collection('User').create({
      organizationId: fixture.organizationId,
      email: `out.${Date.now()}@example.test`,
      emailN: `out.${Date.now()}@example.test`,
      passwordHash: 'x',
      fullName: 'Lê Văn C',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      mustChangePassword: false,
    });
    const outsiderDay = await seedBlockedDay(periodId, { employeeId: outsider._id });

    const outOfScope = await http
      .get(`${API_PREFIX}/${periodId}/days/${outsiderDay._id}`)
      .set('Cookie', managerCookie);
    expect(outOfScope.status).toBe(404);
  });
});

describe('TASK-074 — close re-verifies blockers', () => {
  it('refuses to close while a blocker remains, then succeeds once cleared', async () => {
    const periodId = await createCurrentPeriod();
    const day = await seedBlockedDay(periodId);

    // Drive the period to READY_TO_CLOSE.
    await http.patch(`${API_PREFIX}/${periodId}/status`).set('Cookie', hrCookie).send({ status: 'REVIEWING' });
    const ready = await http.patch(`${API_PREFIX}/${periodId}/status`).set('Cookie', hrCookie).send({ status: 'READY_TO_CLOSE' });
    expect(ready.status).toBe(200);

    const blocked = await http.post(`${API_PREFIX}/${periodId}/close`).set('Cookie', hrCookie);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('BLOCKERS_REMAIN');

    await collection('AttendanceDay').deleteOne({ _id: day._id });

    await collection('DepartmentTimesheetConfirmation').create({
      organizationId: fixture.organizationId,
      periodId,
      departmentId: fixture.departmentId,
      managerId: fixture.managerId,
      periodVersion: 1,
      confirmedAt: new Date(),
      summarySnapshot: { employeeCount: 1, blockerCount: 0 },
    });

    const closed = await http.post(`${API_PREFIX}/${periodId}/close`).set('Cookie', hrCookie);
    expect(closed.status).toBe(201);
    expect(closed.body.data.period.status).toBe('CLOSED');
  });
});
