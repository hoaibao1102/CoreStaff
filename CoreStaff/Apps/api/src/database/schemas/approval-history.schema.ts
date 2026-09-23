import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApprovalHistoryDocument = HydratedDocument<ApprovalHistory>;

@Schema({ collection: 'approval_history', timestamps: true })
export class ApprovalHistory {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'ManagerRequest', required: true, index: true })
  approvalRequestId: string;

  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  actorId: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  previousStatus: string;

  @Prop({ required: true })
  newStatus: string;

  @Prop({ required: false, maxlength: 1000 })
  comment?: string;
}

export const ApprovalHistorySchema = SchemaFactory.createForClass(ApprovalHistory);
ApprovalHistorySchema.index({ organizationId: 1, approvalRequestId: 1, createdAt: 1 });
