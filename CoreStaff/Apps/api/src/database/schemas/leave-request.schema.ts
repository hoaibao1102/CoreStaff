import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LeaveRequestStatus, LeaveType } from './enums';

export type LeaveRequestDocument = HydratedDocument<LeaveRequest>;

@Schema({ collection: 'leave_requests', timestamps: true })
export class LeaveRequest {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true }) organizationId: string;
  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true }) employeeId: string;
  @Prop({ type: 'ObjectId', ref: 'Department', required: true, index: true }) departmentId: string;
  @Prop({ required: true }) startDate: string;
  @Prop({ required: true }) endDate: string;
  @Prop({ required: true, enum: Object.values(LeaveType) }) leaveType: LeaveType;
  @Prop({ required: true, minlength: 10, maxlength: 1000 }) reason: string;
  @Prop({ type: 'ObjectId', ref: 'Evidence', required: false }) evidenceId?: string;
  @Prop({ required: true, enum: Object.values(LeaveRequestStatus), default: LeaveRequestStatus.PENDING_MANAGER, index: true }) status: LeaveRequestStatus;
  @Prop({ type: 'ObjectId', ref: 'User', required: false }) reviewedBy?: string;
  @Prop({ type: Date, required: false }) reviewedAt?: Date;
  @Prop({ required: false, maxlength: 1000 }) reviewComment?: string;
  @Prop({ type: 'ObjectId', ref: 'User', required: false }) appliedBy?: string;
  @Prop({ type: Date, required: false }) appliedAt?: Date;
  @Prop() createdAt?: Date;
  @Prop() updatedAt?: Date;
}

export const LeaveRequestSchema = SchemaFactory.createForClass(LeaveRequest);
LeaveRequestSchema.index({ organizationId: 1, employeeId: 1, startDate: 1, endDate: 1 });
LeaveRequestSchema.index({ organizationId: 1, departmentId: 1, status: 1 });

