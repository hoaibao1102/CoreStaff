import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PayslipDocument = Payslip & Document;

/**
 * TASK-099 — Individual payslip for one employee in one payroll run.
 *
 * Lifecycle: DRAFT → GENERATED → RELEASED → VIEWED
 * - DRAFT      : placeholder created during payroll run calculation
 * - GENERATED  : full calculation complete with all breakdowns
 * - RELEASED   : HR confirmed and sent to employee
 * - VIEWED     : employee opened the payslip
 */
export enum PayslipStatus {
  DRAFT = 'DRAFT',
  GENERATED = 'GENERATED',
  RELEASED = 'RELEASED',
  VIEWED = 'VIEWED',
}

@Schema({ collection: 'payslips', timestamps: true })
export class Payslip {
  @Prop({ type: 'ObjectId', ref: 'PayrollRun', required: true, index: true })
  payrollRunId: string;

  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true, index: true })
  employeeProfileId: string;

  /** Frozen employee name — never changes even if profile is updated. */
  @Prop({ required: true })
  employeeName: string;

  /** Frozen employee code. */
  @Prop()
  employeeCode: string;

  /** Tax code from EmployeeProfile. */
  @Prop()
  taxCode: string;

  /** Period label like "10/2026" frozen at generation time. */
  @Prop({ required: true })
  periodLabel: string;

  @Prop({
    type: String,
    enum: Object.values(PayslipStatus),
    default: PayslipStatus.DRAFT,
    index: true,
  })
  status: PayslipStatus;

  // ── EARNINGS ───────────────────────────────────────────────────────────

  /** Total gross earnings before any deductions. */
  @Prop({ required: true, min: 0, default: 0 })
  grossEarnings: number;

  /** Income subject to PIT after non-taxable allowances removed. */
  @Prop({ required: true, min: 0, default: 0 })
  taxableEarnings: number;

  // ── INSURANCE (employee portion) ───────────────────────────────────────

  /** Contribution base used for insurance calculations (capped at 52,200,000 VND). */
  @Prop({ required: true, min: 0, default: 0 })
  contributionBase: number;

  /** BHXH employee contribution rate (default 0.08 = 8%). */
  @Prop({ required: true, min: 0, max: 1, default: 0.08 })
  socialInsuranceRate: number;

  /** BHYT employee contribution rate (default 0.015 = 1.5%). */
  @Prop({ required: true, min: 0, max: 1, default: 0.015 })
  healthInsuranceRate: number;

  /** BHTN employee contribution rate (default 0.01 = 1%). */
  @Prop({ required: true, min: 0, max: 1, default: 0.01 })
  unemploymentInsuranceRate: number;

  /** BHXH employee contribution (8% of contributionBase). */
  @Prop({ required: true, min: 0, default: 0 })
  socialInsurance: number;

  /** BHYT employee contribution (1.5% of contributionBase). */
  @Prop({ required: true, min: 0, default: 0 })
  healthInsurance: number;

  /** BHTN employee contribution (1% of contributionBase). */
  @Prop({ required: true, min: 0, default: 0 })
  unemploymentInsurance: number;

  // ── PIT DEDUCTIONS ─────────────────────────────────────────────────────

  /** Personal deduction standard (11,000,000 VND). */
  @Prop({ required: true, min: 0, default: 11000000 })
  personalDeduction: number;

  /** Dependent deduction total (6,200,000 × count). */
  @Prop({ required: true, min: 0, default: 0 })
  dependentDeduction: number;

  /** Calculated PIT amount. */
  @Prop({ required: true, min: 0, default: 0 })
  pitAmount: number;

  // ── OTHER DEDUCTIONS ───────────────────────────────────────────────────

  /** Other deductions (loans, penalties, etc.). */
  @Prop({ required: true, min: 0, default: 0 })
  otherDeductions: number;

  // ── NET SALARY ─────────────────────────────────────────────────────────

  /** Final take-home pay = gross - all deductions. */
  @Prop({ required: true, min: 0, default: 0 })
  netSalary: number;

  // ── EARNING BREAKDOWN (embedded array) ─────────────────────────────────

  /** Detailed list of each earning component. */
  @Prop({ type: [], default: [] })
  earningBreakdown: Array<{
    type: string; // BASE_SALARY, ALLOWANCE, ATTENDANCE_BONUS, OVERTIME
    label: string;
    amount: number;
    taxable: boolean;
  }>;

  // ── ALLOWANCE BREAKDOWN (detailed per-type) ────────────────────────────

  /** Individual allowance items with types and amounts. */
  @Prop({ type: [], default: [] })
  allowanceBreakdown: Array<{
    type: string; // MEAL, PHONE, HOUSING, TRANSPORT, etc.
    label: string;
    amount: number;
    taxable: boolean;
  }>;

  // ── OT BREAKDOWN (detailed overtime calculation) ───────────────────────

  /** Detailed overtime breakdown with hours, rates, and tax split. */
  @Prop({ type: Object })
  otBreakdown?: {
    totalMinutes: number;
    workingDayMinutes: number;
    weeklyOffMinutes: number;
    publicHolidayMinutes: number;
    hourlyRate: number;
    otNonTaxable: number; // Phần không chịu thuế (hệ số 1.0)
    otTaxable: number; // Phần chịu thuế (hệ số 0.5)
    otPay: number; // Tổng OT nhận
    breakdown: Array<{
      type: string; // WORKING_DAY, WEEKLY_OFF, PUBLIC_HOLIDAY
      minutes: number;
      coefficient: number;
      amount: number;
      taxable: boolean;
    }>;
  };

  // ── DEDUCTION BREAKDOWN (embedded array) ───────────────────────────────

  /** Detailed list of each deduction component. */
  @Prop({ type: [], default: [] })
  deductionBreakdown: Array<{
    type: string; // SOCIAL_INSURANCE, HEALTH_INSURANCE, UNEMPLOYMENT_INSURANCE, PIT, OTHER
    label: string;
    amount: number;
  }>;

  // ── PIT BREAKDOWN (progressive tax brackets) ───────────────────────────

  /** Progressive tax calculation breakdown by bracket. */
  @Prop({ type: [], default: [] })
  pitBreakdown: Array<{
    bracket: number;
    income: number;
    rate: number;
    tax: number;
  }>;

  // ── DEPENDENTS SNAPSHOT (frozen at generation) ─────────────────────────

  /** Dependents as they were when payslip was generated. */
  @Prop({ type: [], default: [] })
  dependents: Array<{
    fullName: string;
    relationship: string;
    birthDate: Date;
  }>;

  // ── TIMESTAMP ──────────────────────────────────────────────────────────

  @Prop()
  generatedAt: Date;

  @Prop()
  releasedAt: Date;

  @Prop()
  viewedAt: Date;
}

export const PayslipSchema = SchemaFactory.createForClass(Payslip);

// Indexes
PayslipSchema.index({ payrollRunId: 1, employeeProfileId: 1 }, { unique: true });
PayslipSchema.index({ organizationId: 1, employeeProfileId: 1, status: 1 });
PayslipSchema.index({ organizationId: 1, periodLabel: 1, status: 1 });
