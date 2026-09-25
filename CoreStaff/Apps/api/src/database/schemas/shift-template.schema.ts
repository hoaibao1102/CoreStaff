import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { normalizeCode, ShiftScope } from './enums';

export type ShiftTemplateDocument = HydratedDocument<ShiftTemplate>;

/** FR-SCH-01: One shift template per workplace, soft-CRUD, tenant-scoped. */
@Schema({ collection: 'shift_templates', timestamps: true })
export class ShiftTemplate {
	@Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
	organizationId: string;

	@Prop({ required: true, enum: Object.values(ShiftScope), default: ShiftScope.ORGANIZATION, index: true })
	scope: ShiftScope;

	@Prop({ type: 'ObjectId', ref: 'Department', required: false, index: true })
	departmentId?: string;

	@Prop({ type: [Number], required: true, default: [1, 2, 3, 4, 5] })
	weekdays: number[];

	@Prop({ required: true, default: '2026-01-01' })
	effectiveFrom: string;

	@Prop({ required: false })
	effectiveTo?: string;

	/** New scheduling API identity. Optional only for backward-compatible TASK-024 rows. */
	@Prop({ required: false })
	code?: string;

	@Prop({ required: false, maxlength: 200 })
	name?: string;

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

ShiftTemplateSchema.index({ organizationId: 1, scope: 1, departmentId: 1, active: 1 });
ShiftTemplateSchema.index(
	{ organizationId: 1, code: 1 },
	{ unique: true, partialFilterExpression: { code: { $type: 'string' } } },
);
ShiftTemplateSchema.pre('validate', function (next) {
	if (this.code) this.code = normalizeCode(this.code);
	if (this.name) this.name = this.name.trim();
	next();
});
