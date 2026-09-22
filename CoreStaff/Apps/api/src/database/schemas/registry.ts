import { Schema } from 'mongoose';
import { OrganizationSchema } from './organization.schema';
import { UserSchema } from './user.schema';
import { UserSessionSchema } from './user-session.schema';
import { PasswordResetTokenSchema } from './password-reset-token.schema';
import { DepartmentSchema } from './department.schema';
import { PositionSchema } from './position.schema';
import { EmployeeProfileSchema } from './employee-profile.schema';
import { EmploymentHistorySchema } from './employment-history.schema';
import { EmploymentContractSchema } from './employment-contract.schema';
import { EmployeeDocumentSchema } from './employee-document.schema';
import { WorkplaceSchema } from './workplace.schema';
import { ShiftTemplateSchema } from './shift-template.schema';
import { EmployeeAssignmentSchema } from './assignment.schema';
import { ManagerAssignmentSchema } from './manager-assignment.schema';
import { ManagerRequestSchema } from './manager-request.schema';
import {
  SalaryProfileSchema, LaborCompliancePolicySchema, AllowanceCatalogSchema,
  OrganizationAllowanceSchema, AttendanceBonusTemplateSchema,
  AttendanceBonusPolicySchema, KpiPayrollInputSchema, KpiPolicySchema, OvertimePayPolicySchema,
} from './compensation.schema';

/**
 * Single source of truth for the collections bootstrapped by TASK-015 + TASK-024.
 * Reused by both the NestJS `DatabaseModule` and the `ensure-indexes` CLI so a
 * schema is never defined in two places.
 */
export const SCHEMA_REGISTRY: Array<{ name: string; schema: Schema }> = [
  { name: 'Organization', schema: OrganizationSchema },
  { name: 'User', schema: UserSchema },
  { name: 'UserSession', schema: UserSessionSchema },
  { name: 'PasswordResetToken', schema: PasswordResetTokenSchema },
  { name: 'Department', schema: DepartmentSchema },
  { name: 'Position', schema: PositionSchema },
  { name: 'EmployeeProfile', schema: EmployeeProfileSchema },
  { name: 'EmploymentHistory', schema: EmploymentHistorySchema },
  { name: 'EmploymentContract', schema: EmploymentContractSchema },
  { name: 'EmployeeDocument', schema: EmployeeDocumentSchema },
  { name: 'Workplace', schema: WorkplaceSchema },
  { name: 'ShiftTemplate', schema: ShiftTemplateSchema },
  { name: 'Assignment', schema: EmployeeAssignmentSchema },
  { name: 'ManagerAssignment', schema: ManagerAssignmentSchema },
  { name: 'ManagerRequest', schema: ManagerRequestSchema },
  { name: 'SalaryProfile', schema: SalaryProfileSchema },
  { name: 'LaborCompliancePolicy', schema: LaborCompliancePolicySchema },
  { name: 'AllowanceCatalog', schema: AllowanceCatalogSchema },
  { name: 'OrganizationAllowance', schema: OrganizationAllowanceSchema },
  { name: 'AttendanceBonusTemplate', schema: AttendanceBonusTemplateSchema },
  { name: 'AttendanceBonusPolicy', schema: AttendanceBonusPolicySchema },
  { name: 'KpiPayrollInput', schema: KpiPayrollInputSchema },
  { name: 'KpiPolicy', schema: KpiPolicySchema },
  { name: 'OvertimePayPolicy', schema: OvertimePayPolicySchema },
];

export { OrganizationSchema, UserSchema, UserSessionSchema, PasswordResetTokenSchema };
export { DepartmentSchema, PositionSchema, EmployeeProfileSchema, EmploymentHistorySchema, WorkplaceSchema };
export { EmploymentContractSchema, EmployeeDocumentSchema };
export { ShiftTemplateSchema };
export { EmployeeAssignmentSchema };
export { Organization } from './organization.schema';
export { User } from './user.schema';
export { UserSession } from './user-session.schema';
export { PasswordResetToken } from './password-reset-token.schema';
export { Department } from './department.schema';
export { Position } from './position.schema';
export { EmployeeProfile } from './employee-profile.schema';
export { EmploymentHistory } from './employment-history.schema';
export { EmploymentContract } from './employment-contract.schema';
export { EmployeeDocument } from './employee-document.schema';
export { Workplace, WorkplaceType } from './workplace.schema';
export { ShiftTemplate } from './shift-template.schema';

export function registryEntries() {
  return SCHEMA_REGISTRY.map(({ name, schema }) => ({ name, schema } as const));
}

// export function registryEntries() {
//   return SCHEMA_REGISTRY.map(({ name, schema }) => ({ name, schema } as const));
// }
