/**
 * TASK-073 — Period version integration tests (BR-VERSION-01 / AC-HR-03).
 *
 * A data mutation inside a period must bump `TimesheetPeriod.version`.
 * Covered here: HR leave-apply and a manager attendance approval decision.
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

async function createCurrentPeriod(): Promise<string> {
  const today = vnToday();
  const [year, month, day] = today.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1, day + 30));
  const res = await http
    .post(API_PREFIX)
    .set('Cookie', hrCookie)
    .send({ period: today.slice(0, 7), startDate: today, endDate: end.toISOString().slice(0, 10) });
  expect(res.status).toBe(201);
  expect(res.body.data.version).toBe(1);
  return res.body.data._id;
}

async function periodVersion(periodId: string): Promise<number> {
  const res = await http.get(`${API_PREFIX}/${periodId}`).set('Cookie', hrCookie);
  return res.body.data.version;
}

describe('TASK-073 — version bumps on mutation', () => {
  it('bumps when HR applies an approved leave request', async () => {
    const periodId = await createCurrentPeriod();
    const today = vnToday();

    const leave = await collection('LeaveRequest').create({
      organizationId: fixture.organizationId,
      employeeId: fixture.employeeId,
      departmentId: fixture.departmentId,
      startDate: today,
      endDate: today,
      leaveType: 'PAID_LEAVE',
      reason: 'Nghỉ phép năm đã duyệt trước đó',
      status: 'APPROVED',
    });

    const res = await http
      .post(`/api/hr/leave-requests/${leave._id}/apply`)
      .set('Cookie', hrCookie);

    expect(res.status).toBe(201);
    await expect(periodVersion(periodId)).resolves.toBe(2);
  });

  it('bumps when a manager decides an attendance approval', async () => {
    const periodId = await createCurrentPeriod();
    const today = vnToday();

    const day = await collection('AttendanceDay').create({
      organizationId: fixture.organizationId,
      employeeId: fixture.employeeId,
      periodId,
      workDate: today,
      workdayType: 'WORKING_DAY',
      attendanceStatus: 'COMPLETED',
      overallApprovalStatus: 'PENDING',
      checkInAt: new Date(),
      checkOutAt: new Date(),
      employeeSnapshot: { employeeCode: 'NV-IT-1', fullName: 'Nguyễn Văn An', departmentId: fixture.departmentId },
    });

    const request = await collection('ManagerRequest').create({
      organizationId: fixture.organizationId,
      employeeId: fixture.profileId,
      employeeUserId: fixture.employeeId,
      departmentId: fixture.departmentId,
      type: 'ATTENDANCE',
      workDate: new Date(today),
      reason: 'Selfie cần quản lý xác nhận',
      status: 'PENDING',
      version: 1,
      attendanceDayId: day._id,
    });

    const res = await http
      .post(`/api/manager/approvals/${request._id}/approve`)
      .set('Cookie', managerCookie)
      .send({ expectedVersion: 1 });

    expect(res.status).toBe(201);
    await expect(periodVersion(periodId)).resolves.toBe(2);
  });

  it('does not bump a CLOSED period', async () => {
    const periodId = await createCurrentPeriod();
    const today = vnToday();

    // No blockers exist, so the period can go straight to CLOSED.
    await http.patch(`${API_PREFIX}/${periodId}/status`).set('Cookie', hrCookie).send({ status: 'REVIEWING' });
    const confirmed = await http
      .post(`${API_PREFIX}/${periodId}/department-confirmations`)
      .set('Cookie', managerCookie)
      .send({ departmentId: fixture.departmentId, expectedPeriodVersion: 1 });
    expect(confirmed.status).toBe(201);
    const closed = await http.post(`${API_PREFIX}/${periodId}/close`).set('Cookie', hrCookie);
    expect(closed.status).toBe(201);
    const closedVersion = await periodVersion(periodId);

    // A leave applied against a date inside a closed period must not bump it —
    // the period has to be reopened first (FR-HR-05).
    const leave = await collection('LeaveRequest').create({
      organizationId: fixture.organizationId,
      employeeId: fixture.employeeId,
      departmentId: fixture.departmentId,
      startDate: today,
      endDate: today,
      leaveType: 'PAID_LEAVE',
      reason: 'Nghỉ phép áp sau khi kỳ đã chốt',
      status: 'APPROVED',
    });
    await http.post(`/api/hr/leave-requests/${leave._id}/apply`).set('Cookie', hrCookie);

    await expect(periodVersion(periodId)).resolves.toBe(closedVersion);
  });
});
