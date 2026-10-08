import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { EmploymentHistorySchema } from '../../database/schemas/employment-history.schema';
import { DepartmentSchema } from '../../database/schemas/department.schema';
import { PositionSchema } from '../../database/schemas/position.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { AttendanceBonusPolicySchema, OrganizationAllowanceSchema, SalaryProfileSchema } from '../../database/schemas/compensation.schema';
import { InsuranceProfileSchema } from '../../database/schemas/insurance-profile.schema';
import { EmploymentContractSchema } from '../../database/schemas/employment-contract.schema';
import { EmployeeController } from './employee.controller';
import { DependentsController } from './dependents.controller';
import { EmployeeImportController } from './employee-import.controller';
import { EmployeeService } from './employee.service';
import { EmployeeImportService } from './services/employee-import.service';

@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'EmployeeProfile', schema: EmployeeProfileSchema },
			{ name: 'EmploymentHistory', schema: EmploymentHistorySchema },
			{ name: 'Department', schema: DepartmentSchema },
			{ name: 'Position', schema: PositionSchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
			// Bulk import writes the compensation + insurance records the single
			// employee route leaves to separate screens (EMPLOYEE_IMPORT_PLAN.md).
			{ name: 'SalaryProfile', schema: SalaryProfileSchema },
			{ name: 'OrganizationAllowance', schema: OrganizationAllowanceSchema },
			// The import's `Chính sách thưởng chuyên cần` column resolves a policy by name.
			{ name: 'AttendanceBonusPolicy', schema: AttendanceBonusPolicySchema },
			{ name: 'InsuranceProfile', schema: InsuranceProfileSchema },
			// Import may create the contract too — written straight through the model
			// rather than `EmploymentContractService`, which takes no session.
			{ name: 'EmploymentContract', schema: EmploymentContractSchema },
		]),
	],
	controllers: [EmployeeController, DependentsController, EmployeeImportController],
	providers: [EmployeeService, EmployeeImportService, RolesGuard],
	exports: [EmployeeService],
})
export class EmployeeModule {}
