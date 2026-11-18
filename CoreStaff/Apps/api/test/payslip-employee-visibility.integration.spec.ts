/**
 * AUD-C04 — an employee only sees published payslips.
 * Calculate -> hidden; release -> visible; opening a released payslip -> VIEWED;
 * a draft can never be marked VIEWED (that state blocks recalculation).
 */
import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, collection, cookieFor, seedTenant } from './fixtures';

let testApp: TestApp;
let fx: Fixture;
let employee: string;
let draftId: mongoose.Types.ObjectId;
let releasedId: mongoose.Types.ObjectId;
const oid = (v: string) => new mongoose.Types.ObjectId(v);

beforeAll(async () => { testApp = await createTestApp(); });
afterAll(async () => { await testApp.app.close(); });

beforeEach(async () => {
  await clearDatabase();
  fx = await seedTenant();
  employee = await cookieFor(fx.employeeId, fx.organizationId);
  const insert = async (periodLabel: string, status: string) => {
    const _id = new mongoose.Types.ObjectId();
    await collection('Payslip').collection.insertOne({
      _id, organizationId: oid(fx.organizationId), payrollRunId: new mongoose.Types.ObjectId(),
      employeeProfileId: oid(fx.profileId), employeeName: 'NV', periodLabel, status, netSalary: 100,
    });
    return _id;
  };
  draftId = await insert('2026-10', 'GENERATED');
  releasedId = await insert('2026-09', 'RELEASED');
});

const statusOf = async (id: mongoose.Types.ObjectId) =>
  ((await collection('Payslip').collection.findOne({ _id: id })) as any).status;

describe('employee payslip visibility (AUD-C04)', () => {
  it('lists only published payslips', async () => {
    const res = await testApp.http().get('/api/payslips/me').set('Cookie', employee);
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: any) => p.periodLabel)).toEqual(['2026-09']);
  });

  it('does not let a status query parameter reach drafts', async () => {
    const res = await testApp.http().get('/api/payslips/me?status=GENERATED').set('Cookie', employee);
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: any) => p.status)).not.toContain('GENERATED');
  });

  it('hides the detail of a draft but serves a released one', async () => {
    const http = testApp.http();
    expect((await http.get(`/api/payslips/me/${draftId}`).set('Cookie', employee)).status).toBe(404);
    expect((await http.get(`/api/payslips/me/${releasedId}`).set('Cookie', employee)).status).toBe(200);
  });

  it('never turns a draft into VIEWED, and moves a released payslip to VIEWED', async () => {
    const http = testApp.http();
    await http.post(`/api/payslips/me/${draftId}/viewed`).set('Cookie', employee);
    expect(await statusOf(draftId)).toBe('GENERATED');

    await http.post(`/api/payslips/me/${releasedId}/viewed`).set('Cookie', employee);
    expect(await statusOf(releasedId)).toBe('VIEWED');
    const list = await http.get('/api/payslips/me').set('Cookie', employee);
    expect(list.body.data.map((p: any) => p.status)).toEqual(['VIEWED']);
  });
});
