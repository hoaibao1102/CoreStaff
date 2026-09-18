import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ShiftTemplateDocument = HydratedDocument<ShiftTemplate>;

/** FR-SCH-01: One shift template per workplace, soft-CRUD, tenant-scoped. */
@Schema({ collection: 'shift_templates', timestamps: true })
export class ShiftTemplate {
	@Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
	organizationId: string;

	@Prop({ type: 'ObjectId', ref: 'Workplace', required: true, index: true })
	workplaceId: string;

	@Prop({ required: true })
	startTime: string; // HH:mm format (e.g., "08:00")

	@Prop({ required: true })
	endTime: string; // HH:mm format (e.g., "17:00")

	@Prop({ required: true, default: 60 })
	breakMinutes: number; // break duration in minutes

	@Prop({ required: true, default: 5 })
	gracePeriodMinutes: number; // grace period for late arrival in minutes

	/** Soft-CRUD flag — referenced shift templates are deactivated, never hard-deleted. */
	@Prop({ required: true, default: true })
	active: boolean;

	@Prop()
	createdAt?: Date;

	@Prop()
	updatedAt?: Date;
}

export const ShiftTemplateSchema = SchemaFactory.createForClass(ShiftTemplate);

// One active shift template per workplace (tenant-scoped).
ShiftTemplateSchema.index({ organizationId: 1, workplaceId: 1 }, { unique: true });
