import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmployeeDocumentDocument = HydratedDocument<EmployeeDocument>;

/**
 * TASK-029 / SRS §23.2:2216 + §30A.2. Metadata row for a privately uploaded
 * employee document (contract scan, ID, etc.). The bytes live in S3 at
 * `storageKey`, never on a public path / never express.static-served. Reads are
 * authorization-gated: HR (tenant-wide) or the owning employee (via `/app`
 * routes, scoped to their own `employeeProfileId`). AC-CONTRACT-01.
 */
@Schema({ collection: 'employee_documents', timestamps: true })
export class EmployeeDocument {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'EmployeeProfile', required: true, index: true })
  employeeProfileId: string;

  /** Optional link to the contract this scan belongs to (TASK-028). */
  @Prop({ type: 'ObjectId', ref: 'EmploymentContract', required: false, index: true })
  contractId?: string;

  /** As uploaded (multer `originalname`) — never used as a filesystem path. */
  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  sizeBytes: number;

  /** S3 key = `${organizationId}/${_id}` — pre-generated `_id` before upload. */
  @Prop({ required: true })
  storageKey: string;

  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  uploadedBy: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const EmployeeDocumentSchema = SchemaFactory.createForClass(EmployeeDocument);

// Tenant-scoped lookups (SRS §23.2, AC-CONTRACT-01).
EmployeeDocumentSchema.index({ organizationId: 1, employeeProfileId: 1 });
EmployeeDocumentSchema.index({ organizationId: 1, contractId: 1 });