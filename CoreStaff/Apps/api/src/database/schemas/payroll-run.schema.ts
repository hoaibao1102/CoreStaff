import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PayrollRunDocument = PayrollRun & Document;

/**
 * TASK-085 — A payroll run is one salary calculation session for a closed
 * TimesheetPeriod belonging to an Organization.
 *
 * Lifecycle: DRAFT → CALCULATED → LOCKED → RELEASED
 * - DRAFT      : created but not yet calculated
 * - CALCULATED : all employee payslips generated
 * - LOCKED     : HR confirmed, immutable
 * - RELEASED   : payslips sent to employees
 */
export enum PayrollRunStatus {
  DRAFT = 'DRAFT',
  CALCULATED = 'CALCULATED',
  LOCKED = 'LOCKED',
  RELEASED = 'RELEASED',
}

@Schema({ collection: 'payroll_runs', timestamps: true })
export class PayrollRun {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'TimesheetPeriod', required: true, index: true })
  timesheetPeriodId: string;

  /** Frozen period label like "10/2026" — never changes even if period data changes. */
  @Prop({ required: true })
  periodLabel: string;

  @Prop({
    type: String,
    enum: Object.values(PayrollRunStatus),
    default: PayrollRunStatus.DRAFT,
    index: true,
  })
  status: PayrollRunStatus;

  @Prop({ required: true })
  runDate: Date;

  // ── Totals (updated during calculation) ────────────────────────────────

  @Prop({ required: true, min: 0, default: 0 })
  totalGross: number;

  @Prop({ required: true, min: 0, default: 0 })
  totalNet: number;

  @Prop({ required: true, min: 0, default: 0 })
  totalEmployerCost: number;

  // ── Progress tracking ─────────────────────────────────────────────────

  @Prop({ required: true, min: 0, default: 0 })
  processedEmployeeCount: number;

  @Prop({ required: true, min: 0, default: 0 })
  totalEmployeeCount: number;

  // ── Lock info ─────────────────────────────────────────────────────────

  @Prop({ type: 'ObjectId', ref: 'User' })
  lockedBy: string;

  @Prop()
  lockedAt: Date;

  @Prop()
  notes: string;

  @Prop({ required: true, min: 1, default: 1 })
  version: number;

  @Prop({ required: true, default: true })
  active: boolean;
}

export const PayrollRunSchema = SchemaFactory.createForClass(PayrollRun);

// Indexes
PayrollRunSchema.index({ organizationId: 1, timesheetPeriodId: 1 }, { unique: true });
PayrollRunSchema.index({ status: 1 });
PayrollRunSchema.index({ organizationId: 1, status: 1 });
