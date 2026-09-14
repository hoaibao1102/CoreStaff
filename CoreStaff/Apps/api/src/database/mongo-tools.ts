import * as mongoose from 'mongoose';
import { SCHEMA_REGISTRY } from './schemas/registry';

/**
 * Builds Mongoose models from the schema registry on a given connection and
 * idempotently syncs their indexes.
 *
 * Returns only index names — never connection strings or document contents.
 */
export async function syncAllIndexes(
  connection: mongoose.Connection,
): Promise<Array<{ collection: string; indexes: string[] }>> {
  const result: Array<{ collection: string; indexes: string[] }> = [];
  for (const { name, schema } of SCHEMA_REGISTRY) {
    const model = connection.model(name, schema);
    await model.syncIndexes();
    const indexes = (await model.listIndexes()).map((i) => String(i.name));
    result.push({ collection: model.collection.name, indexes });
  }
  return result;
}

const smokeSchema = new mongoose.Schema(
  { key: { type: String, required: true, unique: true } },
  { collection: '_tx_smoke', versionKey: false },
);

/**
 * Proves the target database is a replica set (or sharded cluster) by running a
 * transaction that must roll back. Returns `true` when zero documents survive.
 */
export async function runTransactionSmoke(connection: mongoose.Connection): Promise<boolean> {
  const model = connection.model('_TxSmoke', smokeSchema);
  await model.deleteMany({}).exec();

  const session = await connection.startSession();
  let expectedError: unknown;
  try {
    await session.withTransaction(async () => {
      await model.create([{ key: 'rollback-a' }, { key: 'rollback-b' }], { session });
      // Force abort after two writes to prove all-or-nothing semantics.
      throw new Error('intentional rollback');
    });
  } catch (err) {
    expectedError = err;
  } finally {
    await session.endSession();
  }

  const remaining = await model.countDocuments({}).exec();
  return expectedError instanceof Error && remaining === 0;
}

export function closeConnection(connection: mongoose.Connection): Promise<void> {
  return connection.close();
}