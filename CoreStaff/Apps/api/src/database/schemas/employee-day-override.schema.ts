import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LeaveType } from './enums';

export type EmployeeDayOverrideDocument = HydratedDocument<EmployeeDayOverride>;

@Schema({ collection: 'employee_day_overrides', timestamps: true })
export class EmployeeDayOverride {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true }) organizationId: string;
  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true }) employeeId: string;
  @Prop({ required: true }) date: string;
  @Prop({ required: true, enum: Object.values(LeaveType) }) type: LeaveType;
  @Prop({ type: 'ObjectId', ref: 'LeaveRequest', required: true, index: true }) leaveRequestId: string;
  @Prop({ required: true, maxlength: 1000 }) reason: string;
  @Prop({ type: 'ObjectId', ref: 'User', required: true }) createdBy: string;
  @Prop() createdAt?: Date;
  @Prop() updatedAt?: Date;
}

export const EmployeeDayOverrideSchema = SchemaFactory.createForClass(EmployeeDayOverride);
EmployeeDayOverrideSchema.index({ organizationId: 1, employeeId: 1, date: 1 }, { unique: true });

