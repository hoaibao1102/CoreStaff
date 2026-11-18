/**
 * AUD-C02 / AUD-C03 — payroll tenant isolation, end to end over HTTP against a
 * real (in-memory replica set) Mongo with the real AuthGuard.
 *
 * HR of tenant B uses a payroll run that belongs to tenant A. Every lifecycle,
 * payslip-list/summary/release and export route must answer exactly as it does
 * for an unknown id, and tenant A's data must not change.
 */
import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, collection, cookieFor, seedTenant } from './fixtures';

let testApp: TestApp;
let a: Fixture;
let b: Fixture;
let hrB: string;
let hrA: string;
let runId: string;
let payslipId: mongoose.Types.ObjectId;
const unknownId = () => new mongoose.Types.ObjectId().toString();

beforeAll(async () => {
  testApp = await createTestApp();
});
afterAll(async () => {
  await testApp.app.close();
});

async function seedRun(status: string) {
  const _id = new mongoose.Types.ObjectId();
  const periodId = new mongoose.Types.ObjectId();
  // Raw inserts: the point is cross-tenant reachability, not schema completeness.
  await collection('PayrollRun').collection.insertOne({
    _id,
    organizationId: new mongoose.Types.ObjectId(a.organizationId),
    timesheetPeriodId: periodId,
    periodLabel: '2026-10',
    status,
    version: 3,
    active: true,
    sourceSnapshotIds: [],
    totalGross: 0,
    totalNet: 0,
  });
  payslipId = new mongoose.Types.ObjectId();
  await collection('Payslip').collection.insertOne({
    _id: payslipId,
    organizationId: new mongoose.Types.ObjectId(a.organizationId),
    payrollRunId: _id,
    employeeProfileId: new mongoose.Types.ObjectId(a.profileId),
    employeeName: 'NV A',
    periodLabel: '2026-10',
    status: 'GENERATED',
    netSalary: 123,
  });
  return String(_id);
}

beforeEach(async () => {
  await clearDatabase();
  a = await seedTenant();
  b = await seedTenant();
  hrA = await cookieFor(a.hrId, a.organizationId);
  hrB = await cookieFor(b.hrId, b.organizationId);
});

type Call = { name: string; send: (id: string, cookie: string) => Promise<{ status: number; body: any }> };

function calls(): Call[] {
  const http = () => testApp.http();
  const withCookie = (r: any, cookie: string) => r.set('Cookie', cookie);
  return [
    { name: 'PUT calculate', send: (id, c) => withCookie(http().put(`/api/payroll-runs/${id}/calculate`), c) },
    { name: 'PUT recalculate', send: (id, c) => withCookie(http().put(`/api/payroll-runs/${id}/recalculate`), c) },
    { name: 'PUT lock', send: (id, c) => withCookie(http().put(`/api/payroll-runs/${id}/lock`), c) },
    { name: 'PUT release', send: (id, c) => withCookie(http().put(`/api/payroll-runs/${id}/release`), c) },
    { name: 'GET payslips of run', send: (id, c) => withCookie(http().get(`/api/payslips/run/${id}`), c) },
    { name: 'GET payslip summary', send: (id, c) => withCookie(http().get(`/api/payslips/run/${id}/summary`), c) },
    { name: 'POST payslip release', send: (id, c) => withCookie(http().post(`/api/payslips/release/${id}`), c) },
    { name: 'GET export csv', send: (id, c) => withCookie(http().get(`/api/payroll-runs/${id}/export/csv`), c) },
    { name: 'GET export summary csv', send: (id, c) => withCookie(http().get(`/api/payroll-runs/${id}/export/summary/csv`), c) },
    { name: 'GET export excel', send: (id, c) => withCookie(http().get(`/api/payroll-runs/${id}/export/excel`), c) },
  ];
}

describe('AUD-C02/C03 — a foreign payroll run id behaves like an unknown id', () => {
  it.each(calls().map((c) => c.name))('%s', async (name) => {
    runId = await seedRun('LOCKED');
    const call = calls().find((c) => c.name === name)!;

    const foreign = await call.send(runId, hrB);
    const unknown = await call.send(unknownId(), hrB);

    expect(foreign.status).toBe(unknown.status);
    expect(foreign.status).toBeGreaterThanOrEqual(400);
    expect(foreign.status).toBeLessThan(500);
    expect(foreign.body?.error?.code).toBe(unknown.body?.error?.code);
    // No foreign salary data in the body.
    expect(JSON.stringify(foreign.body ?? {})).not.toContain('NV A');
  });

  it('leaves tenant A data untouched after every mutation attempt by tenant B', async () => {
    runId = await seedRun('LOCKED');
    for (const call of calls()) await call.send(runId, hrB);

    const run: any = await collection('PayrollRun').findOne({ _id: runId as any }).lean();
    expect(run.status).toBe('LOCKED');
    expect(run.version).toBe(3);
    const slip: any = await collection('Payslip').findOne({ _id: payslipId }).lean();
    expect(slip.status).toBe('GENERATED');
    expect(slip.releasedAt).toBeUndefined();
  });

  it('control: HR of the owning tenant still reaches the run', async () => {
    runId = await seedRun('LOCKED');
    const list = await testApp.http().get(`/api/payslips/run/${runId}`).set('Cookie', hrA);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    const summary = await testApp.http().get(`/api/payslips/run/${runId}/summary`).set('Cookie', hrA);
    expect(summary.status).toBe(200);
    expect(summary.body.data.total).toBe(1);
  });
});
