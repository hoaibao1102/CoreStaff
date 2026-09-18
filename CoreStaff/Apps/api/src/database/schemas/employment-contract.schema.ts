import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ContractStatus, ContractType } from './enums';

export type EmploymentContractDocument = HydratedDocument<EmploymentContract>;

/**
 * TASK-028 / SRS §30A.2. A contract lives in its own growing collection (SRS
 * §23.2:2216) — never embedded in EmployeeProfile. `employeeProfileId` points at
 * the HR business record; the owner's display name is resolved via a profile →
 * user join in `EmploymentContractService.enrich`.
 *
 * `status` is stored, HR-managed (DRAFT → ACTIVE → …). `EXPIRING_SOON` is never
 * stored trailing: it is derived on-read by `computeExpiryWarning`.
 */
@Schema({ collection: 'employment_contracts', timestamps: true })
export class EmploymentContract {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true, index: true })
  employeeProfileId: string;

  @Prop({ required: true, enum: Object.values(ContractType) })
  contractType: ContractType;

  /** Default DRAFT — HR starts a contract as a draft and ACTIVEs it deliberately. */
  @Prop({ required: true, enum: Object.values(ContractStatus), default: ContractStatus.DRAFT })
  status: ContractStatus;

  @Prop({ required: true, type: Date })
  effectiveDate: Date;

  /** Required for PROBATION/FIXED_TERM; forbidden for INDEFINITE_TERM (service rule). */
  @Prop({ required: false, type: Date })
  expiryDate?: Date;

  /** Set on TERMINATED transition (= the termination effectiveDate). */
  @Prop({ required: false, type: Date })
  endDate?: Date;

  /** HR-supplied reason for the latest status change (TASK-030). Overwritten each transition. */
  @Prop({ required: false, maxlength: 500 })
  statusReason?: string;

  /** Server time of the latest status change. */
  @Prop({ required: false, type: Date })
  statusChangedAt?: Date;

  @Prop({ required: false, maxlength: 1000 })
  note?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const EmploymentContractSchema = SchemaFactory.createForClass(EmploymentContract);

// Tenant-scoped lookups (SRS §23.2, AC-CONTRACT-01). No unique index — an
// employee may hold multiple contracts over time (renewals, rehires).
EmploymentContractSchema.index({ organizationId: 1, employeeProfileId: 1 });
EmploymentContractSchema.index({ organizationId: 1, status: 1 });