import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EmploymentStatus, EmploymentType, Gender, normalizeEmployeeCode } from './enums';

export type EmployeeProfileDocument = HydratedDocument<EmployeeProfile>;

/**
 * DependentItem — người phụ thuộc của nhân viên.
 * Lưu trực tiếp trong EmployeeProfile, không có effective-dating riêng.
 * KHÔNG XÓA — soft-delete bằng cách set `active = false` để giữ audit trail
 * cho payroll history. `version` tăng mỗi lần update.
 */
@Schema({ _id: true, timestamps: false })
export class DependentItem {
  /** Auto-assigned Mongo _id của subdocument — dùng cho route /dependents/:id. */
  @Prop({ type: Types.ObjectId, auto: true })
  _id?: Types.ObjectId;

  @Prop({ required: true })
  fullName: string;

  /** Ngày sinh (YYYY-MM-DD) — bắt buộc, không được ở tương lai (rule DOB_FUTURE_DATE). */
  @Prop({ required: true })
  dateOfBirth: string;

  @Prop({ required: false })
  idCardNumber?: string;

  /** Quan hệ với nhân viên — CHILD/SPOUSE/PARENT/SIBLING, v.v. */
  @Prop({ required: true })
  relationship: string;

  /** Người phụ thuộc khuyên tật → áp dụng mức giảm trừ cao hơn (Luật Thuế TNCN). */
  @Prop({ required: true, default: false })
  isDisabled: boolean;

  /** ACTIVE = đang tính giảm trừ, INACTIVE = đã hết hiệu lực (deprecated). */
  @Prop({ required: true, default: true })
  active: boolean;

  /** Audit status tương thích ngược với code cũ (status ACTIVE/INACTIVE). */
  @Prop({ required: true, default: 'ACTIVE' })
  status: 'ACTIVE' | 'INACTIVE';

  /** Tăng mỗi lần update để hỗ trợ optimistic concurrency. */
  @Prop({ required: true, default: 1, min: 1 })
  version: number;
}

export const DependentItemSchema = SchemaFactory.createForClass(DependentItem);

/**
 * TASK-020 / SRS §15.2A. `User` is the auth identity; `EmployeeProfile` is the
 * HR business record — separate collections linked by `userId` (§30A.2).
 */
@Schema({ collection: 'employee_profiles', timestamps: true })
export class EmployeeProfile {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true })
  organizationId: string;

  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  userId: string;

  /** Sole owner of the identifier across the tenant (SRS §15.2A, TASK-120). */
  @Prop({ required: true })
  employeeCode: string;

  @Prop({ required: true, enum: Object.values(EmploymentType), default: EmploymentType.FULL_TIME })
  employmentType: EmploymentType;

  /** SRS §176: PROBATION/ACTIVE/ON_LEAVE = working; RESIGNED/TERMINATED = terminal history. */
  @Prop({ required: true, enum: Object.values(EmploymentStatus), default: EmploymentStatus.PROBATION })
  employmentStatus: EmploymentStatus;

  /** List of dependents (người phụ thuộc) — stored directly in employee profile. */
  @Prop({ type: [DependentItemSchema], default: [] })
  dependents?: DependentItem[];

  @Prop({ required: false, type: Date })
  dateOfBirth?: Date;

  @Prop({ required: false, enum: Object.values(Gender) })
  gender?: Gender;

  @Prop({ required: false })
  phone?: string;

  @Prop({ required: false })
  email?: string;

  @Prop({ required: false })
  address?: string;

  citizenId?: string;

  @Prop({ required: false })
  taxCode?: string;

  @Prop({ required: false })
  socialInsuranceCode?: string;

  @Prop({ required: false })
  bankAccount?: string;

  @Prop({ type: 'ObjectId', ref: 'Department', required: false, index: true })
  departmentId?: string;

  @Prop({ type: 'ObjectId', ref: 'Position', required: false, index: true })
  positionId?: string;

  @Prop({ type: 'ObjectId', ref: 'User', required: false, index: true })
  directManagerId?: string;

  /** Workplace catalog is out of this scope's tasks — stored for the future FK only. */
  @Prop({ type: 'ObjectId', ref: 'Workplace', required: false })
  workplaceId?: string;

  @Prop({ required: true, type: Date })
  joinDate: Date;

  @Prop({ required: false, type: Date })
  endDate?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const EmployeeProfileSchema = SchemaFactory.createForClass(EmployeeProfile);

// Tenant-scoped uniqueness (SRS §15.2A).
EmployeeProfileSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
EmployeeProfileSchema.index({ organizationId: 1, employeeCode: 1 }, { unique: true });
EmployeeProfileSchema.index({ organizationId: 1, employmentStatus: 1 });

EmployeeProfileSchema.pre('validate', function (next) {
  if (this.employeeCode) {
    this.employeeCode = normalizeEmployeeCode(this.employeeCode);
  }
  next();
});
