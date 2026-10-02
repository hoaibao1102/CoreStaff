import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { normalizeCode } from './enums';

export type PositionDocument = HydratedDocument<Position>;

/**
 * TASK-022: HR-managed, soft-CRUD, tenant-scoped job-title catalog.
 * A position belongs to exactly one Department (SRS §15.3) — HR configures the
 * positions of a department from inside that department, and a position's code
 * is unique within its department only.
 */
@Schema({ collection: 'positions', timestamps: true })
export class Position {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  /** Owning department. Positions never move between departments (see UpdatePositionDto). */
  @Prop({ type: 'ObjectId', ref: 'Department', required: true, index: true })
  departmentId: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  /** Soft-CRUD flag — referenced positions are deactivated, never hard-deleted. */
  @Prop({ required: true, default: true })
  active: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PositionSchema = SchemaFactory.createForClass(Position);

// Department-scoped uniqueness: a position code is unique within its department.
PositionSchema.index({ organizationId: 1, departmentId: 1, code: 1 }, { unique: true });

PositionSchema.pre('validate', function (next) {
  if (this.code) {
    this.code = normalizeCode(this.code);
  }
  next();
});
