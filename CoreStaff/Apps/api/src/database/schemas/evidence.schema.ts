import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type Document, Types } from 'mongoose';

export type EvidenceDocument = Evidence & Document;

@Schema({ timestamps: true, collection: 'evidences' })
export class Evidence {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  ownerUserId: Types.ObjectId;

  /** Object storage key (ví dụ: "org_<id>/evidence/<id>.jpg") */
  @Prop({ required: true })
  storageKey: string;

  @Prop({ required: true })
  originalFileName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  sizeBytes: number;

  @Prop({ required: false })
  sha256?: string;

  @Prop({ type: Date, required: false })
  retentionUntil?: Date;
}

export const EvidenceSchema = SchemaFactory.createForClass(Evidence);

EvidenceSchema.index({ organizationId: 1, storageKey: 1 }, { unique: true });
