import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type Document, Types } from 'mongoose';
import {
  AttendanceApprovalStatus,
  AttendanceStatus,
  DayResult,
  WorkdayType,
  WorkMode,
} from './enums';

export type AttendanceDayDocument = AttendanceDay & Document;

@Schema({ timestamps: true, collection: 'attendance_days' })
export class AttendanceDay {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  employeeId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TimesheetPeriod', required: false, index: true })
  periodId?: Types.ObjectId;

  /** Định dạng 'YYYY-MM-DD' */
  @Prop({ required: true, index: true })
  workDate: string;

  @Prop({ type: String, enum: Object.values(WorkMode), required: false })
  workMode?: WorkMode;

  @Prop({ type: String, enum: Object.values(WorkdayType), default: WorkdayType.WORKING_DAY })
  workdayType: WorkdayType;

  @Prop({ type: String, enum: Object.values(DayResult), required: false })
  dayResult?: DayResult;

  @Prop({
    type: String,
    enum: Object.values(AttendanceStatus),
    default: AttendanceStatus.NOT_CHECKED_IN,
    index: true,
  })
  attendanceStatus: AttendanceStatus;

  @Prop({
    type: String,
    enum: Object.values(AttendanceApprovalStatus),
    default: AttendanceApprovalStatus.NOT_REQUIRED,
    index: true,
  })
  overallApprovalStatus: AttendanceApprovalStatus;

  @Prop({ type: Date, required: false })
  checkInAt?: Date;

  @Prop({ type: Date, required: false })
  checkOutAt?: Date;

  @Prop({ type: Number, required: false })
  workingMinutes?: number;

  @Prop({ type: Number, default: 0 })
  lateMinutes: number;

  @Prop({ type: Number, default: 0 })
  earlyMinutes: number;

  /** Snapshot ca làm việc tại thời điểm chấm công */
  @Prop({ type: Object, required: false })
  shiftSnapshot?: {
    shiftTemplateId?: string;
    shiftName?: string;
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
    gracePeriodMinutes?: number;
  };

  /** Snapshot nơi làm việc tại thời điểm chấm công */
  @Prop({ type: Object, required: false })
  workplaceSnapshot?: {
    workplaceId?: string;
    workplaceName?: string;
    workplaceType?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    allowedRadiusMeters?: number;
  };

  /** Snapshot nhân viên tại thời điểm chấm công */
  @Prop({ type: Object, required: false })
  employeeSnapshot?: {
    employeeCode?: string;
    fullName?: string;
    departmentId?: string;
    departmentName?: string;
  };
}

export const AttendanceDaySchema = SchemaFactory.createForClass(AttendanceDay);

// Compound Unique Index: Mỗi nhân viên chỉ có 1 bản ghi công duy nhất cho mỗi ngày trong 1 Organization
AttendanceDaySchema.index({ organizationId: 1, employeeId: 1, workDate: 1 }, { unique: true });
