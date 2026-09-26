import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, collection, cookieFor, recentWorkDate, seedAttendanceDay, seedTenant, setLaborPolicy, vn } from './fixtures';

/**
 * D39 — the two filing rules the SRS left implicit, driven over real HTTP:
 * a report may not reach into the shift the employee is assigned, and a report
 * filed too long after the work date is refused outright rather than excused by
 * a reason. What only this lane proves: the guard fires *before* the row is
 * written, so a refused filing leaves nothing in `manager_requests`, and an
 * approval that would create an encroaching window leaves the request PENDING
 * at its original version.
 *
 * The seeded tenant runs an 08:00–17:00 weekday shift, so 18:00–20:00 is clean
 * and any window touching 08:00–17:00 is not.
 */

type Http = ReturnType<TestApp['http']>;

let testApp: TestApp;
let http: Http;
let fixture: Fixture;
let employeeCookie: string;
let managerCookie: string;

let WORK_DATE: string;
const iso = (hhmm: string, day = WORK_DATE) => `${day}T${hhmm}:00+07:00`;

/** WORK_DATE minus `days`, as the 'YYYY-MM-DD' the filing path expects. */
function daysBefore(workDate: string, days: number): string {
  const [y, m, d] = workDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
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
  fixture = await seedTenant();
  employeeCookie = await cookieFor(fixture.employeeId, fixture.organizationId);
  managerCookie = await cookieFor(fixture.managerId, fixture.organizationId);
});

const requests = () => collection('ManagerRequest');

async function file(body: Record<string, unknown>) {
  return http.post('/api/overtime').set('Cookie', employeeCookie).send(body);
}

describe('OT filing rules (D39)', () => {
  it('accepts a window entirely outside the assigned shift', async () => {
    const filed = await file({
      workDate: WORK_DATE,
      requestedStart: iso('17:00'),   // touching the shift end is allowed (half-open)
      requestedEnd: iso('19:00'),
      reason: 'Ở lại nghiệm thu phát hành bản vá tới 19:00',
    });
    expect(filed.status).toBe(201);
    expect(filed.body.data.status).toBe('PENDING');
  });

  it('refuses a window that reaches into the shift, before storing anything', async () => {
    const filed = await file({
      workDate: WORK_DATE,
      requestedStart: iso('16:00'),   // 16:00–18:00 straddles the 17:00 shift end
      requestedEnd: iso('18:00'),
      reason: 'Ở lại hỗ trợ go-live từ đầu giờ chiều tới tối',
    });
    expect(filed.status).toBe(409);
    expect(filed.body.error.code).toBe('OVERTIME_OVERLAPS_SCHEDULE');
    // The whole point: a refused filing leaves no request behind.
    expect(await requests().countDocuments({ organizationId: fixture.organizationId })).toBe(0);
  });

  it('refuses a window sitting entirely inside the shift', async () => {
    const filed = await file({
      workDate: WORK_DATE,
      requestedStart: iso('09:00'),
      requestedEnd: iso('11:00'),
      reason: 'Đăng ký giờ trong ca hành chính để hợp thức công',
    });
    expect(filed.status).toBe(409);
    expect(filed.body.error.code).toBe('OVERTIME_OVERLAPS_SCHEDULE');
  });

  it('lifts the schedule guard on a day with no assigned shift', async () => {
    // The seeded shift covers Mon–Fri only, so a Sunday resolves to no shift at
    // all: a window filling the middle of that day is exactly what weekend OT
    // means, and must not be refused for "encroaching" a shift that isn't there.
    const [y, m, d] = WORK_DATE.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    const sunday = new Date(base.getTime() + ((7 - base.getUTCDay()) % 7 || 7) * 86_400_000)
      .toISOString().slice(0, 10);
    const filed = await file({
      workDate: sunday,
      requestedStart: `${sunday}T09:00:00+07:00`,
      requestedEnd: `${sunday}T13:00:00+07:00`,
      reason: 'Làm cả ngày chủ nhật cho đợt kiểm kê cuối tuần',
    });
    expect(filed.status).toBe(201);
    expect(filed.body.data.overtimeType).toBeUndefined();
  });

  it('refuses a report filed past the retroactive ceiling, even with a reason', async () => {
    const longAgo = daysBefore(WORK_DATE, 30);
    const filed = await file({
      workDate: longAgo,
      requestedStart: `${longAgo}T18:00:00+07:00`,
      requestedEnd: `${longAgo}T20:00:00+07:00`,
      reason: 'Báo bổ sung ca tăng ca cách đây một tháng đầy đủ lý do',
      retroactiveReason: 'Quên không báo khi đi công tác dài ngày về',
    });
    expect(filed.status).toBe(409);
    expect(filed.body.error.code).toBe('OVERTIME_FILING_WINDOW_CLOSED');
    expect(await requests().countDocuments({ organizationId: fixture.organizationId })).toBe(0);
  });

  it('takes the ceiling from the labor policy', async () => {
    // A tenant that allows a year of lateness is not refused where the default would be.
    await setLaborPolicy(fixture.organizationId, { maxRetroactiveFilingDays: 400 });
    const longAgo = daysBefore(WORK_DATE, 30);
    const filed = await file({
      workDate: longAgo,
      requestedStart: `${longAgo}T18:00:00+07:00`,
      requestedEnd: `${longAgo}T20:00:00+07:00`,
      reason: 'Báo bổ sung ca tăng ca với trần chính sách nới rộng',
      retroactiveReason: 'Đi công tác dài ngày, vừa về nên báo trễ',
    });
    expect(filed.status).toBe(201);
    expect(filed.body.data.isRetroactive).toBe(true);
  });

  it('refuses an approval that would widen the window into the shift', async () => {
    // Filing is clean (18:00–20:00), but the manager tries to approve 16:00–20:00.
    await seedAttendanceDay(fixture, WORK_DATE, vn(WORK_DATE, '08:00'), vn(WORK_DATE, '20:00'), 660);
    const filed = await file({
      workDate: WORK_DATE,
      requestedStart: iso('18:00'),
      requestedEnd: iso('20:00'),
      reason: 'Ở lại trực hệ thống tới 20:00',
    });
    expect(filed.status).toBe(201);
    const id = String(filed.body.data._id);
    const before = await requests().findById(id).lean() as any;

    const approved = await http.post(`/api/manager/overtime/${id}/approve`)
      .set('Cookie', managerCookie)
      .send({ expectedVersion: 1, approvedStart: iso('16:00'), approvedEnd: iso('20:00') });
    expect(approved.status).toBe(409);
    expect(approved.body.error.code).toBe('OVERTIME_OVERLAPS_SCHEDULE');

    const after = await requests().findById(id).lean() as any;
    expect(after).toMatchObject({ status: 'PENDING', version: before.version });
    expect(await collection('OvertimeResult').countDocuments({ organizationId: fixture.organizationId })).toBe(0);
  });
});

describe('assigned-shift lookup (GET /api/overtime/schedule)', () => {
  it('returns the shift the guard will enforce for that date', async () => {
    const res = await http.get(`/api/overtime/schedule?date=${WORK_DATE}`).set('Cookie', employeeCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.scheduled).toMatchObject({ startTime: '08:00', endTime: '17:00', breakMinutes: 60 });
    expect(new Date(res.body.data.scheduled.to).getTime()).toBe(vn(WORK_DATE, '17:00').getTime());
    expect(res.body.data.overtimeType).toBe('OT_WORKING_DAY');
  });

  it('says there is no shift on an unscheduled day', async () => {
    const [y, m, d] = WORK_DATE.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    const sunday = new Date(base.getTime() + ((7 - base.getUTCDay()) % 7 || 7) * 86_400_000).toISOString().slice(0, 10);
    const res = await http.get(`/api/overtime/schedule?date=${sunday}`).set('Cookie', employeeCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.scheduled).toBeNull();
    expect(res.body.data.overtimeType).toBe('OT_WEEKLY_OFF');
  });
});
