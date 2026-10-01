import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TimesheetPeriodDocument = HydratedDocument<TimesheetPeriod>;

/** Valid status values for TimesheetPeriod. */
export const TimesheetPeriodStatus = {
  OPEN: 'OPEN',
  REVIEWING: 'REVIEWING',
  READY_TO_CLOSE: 'READY_TO_CLOSE',
  CLOSED: 'CLOSED',
} as const;

export type TimesheetPeriodStatus = (typeof TimesheetPeriodStatus)[keyof typeof TimesheetPeriodStatus];

/** Valid state transitions — enforces the state machine at the schema level. */
export const VALID_TRANSITIONS: Record<TimesheetPeriodStatus, TimesheetPeriodStatus[]> = {
  [TimesheetPeriodStatus.OPEN]: [TimesheetPeriodStatus.REVIEWING, TimesheetPeriodStatus.READY_TO_CLOSE],
  [TimesheetPeriodStatus.REVIEWING]: [TimesheetPeriodStatus.OPEN, TimesheetPeriodStatus.READY_TO_CLOSE],
  [TimesheetPeriodStatus.READY_TO_CLOSE]: [TimesheetPeriodStatus.CLOSED, TimesheetPeriodStatus.REVIEWING],
  [TimesheetPeriodStatus.CLOSED]: [TimesheetPeriodStatus.REVIEWING],
};

/**
 * TASK-072 / SRS §7.4 — Represents one "working month" for an Organization.
 * Example: "2026-09" is the timesheet period for September 2026 of Company A.
 *
 * Purpose:
 * - Mark the start/end of a attendance cycle
 * - Track lifecycle: open → reviewing → ready to close → closed
 * - Manage versioning: each change increments version → old confirmations become invalid
 */
@Schema({ collection: 'timesheet_periods', timestamps: true })
export class TimesheetPeriod {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  /** Period key in YYYY-MM format — unique per organization. */
  @Prop({ required: true, index: true })
  period: string;

  /** Current lifecycle status. */
  @Prop({ required: true, enum: Object.values(TimesheetPeriodStatus), default: TimesheetPeriodStatus.OPEN, index: true })
  status: TimesheetPeriodStatus;

  /** Version — auto-incremented when data changes after initial creation. */
  @Prop({ required: true, min: 1, default: 1 })
  version: number;

  /** Start date of the period (inclusive). */
  @Prop({ required: true, type: Date })
  startDate: Date;

  /** End date of the period (inclusive). */
  @Prop({ required: true, type: Date })
  endDate: Date;

  /** User who closed this period. */
  @Prop({ type: 'ObjectId', ref: 'User' })
  closedBy?: string;

  /** Timestamp when the period was closed. */
  @Prop({ type: Date })
  closedAt?: Date;

  /** Reason for reopening a closed period (≥ 10 characters required). */
  @Prop({ required: false, minlength: 10 })
  reopenReason?: string;

  /** User who reopened this period. */
  @Prop({ type: 'ObjectId', ref: 'User' })
  reopenedBy?: string;

  /** Timestamp when the period was last reopened. */
  @Prop({ type: Date })
  reopenedAt?: Date;

  /** True when all departments have closed their snapshots. */
  @Prop({ type: Boolean, default: false })
  managerSnapshotClosed: boolean;

  /** User who triggered the final manager-snapshot-closed state. */
  @Prop({ type: 'ObjectId', ref: 'User' })
  managerSnapshotClosedBy?: string;

  /** Timestamp when all department snapshots were closed. */
  @Prop({ type: Date })
  managerSnapshotClosedAt?: Date;

  /** Per-department snapshot closure tracking. */
  @Prop({
    type: [
      {
        departmentId: { type: 'ObjectId', ref: 'Department', required: true },
        managerUserId: { type: 'ObjectId', ref: 'User', required: true },
        closedAt: { type: Date, required: true },
      },
    ],
    default: [],
  })
  departmentSnapshots: Array<{
    departmentId: string;
    managerUserId: string;
    closedAt: Date;
  }>;

  /** Soft-delete flag. */
  @Prop({ required: true, default: true })
  active: boolean;
}

export const TimesheetPeriodSchema = SchemaFactory.createForClass(TimesheetPeriod);

// Tenant-scoped uniqueness: only one period per (organization, month).
TimesheetPeriodSchema.index({ organizationId: 1, period: 1 }, { unique: true });
TimesheetPeriodSchema.index({ organizationId: 1, status: 1 });
