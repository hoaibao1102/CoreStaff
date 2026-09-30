import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InsuranceProfileDocument = HydratedDocument<InsuranceProfile>;

/**
 * TASK-038. UNLIKE SalaryProfile/InsurancePolicy, the SRS never gives
 * InsuranceProfile a field list — it is named only in §30F/§2674 as a data
 * model entry. Every field below is an engineering proposal (per the
 * 2026-09-22 scope decision, see DOCS_DECISION_LOG.md), not a documented
 * requirement, pending HR/legal sign-off before real rates are seeded.
 *
 * Modeled symmetric to TaxProfile (§30D.4): InsuranceProfile is the
 * per-employee *participation* record; InsurancePolicy (§30D.3) is the
 * org-wide rate/base/cap engine. `insuranceSalary` itself lives on
 * SalaryProfile (§30D.1), not duplicated here.
 *
 * §30A.3: "Trạng thái thử việc không tự quyết định nghĩa vụ bảo hiểm...
 * engine dùng Contract, InsuranceProfile và TaxProfile có hiệu lực" — so
 * participation is never derived from EmploymentContract.contractType or
 * EmployeeProfile.employmentStatus.
 *
 * **Cập nhật (D40, 2026-09-28):** BHXH/BHYT/BHTN là nghĩa vụ bắt buộc theo
 * pháp luật lao động hiện hành đối với người lao động có hợp đồng lao động
 * (Luật BHXH 2024, Luật Việc làm 2025, Luật BHYT) — không phải một lựa chọn
 * tự do của HR. Ba field `participates*` do đó default `true`, không phải
 * `false` như bản trước. Field vẫn giữ dạng boolean (không xoá) để còn chỗ
 * ghi nhận các trường hợp miễn trừ hợp pháp hiếm gặp (đã hưởng lương hưu,
 * lao động nước ngoài theo hiệp định song phương…) qua API trực tiếp kèm
 * `note`, không phải qua checkbox trên UI tạo hồ sơ — xem
 * `InsuranceProfileCreateDialog` (web) đã bỏ 3 checkbox, luôn gửi `true`.
 * Ngưỡng thời hạn hợp đồng để đủ điều kiện bắt buộc (ví dụ BHXH/BHYT ≥1
 * tháng, BHTN theo Luật Việc làm 2025) **không** được suy luận tự động ở
 * đây — vẫn đúng tinh thần §30A.3, tránh trùng logic với
 * `hr/employment-contract` của team; HR vẫn là người xác nhận tường minh
 * từng giai đoạn hiệu lực.
 *
 * One document per effective period, immutable once created (no update/delete
 * endpoint) — same versioning pattern as SalaryProfile.
 */
@Schema({ collection: 'insurance_profiles', timestamps: true })
export class InsuranceProfile {
	@Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
	organizationId: string;

	@Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true, index: true })
	employeeId: string;

	@Prop({ required: true, type: Date })
	effectiveFrom: Date;

	@Prop({ required: false, type: Date })
	effectiveTo?: Date;

	@Prop({ required: true, default: true })
	participatesSocialInsurance: boolean;

	@Prop({ required: true, default: true })
	participatesHealthInsurance: boolean;

	@Prop({ required: true, default: true })
	participatesUnemploymentInsurance: boolean;

	/** Free-text HR justification when a flag above is false — not a fixed taxonomy (none is documented). */
	@Prop({ required: false })
	note?: string;

	@Prop({ required: true, default: 1, min: 1 })
	version: number;

	@Prop({ type: 'ObjectId', ref: 'User', required: false })
	createdBy?: string;

	@Prop()
	createdAt?: Date;

	@Prop()
	updatedAt?: Date;
}

export const InsuranceProfileSchema = SchemaFactory.createForClass(InsuranceProfile);

InsuranceProfileSchema.index({ organizationId: 1, employeeId: 1, effectiveFrom: 1 });
