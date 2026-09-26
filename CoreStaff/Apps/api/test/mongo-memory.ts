/**
 * TASK-071 — where the integration lane gets its Mongo, and the guard rail that
 * keeps it out of the real one.
 *
 * Order of preference:
 * 1. `MONGODB_URI_TEST` — a throwaway database on a replica set you already own
 *    (Atlas gives you transactions for free and skips the binary download).
 * 2. an ephemeral single-node replica set started by `mongodb-memory-server`.
 *
 * A standalone server is deliberately not an option: `startSession`/transactions
 * need a replica set, and Sprint 6's timesheet-close transaction is exactly what
 * this lane exists to keep honest.
 *
 * The app's own `MONGODB_URI` is erased from the environment for the whole run
 * (`env-guard.ts`), so no test, and no accidental import, can reach production
 * data. Values are never printed — only key names.
 */
import * as mongoose from 'mongoose';

const URI_KEYS = ['MONGODB_URI', 'MONGO_URI', 'MONGODB_URL', 'ATLAS_URI', 'DATABASE_URL'] as const;

interface MongoHandle {
  uri: string;
  /** True when this process started the server and must stop it on teardown. */
  ephemeral: boolean;
}

export async function startMongo(): Promise<MongoHandle> {
  // Before anything else can call `loadEnv()` and pull the real URI back in.
  for (const key of URI_KEYS) delete process.env[key];

  const override = (process.env.MONGODB_URI_TEST ?? '').trim();
  if (override) {
    await mongoose.connect(override, { serverSelectionTimeoutMS: 15000 });
    const handle: MongoHandle = { uri: override, ephemeral: false };
    process.env.TEST_MONGO_URI = override;
    process.env.TEST_MONGO_EPHEMERAL = '';
    console.log(`[integration] Mongo: MONGODB_URI_TEST, db "${mongoose.connection.name}", ${await topology()}`);
    return handle;
  }

  // Required so mongodb-memory-server does not try to resolve a proxy or fall
  // back to a download host that the corporate network blocks silently.
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: process.env.MONGOD_BINARY_VERSION ?? '7.0.14' },
  });
  const uri = replSet.getUri();
  const handle: MongoHandle = { uri, ephemeral: true };
  (globalThis as Record<string, unknown>).__mongoReplSet = replSet;
  process.env.TEST_MONGO_URI = uri;
  process.env.TEST_MONGO_EPHEMERAL = '1';
  console.log(`[integration] Mongo: in-memory replica set (mongod 7.0.14, first run downloads it)`);
  return handle;
}

async function topology(): Promise<string> {
  try {
    const info = await mongoose.connection.db!.admin().command({ replSetGetStatus: 1 });
    return info.set ? `replicaSet ${info.set}` : 'replica set';
  } catch {
    // A shared standalone would report nothing here, and a transaction test would
    // then fail with a confusing error — say so up front instead.
    return 'standalone? transactions may be unavailable';
  }
}

export async function stopMongo(): Promise<void> {
  await mongoose.disconnect().catch(() => undefined);
  const replSet = (globalThis as Record<string, unknown>).__mongoReplSet as { stop?: () => Promise<boolean> } | undefined;
  if (replSet?.stop) await replSet.stop().catch(() => undefined);
}
