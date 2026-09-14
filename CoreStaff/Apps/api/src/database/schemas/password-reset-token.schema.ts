import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PasswordResetTokenDocument = HydratedDocument<PasswordResetToken>;

@Schema({ collection: 'password_reset_tokens', timestamps: { createdAt: true, updatedAt: false } })
export class PasswordResetToken {
  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  userId: string;

  /** Hash of the one-time reset token — never the raw token (FR-AUTH-05). */
  @Prop({ required: true })
  tokenHash: string;

  /** Tokens expire 15 minutes after issue (SRS §4.8). */
  @Prop({ required: true, type: Date })
  expiresAt: Date;

  /** Tombstone set when the token is consumed — single-use. */
  @Prop({ required: false, type: Date })
  usedAt?: Date;

  @Prop({ required: false })
  createdAt?: Date;
}

export const PasswordResetTokenSchema = SchemaFactory.createForClass(PasswordResetToken);

PasswordResetTokenSchema.index({ tokenHash: 1 }, { unique: true });
PasswordResetTokenSchema.index({ userId: 1, expiresAt: 1 });
