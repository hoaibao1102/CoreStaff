import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { OrganizationStatus } from './enums';

export type OrganizationDocument = HydratedDocument<Organization>;

@Schema({ collection: 'organizations', timestamps: true })
export class Organization {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: Object.values(OrganizationStatus), default: OrganizationStatus.ACTIVE })
  status: OrganizationStatus;

  @Prop({ required: true, default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @Prop({ required: true, default: 90 })
  evidenceRetentionDays: number;

  @Prop({ required: true, default: false })
  payrollSeparationOfDuties: boolean;

  @Prop({ type: 'ObjectId', ref: 'User', required: false })
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

// Platform-wide uniqueness of the organization code.
OrganizationSchema.index({ code: 1 }, { unique: true });