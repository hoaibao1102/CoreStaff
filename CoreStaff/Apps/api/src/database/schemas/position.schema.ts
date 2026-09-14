import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { normalizeCode } from './enums';

export type PositionDocument = HydratedDocument<Position>;

/**
 * TASK-022: HR-managed, soft-CRUD, tenant-scoped job-title catalog.
 * Mirrors the Department pattern (SRS §15.3) — the SRS names `Position` as an
 * EmployeeProfile reference (§15.2A, §2670) without a dedicated ERD block.
 */
@Schema({ collection: 'positions', timestamps: true })
export class Position {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

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

// Tenant-scoped uniqueness: position code is unique within an Organization.
PositionSchema.index({ organizationId: 1, code: 1 }, { unique: true });

PositionSchema.pre('validate', function (next) {
  if (this.code) {
    this.code = normalizeCode(this.code);
  }
  next();
});
