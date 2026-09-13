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
    console.log('[ensure-indexes] done');
  } catch (err) {
    console.error('[ensure-indexes] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await closeConnection(connection);
  }
}

void main();