import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { PayrollRun, PayrollRunSchema } from '../../database/schemas/payroll-run.schema';
import { Payslip, PayslipSchema } from '../../database/schemas/payslip.schema';
import { PayrollInputSnapshot, PayrollInputSnapshotSchema } from '../../database/schemas/payroll-input-snapshot.schema';
import { TimesheetPeriod, TimesheetPeriodSchema } from '../../database/schemas/timesheet-period.schema';
import { EmployeeProfile, EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { TaxPolicy, TaxPolicySchema } from '../../database/schemas/tax-policy.schema';
import { InsurancePolicy, InsurancePolicySchema } from '../../database/schemas/insurance-policy.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { UserSession, UserSessionSchema } from '../../database/schemas/user-session.schema';
import { PayrollRunService } from './payroll-run.service';
import { PayrollRunController } from './payroll-run.controller';
import { InsuranceService } from './insurance.service';
import { PitService } from './pit.service';
import { PayslipService } from './payslip.service';
import { PayslipController } from './payslip.controller';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: PayrollRun.name, schema: PayrollRunSchema },
      { name: Payslip.name, schema: PayslipSchema },
      { name: PayrollInputSnapshot.name, schema: PayrollInputSnapshotSchema },
      { name: TimesheetPeriod.name, schema: TimesheetPeriodSchema },
      { name: EmployeeProfile.name, schema: EmployeeProfileSchema },
      { name: TaxPolicy.name, schema: TaxPolicySchema },
      { name: InsurancePolicy.name, schema: InsurancePolicySchema },
      { name: 'User', schema: UserSchema },
      { name: 'UserSession', schema: UserSessionSchema },
    ]),
  ],
  controllers: [PayrollRunController, PayslipController],
  providers: [PayrollRunService, InsuranceService, PitService, PayslipService, RolesGuard],
  exports: [PayrollRunService, InsuranceService, PitService, PayslipService],
})
export class PayrollModule {}
