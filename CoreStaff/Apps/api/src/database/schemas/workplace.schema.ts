import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { normalizeCode } from './enums';

export type WorkplaceDocument = HydratedDocument<Workplace>;

/** FR-HRCFG-03: HR-managed, soft-CRUD, tenant-scoped workplace catalog. */
@Schema({ collection: 'workplaces', timestamps: true })
export class Workplace {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId!: string;

  @Prop({ required: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: false })
  address?: string;

  /** Latitude [-90, 90]. */
  @Prop({ required: true })
  latitude!: number;

  /** Longitude [-180, 180]. */
  @Prop({ required: true })
  longitude!: number;

  /** Geofence radius in meters (minimum: 100). */
  @Prop({ required: true })
  allowedRadiusMeters!: number;

  /** Maximum GPS accuracy in meters (minimum: 80). */
  @Prop({ required: true })
  maximumAccuracyMeters!: number;

  /** Soft-CRUD flag — referenced workplaces are deactivated, never hard-deleted. */
  @Prop({ required: true, default: true })
  active!: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const WorkplaceSchema = SchemaFactory.createForClass(Workplace);

// Tenant-scoped uniqueness: workplace code is unique within an Organization.
WorkplaceSchema.index({ organizationId: 1, code: 1 }, { unique: true });

WorkplaceSchema.pre('validate', function (next) {
  if (this.code) {
    this.code = normalizeCode(this.code);
  }
  next();
});
