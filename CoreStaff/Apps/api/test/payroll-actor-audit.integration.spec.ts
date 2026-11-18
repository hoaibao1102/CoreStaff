/**
 * The payroll controllers used to pass `user.id` (undefined — the guard exposes
 * `_id`) into the service, and `new ObjectId(undefined)` silently mints a random
 * id. Result: createdBy/calculatedBy/lockedBy never matched the real actor, so
 * separation of duties (AUD-H04) could not fire and the audit trail named nobody.
 *
 * Driven over HTTP on purpose — the service-level specs pass a real id by hand
 * and could not see this.
 */
import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { clearDatabase, createTestApp, TestApp } from './app-factory';
import { Fixture, collection, cookieFor, seedTenant } from './fixtures';

let testApp: TestApp;
let fx: Fixture;
let hr: string;
const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));

beforeAll(async () => { testApp = await createTestApp(); });
afterAll(async () => { await testApp.app.close(); });
beforeEach(async () => {
  await clearDatabase();
  fx = await seedTenant();
  hr = await cookieFor(fx.hrId, fx.organizationId);
});

async function seedCalculatedRun(calculatedBy?: string) {
  const runId = new mongoose.Types.ObjectId();
  const periodId = new mongoose.Types.ObjectId();
  await collection('TimesheetPeriod').collection.insertOne({
    _id: periodId, organizationId: oid(fx.organizationId), period: '2026-10', status: 'CLOSED', version: 5, active: true,
    payrollRunId: runId, payrollState: 'CALCULATED', payrollSourceVersion: 5,
  });
  await collection('PayrollRun').collection.insertOne({
    _id: runId, organizationId: oid(fx.organizationId), timesheetPeriodId: periodId, periodLabel: '2026-10',
    status: 'CALCULATED', version: 3, active: true, sourceSnapshotIds: [], totalGross: 10, totalNet: 8,
    ...(calculatedBy ? { calculatedBy: oid(calculatedBy) } : {}),
  });
  return String(runId);
}

describe('payroll lifecycle records the real acting user', () => {
  it('stores the caller as lockedBy and audits PAYROLL_LOCK under that user', async () => {
    const runId = await seedCalculatedRun();
    const res = await testApp.http().put(`/api/payroll-runs/${runId}/lock`).set('Cookie', hr);
    expect(res.status).toBe(200);

    const run = (await collection('PayrollRun').collection.findOne({ _id: oid(runId) })) as any;
    expect(String(run.lockedBy)).toBe(fx.hrId);

    const rows = (await collection('AuditLog').collection.find({ action: 'PAYROLL_LOCK' }).toArray()) as any[];
    expect(rows).toHaveLength(1);
    expect(String(rows[0].actorId)).toBe(fx.hrId);
    expect(rows[0].actorRoleSnapshot).toBe('HR');
    expect(rows[0].targetId).toBe(runId);
  });

  it('enforces separation of duties against the real caller when the tenant enables it', async () => {
    await collection('Organization').collection.updateOne({ _id: oid(fx.organizationId) }, { $set: { payrollSeparationOfDuties: true } });
    const runId = await seedCalculatedRun(fx.hrId); // the same HR prepared the run

    const res = await testApp.http().put(`/api/payroll-runs/${runId}/lock`).set('Cookie', hr);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PAYROLL_SEPARATION_OF_DUTIES');
    const run = (await collection('PayrollRun').collection.findOne({ _id: oid(runId) })) as any;
    expect(run.status).toBe('CALCULATED');
    expect(await collection('AuditLog').collection.countDocuments({ action: 'PAYROLL_LOCK' })).toBe(0);
  });
});
