import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type Document, Types } from 'mongoose';
import {
  AttendanceApprovalStatus,
  AttendanceEventType,
  AttendanceMethod,
} from './enums';

export type AttendanceEventDocument = AttendanceEvent & Document;

@Schema({ timestamps: true, collection: 'attendance_events' })
export class AttendanceEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AttendanceDay', required: true, index: true })
  attendanceDayId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  employeeId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(AttendanceEventType), required: true })
  eventType: AttendanceEventType;

  @Prop({ type: String, enum: Object.values(AttendanceMethod), required: true })
  method: AttendanceMethod;

  /** Server timestamp chính thức */
  @Prop({ type: Date, required: true })
  recordedAt: Date;

  /** Client timestamp gửi lên để đối soát */
  @Prop({ type: Date, required: false })
  capturedAtClient?: Date;

  @Prop({ required: false })
  publicIp?: string;

  @Prop({ type: Number, required: false })
  latitude?: number;

  @Prop({ type: Number, required: false })
  longitude?: number;

  @Prop({ type: Number, required: false })
  accuracyMeters?: number;

  @Prop({ type: Number, required: false })
  distanceFromWorkplaceMeters?: number;

  @Prop({ required: false })
  address?: string;

  @Prop({ enum: ['VALID', 'FLAGGED'], default: 'VALID' })
  validationStatus: string;

  @Prop({
    type: String,
    enum: Object.values(AttendanceApprovalStatus),
    default: AttendanceApprovalStatus.NOT_REQUIRED,
  })
  approvalStatus: AttendanceApprovalStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Evidence', required: false })
  evidenceId?: Types.ObjectId;

  @Prop({ required: false })
  userAgent?: string;

  @Prop({ type: Boolean, default: false })
  isFallback: boolean;

  @Prop({ required: false })
  note?: string;
}

export const AttendanceEventSchema = SchemaFactory.createForClass(AttendanceEvent);

// Compound Unique Index: Mỗi AttendanceDay chỉ có tối đa 1 CHECK_IN và 1 CHECK_OUT
AttendanceEventSchema.index(
  { organizationId: 1, attendanceDayId: 1, eventType: 1 },
  { unique: true },
);
