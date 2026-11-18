import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PlatformAuditLogDocument } from '../database/schemas/platform-audit-log.schema';

export interface PlatformAuditEvent {
  eventId?: string;
  occurredAt?: Date;
  actorId?: string;
  actorNameSnapshot?: string;
  actorEmailSnapshot?: string;
  actorRoleSnapshot?: string;
  action: string;
  targetType: string;
  targetId?: string;
  targetSummary?: string;
  targetOrganizationId?: string;
  outcome?: 'SUCCEEDED' | 'FAILED';
  reason?: string;
  source?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export interface PlatformAuditQuery {
  action?: string;
  outcome?: string;
  actorId?: string;
  targetOrganizationId?: string;
  /** YYYY-MM-DD, inclusive, read as a Vietnam calendar day. */
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
}

const SECRET_KEY = /pass(word)?|token|secret|hash|cookie|authorization/i;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Defense in depth: even if a caller passes it, a secret never reaches the log. */
export function stripSecrets(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => stripSecrets(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, item]) => [key, stripSecrets(item, depth + 1)]),
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(
    @InjectModel('PlatformAuditLog') private readonly logs: Model<PlatformAuditLogDocument>,
    @InjectModel('User') private readonly users: Model<any>,
  ) {}

  /**
   * Writes one event. Called after the action already succeeded, so a failure to
   * write the log is reported to the server log instead of failing the admin's
   * request (which would leave a tenant suspended but the caller told it failed).
   */
  async record(event: PlatformAuditEvent): Promise<void> {
    try {
      await this.logs.create({
        ...event,
        details: event.details ? stripSecrets(event.details) : undefined,
        eventId: event.eventId ?? new Types.ObjectId().toString(),
        occurredAt: event.occurredAt ?? new Date(),
      });
    } catch (error) {
      this.logger.error(`Could not write platform audit event ${event.action}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Same as `record`, filling the actor's name/email/role from their user document. */
  async recordForActor(actorId: string | undefined, event: PlatformAuditEvent): Promise<void> {
    let snapshot: Partial<PlatformAuditEvent> = {};
    if (actorId && Types.ObjectId.isValid(String(actorId))) {
      try {
        const user: any = await this.users.findById(String(actorId)).select({ fullName: 1, email: 1, role: 1 }).lean();
        snapshot = { actorId: String(actorId), actorNameSnapshot: user?.fullName, actorEmailSnapshot: user?.email, actorRoleSnapshot: user?.role };
      } catch {
        snapshot = { actorId: String(actorId) };
      }
    }
    await this.record({ ...snapshot, ...event });
  }

  async list(query: PlatformAuditQuery = {}): Promise<{ items: any[]; total: number }> {
    const filter: Record<string, any> = {};
    if (query.action) filter.action = query.action;
    if (query.outcome) filter.outcome = query.outcome;
    if (query.actorId && Types.ObjectId.isValid(query.actorId)) filter.actorId = new Types.ObjectId(query.actorId);
    if (query.targetOrganizationId && Types.ObjectId.isValid(query.targetOrganizationId)) {
      filter.targetOrganizationId = new Types.ObjectId(query.targetOrganizationId);
    }
    const range: Record<string, Date> = {};
    if (query.from && ISO_DAY.test(query.from)) range.$gte = new Date(`${query.from}T00:00:00+07:00`);
    if (query.to && ISO_DAY.test(query.to)) range.$lte = new Date(`${query.to}T23:59:59.999+07:00`);
    if (Object.keys(range).length) filter.occurredAt = range;
    const text = query.q?.trim();
    if (text) {
      const pattern = new RegExp(escapeRegExp(text.slice(0, 100)), 'i');
      filter.$or = [{ targetSummary: pattern }, { actorNameSnapshot: pattern }, { actorEmailSnapshot: pattern }];
    }

    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const page = Math.max(1, Number(query.page) || 1);
    const [items, total] = await Promise.all([
      this.logs.find(filter).sort({ occurredAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.logs.countDocuments(filter),
    ]);
    return { items, total };
  }
}
