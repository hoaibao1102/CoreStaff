import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { normalizeCode } from './enums';

export type DepartmentDocument = HydratedDocument<Department>;

/** FR-HRCFG-01: HR-managed, soft-CRUD, tenant-scoped department catalog. */
@Schema({ collection: 'departments', timestamps: true })
export class Department {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  /** Soft-CRUD flag — referenced departments are deactivated, never hard-deleted. */
  @Prop({ required: true, default: true })
  active: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

// Tenant-scoped uniqueness: department code is unique within an Organization.
DepartmentSchema.index({ organizationId: 1, code: 1 }, { unique: true });

DepartmentSchema.pre('validate', function (next) {
  if (this.code) {
    this.code = normalizeCode(this.code);
  }
  next();
});
