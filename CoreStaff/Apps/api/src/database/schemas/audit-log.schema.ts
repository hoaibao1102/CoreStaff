import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ collection: 'audit_logs', timestamps: true })
export class AuditLog {
  @Prop({ type: String, required: true, index: true })
  eventId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false, index: true })
  actorId?: string;

  @Prop({ type: String, required: false })
  actorNameSnapshot?: string;

  @Prop({ type: String, required: false })
  actorRoleSnapshot?: string;

  @Prop({ type: String, required: true, index: true })
  action: string;

  @Prop({ type: String, required: true, index: true })
  targetType: string;

  @Prop({ type: String, required: false })
  targetId?: string;

  @Prop({ type: String, required: false })
  targetSummary?: string;

  @Prop({ type: String, required: false })
  correlationId?: string;

  @Prop({ type: String, default: 'API' })
  source: string;

  @Prop({ type: String, default: 'SUCCEEDED' })
  outcome: string;

  @Prop({ type: String, required: false })
  reason?: string;

  @Prop({ type: Boolean, default: false })
  isSelfApproved: boolean;

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  details?: any;

  @Prop({ type: Date, default: () => new Date(), index: true })
  occurredAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ organizationId: 1, occurredAt: -1, _id: -1 });
AuditLogSchema.index({ organizationId: 1, action: 1, occurredAt: -1 });
AuditLogSchema.index({ organizationId: 1, targetType: 1, targetId: 1, occurredAt: -1 });

