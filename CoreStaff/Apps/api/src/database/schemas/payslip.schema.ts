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

  /** §2 — Thu nhập chịu thuế TRƯỚC giảm trừ = gross − OT miễn thuế − phụ cấp miễn thuế. */
  @Prop({ required: true, min: 0, default: 0 })
  taxableIncome: number;

  /** §3 — Thu nhập TÍNH thuế = taxableIncome − bảo hiểm − giảm trừ bản thân − giảm trừ người phụ thuộc. */
  @Prop({ required: true, min: 0, default: 0 })
  taxableEarnings: number;

  // ── WORKDAY INPUTS (frozen from snapshot, dùng để hiện chi tiết lương công) ──

  /** Lương cơ bản theo hợp đồng (chưa chia ngày công). */
  @Prop({ required: true, min: 0, default: 0 })
  monthlyBaseSalary: number;

  /** Số ngày công chuẩn của kỳ. */
  @Prop({ required: true, min: 0, default: 0 })
  standardWorkingDays: number;

  /** Số ngày công thực tế được trả lương. */
  @Prop({ required: true, min: 0, default: 0 })
  payableWorkingDays: number;

  /** Tiền công 1 giờ = monthlyBaseSalary / (standardWorkingDays × 8). */
  @Prop({ required: true, min: 0, default: 0 })
  hourlyRate: number;

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

  /** Personal deduction standard (defaults to PitService.STANDARD_DEDUCTION = 15,500,000 VND). */
  @Prop({ required: true, min: 0, default: 15500000 })
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

  /** Detailed overtime breakdown: hours × hourly rate × coefficient per day type. */
  @Prop({ type: Object })
  otBreakdown?: {
    totalMinutes: number;
    totalHours?: number;
    workingDayMinutes: number;
    workingDayHours?: number;
    weeklyOffMinutes: number;
    weeklyOffHours?: number;
    publicHolidayMinutes: number;
    publicHolidayHours?: number;
    hourlyRate: number;
    overtimeTaxable?: boolean; // Cờ công ty: true = toàn bộ OT chịu thuế
    otPay: number; // Tổng OT nhận
    breakdown: Array<{
      type: string; // WORKING_DAY, WEEKLY_OFF, PUBLIC_HOLIDAY
      label?: string;
      minutes: number;
      hours?: number;
      coefficient: number;
      amount: number;
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
