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
import { InsuranceProfileSchema } from './insurance-profile.schema';
import { InsurancePolicySchema } from './insurance-policy.schema';
import { ManagerAssignmentSchema } from './manager-assignment.schema';
import { ManagerRequestSchema } from './manager-request.schema';
import { OvertimeResultSchema } from './overtime-result.schema';
import {
  SalaryProfileSchema, LaborCompliancePolicySchema, AllowanceCatalogSchema,
  OrganizationAllowanceSchema, AttendanceBonusTemplateSchema,
  AttendanceBonusPolicySchema, KpiPayrollInputSchema, KpiPolicySchema, OvertimePayPolicySchema,
} from './compensation.schema';
import { AttendanceDaySchema, AttendanceDay } from './attendance-day.schema';
import { AttendanceEventSchema, AttendanceEvent } from './attendance-event.schema';
import { EvidenceSchema, Evidence } from './evidence.schema';
import { IdempotencyRecordSchema } from './idempotency-record.schema';
import { ApprovalHistorySchema } from './approval-history.schema';
import { CalendarExceptionSchema } from './calendar-exception.schema';
import { LeaveRequestSchema } from './leave-request.schema';
import { EmployeeDayOverrideSchema } from './employee-day-override.schema';
import { LeaveActionSchema } from './leave-action.schema';

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
  { name: 'InsuranceProfile', schema: InsuranceProfileSchema },
  { name: 'InsurancePolicy', schema: InsurancePolicySchema },
  { name: 'ManagerAssignment', schema: ManagerAssignmentSchema },
  { name: 'ManagerRequest', schema: ManagerRequestSchema },
  { name: 'OvertimeResult', schema: OvertimeResultSchema },
  { name: 'SalaryProfile', schema: SalaryProfileSchema },
  { name: 'LaborCompliancePolicy', schema: LaborCompliancePolicySchema },
  { name: 'AllowanceCatalog', schema: AllowanceCatalogSchema },
  { name: 'OrganizationAllowance', schema: OrganizationAllowanceSchema },
  { name: 'AttendanceBonusTemplate', schema: AttendanceBonusTemplateSchema },
  { name: 'AttendanceBonusPolicy', schema: AttendanceBonusPolicySchema },
  { name: 'KpiPayrollInput', schema: KpiPayrollInputSchema },
  { name: 'KpiPolicy', schema: KpiPolicySchema },
  { name: 'OvertimePayPolicy', schema: OvertimePayPolicySchema },
  { name: 'AttendanceDay', schema: AttendanceDaySchema },
  { name: 'AttendanceEvent', schema: AttendanceEventSchema },
  { name: 'Evidence', schema: EvidenceSchema },
  { name: 'IdempotencyRecord', schema: IdempotencyRecordSchema },
  { name: 'ApprovalHistory', schema: ApprovalHistorySchema },
  { name: 'CalendarException', schema: CalendarExceptionSchema },
  { name: 'LeaveRequest', schema: LeaveRequestSchema },
  { name: 'EmployeeDayOverride', schema: EmployeeDayOverrideSchema },
  { name: 'LeaveAction', schema: LeaveActionSchema },
];

export { OrganizationSchema, UserSchema, UserSessionSchema, PasswordResetTokenSchema };
export { DepartmentSchema, PositionSchema, EmployeeProfileSchema, EmploymentHistorySchema, WorkplaceSchema };
export { EmploymentContractSchema, EmployeeDocumentSchema };
export { ShiftTemplateSchema };
export { EmployeeAssignmentSchema };
export { InsuranceProfileSchema };
export { InsurancePolicySchema };
export { InsuranceProfile } from './insurance-profile.schema';
export { InsurancePolicy } from './insurance-policy.schema';
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
export { AttendanceDay, AttendanceDaySchema } from './attendance-day.schema';
export { AttendanceEvent, AttendanceEventSchema } from './attendance-event.schema';
export { Evidence, EvidenceSchema } from './evidence.schema';
export { CalendarException, CalendarExceptionSchema } from './calendar-exception.schema';
export { LeaveRequest, LeaveRequestSchema } from './leave-request.schema';
export { EmployeeDayOverride, EmployeeDayOverrideSchema } from './employee-day-override.schema';
export { LeaveAction, LeaveActionSchema } from './leave-action.schema';

export function registryEntries() {
  return SCHEMA_REGISTRY.map(({ name, schema }) => ({ name, schema } as const));
}

// export function registryEntries() {
//   return SCHEMA_REGISTRY.map(({ name, schema }) => ({ name, schema } as const));
// }
