import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../config/env';
import { syncAllIndexes, closeConnection } from './mongo-tools';

/**
 * Idempotent index bootstrap for Organization / User / UserSession.
 * Run: `npm run ensure-indexes` (from Apps/api).
 *
 * Prints only collection + index names. Never prints the connection URI.
 */
async function main(): Promise<void> {
  const env = resolveEnv();
  if (!hasMongoUri(env)) {
    console.error(
      `[ensure-indexes] No Mongo URI configured (checked ${env.mongodbSourceKey ?? 'MONGODB_URI'}). ` +
        'Add MONGODB_URI to Apps/api/.env.',
    );
    process.exitCode = 1;
    return;
  }

  const connection = mongoose.createConnection(env.mongodbUri, {
    serverSelectionTimeoutMS: 15000,
  });

  try {
    await connection.asPromise();
    const result = await syncAllIndexes(connection);
    for (const entry of result) {
      console.log(`[ensure-indexes] ${entry.collection}: ${entry.indexes.join(', ')}`);
    }

    // TASK-120: EmployeeProfile is the sole owner of employeeCode. syncIndexes()
    // drops the old users index but leaves stored values behind; clear them so a
    // stale copy can never be read as authoritative. Idempotent — matches nothing
    // once done, and any future re-add is exactly what this is meant to catch.
    //
    // On the raw collection, deliberately NOT through a Model: Mongoose casts
    // updates against the schema and drops `$unset` of a path the schema no longer
    // declares, while still reporting the documents as modified (only `updatedAt`
    // changed). The purge would silently never happen.
    const { modifiedCount } = await connection
      .collection('users')
      .updateMany({ employeeCode: { $exists: true } }, { $unset: { employeeCode: 1 } });
    console.log(`[ensure-indexes] users: unset legacy employeeCode on ${modifiedCount} doc(s)`);

    console.log('[ensure-indexes] done');
  } catch (err) {
    console.error('[ensure-indexes] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await closeConnection(connection);
  }
}

void main();