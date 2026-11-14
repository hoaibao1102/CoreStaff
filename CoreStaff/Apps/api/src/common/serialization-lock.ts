import type { ClientSession, Connection } from 'mongoose';

/**
 * AUD-H10..H12: serialize read-check-write invariants that no unique index can
 * express (overlap, single active slot). Every writer first bumps one shared
 * lock document inside its transaction. MongoDB turns two concurrent bumps into
 * a write conflict, `withTransaction` retries the loser, and on retry it sees
 * the winner's committed row, so the check-then-insert pair becomes serial.
 */
export async function acquireSerializationLock(
  connection: Connection,
  scopeKey: string,
  session: ClientSession,
): Promise<void> {
  await connection.collection('serialization_locks').updateOne(
    { _id: scopeKey as any },
    { $inc: { seq: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true, session },
  );
}
