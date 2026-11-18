/**
 * SRS §9 — a check-in is classified PUBLIC_HOLIDAY -> WEEKLY_OFF/no schedule ->
 * WORKING_DAY. It used to be stored as WORKING_DAY whatever the date, so a
 * Sunday punch inflated the period's working-day count.
 */
import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { AttendanceService } from '../src/attendance/attendance.service';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, addCalendarException, collection, cookieFor, seedTenant } from './fixtures';

let testApp: TestApp;
let fx: Fixture;
let employee: string;
let spy: ReturnType<typeof jest.spyOn>;

beforeAll(async () => {
  testApp = await createTestApp();
  spy = jest.spyOn(testApp.app.get(AttendanceService), 'getTodayWorkDate');
});
afterAll(async () => {
  spy.mockRestore();
  await testApp.app.close();
});
beforeEach(async () => {
  await clearDatabase();
  fx = await seedTenant();
  employee = await cookieFor(fx.employeeId, fx.organizationId);
  // GPS verification needs a workplace to measure against.
  const workplace = await collection('Workplace').collection.insertOne({
    organizationId: new mongoose.Types.ObjectId(fx.organizationId), name: 'HQ', type: 'IN_OFFICE', active: true,
    latitude: 10.78, longitude: 106.7, allowedRadiusMeters: 200,
    allowGpsAttendance: true, allowWifiAttendance: false, allowSelfieFallback: true,
  });
  await collection('Assignment').collection.updateMany(
    { organizationId: new mongoose.Types.ObjectId(fx.organizationId) },
    { $set: { workplaceId: workplace.insertedId } },
  );
  await collection('TimesheetPeriod').collection.insertOne({
    organizationId: new mongoose.Types.ObjectId(fx.organizationId), period: '2026-11', status: 'OPEN', version: 1, active: true,
    startDate: new Date('2026-11-01T00:00:00Z'), endDate: new Date('2026-11-30T00:00:00Z'),
  });
});

async function checkInOn(workDate: string) {
  spy.mockReturnValue(workDate);
  const res = await testApp.http().post('/api/attendance/check-in').set('Cookie', employee)
    .set('Idempotency-Key', `key-${workDate}-${Math.random()}`)
    .send({ workMode: 'IN_OFFICE', latitude: 10.78, longitude: 106.7, accuracyMeters: 10, address: 'Office' });
  const day = (await collection('AttendanceDay').collection.findOne({ workDate })) as any;
  return { res, day };
}

describe('check-in workday classification', () => {
  it('stores a Monday punch as WORKING_DAY', async () => {
    const { res, day } = await checkInOn('2026-11-16');
    expect(res.status).toBe(201);
    expect(day.workdayType).toBe('WORKING_DAY');
  });

  it('stores a Sunday punch as WEEKLY_OFF (no schedule)', async () => {
    const { res, day } = await checkInOn('2026-11-15');
    expect(res.status).toBe(201);
    expect(day.workdayType).toBe('WEEKLY_OFF');
  });

  it('stores a public-holiday punch as PUBLIC_HOLIDAY even on a weekday', async () => {
    await addCalendarException(fx, '2026-11-17', 'PUBLIC_HOLIDAY', 'Lễ');
    const { res, day } = await checkInOn('2026-11-17');
    expect(res.status).toBe(201);
    expect(day.workdayType).toBe('PUBLIC_HOLIDAY');
  });

  it('treats a SPECIAL_WORKING_DAY on a Sunday as a working day', async () => {
    await addCalendarException(fx, '2026-11-22', 'SPECIAL_WORKING_DAY', 'Làm bù');
    const { res, day } = await checkInOn('2026-11-22');
    expect(res.status).toBe(201);
    expect(day.workdayType).toBe('WORKING_DAY');
  });
});
