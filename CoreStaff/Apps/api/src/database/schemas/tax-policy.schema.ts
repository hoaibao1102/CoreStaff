import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TaxPolicyDocument = HydratedDocument<TaxPolicy>;

/**
 * TASK-041 — Organization-wide tax policy for PIT (Thuế TNCN) calculation.
 *
 * Contains progressive tax brackets, personal/dependent deductions.
 * Each document is one effective period, immutable once created (no update/delete endpoint)
 * — same versioning pattern as LaborCompliancePolicy / OvertimePayPolicy.
 *
 * Key fields:
 * - personalDeduction: 15,500,000 VND/month (self deduction)
 * - dependentDeduction: 6,200,000 VND/month per dependent
 * - progressiveBrackets: 5-tier Vietnam tax brackets
 */
@Schema({ collection: 'tax_policies', timestamps: true })
export class TaxPolicy {
	@Prop({ type: 'ObjectId', ref: 'Organization', required: true })
	organizationId: string;

	@Prop({ required: true, type: Date })
	effectiveFrom: Date;

	@Prop({ type: Date })
	effectiveTo?: Date;

	/** Personal deduction: 15,500,000 VND/month */
	@Prop({ required: true, min: 0 })
	personalDeduction: number;

	/** Dependent deduction: 6,200,000 VND/month per dependent */
	@Prop({ required: true, min: 0 })
	dependentDeduction: number;

	/** Progressive tax brackets (Vietnam 5-tier) */
	@Prop({ type: [], required: true })
	progressiveBrackets: TaxBracket[];

	/** Rounding rule */
	@Prop({ required: true, default: 'ROUND_HALF_UP_TO_VND' })
	roundingRule: string;

	/** Legal reference document */
	@Prop({ required: true, trim: true })
	legalReference: string;

	@Prop({ required: true, min: 1, default: 1 })
	version: number;

	@Prop({ required: true, default: true })
	active: boolean;
}

export interface TaxBracket {
	upperLimit: number;   // Monthly threshold (VND)
	rate: number;         // Tax rate (%)
}

export const TaxPolicySchema = SchemaFactory.createForClass(TaxPolicy);
TaxPolicySchema.index({ organizationId: 1, effectiveFrom: -1 });
