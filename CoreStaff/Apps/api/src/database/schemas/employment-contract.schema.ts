import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ContractType } from './enums';

export type EmploymentContractDocument = HydratedDocument<EmploymentContract>;

/**
 * TASK-028 / SRS §30A.2: "Loại hợp đồng: PROBATION | FIXED_TERM | INDEFINITE_TERM";
 * "Quản lý ngày hiệu lực/hết hạn, tài liệu hợp đồng private và lịch sử thay đổi";
 * "Không hard-delete nhân viên/hợp đồng đã phát sinh bảng công hoặc payroll."
 *
 * One document per contract period — renewal creates a new row rather than
 * mutating the old one, which is how "lịch sử thay đổi" is kept without a
 * separate history collection (mirrors the SalaryProfile/InsurancePolicy
 * effective-dating pattern in §30D). There is no update/delete endpoint:
 * corrections are a new contract row, and rows are never removed.
 */
@Schema({ collection: 'employment_contracts', timestamps: true })
export class EmploymentContract {
	@Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
	organizationId: string;

	@Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true, index: true })
	employeeId: string;

	@Prop({ required: true, enum: Object.values(ContractType) })
	contractType: ContractType;

	@Prop({ required: true, type: Date })
	startDate: Date;

	/** Null only for INDEFINITE_TERM. */
	@Prop({ required: false, type: Date })
	endDate?: Date;

	/**
	 * Points at the private contract file (TASK-029 EmployeeDocument, not yet
	 * built) — stored for the future FK only, same pattern as
	 * EmployeeProfile.workplaceId before the Workplace module existed.
	 */
	@Prop({ type: 'ObjectId', ref: 'EmployeeDocument', required: false })
	documentRef?: string;

	@Prop({ type: 'ObjectId', ref: 'User', required: false })
	createdBy?: string;

	@Prop()
	createdAt?: Date;

	@Prop()
	updatedAt?: Date;
}

export const EmploymentContractSchema = SchemaFactory.createForClass(EmploymentContract);

EmploymentContractSchema.index({ organizationId: 1, employeeId: 1, startDate: 1 });
