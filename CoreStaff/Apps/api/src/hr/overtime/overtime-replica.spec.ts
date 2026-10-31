import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection, Schema, Types } from 'mongoose';
import { OvertimeService } from './overtime.service';
import { PeriodVersionService } from '../timesheet/period-version.service';
import { TimesheetPeriodSchema } from '../../database/schemas/timesheet-period.schema';

// Opt-in lane creates its OWN replica set; no application bootstrap or URI fallback.
const isolated = process.env.OT_EPHEMERAL_TEST === '1' ? describe : describe.skip;
isolated('OT isolated replica-set filing serialization', () => {
  let replica: MongoMemoryReplSet;
  let db: Connection;
  let periods: any, days: any, requests: any, service: OvertimeService;
  const org = new Types.ObjectId().toString(), user = new Types.ObjectId().toString();
  const workDate = '2026-09-22';
  beforeAll(async () => {
    for (const key of Object.keys(process.env)) if (/MONGO.*URI|DATABASE_URL/.test(key)) delete process.env[key];
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' } });
    console.info('OT_EPHEMERAL_TARGET', replica.getUri('ot_ephemeral_only'));
    db = await createConnection(replica.getUri('ot_ephemeral_only')).asPromise();
    periods = db.model('TimesheetPeriod', TimesheetPeriodSchema);
    days = db.model('OtTestDay', new Schema({ organizationId: String, employeeId: String, workDate: String }));
    requests = db.model('OtTestRequest', new Schema({ organizationId: String, employeeUserId: String, type: String, status: String, workDate: Date, requestedStart: Date, requestedEnd: Date }));
    await Promise.all([periods.init(), days.init(), requests.init()]);
    service = new OvertimeService(requests, days, {} as any, {} as any, {} as any, {} as any, {} as any, new PeriodVersionService(periods));
    jest.spyOn(service, 'preview').mockResolvedValue({ canFile: true, blockedReasons: [], contextHash: 'hash' } as any);
    jest.spyOn(service, 'assertOutsideSchedule').mockResolvedValue();
    jest.spyOn(service, 'maxFilingDays').mockResolvedValue(7);
  }, 120000);
  afterAll(async () => { if (db) await db.close(); if (replica) await replica.stop(); });
  beforeEach(async () => {
    await Promise.all([periods.deleteMany({}), days.deleteMany({}), requests.deleteMany({})]);
    await periods.create({ organizationId: org, period: '2026-09', startDate: '2026-09-01', endDate: '2026-09-30', status: 'REVIEWING', version: 1 });
    await days.create({ organizationId: org, employeeId: user, workDate });
  });
  const window = { from: Date.parse('2026-09-22T11:00:00Z'), to: Date.parse('2026-09-22T13:00:00Z') };
  async function file(fail = false) {
    const session = await db.startSession();
    try {
      return await session.withTransaction(async () => {
        await service.assertFilingAllowed(org, user, window, workDate, new Date('2026-09-23'), undefined, { session, v2Enabled: true });
        await requests.create([{ organizationId: org, employeeUserId: user, workDate: new Date(workDate), type: 'OVERTIME', status: 'PENDING', requestedStart: new Date(window.from), requestedEnd: new Date(window.to) }], { session });
        if (fail) throw new Error('INJECTED_REQUEST_FAILURE');
      });
    } finally { await session.endSession(); }
  }
  async function approve(contract?: string) {
    const session = await db.startSession();
    try {
      await session.withTransaction(async () => {
        await service.claimApproval(org, {
          _id: new Types.ObjectId(), employeeUserId: user, workDate,
          requestedStart: new Date(window.from), requestedEnd: new Date(window.to),
          metadata: contract ? { calculationContract: contract } : {},
        } as any, session);
      });
    } finally { await session.endSession(); }
  }
  it('preserves legacy approval without a covering period or attendance', async () => {
    await periods.deleteMany({});
    await days.deleteMany({});
    await approve();
    expect(await periods.countDocuments()).toBe(0);
  });
  it('still requires a covering period for V2 approval', async () => {
    await periods.deleteMany({});
    await expect(approve('OVERTIME_V2')).rejects.toThrow('PERIOD_REQUIRED');
  });
  it('never bypasses a closed covering period for legacy approval', async () => {
    await periods.updateOne({}, { $set: { status: 'CLOSED' } });
    await expect(approve()).rejects.toThrow('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
    expect((await periods.findOne().lean()).version).toBe(1);
  });
  it('never bypasses a payroll-claimed covering period for legacy approval', async () => {
    await periods.updateOne({}, { $set: { payrollRunId: new Types.ObjectId() } });
    await expect(approve()).rejects.toThrow('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
    expect((await periods.findOne().lean()).version).toBe(1);
  });
  it('rolls back the V2 period claim when attendance is missing', async () => {
    await days.deleteMany({});
    await expect(approve('OVERTIME_V2')).rejects.toThrow('OVERTIME_ATTENDANCE_INCOMPLETE');
    expect((await periods.findOne().lean()).version).toBe(1);
  });
  it('allows exactly one overlapping concurrent filing', async () => {
    const results = await Promise.allSettled([file(), file()]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await requests.countDocuments()).toBe(1);
    expect((await periods.findOne().lean()).version).toBe(2);
  });
  it('rolls back request and both claims on a downstream failure', async () => {
    await expect(file(true)).rejects.toThrow('INJECTED_REQUEST_FAILURE');
    expect(await requests.countDocuments()).toBe(0);
    expect((await periods.findOne().lean()).version).toBe(1);
    expect((await days.findOne().lean()).__v).toBe(0);
  });
});
