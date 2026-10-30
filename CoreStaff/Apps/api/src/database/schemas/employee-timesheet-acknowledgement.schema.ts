import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EmployeeTimesheetAcknowledgementDocument = HydratedDocument<EmployeeTimesheetAcknowledgement>;
export type TimesheetReviewAction = 'ACKNOWLEDGED' | 'DISPUTED' | 'RESOLVED_BY_CORRECTION' | 'RESOLVED_NO_CHANGE' | 'EXCEPTED';

@Schema({ timestamps: true, collection: 'employee_timesheet_acknowledgements' })
export class EmployeeTimesheetAcknowledgement {
  @Prop({ type: Types.ObjectId, required: true, index: true }) organizationId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, index: true }) periodId!: Types.ObjectId;
  @Prop({ required: true, min: 1 }) periodVersion!: number;
  @Prop({ type: Types.ObjectId, required: true, index: true }) employeeProfileId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, index: true }) userId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, index: true }) departmentId!: Types.ObjectId;
  @Prop({ required: true, enum: ['ACKNOWLEDGED', 'DISPUTED', 'RESOLVED_BY_CORRECTION', 'RESOLVED_NO_CHANGE', 'EXCEPTED'] }) action!: TimesheetReviewAction;
  @Prop({ required: true, minlength: 64, maxlength: 64 }) projectionHash!: string;
  @Prop({ required: true, maxlength: 200 }) idempotencyKey!: string;
  @Prop({ type: Types.ObjectId, required: true }) actorUserId!: Types.ObjectId;
  @Prop({ required: true }) actedAt!: Date;
  @Prop({ maxlength: 2000 }) disputeReason?: string;
  @Prop({ type: [String], default: undefined }) disputedWorkDates?: string[];
  @Prop({ maxlength: 1000 }) transitionReason?: string;
}

export const EmployeeTimesheetAcknowledgementSchema = SchemaFactory.createForClass(EmployeeTimesheetAcknowledgement);
EmployeeTimesheetAcknowledgementSchema.index({ organizationId: 1, periodId: 1, periodVersion: 1, userId: 1, actedAt: -1 });
EmployeeTimesheetAcknowledgementSchema.index(
  { organizationId: 1, periodId: 1, periodVersion: 1, userId: 1, projectionHash: 1, idempotencyKey: 1 },
  { unique: true },
);
