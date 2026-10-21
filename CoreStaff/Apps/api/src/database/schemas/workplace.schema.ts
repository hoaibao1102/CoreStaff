import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { normalizeCode } from './enums';

export const WorkplaceType = {
  IN_OFFICE: 'IN_OFFICE',
  OUT_OFFICE: 'OUT_OFFICE',
} as const;
export type WorkplaceType = (typeof WorkplaceType)[keyof typeof WorkplaceType];

export type WorkplaceDocument = HydratedDocument<Workplace>;

export interface WorkplaceNetworkRule {
  label?: string;
  cidrOrIp: string;
  active: boolean;
}

/** FR-HRCFG-03: HR-managed, soft-CRUD, tenant-scoped workplace catalog. */
@Schema({ collection: 'workplaces', timestamps: true })
export class Workplace {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId!: string;

  @Prop({ required: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: Object.values(WorkplaceType), default: WorkplaceType.IN_OFFICE })
  type!: WorkplaceType;

  @Prop({ required: false })
  address?: string;

  /** Latitude [-90, 90]. */
  @Prop({ required: false, default: 0 })
  latitude!: number;

  /** Longitude [-180, 180]. */
  @Prop({ required: false, default: 0 })
  longitude!: number;

  /** Geofence radius in meters (minimum: 100 for IN_OFFICE). */
  @Prop({ required: false, default: 0 })
  allowedRadiusMeters!: number;

  /** Maximum GPS accuracy in meters (minimum: 80 for IN_OFFICE). */
  @Prop({ required: false, default: 0 })
  maximumAccuracyMeters!: number;

  /** Trusted office IPs/CIDRs used by the network attendance method. */
  @Prop({
    type: [{ label: { type: String }, cidrOrIp: { type: String, required: true }, active: { type: Boolean, default: true } }],
    default: [],
    _id: false,
  })
  allowedNetworks!: WorkplaceNetworkRule[];

  @Prop({ required: true, default: true })
  allowNetworkAttendance!: boolean;

  @Prop({ required: true, default: true })
  allowGpsAttendance!: boolean;

  @Prop({ required: true, default: true })
  allowSelfieFallback!: boolean;

  /** Optional default used when HR creates an assignment for this workplace. */
  @Prop({ type: 'ObjectId', ref: 'ShiftTemplate', required: false })
  defaultShiftTemplateId?: string;

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
