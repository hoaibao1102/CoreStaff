import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PayrollInputSnapshotDocument = PayrollInputSnapshot & Document;

/**
 * TASK-081/082 / SRS §30C.2 — Immutable payroll input data for one employee in a period.
 *
 * Generated when HR closes a timesheet period (TASK-078). Contains all inputs
 * needed for payroll calculation: base salary, allowances, OT, insurance, deductions.
 *
 * Immutable after generation — any change to source data requires re-generating
 * the snapshot (which happens inside the close-period transaction or via manual
 * re-generation if data was modified post-close).
 */
@Schema({ collection: 'payroll_input_snapshots', timestamps: true })
export class PayrollInputSnapshot {
  /** Reference to the closed TimesheetPeriod this snapshot belongs to. */
  @Prop({ type: 'ObjectId', ref: 'TimesheetPeriod', required: true, index: true })
  periodId: string;

  /** EmployeeProfile id — the HR business record. */
  @Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true, index: true })
  employeeProfileId: string;

  /** User id linked to the EmployeeProfile. */
  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  userId: string;

  /** Organization this snapshot belongs to. */
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  /** Department at time of snapshot generation (frozen snapshot). */
  @Prop({ type: 'ObjectId', ref: 'Department', required: false, index: true })
  departmentId?: string;

  /** Period key in 'YYYY-MM' format. */
  @Prop({ required: true, index: true })
  periodKey: string;

  // ───────── EARNINGS INPUTS ─────────

  /** Monthly base salary at time of snapshot generation. */
  @Prop({ required: true, min: 0, default: 0 })
  monthlyBaseSalary: number;

  /** Prorated base salary based on actual working days (TASK-087). */
  @Prop({ required: true, min: 0, default: 0 })
  proratedBaseSalary: number;

  /** Total allowances for the period (TASK-088). */
  @Prop({ required: true, min: 0, default: 0 })
  totalAllowances: number;

  /** Attendance bonus for the period (TASK-088). */
  @Prop({ required: true, min: 0, default: 0 })
  attendanceBonus: number;

  /** OT minutes by type (frozen from TimesheetSummary). */
  @Prop({ type: Object, required: false })
  otMinutesByType?: {
    otWorkingDayMinutes: number;
    otWeeklyOffMinutes: number;
    otPublicHolidayMinutes: number;
    totalOvertimeMinutes: number;
  };

  /** Calculated OT pay using effective policy rates (TASK-089). */
  @Prop({ required: true, min: 0, default: 0 })
  otPay: number;

  /** OT non-taxable portion = hours × coeff 1.0 × hourlyRate (Vietnam tax law). This is the base OT payment that is NOT subject to PIT. */
  @Prop({ required: true, min: 0, default: 0 })
  otNonTaxableEarnings: number;

  /** OT taxable portion = hours × coeff 0.5 × hourlyRate (Vietnam tax law). Only this coefficient premium is subject to PIT. */
  @Prop({ required: true, min: 0, default: 0 })
  otTaxableEarnings: number;

  // ───────── NON-TAXABLE ALLOWANCES ─────────
  // Theo luật thuế Việt Nam: một số phụ cấp được miễn thuế (trợ cấp nuôi ăn giữa ca, đi lại, ...
  // Cần tách biệt taxable vs non-taxable allowances để tính PIT đúng.

  /** Total non-taxable allowances (miễn thuế theo luật). These are EXCLUDED from PIT calculation. */
  @Prop({ required: true, min: 0, default: 0 })
  nonTaxableAllowances: number;

  /** Allowance breakdown with taxable flag per item (for payslip display). */
  @Prop({ type: [], default: [] })
  allowanceBreakdown?: Array<{
    type: string;      // meal, phone, transport, ...
    label: string;     // 'Trợ cấp nuôi ăn', 'Phụ cấp đi lại', ...
    amount: number;
    taxable: boolean;  // true = chịu thuế PIT, false = miễn thuế
  }>;

  // ───────── INSURANCE INPUTS ─────────
  // Employee contributions (BHXH 8%, BHYT 1.5%, BHTN 1%)

  /** BHXH employee rate (8%). */
  @Prop({ required: true, min: 0, max: 1, default: 0.08 })
  socialInsuranceRate: number;

  /** BHYT employee rate (1.5%). */
  @Prop({ required: true, min: 0, max: 1, default: 0.015 })
  healthInsuranceRate: number;

  /** BHTN employee rate (1%). */
  @Prop({ required: true, min: 0, max: 1, default: 0.01 })
  unemploymentInsuranceRate: number;

  /** Contribution base capped at policy maximum. */
  @Prop({ required: true, min: 0, default: 0 })
  contributionBase: number;

  /** BHXH employee amount (contributionBase × 8%). */
  @Prop({ required: true, min: 0, default: 0 })
  socialInsurance: number;

  /** BHYT employee amount (contributionBase × 1.5%). */
  @Prop({ required: true, min: 0, default: 0 })
  healthInsurance: number;

  /** BHTN employee amount (contributionBase × 1%). */
  @Prop({ required: true, min: 0, default: 0 })
  unemploymentInsurance: number;

  // ───────── PIT INPUTS ─────────

  /** Taxable earnings = proratedBaseSalary + allowances + attendanceBonus + otPay − insurance (TASK-094). */
  @Prop({ required: true, min: 0, default: 0 })
  taxableEarnings: number;

  /** Total dependent deductions (dependentCount × personalDeductionRate) (TASK-095). */
  @Prop({ required: true, min: 0, default: 0 })
  totalDependentDeductions: number;

  /** Number of active dependents at snapshot time. */
  @Prop({ required: true, min: 0, default: 0 })
  dependentCount: number;

  /** Version of tax policy used for calculation. */
  @Prop({ required: true, min: 1, default: 1 })
  taxPolicyVersion: number;

  /** Legal reference (e.g., "Nghị định 126/2025/NĐ-CP"). */
  @Prop({ required: true })
  legalReference: string;

  // ───────── STATUS & INTEGRITY ─────────

  /** Status: GENERATED → CALCULATED → LOCKED → RELEASED. */
  @Prop({ required: true, enum: ['GENERATED', 'CALCULATED', 'LOCKED', 'RELEASED'], default: 'GENERATED', index: true })
  status: string;

  /** Fingerprint of source data at generation time. Mismatch = recompute needed. */
  @Prop({ required: true })
  sourceHash: string;

  /** Version — increments if re-generated for same period/employee. */
  @Prop({ required: true, min: 1, default: 1 })
  version: number;

  /** Timestamp when this snapshot was last generated/updated. */
  @Prop({ required: true })
  generatedAt: Date;
}

export const PayrollInputSnapshotSchema = SchemaFactory.createForClass(PayrollInputSnapshot);

// ───────── INDEXES ─────────

// Unique: one snapshot per (period, employee) combination
PayrollInputSnapshotSchema.index(
  { periodId: 1, employeeProfileId: 1 },
  { unique: true }
);

// Query: filter by status (e.g., find all GENERATED snapshots)
PayrollInputSnapshotSchema.index({ status: 1 });

// Query: all snapshots for an employee across periods
PayrollInputSnapshotSchema.index({ employeeProfileId: 1 });

// Query: filter by organization and period
PayrollInputSnapshotSchema.index({ organizationId: 1, periodKey: 1 });
