import type { ClientSession, Model } from 'mongoose';

/**
 * QC 2.4 — when a day reaches a terminal outcome (forfeited, attendance
 * confirmed, explanation approved) every other still-open request for the same
 * attendance day is moot. Mark them CANCELLED inside the caller's transaction
 * instead of deleting: SRS BR-DELETE-01 keeps history, and every reader filters
 * `status !== 'CANCELLED'` so the stale rows never resurface in the UI.
 */
export async function closeSiblingRequests(
  requests: Model<any>,
  input: {
    organizationId: string;
    attendanceDayId?: unknown;
    exceptId?: unknown;
    reason: string;
    session?: ClientSession;
  },
): Promise<number> {
  const { organizationId, attendanceDayId, exceptId, reason, session } = input;
  if (!attendanceDayId) return 0;
  const filter: Record<string, unknown> = {
    organizationId,
    attendanceDayId,
    status: { $in: ['PENDING', 'CLARIFICATION_REQUESTED'] },
  };
  if (exceptId) filter._id = { $ne: exceptId };
  const result = await requests.updateMany(
    filter,
    { $set: { status: 'CANCELLED', closedAt: new Date(), closedReason: reason } },
    session ? { session } : {},
  );
  return result.modifiedCount ?? 0;
}
