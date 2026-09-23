import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { InsuranceContributionType } from './enums';

export type InsurancePolicyDocument = HydratedDocument<InsurancePolicy>;

/**
 * TASK-039 / SRS §30D.3 field list, verbatim:
 * "effectiveFrom, effectiveTo, version, legalReference,
 * socialInsuranceEmployeeRate, healthInsuranceEmployeeRate,
 * unemploymentInsuranceEmployeeRate, salaryBaseRules và capRules riêng từng
 * khoản, employerContributionRates[]."
 * Seed reference (§30D.3): "BHXH 8%, BHYT 1,5%, BHTN 1%." Hard rule (same
 * section): "Không tính grossSalary × 10,5%; mỗi khoản dùng insuranceSalary,
 * đối tượng áp dụng và trần riêng."
 *
 * The doc names `salaryBaseRules` and `capRules` but never their shape or any
 * cap multiplier / regional minimum-wage value (confirmed absent repo-wide).
 * The per-type array shape below is an engineering proposal — `floorAmount`/
 * `capAmount` default to `null` (no floor/cap enforced) until HR/legal supply
 * real values; nothing here is a seeded legal number. Immutable once created,
 * same as InsuranceProfile/SalaryProfile — corrections are a new version.
 */
@Schema({ collection: 'insurance_policies', timestamps: true })
export class InsurancePolicy {
	@Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
	organizationId: string;

	@Prop({ required: true, type: Date })
	effectiveFrom: Date;

	@Prop({ required: false, type: Date })
	effectiveTo?: Date;

	@Prop({ required: true, default: 1, min: 1 })
	version: number;

	@Prop({ required: true })
	legalReference: string;

	@Prop({ required: true, min: 0, max: 1 })
	socialInsuranceEmployeeRate: number;

	@Prop({ required: true, min: 0, max: 1 })
	healthInsuranceEmployeeRate: number;

	@Prop({ required: true, min: 0, max: 1 })
	unemploymentInsuranceEmployeeRate: number;

	@Prop({
		type: [
			{
				_id: false,
				type: { type: String, enum: Object.values(InsuranceContributionType), required: true },
				floorAmount: { type: Number, min: 0, default: null },
			},
		],
		required: true,
		default: [],
	})
	salaryBaseRules: Array<{ type: InsuranceContributionType; floorAmount: number | null }>;

	@Prop({
		type: [
			{
				_id: false,
				type: { type: String, enum: Object.values(InsuranceContributionType), required: true },
				capAmount: { type: Number, min: 0, default: null },
			},
		],
		required: true,
		default: [],
	})
	capRules: Array<{ type: InsuranceContributionType; capAmount: number | null }>;

	@Prop({
		type: [
			{
				_id: false,
				type: { type: String, enum: Object.values(InsuranceContributionType), required: true },
				rate: { type: Number, min: 0, max: 1, required: true },
			},
		],
		required: true,
		default: [],
	})
	employerContributionRates: Array<{ type: InsuranceContributionType; rate: number }>;

	@Prop({ type: 'ObjectId', ref: 'User', required: false })
	createdBy?: string;

	@Prop()
	createdAt?: Date;

	@Prop()
	updatedAt?: Date;
}

export const InsurancePolicySchema = SchemaFactory.createForClass(InsurancePolicy);

InsurancePolicySchema.index({ organizationId: 1, effectiveFrom: 1 });
