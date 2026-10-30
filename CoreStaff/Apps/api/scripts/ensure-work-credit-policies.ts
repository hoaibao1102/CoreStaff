import * as mongoose from 'mongoose';
import { hasMongoUri, resolveEnv } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const apply = process.argv.includes('--apply');
  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  try {
    await connection.asPromise();
    const db = connection.db;
    if (!db) throw new Error('Mongo database unavailable.');
    const organizations = await db.collection('organizations').find({}).project({ _id: 1 }).toArray();
    const policies = db.collection('work_credit_policies');
    const coveredOrganizationIds = new Set((await policies.distinct('organizationId')).map(String));
    const missing = organizations.filter((organization) => !coveredOrganizationIds.has(String(organization._id)));
    console.log(`[ensure-work-credit-policies] mode=${apply ? 'apply' : 'dry-run'} organizations=${organizations.length} missing=${missing.length}`);
    if (!apply || !missing.length) return;
    await policies.insertMany(missing.map((organization) => ({
      organizationId: organization._id,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      halfDayMinimumRatio: 0.5,
      fullDayMinimumRatio: 1,
      paidLeaveCreditEnabled: true,
      incompleteDayRule: 'BLOCK',
      businessReference: 'Chính sách quy đổi ngày công mặc định',
      version: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })));
    console.log(`[ensure-work-credit-policies] created=${missing.length}`);
  } finally {
    await closeConnection(connection);
  }
}

void main().catch((error) => {
  console.error('[ensure-work-credit-policies] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
