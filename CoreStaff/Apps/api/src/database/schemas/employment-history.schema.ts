import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EmploymentStatus } from './enums';

export type EmploymentHistoryDocument = HydratedDocument<EmploymentHistory>;

/**
 * TASK-023: append-only audit trail of `EmployeeProfile.employmentStatus`
 * transitions. Kept as its own collection rather than an embedded array
 * (SRS §2216 — unbounded-growth history must not be nested in the profile).
 */
@Schema({ collection: 'employment_histories', timestamps: { createdAt: true, updatedAt: false } })
export class EmploymentHistory {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true, index: true })
  employeeProfileId: string;

  /** Absent only for the very first status set at profile creation. */
  @Prop({ required: false, enum: Object.values(EmploymentStatus) })
  previousStatus?: EmploymentStatus;

  @Prop({ required: true, enum: Object.values(EmploymentStatus) })
  newStatus: EmploymentStatus;

  @Prop({ required: true, type: Date })
  effectiveDate: Date;

  @Prop({ required: false })
  reason?: string;

  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  changedBy: string;

  @Prop()
  createdAt?: Date;
}

export const EmploymentHistorySchema = SchemaFactory.createForClass(EmploymentHistory);

EmploymentHistorySchema.index({ organizationId: 1, employeeProfileId: 1, createdAt: -1 });
