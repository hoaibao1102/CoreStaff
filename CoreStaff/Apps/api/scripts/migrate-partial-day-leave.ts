import * as mongoose from 'mongoose';
import { hasMongoUri, resolveEnv } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const apply = process.argv.includes('--apply');
  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  try {
    await connection.asPromise();
    const db = connection.db;
    if (!db) throw new Error('Mongo database unavailable.');
    const requests = db.collection('leave_requests');
    const overrides = db.collection('employee_day_overrides');
    const requestResult = apply
      ? await requests.updateMany({ durationType: { $exists: false } }, { $set: { durationType: 'FULL_DAY' } })
      : { modifiedCount: await requests.countDocuments({ durationType: { $exists: false } }) };
    const overrideResult = apply
      ? await overrides.updateMany({ durationType: { $exists: false } }, { $set: { durationType: 'FULL_DAY' } })
      : { modifiedCount: await overrides.countDocuments({ durationType: { $exists: false } }) };
    if (apply) {
      await requests.updateMany({ durationType: 'MORNING' }, { $set: { durationType: 'MORNING_HALF' } });
      await requests.updateMany({ durationType: 'AFTERNOON' }, { $set: { durationType: 'AFTERNOON_HALF' } });
      await overrides.updateMany({ durationType: 'MORNING' }, { $set: { durationType: 'MORNING_HALF' } });
      await overrides.updateMany({ durationType: 'AFTERNOON' }, { $set: { durationType: 'AFTERNOON_HALF' } });
    }
    console.log(`[migrate:partial-day-leave] mode=${apply ? 'apply' : 'dry-run'} requests=${requestResult.modifiedCount} overrides=${overrideResult.modifiedCount}`);
    if (apply) {
      const legacyIndex = 'organizationId_1_employeeId_1_date_1';
      const names = (await overrides.indexes()).map(index => index.name);
      if (names.includes(legacyIndex)) await overrides.dropIndex(legacyIndex);
      await overrides.createIndex(
        { organizationId: 1, employeeId: 1, date: 1, leaveRequestId: 1 },
        { unique: true, name: 'organizationId_1_employeeId_1_date_1_leaveRequestId_1' },
      );
    }
  } finally {
    await closeConnection(connection);
  }
}

void main().catch(error => {
  console.error('[migrate:partial-day-leave] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
