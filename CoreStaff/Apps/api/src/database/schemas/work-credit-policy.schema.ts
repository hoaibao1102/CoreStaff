import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { IncompleteDayRule } from '../../hr/policies/work-credit-domain';

export type WorkCreditPolicyDocument = HydratedDocument<WorkCreditPolicy>;

@Schema({ collection: 'work_credit_policies', timestamps: true })
export class WorkCreditPolicy {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true }) organizationId: string;
  @Prop({ required: true, type: Date }) effectiveFrom: Date;
  @Prop({ type: Date }) effectiveTo?: Date;
  @Prop({ required: true, min: 0, max: 1 }) halfDayMinimumRatio: number;
  @Prop({ required: true, min: 0, max: 1 }) fullDayMinimumRatio: number;
  @Prop({ required: true }) paidLeaveCreditEnabled: boolean;
  @Prop({ required: true, enum: Object.values(IncompleteDayRule) }) incompleteDayRule: IncompleteDayRule;
  @Prop({ trim: true, maxlength: 1000 }) businessReference?: string;
  @Prop({ required: true, min: 1, default: 1 }) version: number;
  @Prop({ required: true, default: true }) active: boolean;
}

export const WorkCreditPolicySchema = SchemaFactory.createForClass(WorkCreditPolicy);
WorkCreditPolicySchema.index({ organizationId: 1, effectiveFrom: -1 });
