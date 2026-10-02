/** TASK-075/076 — department confirmation and version invalidation. */
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
  const response = await http.post(API_PREFIX).set('Cookie', hrCookie).send({
    period: today.slice(0, 7),
    startDate: today,
    endDate: end.toISOString().slice(0, 10),
  });
  expect(response.status).toBe(201);
  return response.body.data._id;
}

async function confirm(periodId: string, expectedPeriodVersion = 1) {
  return http
    .post(`${API_PREFIX}/${periodId}/department-confirmations`)
    .set('Cookie', managerCookie)
    .send({ departmentId: fixture.departmentId, expectedPeriodVersion });
}

describe('TASK-075 — department confirmation', () => {
  it('stores an immutable current-version confirmation and makes the period ready', async () => {
    const periodId = await createCurrentPeriod();

    const response = await confirm(periodId);

    expect(response.status).toBe(201);
    expect(response.body.data.confirmation).toMatchObject({
      periodId,
      departmentId: fixture.departmentId,
      managerId: fixture.managerId,
      periodVersion: 1,
      summarySnapshot: { employeeCount: 1, blockerCount: 0 },
    });
    expect(response.body.data.period.status).toBe('READY_TO_CLOSE');

    const stored = await collection('DepartmentTimesheetConfirmation').find({ periodId }).lean();
    expect(stored).toHaveLength(1);
  });

  it('is idempotent for the same department and version', async () => {
    const periodId = await createCurrentPeriod();
    const first = await confirm(periodId);
    expect(first.status).toBe(201);

    const retry = await confirm(periodId);
    expect(retry.status).toBe(201);
    expect(retry.body.data.confirmation._id).toBe(first.body.data.confirmation._id);
    expect(await collection('DepartmentTimesheetConfirmation').countDocuments({ periodId })).toBe(1);
  });

  it('shows HR which required departments still need a current-version confirmation', async () => {
    const periodId = await createCurrentPeriod();
    const before = await http.get(`${API_PREFIX}/${periodId}`).set('Cookie', hrCookie);
    expect(before.body.data.requiredDepartmentConfirmations).toEqual([
      expect.objectContaining({ departmentId: fixture.departmentId, confirmed: false }),
    ]);

    expect((await confirm(periodId)).status).toBe(201);
    const after = await http.get(`${API_PREFIX}/${periodId}`).set('Cookie', hrCookie);
    expect(after.body.data.requiredDepartmentConfirmations).toEqual([
      expect.objectContaining({ departmentId: fixture.departmentId, confirmed: true }),
    ]);
    expect(after.body.data.status).toBe('READY_TO_CLOSE');
  });

  it('repairs a period stuck in reviewing after all current-version confirmations committed', async () => {
    const periodId = await createCurrentPeriod();
    expect((await confirm(periodId)).status).toBe(201);
    await collection('TimesheetPeriod').updateOne(
      { _id: periodId },
      { $set: { status: 'REVIEWING', managerSnapshotClosed: false } },
    );

    const detail = await http.get(`${API_PREFIX}/${periodId}`).set('Cookie', hrCookie);

    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe('READY_TO_CLOSE');
    expect(detail.body.data.managerSnapshotClosed).toBe(true);
  });

  it('lets HR close a stale reviewing period when every current-version department already confirmed', async () => {
    const periodId = await createCurrentPeriod();
    expect((await confirm(periodId)).status).toBe(201);
    await collection('TimesheetPeriod').updateOne(
      { _id: periodId },
      { $set: { status: 'REVIEWING', managerSnapshotClosed: false } },
    );

    const response = await http.post(`${API_PREFIX}/${periodId}/close`).set('Cookie', hrCookie);

    expect(response.status).toBe(201);
    expect(response.body.data.period.status).toBe('CLOSED');
  });

  it('rejects confirmation while the department has blockers', async () => {
    const periodId = await createCurrentPeriod();
    await collection('AttendanceDay').create({
      organizationId: fixture.organizationId,
      employeeId: fixture.employeeId,
      periodId,
      workDate: vnToday(),
      workdayType: 'WORKING_DAY',
      attendanceStatus: 'NOT_CHECKED_IN',
      overallApprovalStatus: 'NOT_REQUIRED',
      employeeSnapshot: { departmentId: fixture.departmentId },
    });

    const response = await confirm(periodId);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DEPARTMENT_NOT_READY');
    expect(await collection('DepartmentTimesheetConfirmation').countDocuments()).toBe(0);
  });

  it('rejects a stale expected period version', async () => {
    const periodId = await createCurrentPeriod();
    const response = await confirm(periodId, 99);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PERIOD_VERSION_CONFLICT');
  });

  it('rejects a department outside the manager scope', async () => {
    const periodId = await createCurrentPeriod();
    const otherDepartment = await collection('Department').create({
      organizationId: fixture.organizationId,
      code: `OTHER-${Date.now()}`,
      name: 'Phòng ngoài phạm vi',
      active: true,
    });
    const response = await http
      .post(`${API_PREFIX}/${periodId}/department-confirmations`)
      .set('Cookie', managerCookie)
      .send({ departmentId: String(otherDepartment._id), expectedPeriodVersion: 1 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('DEPARTMENT_SCOPE_VIOLATION');
  });

  it('does not let HR close a manually-ready period without current confirmations', async () => {
    const periodId = await createCurrentPeriod();
    await http.patch(`${API_PREFIX}/${periodId}/status`).set('Cookie', hrCookie).send({ status: 'REVIEWING' });
    await http.patch(`${API_PREFIX}/${periodId}/status`).set('Cookie', hrCookie).send({ status: 'READY_TO_CLOSE' });

    const response = await http.post(`${API_PREFIX}/${periodId}/close`).set('Cookie', hrCookie);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PERIOD_NOT_READY');
  });

  it('keeps active employees in payroll artifacts even when they have no attendance rows', async () => {
    const periodId = await createCurrentPeriod();
    expect((await confirm(periodId)).status).toBe(201);

    const response = await http.post(`${API_PREFIX}/${periodId}/close`).set('Cookie', hrCookie);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ summariesCreated: 1, snapshotsCreated: 1 });
    expect(await collection('TimesheetSummary').countDocuments({ periodId })).toBe(1);
    expect(await collection('PayrollInputSnapshot').countDocuments({ periodId })).toBe(1);
  });

  it('keeps the legacy close-snapshot route without generating payroll data', async () => {
    const periodId = await createCurrentPeriod();
    const response = await http
      .post(`${API_PREFIX}/${periodId}/close-snapshot`)
      .set('Cookie', managerCookie)
      .send({ departmentId: fixture.departmentId });

    expect(response.status).toBe(201);
    expect(response.body.data.summariesCreated).toBe(0);
    expect(response.body.data.snapshotsCreated).toBe(0);
    expect(await collection('DepartmentTimesheetConfirmation').countDocuments({ periodId })).toBe(1);
    expect(await collection('PayrollInputSnapshot').countDocuments({ periodId })).toBe(0);
  });
});

describe('TASK-076 — invalidate after change', () => {
  it('keeps confirmation history but excludes it after an in-period mutation', async () => {
    const periodId = await createCurrentPeriod();
    expect((await confirm(periodId)).status).toBe(201);

    const leave = await collection('LeaveRequest').create({
      organizationId: fixture.organizationId,
      employeeId: fixture.employeeId,
      departmentId: fixture.departmentId,
      startDate: vnToday(),
      endDate: vnToday(),
      leaveType: 'PAID_LEAVE',
      reason: 'Nghỉ phép năm đã được duyệt trước đó',
      status: 'APPROVED',
    });
    const applied = await http
      .post(`/api/hr/leave-requests/${leave._id}/apply`)
      .set('Cookie', hrCookie);
    expect(applied.status).toBe(201);

    const detail = await http.get(`${API_PREFIX}/${periodId}`).set('Cookie', hrCookie);
    expect(detail.body.data.version).toBe(2);
    expect(detail.body.data.status).toBe('REVIEWING');
    expect(detail.body.data.departmentConfirmations).toEqual([]);
    expect(await collection('DepartmentTimesheetConfirmation').countDocuments({ periodId })).toBe(1);
  });
});
