import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SalaryProfileDocument = HydratedDocument<SalaryProfile>;

/**
 * TASK-032 / SRS §30D.1 field list, verbatim:
 * "employeeId, effectiveFrom, effectiveTo, baseSalary, insuranceSalary,
 * probationJobSalary, probationAgreedSalary, probationRate,
 * organizationAllowanceIds[], attendanceBonusPolicyId, kpiAmount/score source,
 * currency: VND (MVP only), roundingRule: ROUND_HALF_UP_TO_VND, version."
 *
 * One document per effective period (never mutated in place — a new row is
 * the only way to change pay, so history is exactly the row set). No
 * update/delete endpoint. `organizationAllowanceIds` / `attendanceBonusPolicyId`
 * reference catalogs from TASK-033/034 that do not exist yet in this repo —
 * stored as loose ObjectId refs with no existence check, same as
 * EmployeeProfile.workplaceId before the Workplace module existed.
 */
@Schema({ collection: 'salary_profiles', timestamps: true })
export class SalaryProfile {
	@Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
	organizationId: string;

	@Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true, index: true })
	employeeId: string;

	@Prop({ required: true, type: Date })
	effectiveFrom: Date;

	@Prop({ required: false, type: Date })
	effectiveTo?: Date;

	@Prop({ required: true, min: 0 })
	baseSalary: number;

	/** Contribution base for BHXH/BHYT/BHTN (AC-INS-01) — deliberately not derived from baseSalary. */
	@Prop({ required: true, min: 0 })
	insuranceSalary: number;

	@Prop({ required: false, min: 0 })
	probationJobSalary?: number;

	@Prop({ required: false, min: 0 })
	probationAgreedSalary?: number;

	@Prop({ required: false, min: 0, max: 1 })
	probationRate?: number;

	@Prop({ type: ['ObjectId'], ref: 'OrganizationAllowance', required: false, default: [] })
	organizationAllowanceIds?: string[];

	@Prop({ type: 'ObjectId', ref: 'AttendanceBonusPolicy', required: false })
	attendanceBonusPolicyId?: string;

	@Prop({ required: false, min: 0 })
	kpiAmount?: number;

	/** MVP-only value (§30D.1: "currency: VND (MVP only)"). */
	@Prop({ required: true, enum: ['VND'], default: 'VND' })
	currency: 'VND';

	@Prop({ required: true, enum: ['ROUND_HALF_UP_TO_VND'], default: 'ROUND_HALF_UP_TO_VND' })
	roundingRule: 'ROUND_HALF_UP_TO_VND';

	@Prop({ required: true, default: 1, min: 1 })
	version: number;

	@Prop({ type: 'ObjectId', ref: 'User', required: false })
	createdBy?: string;

	@Prop()
	createdAt?: Date;

	@Prop()
	updatedAt?: Date;
}

export const SalaryProfileSchema = SchemaFactory.createForClass(SalaryProfile);

SalaryProfileSchema.index({ organizationId: 1, employeeId: 1, effectiveFrom: 1 });
