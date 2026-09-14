import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserSessionDocument = HydratedDocument<UserSession>;

@Schema({ collection: 'user_sessions', timestamps: { createdAt: true, updatedAt: false } })
export class UserSession {
  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  userId: string;

  /** Null for platform-local System Admin sessions. */
  @Prop({ type: 'ObjectId', ref: 'Organization', required: false })
  organizationId?: string;

  /** Hash of the session token — never the raw token. */
  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ required: false, type: Date })
  revokedAt?: Date;

  @Prop({ required: false })
  userAgent?: string;

  @Prop({ required: false })
  ipAddress?: string;

  @Prop()
  createdAt?: Date;
}

export const UserSessionSchema = SchemaFactory.createForClass(UserSession);

UserSessionSchema.index({ tokenHash: 1 }, { unique: true });
UserSessionSchema.index({ userId: 1, expiresAt: 1 });
UserSessionSchema.index({ organizationId: 1, userId: 1 });