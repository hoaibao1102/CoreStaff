import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { BonusCondition, BonusTier } from '../../hr/compensation/compensation-domain';

export const KpiStatus = { DRAFT: 'DRAFT', CONFIRMED: 'CONFIRMED' } as const;
export type KpiStatus = (typeof KpiStatus)[keyof typeof KpiStatus];
export const KpiSource = { MANUAL: 'MANUAL', IMPORT: 'IMPORT' } as const;
export type KpiSource = (typeof KpiSource)[keyof typeof KpiSource];

/**
 * TASK-036 / SRS §30B.1 — tenant labor-compliance policy, effective-dated and
 * versioned. All limit/rate values are seed configuration (SRS §30B.1:2516) and
 * are never hard-coded in calculation services. Vietnam seed: 8h/day, 48h/week;
 * combined normal + OT capped per policy with monthly/annual OT checked against
 * their own limits (AC-LABOR-01).
 */
@Schema({ collection: 'labor_compliance_policies', timestamps: true })
export class LaborCompliancePolicy {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true }) organizationId: string;
  @Prop({ required: true, type: Date }) effectiveFrom: Date;
  @Prop({ type: Date }) effectiveTo?: Date;
  @Prop({ required: true, min: 0 }) normalDailyMinutes: number;
  @Prop({ required: true, min: 0 }) normalWeeklyMinutes: number;
  @Prop({ required: true, min: 0 }) maxCombinedDailyMinutes: number;
  @Prop({ required: true, min: 0 }) maxMonthlyOvertimeMinutes: number;
  @Prop({ required: true, min: 0 }) maxAnnualOvertimeMinutes: number;
  @Prop({ required: true, min: 0 }) exceptionalAnnualOvertimeMinutes: number;
  /** Below this % of a limit the engine treats usage as normal; at/above it warns. */
  @Prop({ required: true, min: 0, max: 100 }) warningThresholdPercent: number;
  @Prop({ required: true, min: 0.01, max: 1 }) probationMinimumRate: number;
  @Prop({ required: true, trim: true }) legalReference: string;
  @Prop({ required: true, min: 1, default: 1 }) version: number;
  @Prop({ required: true, default: true }) active: boolean;
}
export const LaborCompliancePolicySchema = SchemaFactory.createForClass(LaborCompliancePolicy);
LaborCompliancePolicySchema.index({ organizationId: 1, effectiveFrom: -1 });

/** OT categories backend derives from the Calendar (§30D.2:2610). No OT_SUNDAY. */
export const OvertimeType = {
  WORKING_DAY: 'OT_WORKING_DAY',
  WEEKLY_OFF: 'OT_WEEKLY_OFF',
  PUBLIC_HOLIDAY: 'OT_PUBLIC_HOLIDAY',
} as const;
export type OvertimeType = (typeof OvertimeType)[keyof typeof OvertimeType];

/**
 * TASK-037 / SRS §30D.2 — overtime pay rates, effective-dated and versioned.
 * Rates are multipliers (e.g. 1.5 = +150% for OTPay per overtime minute).
 * Referential seed values: 150%/200%/300% — kept solely in seed configuration,
 * never hard-coded in a service. Public-holiday rule (avoid double counting a
 * weekly-off that is also a public holiday) is enforced by the rate resolver
 * (AC-OT-PAY-01).
 */
@Schema({ collection: 'overtime_pay_policies', timestamps: true })
export class OvertimePayPolicy {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true }) organizationId: string;
  @Prop({ required: true, type: Date }) effectiveFrom: Date;
  @Prop({ type: Date }) effectiveTo?: Date;
  @Prop({ required: true, min: 0 }) workingDayRate: number;
  @Prop({ required: true, min: 0 }) weeklyOffRate: number;
  @Prop({ required: true, min: 0 }) publicHolidayRate: number;
  @Prop({ required: true, trim: true }) legalReference: string;
  @Prop({ required: true, min: 1, default: 1 }) version: number;
  @Prop({ required: true, default: true }) active: boolean;
}
export type OvertimePayPolicyDocument = HydratedDocument<OvertimePayPolicy>;
export const OvertimePayPolicySchema = SchemaFactory.createForClass(OvertimePayPolicy);
OvertimePayPolicySchema.index({ organizationId: 1, effectiveFrom: -1 });

@Schema({ collection: 'salary_profiles', timestamps: true })
export class SalaryProfile {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true }) organizationId: string;
  @Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true }) employeeProfileId: string;
  @Prop({ required: true, type: Date }) effectiveFrom: Date;
  @Prop({ type: Date }) effectiveTo?: Date;
  @Prop({ required: true, min: 0 }) baseSalary: number;
  @Prop({ required: true, min: 0 }) insuranceSalary: number;
  @Prop({ min: 1 }) probationJobSalary?: number;
  @Prop({ min: 1 }) probationAgreedSalary?: number;
  @Prop({ min: 0, max: 1 }) probationRate?: number;
  @Prop({ type: ['ObjectId'], ref: 'OrganizationAllowance', default: [] }) organizationAllowanceIds: string[];
  @Prop({ type: 'ObjectId', ref: 'AttendanceBonusPolicy' }) attendanceBonusPolicyId?: string;
  @Prop({ required: true, enum: ['VND'], default: 'VND' }) currency: 'VND';
  @Prop({ required: true, enum: ['ROUND_HALF_UP_TO_VND'], default: 'ROUND_HALF_UP_TO_VND' }) roundingRule: string;
  @Prop({ required: true, min: 1, default: 1 }) version: number;
  @Prop({ required: true, default: true }) active: boolean;
}
export type SalaryProfileDocument = HydratedDocument<SalaryProfile>;
export const SalaryProfileSchema = SchemaFactory.createForClass(SalaryProfile);
SalaryProfileSchema.index({ organizationId: 1, employeeProfileId: 1, effectiveFrom: -1 });

@Schema({ collection: 'allowance_catalog', timestamps: true })
export class AllowanceCatalog {
  @Prop({ required: true, trim: true, uppercase: true }) code: string;
  @Prop({ required: true }) defaultName: string;
  @Prop({ required: true, default: true }) defaultTaxable: boolean;
  @Prop({ required: true, default: false }) defaultInsuranceBased: boolean;
  @Prop({ required: true, default: true }) active: boolean;
}
export const AllowanceCatalogSchema = SchemaFactory.createForClass(AllowanceCatalog);
AllowanceCatalogSchema.index({ code: 1 }, { unique: true });

@Schema({ collection: 'organization_allowances', timestamps: true })
export class OrganizationAllowance {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true }) organizationId: string;
  @Prop({ type: 'ObjectId', ref: 'AllowanceCatalog' }) catalogId?: string;
  @Prop({ required: true, trim: true, uppercase: true }) code: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true, min: 0 }) amount: number;
  @Prop({ required: true }) taxable: boolean;
  @Prop({ required: true }) insuranceBased: boolean;
  @Prop({ required: true, default: false }) prorated: boolean;
  @Prop({ required: true, type: Date }) effectiveFrom: Date;
  @Prop({ type: Date }) effectiveTo?: Date;
  @Prop({ required: true, min: 1, default: 1 }) version: number;
  @Prop({ required: true, default: true }) active: boolean;
}
export const OrganizationAllowanceSchema = SchemaFactory.createForClass(OrganizationAllowance);
OrganizationAllowanceSchema.index({ organizationId: 1, code: 1 }, { unique: true });
OrganizationAllowanceSchema.index({ organizationId: 1, effectiveFrom: -1 });

@Schema({ collection: 'attendance_bonus_templates', timestamps: true })
export class AttendanceBonusTemplate {
  @Prop({ required: true, trim: true, uppercase: true }) code: string;
  @Prop({ required: true }) name: string;
  @Prop({ type: Array, required: true }) tiers: BonusTier[];
  @Prop({ required: true, min: 1, default: 1 }) templateVersion: number;
  @Prop({ required: true, default: true }) active: boolean;
}
export const AttendanceBonusTemplateSchema = SchemaFactory.createForClass(AttendanceBonusTemplate);
AttendanceBonusTemplateSchema.index({ code: 1 }, { unique: true });

@Schema({ collection: 'attendance_bonus_policies', timestamps: true })
export class AttendanceBonusPolicy {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true }) organizationId: string;
  @Prop({ type: 'ObjectId', ref: 'AttendanceBonusTemplate' }) templateId?: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true, enum: ['FIXED_AMOUNT'], default: 'FIXED_AMOUNT' }) calculationBase: string;
  @Prop({ required: true, min: 0 }) bonusAmount: number;
  @Prop({ type: Array, required: true }) tiers: BonusTier[];
  @Prop({ type: Array, default: [] }) conditions: BonusCondition[];
  @Prop({ required: true, type: Date }) effectiveFrom: Date;
  @Prop({ type: Date }) effectiveTo?: Date;
  @Prop({ required: true, min: 1, default: 1 }) version: number;
  @Prop({ required: true, default: true }) active: boolean;
}
export const AttendanceBonusPolicySchema = SchemaFactory.createForClass(AttendanceBonusPolicy);
AttendanceBonusPolicySchema.index({ organizationId: 1, effectiveFrom: -1 });

@Schema({ collection: 'kpi_payroll_inputs', timestamps: true })
export class KpiPayrollInput {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true }) organizationId: string;
  @Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true }) employeeProfileId: string;
  @Prop({ required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }) period: string;
  @Prop({ min: 0 }) score?: number;
  @Prop({ required: true, min: 0 }) amount: number;
  @Prop({ required: true, enum: Object.values(KpiSource), default: KpiSource.MANUAL }) source: KpiSource;
  @Prop({ maxlength: 1000 }) note?: string;
  @Prop({ required: true, enum: Object.values(KpiStatus), default: KpiStatus.DRAFT }) status: KpiStatus;
  @Prop({ required: true, min: 1, default: 1 }) version: number;
  @Prop({ type: Date }) confirmedAt?: Date;
  @Prop({ type: 'ObjectId', ref: 'User' }) confirmedBy?: string;
}
export const KpiPayrollInputSchema = SchemaFactory.createForClass(KpiPayrollInput);
KpiPayrollInputSchema.index({ organizationId: 1, employeeProfileId: 1, period: 1 }, { unique: true });
