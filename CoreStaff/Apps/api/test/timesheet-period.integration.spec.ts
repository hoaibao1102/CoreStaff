/**
 * TASK-072 — TimesheetPeriod State Machine Integration Tests
 * 
 * Test coverage:
 * - Create period with validation (28-31 days, not in past, no overlap)
 * - State machine transitions (OPEN → REVIEWING → READY_TO_CLOSE → CLOSED)
 * - Reopen closed period (version increment + reason required)
 * - Active period lock (only 1 OPEN/REVIEWING/READY_TO_CLOSE per org)
 * - Tenant isolation (IDOR protection)
 */

import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, seedTenant, cookieFor } from './fixtures';

type Http = ReturnType<TestApp['http']>;

let testApp: TestApp;
let http: Http;
let fixture: Fixture;
let hrCookie: string;

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
  hrCookie = await import('./fixtures').then(m => m.cookieFor(fixture.hrId, fixture.organizationId));
});

/* ───────── HELPERS ───────── */

const API_PREFIX = '/api/hr/timesheet-periods';

const createPeriodBody = (period: string, startDate: string, endDate: string) => ({
  period,
  startDate,
  endDate,
});

const validPeriod = () => createPeriodBody('2026-10', '2026-10-01', '2026-10-31');
const validPeriodPast = () => createPeriodBody('2020-01', '2020-01-01', '2020-01-31');

/* ───────── CREATE PERIOD VALIDATIONS ───────── */

describe('TASK-072 — Create Period Validations', () => {
  it('should create a period successfully', async () => {
    const res = await http.post(API_PREFIX)
      .set('Cookie', hrCookie)
      .send(validPeriod());

    expect(res.status).toBe(201);
    expect(res.body.data.period).toBe('2026-10');
    expect(res.body.data.status).toBe('OPEN');
    expect(res.body.data.version).toBe(1);
  });

  it('should reject period with less than 28 days', async () => {
    const res = await http.post('/api/hr/timesheet-periods')
      .set('Cookie', hrCookie)
      .send(createPeriodBody('2026-10', '2026-10-01', '2026-10-20'));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DAY_RANGE');
  });

  it('should reject period with more than 31 days', async () => {
    const res = await http.post('/api/hr/timesheet-periods')
      .set('Cookie', hrCookie)
      .send(createPeriodBody('2026-10', '2026-10-01', '2026-11-15'));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DAY_RANGE');
  });

  it('should reject period in the past', async () => {
    const res = await http.post(API_PREFIX)
      .set('Cookie', hrCookie)
      .send(validPeriodPast());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PERIOD_IN_PAST');
  });

  it('should reject duplicate period for same organization', async () => {
    await http.post(API_PREFIX)
      .set('Cookie', hrCookie)
      .send(validPeriod());

    const res = await http.post(API_PREFIX)
      .set('Cookie', hrCookie)
      .send(validPeriod());

    // Duplicate of an currently-active period is rejected as PERIOD_ALREADY_ACTIVE.
    // The unique index would only surface if the first period were CLOSED/soft-deleted.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PERIOD_ALREADY_ACTIVE');
  });

  it('should block creation when active period exists', async () => {
    await http.post(API_PREFIX)
      .set('Cookie', hrCookie)
      .send(validPeriod());

    const res = await http.post(API_PREFIX)
      .set('Cookie', hrCookie)
      .send(createPeriodBody('2026-11', '2026-11-01', '2026-11-30'));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PERIOD_ALREADY_ACTIVE');
  });

  it('should allow creating new period after closing previous one', async () => {
    // Create and close first period
    const createRes = await http.post(API_PREFIX)
      .set('Cookie', hrCookie)
      .send(validPeriod());
    const periodId = createRes.body.data._id;

    // Transition to CLOSED
    await http.patch(`${API_PREFIX}/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'REVIEWING' });
    await http.patch(`${API_PREFIX}/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'READY_TO_CLOSE' });
    await http.patch(`${API_PREFIX}/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'CLOSED' });

    // Now should be able to create next month
    const res = await http.post(API_PREFIX)
      .set('Cookie', hrCookie)
      .send(createPeriodBody('2026-11', '2026-11-01', '2026-11-30'));

    expect(res.status).toBe(201);
  });
});

/* ───────── STATE MACHINE TRANSITIONS ───────── */

describe('TASK-072 — State Machine Transitions', () => {
  let periodId: string;

  beforeEach(async () => {
    const res = await http.post('/api/hr/timesheet-periods')
      .set('Cookie', hrCookie)
      .send(validPeriod());
    periodId = res.body.data._id;
  });

  it('should transition OPEN → REVIEWING', async () => {
    const res = await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'REVIEWING' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REVIEWING');
  });

  it('should transition REVIEWING → READY_TO_CLOSE', async () => {
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'REVIEWING' });

    const res = await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'READY_TO_CLOSE' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('READY_TO_CLOSE');
  });

  it('should transition READY_TO_CLOSE → CLOSED', async () => {
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'REVIEWING' });
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'READY_TO_CLOSE' });

    const res = await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'CLOSED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLOSED');
    expect(res.body.data.closedBy).toBeDefined();
    expect(res.body.data.closedAt).toBeDefined();
  });

  it('should reject invalid transition CLOSED → OPEN', async () => {
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'REVIEWING' });
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'READY_TO_CLOSE' });
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'CLOSED' });

    const res = await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'OPEN' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('should allow CLOSED → REVIEWING (reopen via status update)', async () => {
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'REVIEWING' });
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'READY_TO_CLOSE' });
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'CLOSED' });

    const res = await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'REVIEWING' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REVIEWING');
  });
});

/* ───────── REOPEN WITH VERSION INCREMENT ───────── */

describe('TASK-072 — Reopen Closed Period', () => {
  let periodId: string;

  beforeEach(async () => {
    const res = await http.post('/api/hr/timesheet-periods')
      .set('Cookie', hrCookie)
      .send(validPeriod());
    periodId = res.body.data._id;

    // Close it
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'REVIEWING' });
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'READY_TO_CLOSE' });
    await http.patch(`/api/hr/timesheet-periods/${periodId}/status`)
      .set('Cookie', hrCookie)
      .send({ status: 'CLOSED' });
  });

  it('should reopen with version increment', async () => {
    const res = await http.patch(`/api/hr/timesheet-periods/${periodId}/reopen`)
      .set('Cookie', hrCookie)
      .send({ reason: 'Nhân viên ABC điều chỉnh công ngày 15/10 cần xem xét lại' });

    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.status).toBe('REVIEWING');
    expect(res.body.data.reopenReason).toBe('Nhân viên ABC điều chỉnh công ngày 15/10 cần xem xét lại');
  });

  it('should reject reopen with reason < 10 characters', async () => {
    const res = await http.patch(`/api/hr/timesheet-periods/${periodId}/reopen`)
      .set('Cookie', hrCookie)
      .send({ reason: 'Sai' }); // Only 3 chars

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REASON_TOO_SHORT');
  });

  it('should only allow reopening CLOSED periods', async () => {
    // Create a fresh OPEN period; the suite's beforeEach closed the other one
    const openRes = await http.post(API_PREFIX)
      .set('Cookie', hrCookie)
      .send(createPeriodBody('2026-11', '2026-11-01', '2026-11-30'));

    const res = await http.patch(`${API_PREFIX}/${openRes.body.data._id}/reopen`)
      .set('Cookie', hrCookie)
      .send({ reason: 'Test reopen on non-closed period' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_REOPEN_NON_CLOSED');
  });
});

/* ───────── TENANT ISOLATION ───────── */

describe('TASK-072 — Tenant Isolation', () => {
  it('should return 404 when accessing another tenant\'s period', async () => {
    const otherFixture = await seedTenant();
    const otherHrCookie = await import('./fixtures').then(m => m.cookieFor(otherFixture.hrId, otherFixture.organizationId));

    // Create period in own tenant
    const myRes = await http.post('/api/hr/timesheet-periods')
      .set('Cookie', hrCookie)
      .send(validPeriod());
    const myPeriodId = myRes.body.data._id;

    // Try to access with different tenant's cookie
    const res = await http.get(`/api/hr/timesheet-periods/${myPeriodId}`)
      .set('Cookie', otherHrCookie);

    expect(res.status).toBe(404);
  });
});
