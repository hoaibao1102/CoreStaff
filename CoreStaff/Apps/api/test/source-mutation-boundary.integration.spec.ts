import './env-guard';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Connection, createConnection, Types } from 'mongoose';
import { TimesheetPeriodSchema } from '../src/database/schemas/timesheet-period.schema';
import { PeriodVersionService } from '../src/hr/timesheet/period-version.service';

/** Deliberately refuses external test URI overrides: these tests mutate isolated data only. */
let db: Connection;
let periods: any;
let service: PeriodVersionService;
const organizationId = new Types.ObjectId().toString();
let periodId: string;
beforeAll(async () => {
  if (process.env.TEST_MONGO_EPHEMERAL !== '1') throw new Error('EPHEMERAL_REPLICA_SET_REQUIRED');
  const uri = process.env.TEST_MONGO_URI;
  if (!uri || !/^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(uri)) throw new Error('LOOPBACK_MONGO_REQUIRED');
  db = await createConnection(uri, { dbName: 'corestaff_mutation_boundary_it' }).asPromise();
  periods = db.model('TimesheetPeriod', TimesheetPeriodSchema);
  await periods.init();
  service = new PeriodVersionService(periods);
});
afterAll(async () => { if (db) { await db.dropDatabase(); await db.close(); } });
beforeEach(async () => {
  await periods.deleteMany({});
  periodId = String((await periods.create({ organizationId, period: '2026-10', startDate: '2026-10-01', endDate: '2026-10-31', status: 'READY_TO_CLOSE', version: 1 }))._id);
});

describe('source mutation / close shared replica-set write boundary', () => {
  it('rolls back the period claim when the source write fails', async () => {
    const session = await db.startSession();
    try {
      await expect(session.withTransaction(async () => {
        await service.claimForWorkDate(organizationId, '2026-10-05', session);
        throw new Error('INJECTED_SOURCE_FAILURE');
      })).rejects.toThrow('INJECTED_SOURCE_FAILURE');
      const period = await periods.findById(periodId).lean();
      expect(period.version).toBe(1);
      expect(period.status).toBe('READY_TO_CLOSE');
    } finally { await session.endSession(); }
  });

  it('permits only one writer after source and close read the same snapshot', async () => {
    const source = await db.startSession();
    const close = await db.startSession();
    source.startTransaction();
    close.startTransaction();
    try {
      // Establish both read snapshots before either transaction takes the write lock.
      await periods.findById(periodId).session(source).lean();
      await periods.findById(periodId).session(close).lean();
      await service.claimForWorkDate(organizationId, '2026-10-05', source);
      await source.commitTransaction();
      await expect(periods.updateOne({ _id: periodId, organizationId, version: 1, status: 'READY_TO_CLOSE', payrollRunId: { $exists: false } }, { $set: { status: 'CLOSED' } }, { session: close })).rejects.toThrow();
      await close.abortTransaction();
      const period = await periods.findById(periodId).lean();
      expect(period.status).toBe('REVIEWING');
      expect(period.version).toBe(2);
    } finally {
      if (source.inTransaction()) await source.abortTransaction();
      if (close.inTransaction()) await close.abortTransaction();
      await source.endSession(); await close.endSession();
    }
  });

  it('blocks a source claim after close commits on the competing snapshot', async () => {
    const session = await db.startSession();
    try {
      await periods.updateOne({ _id: periodId }, { $set: { status: 'CLOSED' } });
      await expect(session.withTransaction(() => service.claimForWorkDate(organizationId, '2026-10-05', session))).rejects.toThrow('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
      expect((await periods.findById(periodId).lean()).version).toBe(1);
    } finally { await session.endSession(); }
  });
});
