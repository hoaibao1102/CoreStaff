import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DayResult, WorkdayType } from './enums';

export type TimesheetSummaryDocument = HydratedDocument<TimesheetSummary>;

/**
 * TASK-077 / SRS §7.4 — immutable snapshot of one employee's work for a period.
 *
 * Aggregated from `attendance_days` (raw punches) and `overtime_results`
 * (approved OT minutes by type). Created when HR closes a timesheet period.
 *
 * Immutable after creation — any change to attendance requires re-generating
 * the summary (which happens inside the close-period transaction).
 */
@Schema({ collection: 'timesheet_summaries', timestamps: true })
export class TimesheetSummary {
  /** Reference to the closed TimesheetPeriod this summary belongs to. */
  @Prop({ type: 'ObjectId', ref: 'TimesheetPeriod', required: true, index: true })
  periodId: string;

  /** EmployeeProfile id — the HR business record, NOT the User auth id. */
  @Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true, index: true })
  employeeProfileId: string;

  /** User id linked to the EmployeeProfile — used for punch lookups. */
  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  userId: string;

  /** Organization this summary belongs to. */
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  /** Department at time of summary creation (frozen snapshot). */
  @Prop({ type: 'ObjectId', ref: 'Department', required: false, index: true })
  departmentId?: string;

  /** Department name frozen at summary time (for display without joins). */
  @Prop({ required: false })
  departmentName?: string;

  /** Employee code frozen at summary time. */
  @Prop({ required: false })
  employeeCode?: string;

  /** Full name frozen at summary time. */
  @Prop({ required: false })
  fullName?: string;

  /** Period key in 'YYYY-MM' format. */
  @Prop({ required: true, index: true })
  periodKey: string;

  // ───────── WORK COUNT ─────────

  /** Total calendar days in the period (derived from period startDate/endDate). */
  @Prop({ required: true, min: 0 })
  totalDays: number;

  /** Days classified as working (WORKING_DAY from calendar). */
  @Prop({ required: true, min: 0 })
  workingDays: number;

  /** Days classified as paid leave (sick leave, personal leave, etc.). */
  @Prop({ required: true, min: 0 })
  paidLeaveDays: number;

  /** Days classified as unpaid leave. */
  @Prop({ required: true, min: 0 })
  unpaidLeaveDays: number;

  /** Holidays (non-working, non-paid). */
  @Prop({ required: true, min: 0 })
  holidayDays: number;

  /** Absent days (no check-in/out, no approval). */
  @Prop({ required: true, min: 0 })
  absentDays: number;

  /** Present days (has valid check-in/check-out or approved attendance). */
  @Prop({ required: true, min: 0 })
  presentDays: number;

  /** Days with incomplete data (missing check-in OR check-out). */
  @Prop({ required: true, min: 0 })
  incompleteDays: number;

  // ───────── MINUTES ─────────

  /** Total worked minutes across all days in the period. */
  @Prop({ required: true, min: 0 })
  totalWorkingMinutes: number;

  /** Total late minutes across all days. */
  @Prop({ required: true, min: 0 })
  totalLateMinutes: number;

  /** Total early departure minutes across all days. */
  @Prop({ required: true, min: 0 })
  totalEarlyMinutes: number;

  // ───────── OVERTIME MINUTES (by type) ─────────
  // Source: aggregated from `overtime_results.eligibleMinutes` grouped by overtimeType.
  // These are APPROVED minutes only (PROVISIONAL → FINAL on period close).

  /** OT minutes for regular working days (OT_WORKING_DAY). */
  @Prop({ required: true, min: 0, default: 0 })
  otWorkingDayMinutes: number;

  /** OT minutes for weekly off days (OT_WEEKLY_OFF). */
  @Prop({ required: true, min: 0, default: 0 })
  otWeeklyOffMinutes: number;

  /** OT minutes for public holidays (OT_PUBLIC_HOLIDAY). */
  @Prop({ required: true, min: 0, default: 0 })
  otPublicHolidayMinutes: number;

  /** Sum of all OT minutes above. */
  @Prop({ required: true, min: 0 })
  totalOvertimeMinutes: number;

  // ───────── LEAVE DAYS (by type) ─────────
  // Aggregated from attendance_days.dayResult or leave_requests.

  /** Sick leave days. */
  @Prop({ required: true, min: 0, default: 0 })
  sickLeaveDays: number;

  /** Personal/private leave days. */
  @Prop({ required: true, min: 0, default: 0 })
  personalLeaveDays: number;

  /** Paid annual leave days taken. */
  @Prop({ required: true, min: 0, default: 0 })
  annualLeaveDays: number;

  /** Other paid leave days (maternity, paternity, etc.). */
  @Prop({ required: true, min: 0, default: 0 })
  otherPaidLeaveDays: number;

  /** Unpaid leave days. */
  @Prop({ required: true, min: 0, default: 0 })
  otherUnpaidLeaveDays: number;

  @Prop({ required: false, min: 0 })
  standardWorkUnits?: number;

  @Prop({ required: false, min: 0 })
  standardWorkMinutes?: number;

  @Prop({ required: false, min: 0 })
  payableWorkUnits?: number;

  @Prop({ type: [], required: false, default: undefined })
  dailyWorkCredits?: Array<Record<string, unknown>>;

  @Prop({ type: [], required: false, default: undefined })
  workCreditPolicySnapshots?: Array<Record<string, unknown>>;

  // ───────── DATA INTEGRITY ─────────

  /** Fingerprint of source data at aggregation time. Mismatch = recompute needed. */
  @Prop({ required: true })
  sourceHash: string;

  /** Persistence contract version. Version 1 rows use the legacy working-day contract. */
  @Prop({ required: true, min: 1, default: 1 })
  schemaVersion: number;

  /** Exact TimesheetPeriod.version from which this immutable row was generated. */
  @Prop({ required: true, min: 1, default: 1 })
  sourcePeriodVersion: number;

  /** SHA-256 of the stored frozen payload; unlike sourceHash this is not a staleness check. */
  @Prop({ required: false })
  canonicalPayloadHash?: string;

  /** Explicit compatibility label; legacy rows must not be interpreted as work-credit rows. */
  @Prop({
    required: true,
    enum: ['LEGACY_WORKING_DAYS_V1', 'VERSIONED_WORK_CREDIT_V2'],
    default: 'LEGACY_WORKING_DAYS_V1',
  })
  calculationContract: string;

  @Prop({ type: 'ObjectId', ref: 'TimesheetSummary', required: false })
  supersededBySummaryId?: string;

  @Prop({ type: Date, required: false })
  supersededAt?: Date;

  @Prop({ required: false, minlength: 10, maxlength: 500 })
  supersessionReason?: string;

  /** Version of the summary — increments if re-aggregated for same period/employee. */
  @Prop({ required: true, min: 1, default: 1 })
  version: number;

  /** Timestamp when this summary was last generated/updated. */
  @Prop({ required: true })
  generatedAt: Date;
}

export const TimesheetSummarySchema = SchemaFactory.createForClass(TimesheetSummary);

// ───────── INDEXES ─────────

// Append-only identity: one summary per source period version and employee.
TimesheetSummarySchema.index(
  { organizationId: 1, periodId: 1, sourcePeriodVersion: 1, employeeProfileId: 1 },
  { unique: true }
);

// Query: all summaries for an employee across periods
TimesheetSummarySchema.index({ employeeProfileId: 1 });

// Query: all summaries for an organization in a period
TimesheetSummarySchema.index({ organizationId: 1, periodKey: 1 });

// Query: filter by department
TimesheetSummarySchema.index({ departmentId: 1 });
