import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EnterpriseInsuranceCostBearer } from './enums';

export type EnterpriseInsurancePolicyDocument = HydratedDocument<EnterpriseInsurancePolicy>;

/**
 * New module (2026-09-28, see Docs/DOCS_DECISION_LOG.md D40) — added after the
 * user flagged that "bảo hiểm doanh nghiệp" is missing from the InsuranceProfile/
 * InsurancePolicy pair (TASK-038/039), which only cover BHXH/BHYT/BHTN.
 *
 * This is a DIFFERENT legal category from InsurancePolicy: BHXH/BHYT/BHTN are
 * mandatory social insurance under Luật BHXH/BHYT/Việc làm, deducted straight
 * from payroll. `EnterpriseInsurancePolicy` is a VOLUNTARY commercial policy
 * (accident/health, group life, etc.) an employer may buy from an insurer
 * under Luật Kinh doanh bảo hiểm — never mandated by labor law, never
 * regulated with a fixed rate/floor/cap the way InsurancePolicy is. There is
 * no confirmed field-level spec for this in Docs/ (confirmed absent by a
 * repo-wide audit before writing this) — every field below is an engineering
 * proposal, same footing as InsuranceProfile was at TASK-038 (D37): no legal
 * number is hard-coded, `coverageDescription` is free text rather than a
 * fixed taxonomy of coverage types (none is documented), and `provider`/
 * `policyNumber`/`premiumPerEmployee` are optional so HR can record a policy
 * before every commercial detail is finalized.
 *
 * Org-wide, effective-dated, immutable once created — same pattern as
 * InsurancePolicy/InsuranceProfile: corrections are a new version, not an
 * in-place edit.
 */
@Schema({ collection: 'enterprise_insurance_policies', timestamps: true })
export class EnterpriseInsurancePolicy {
	@Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
	organizationId: string;

	@Prop({ required: true, type: Date })
	effectiveFrom: Date;

	@Prop({ required: false, type: Date })
	effectiveTo?: Date;

	@Prop({ required: true, default: 1, min: 1 })
	version: number;

	@Prop({ required: true })
	provider: string;

	@Prop({ required: false })
	policyNumber?: string;

	/** Free text on purpose — no fixed coverage-type taxonomy is documented anywhere in Docs/. */
	@Prop({ required: true })
	coverageDescription: string;

	/** Premium per employee for the effective period. null = not finalized yet. */
	@Prop({ required: false, type: Number, min: 0, default: null })
	premiumPerEmployee?: number | null;

	@Prop({ required: true, enum: Object.values(EnterpriseInsuranceCostBearer) })
	costBearer: EnterpriseInsuranceCostBearer;

	/** Only meaningful when costBearer is EMPLOYEE/SHARED — service rejects a nonzero value under EMPLOYER. */
	@Prop({ required: false, type: Number, min: 0, default: null })
	employeeContributionAmount?: number | null;

	@Prop({ required: false })
	note?: string;

	@Prop({ type: 'ObjectId', ref: 'User', required: false })
	createdBy?: string;

	@Prop()
	createdAt?: Date;

	@Prop()
	updatedAt?: Date;
}

export const EnterpriseInsurancePolicySchema = SchemaFactory.createForClass(EnterpriseInsurancePolicy);

EnterpriseInsurancePolicySchema.index({ organizationId: 1, effectiveFrom: 1 });
