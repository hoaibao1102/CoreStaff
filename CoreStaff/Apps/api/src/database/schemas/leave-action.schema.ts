import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LeaveActionDocument = HydratedDocument<LeaveAction>;
@Schema({ collection: 'leave_actions', timestamps: true })
export class LeaveAction {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true }) organizationId: string;
  @Prop({ type: 'ObjectId', ref: 'LeaveRequest', required: true, index: true }) leaveRequestId: string;
  @Prop({ type: 'ObjectId', ref: 'User', required: true }) actorId: string;
  @Prop({ required: true }) action: string;
  @Prop({ required: true }) previousStatus: string;
  @Prop({ required: true }) newStatus: string;
  @Prop({ required: false, maxlength: 1000 }) comment?: string;
  @Prop({ type: Object, required: false }) beforeData?: Record<string, unknown>;
  @Prop({ type: Object, required: false }) afterData?: Record<string, unknown>;
  @Prop() createdAt?: Date;
}
export const LeaveActionSchema = SchemaFactory.createForClass(LeaveAction);
LeaveActionSchema.index({ organizationId: 1, leaveRequestId: 1, createdAt: 1 });

