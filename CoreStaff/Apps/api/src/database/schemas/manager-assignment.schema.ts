import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ManagerAssignmentDocument = HydratedDocument<ManagerAssignment>;

/** D36: effective-dated authorization for departments managed by a user. */
@Schema({ collection: 'manager_assignments', timestamps: true })
export class ManagerAssignment {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  managerUserId: string;

  @Prop({ type: 'ObjectId', ref: 'Department', required: true, index: true })
  departmentId: string;

  @Prop({ type: Date, required: true })
  effectiveFrom: Date;

  @Prop({ type: Date, required: false })
  effectiveTo?: Date;

  @Prop({ required: true, default: true })
  active: boolean;

  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  createdBy: string;

  @Prop() createdAt?: Date;
  @Prop() updatedAt?: Date;
}

export const ManagerAssignmentSchema = SchemaFactory.createForClass(ManagerAssignment);
ManagerAssignmentSchema.index({ organizationId: 1, managerUserId: 1, active: 1 });
ManagerAssignmentSchema.index({ organizationId: 1, departmentId: 1, active: 1 });
