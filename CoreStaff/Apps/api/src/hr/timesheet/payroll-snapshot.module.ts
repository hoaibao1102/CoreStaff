import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PayrollSnapshotService } from './payroll-snapshot.service';
import { PayrollInputSnapshot, PayrollInputSnapshotSchema } from '../../database/schemas/payroll-input-snapshot.schema';
import { TimesheetSummary, TimesheetSummarySchema } from '../../database/schemas/timesheet-summary.schema';
import { EmployeeProfile, EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import {
  AttendanceBonusPolicySchema,
  KpiPayrollInputSchema,
  OrganizationAllowanceSchema,
  SalaryProfileSchema,
} from '../../database/schemas/compensation.schema';
import { InsurancePolicySchema } from '../../database/schemas/insurance-policy.schema';
import { TaxPolicySchema } from '../../database/schemas/tax-policy.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'PayrollInputSnapshot', schema: PayrollInputSnapshotSchema },
      { name: 'TimesheetSummary', schema: TimesheetSummarySchema },
      { name: 'EmployeeProfile', schema: EmployeeProfileSchema },
      { name: 'SalaryProfile', schema: SalaryProfileSchema },
      { name: 'OrganizationAllowance', schema: OrganizationAllowanceSchema },
      { name: 'AttendanceBonusPolicy', schema: AttendanceBonusPolicySchema },
      { name: 'KpiPayrollInput', schema: KpiPayrollInputSchema },
      { name: 'InsurancePolicy', schema: InsurancePolicySchema },
      { name: 'TaxPolicy', schema: TaxPolicySchema },
    ]),
  ],
  providers: [PayrollSnapshotService],
  exports: [PayrollSnapshotService],
})
export class PayrollSnapshotModule {}
