import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IdempotencyRecordDocument = HydratedDocument<IdempotencyRecord>;

@Schema({ collection: 'idempotency_records', timestamps: true })
export class IdempotencyRecord {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  userId: string;

  @Prop({ required: true })
  key: string;

  @Prop({ required: true, enum: ['CHECK_IN', 'CHECK_OUT'] })
  operation: 'CHECK_IN' | 'CHECK_OUT';

  @Prop({ required: true })
  requestHash: string;

  @Prop({ required: true, default: 200 })
  responseStatus: number;

  @Prop({ type: Object, required: true })
  responseBody: Record<string, unknown>;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt: Date;
}

export const IdempotencyRecordSchema = SchemaFactory.createForClass(IdempotencyRecord);
IdempotencyRecordSchema.index({ organizationId: 1, userId: 1, key: 1 }, { unique: true });
