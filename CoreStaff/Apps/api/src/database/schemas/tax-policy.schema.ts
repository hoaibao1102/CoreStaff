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
 * - standardDeduction: 11,000,000 VND/month (self deduction, 2026 Vietnam rate)
 * - personalDeduction: 15,500,000 VND/month (legacy personal deduction)
 * - dependentDeduction: 4,400,000 VND/month per dependent
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

	/** Standard (personal) deduction used by the modern PIT pipeline. */
	@Prop({ required: true, min: 0 })
	standardDeduction: number;

	/** Personal deduction: 15,500,000 VND/month (legacy alias of standardDeduction). */
	@Prop({ required: false, min: 0 })
	personalDeduction?: number;

	/** Dependent deduction: 4,400,000 VND/month per dependent (2026 rate). */
	@Prop({ required: true, min: 0 })
	dependentDeduction: number;

	/** Progressive tax brackets (Vietnam 5-tier) */
	@Prop({ type: [], required: true })
	progressiveBrackets: TaxBracket[];

	/** Rounding rule */
	@Prop({ required: true, default: 'ROUND_HALF_UP_TO_VND' })
	roundingRule: string;

	/** Legal reference document */
	@Prop({ required: false, trim: true })
	legalReference?: string;

	/**
	 * Công ty quyết định tiền tăng ca (OT) có chịu PIT không.
	 * false (mặc định) = giữ nguyên cách loại trừ cũ (phần hệ số 1.0 miễn thuế,
	 *                    chỉ phần chênh trên 1.0 chịu thuế).
	 * true            = toàn bộ tiền OT vào thu nhập tính thuế.
	 */
	@Prop({ required: true, default: false })
	overtimeTaxable: boolean;

	@Prop({ required: true, min: 1, default: 1 })
	version: number;

	@Prop({ required: true, default: true })
	active: boolean;
}

export interface TaxBracket {
	upperLimit: number | null; // Monthly threshold (null = unbounded last tier)
	rate: number;         // Tax rate (%)
}

export const TaxPolicySchema = SchemaFactory.createForClass(TaxPolicy);
TaxPolicySchema.index({ organizationId: 1, effectiveFrom: -1 });
