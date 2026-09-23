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

  /**
   * SRS §4.4 — the session cookie is short-lived (30 min idle), so a returning
   * user would otherwise be bounced to the login screen. This session's own
   * refresh token (HttpOnly `rt` cookie, never in localStorage) buys a new
   * `sid` without credentials, up to REFRESH_TTL_MS after login. Rotated on
   * every refresh, so it is single-use. Hash at rest like `tokenHash`.
   */
  @Prop({ required: false })
  refreshTokenHash?: string;

  /** Absolute cap on session lifetime — refreshed access never extends this. */
  @Prop({ required: false, type: Date })
  refreshExpiresAt?: Date;

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
// Refresh lookup only ever touches live refresh tokens; sparse so pre-refresh
// sessions (and any session row created outside login) don't collide on null.
UserSessionSchema.index({ refreshTokenHash: 1 }, { unique: true, sparse: true });
UserSessionSchema.index({ userId: 1, expiresAt: 1 });
UserSessionSchema.index({ organizationId: 1, userId: 1 });