import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type PlatformAuditLogDocument = HydratedDocument<PlatformAuditLog>;

/**
 * Append-only trail of what the platform admin (SYSTEM_ADMIN) does and of every
 * security event on an admin account. It is deliberately separate from
 * `audit_logs`: that collection is tenant-scoped (organizationId is required and
 * HR reads it), whereas a platform admin has no tenant and the events here must
 * never be visible to a tenant's HR.
 */
@Schema({ collection: 'platform_audit_logs', timestamps: true })
export class PlatformAuditLog {
  @Prop({ type: String, required: true, unique: true })
  eventId: string;

  @Prop({ type: Date, default: () => new Date(), index: true })
  occurredAt: Date;

  /** Who did it. Absent for a failed login on an account we could not identify. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  actorId?: string;

  /** Snapshots keep the trail readable after the account is renamed or removed. */
  @Prop({ type: String, required: false })
  actorNameSnapshot?: string;

  @Prop({ type: String, required: false })
  actorEmailSnapshot?: string;

  @Prop({ type: String, required: false })
  actorRoleSnapshot?: string;

  @Prop({ type: String, required: true })
  action: string;

  /** ORGANIZATION | USER | ADMIN_ACCOUNT */
  @Prop({ type: String, required: true })
  targetType: string;

  @Prop({ type: String, required: false })
  targetId?: string;

  /** Human readable target, e.g. "TVS — TVS Corporation" or the HR email. */
  @Prop({ type: String, required: false })
  targetSummary?: string;

  /** The tenant the action concerns, when there is one. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Organization', required: false })
  targetOrganizationId?: string;

  @Prop({ type: String, default: 'SUCCEEDED' })
  outcome: string;

  @Prop({ type: String, required: false })
  reason?: string;

  @Prop({ type: String, default: 'API' })
  source: string;

  @Prop({ type: String, required: false })
  ip?: string;

  @Prop({ type: String, required: false })
  userAgent?: string;

  /** Never holds secrets: passwords, tokens and hashes are stripped on write. */
  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  details?: any;
}

export const PlatformAuditLogSchema = SchemaFactory.createForClass(PlatformAuditLog);
PlatformAuditLogSchema.index({ occurredAt: -1, _id: -1 });
PlatformAuditLogSchema.index({ action: 1, occurredAt: -1 });
PlatformAuditLogSchema.index({ targetOrganizationId: 1, occurredAt: -1 });
PlatformAuditLogSchema.index({ actorId: 1, occurredAt: -1 });
