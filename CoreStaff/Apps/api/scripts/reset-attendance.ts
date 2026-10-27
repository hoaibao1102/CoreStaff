import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { UserSchema } from '../src/database/schemas/user.schema';
import { AttendanceDaySchema } from '../src/database/schemas/attendance-day.schema';
import { AttendanceEventSchema } from '../src/database/schemas/attendance-event.schema';
import { ManagerRequestSchema } from '../src/database/schemas/manager-request.schema';
import { EvidenceSchema } from '../src/database/schemas/evidence.schema';
import { IdempotencyRecordSchema } from '../src/database/schemas/idempotency-record.schema';
import { normalizeEmail } from '../src/database/schemas/enums';

/**
 * Clears attendance punches so the named accounts can check in again.
 *
 * Usage (from Apps/api):
 *   npx ts-node-script scripts/reset-attendance.ts
 *   ... --emails=a@x.local,b@x.local --date=2026-10-22
 *   ... --all            # every attendance record of these users, not just one day
 *
 * Deletes the day, its events, their selfie approval requests, the evidence
 * rows and idempotency records. Objects already written to evidence storage
 * are left behind (no storage credentials here) — they are unreachable once
 * their Evidence row is gone.
 */
const args = process.argv.slice(2);
const arg = (name: string, fallback?: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const ALL = args.includes('--all');

const EMAILS = (arg('emails', 'binh.tran@tvs.local,an.nguyen@tvs.local') as string)
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);
/** Today in Asia/Ho_Chi_Minh, the same day the attendance service stamps. */
const TODAY = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const DATE = arg('date', TODAY) as string;

async function main(): Promise<void> {
  const env = resolveEnv();
  if (!hasMongoUri(env)) {
    console.error('[reset] No Mongo URI configured. Add MONGODB_URI to Apps/api/.env.');
    process.exitCode = 1;
    return;
  }

  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  try {
    await connection.asPromise();
    const User = connection.model('User', UserSchema);
    const Day = connection.model('AttendanceDay', AttendanceDaySchema);
    const Event = connection.model('AttendanceEvent', AttendanceEventSchema);
    const Request = connection.model('ManagerRequest', ManagerRequestSchema);
    const Evidence = connection.model('Evidence', EvidenceSchema);
    const Idempotency = connection.model('IdempotencyRecord', IdempotencyRecordSchema);

    for (const email of EMAILS) {
      const user = await User.findOne({ emailN: normalizeEmail(email) }).select('_id organizationId').lean<{ _id: mongoose.Types.ObjectId; organizationId: mongoose.Types.ObjectId }>().exec();
      if (!user) {
        console.log(`[reset] NOT FOUND ${normalizeEmail(email)}`);
        continue;
      }

      const dayFilter = { organizationId: user.organizationId, employeeId: user._id, ...(ALL ? {} : { workDate: DATE }) };
      const days = await Day.find(dayFilter).select('_id').lean<Array<{ _id: mongoose.Types.ObjectId }>>().exec();
      const dayIds = days.map((d) => d._id);

      const events = await Event.find({ organizationId: user.organizationId, attendanceDayId: { $in: dayIds } }).select('_id evidenceId').lean<Array<{ _id: mongoose.Types.ObjectId; evidenceId?: mongoose.Types.ObjectId }>>().exec();
      const requests = await Request.find({ organizationId: user.organizationId, attendanceDayId: { $in: dayIds } }).select('_id evidenceId').lean<Array<{ _id: mongoose.Types.ObjectId; evidenceId?: mongoose.Types.ObjectId }>>().exec();
      const evidenceIds = [...events, ...requests].map((row) => row.evidenceId).filter(Boolean) as mongoose.Types.ObjectId[];

      const removed = {
        requests: (await Request.deleteMany({ _id: { $in: requests.map((r) => r._id) } }).exec()).deletedCount,
        events: (await Event.deleteMany({ _id: { $in: events.map((e) => e._id) } }).exec()).deletedCount,
        evidence: (await Evidence.deleteMany({ _id: { $in: evidenceIds } }).exec()).deletedCount,
        days: (await Day.deleteMany({ _id: { $in: dayIds } }).exec()).deletedCount,
        idempotency: (await Idempotency.deleteMany({
          organizationId: user.organizationId,
          userId: user._id,
          ...(ALL ? {} : { createdAt: { $gte: new Date(`${DATE}T00:00:00+07:00`) } }),
        }).exec()).deletedCount,
      };
      console.log(`[reset] ${normalizeEmail(email)} ${ALL ? 'all dates' : DATE} → days=${removed.days} events=${removed.events} requests=${removed.requests} evidence=${removed.evidence} idempotency=${removed.idempotency}`);
    }
  } finally {
    await closeConnection(connection);
  }
}

void main();
