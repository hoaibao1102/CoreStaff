import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { normalizeCode, normalizeEmail, Role, UserStatus } from './enums';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', timestamps: true })
export class User {
  /** Null only for platform-local SYSTEM_ADMIN accounts. */
  @Prop({ type: 'ObjectId', ref: 'Organization', required: false, index: true })
  organizationId?: string;

  @Prop({ required: true })
  email: string;

  /** Lowercased/trimmed email used for case-insensitive tenant uniqueness. */
  @Prop({ required: true })
  emailN: string;

  /** Null only for platform-local SYSTEM_ADMIN accounts. */
  @Prop({ required: false })
  employeeCode?: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: false })
  phone?: string;

  @Prop({ required: false })
  avatarUrl?: string;

  @Prop({ required: true, enum: Object.values(Role) })
  role: Role;

  @Prop({ required: true, enum: Object.values(UserStatus), default: UserStatus.ACTIVE })
  status: UserStatus;

  @Prop({ required: true, default: false })
  mustChangePassword: boolean;

  @Prop({ required: true, default: 0 })
  failedLoginCount: number;

  @Prop({ required: false, type: Date })
  lockedUntil?: Date;

  @Prop({ required: false, type: Date })
  lastLoginAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// tenant-scoped uniqueness: email and employee code are unique within an Organization
// (two different tenants may reuse the same identifier).
UserSchema.index({ organizationId: 1, emailN: 1 }, { unique: true });
UserSchema.index({ organizationId: 1, employeeCode: 1 }, { unique: true, sparse: true });

// Keep normalized fields in sync on every save.
UserSchema.pre('validate', function (next) {
  if (this.email) {
    this.emailN = normalizeEmail(this.email);
  }
  if (this.employeeCode) {
    this.employeeCode = normalizeCode(this.employeeCode);
  }
  next();
});