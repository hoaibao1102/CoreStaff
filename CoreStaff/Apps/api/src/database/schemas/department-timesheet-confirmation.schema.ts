import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DepartmentTimesheetConfirmationDocument = HydratedDocument<DepartmentTimesheetConfirmation>;

export type DepartmentTimesheetSummarySnapshot = {
  employeeCount: number;
  scheduledWorkDays: number;
  actualWorkingDays: number;
  workingMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  incompleteDays: number;
  overtimeMinutes: {
    workingDay: number;
    weeklyOff: number;
    publicHoliday: number;
    total: number;
  };
  blockerCount: number;
};

/**
 * TASK-075 — immutable evidence that one department manager reviewed one
 * version of a timesheet period. A confirmation is current only while its
 * `periodVersion` equals `TimesheetPeriod.version` (TASK-076).
 */
@Schema({ collection: 'department_timesheet_confirmations', timestamps: true })
export class DepartmentTimesheetConfirmation {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'TimesheetPeriod', required: true, index: true })
  periodId: string;

  @Prop({ type: 'ObjectId', ref: 'Department', required: true, index: true })
  departmentId: string;

  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  managerId: string;

  @Prop({ required: true, min: 1 })
  periodVersion: number;

  @Prop({ type: Date, required: true })
  confirmedAt: Date;

  @Prop({ type: Object, required: true })
  summarySnapshot: DepartmentTimesheetSummarySnapshot;
}

export const DepartmentTimesheetConfirmationSchema = SchemaFactory.createForClass(DepartmentTimesheetConfirmation);

DepartmentTimesheetConfirmationSchema.index(
  { organizationId: 1, periodId: 1, departmentId: 1, periodVersion: 1 },
  { unique: true },
);
DepartmentTimesheetConfirmationSchema.index({ organizationId: 1, periodId: 1, periodVersion: 1 });
