import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmployeeAssignmentDocument = HydratedDocument<EmployeeAssignment>;

/** FR-HRCFG-04: Time-bound assignment linking User to Department/Workplace/Shift. */
@Schema({ collection: 'assignments', timestamps: true })
export class EmployeeAssignment {
	@Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
	organizationId: string;

	@Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
	userId!: string;

	@Prop({ type: 'ObjectId', ref: 'Department', required: true, index: true })
	departmentId!: string;

	@Prop({ type: 'ObjectId', ref: 'Workplace', required: false, index: true })
	workplaceId?: string;

	/** Resolved from workplace.defaultShiftTemplateId at assignment creation time. Optional for backward compatibility. */
	@Prop({ type: 'ObjectId', ref: 'ShiftTemplate', required: false })
	shiftTemplateId?: string;

	/** Assignment effective start date (ISO string). */
	@Prop({ required: false })
	effectiveFrom?: string;

	/** Assignment effective end date (ISO string, nullable for ongoing). */
	@Prop({ required: false })
	effectiveTo?: string;

	/** Soft-CRUD flag — referenced assignments are deactivated, never hard-deleted. */
	@Prop({ required: true, default: true })
	active: boolean;

	@Prop()
	createdAt?: Date;

	@Prop()
	updatedAt?: Date;
}

export const EmployeeAssignmentSchema = SchemaFactory.createForClass(EmployeeAssignment);

// Historical assignments are allowed. Overlap protection is enforced by the
// service because the date range is part of the business rule.
EmployeeAssignmentSchema.index({ organizationId: 1, userId: 1, departmentId: 1, active: 1 });
