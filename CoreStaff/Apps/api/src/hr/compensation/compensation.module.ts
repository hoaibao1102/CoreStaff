import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import {
  AllowanceCatalogSchema, AttendanceBonusPolicySchema, AttendanceBonusTemplateSchema,
  KpiPayrollInputSchema, KpiPolicySchema, LaborCompliancePolicySchema, OrganizationAllowanceSchema, SalaryProfileSchema,
} from '../../database/schemas/compensation.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { CompensationController } from './compensation.controller';
import { CompensationService } from './compensation.service';
import { ManagerModule } from '../manager/manager.module';

@Module({
  imports: [AuthModule, ManagerModule, MongooseModule.forFeature([
    { name: 'SalaryProfile', schema: SalaryProfileSchema },
    { name: 'LaborCompliancePolicy', schema: LaborCompliancePolicySchema },
    { name: 'AllowanceCatalog', schema: AllowanceCatalogSchema },
    { name: 'OrganizationAllowance', schema: OrganizationAllowanceSchema },
    { name: 'AttendanceBonusTemplate', schema: AttendanceBonusTemplateSchema },
    { name: 'AttendanceBonusPolicy', schema: AttendanceBonusPolicySchema },
    { name: 'KpiPayrollInput', schema: KpiPayrollInputSchema },
    { name: 'KpiPolicy', schema: KpiPolicySchema },
    { name: 'EmployeeProfile', schema: EmployeeProfileSchema },
    { name: 'User', schema: UserSchema },
    { name: 'UserSession', schema: UserSessionSchema },
  ])],
  controllers: [CompensationController],
  providers: [CompensationService, RolesGuard],
  exports: [CompensationService],
})
export class CompensationModule {}
