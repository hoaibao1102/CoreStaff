import { Module } from '@nestjs/common';
import { DepartmentModule } from './department/department.module';
import { PositionModule } from './position/position.module';
import { EmployeeModule } from './employee/employee.module';
import { WorkplaceModule } from './workplace/workplace.module';
import { ShiftTemplateModule } from './shift-template/shift-template.module';
import { AssignmentModule } from './assignment/assignment.module';
import { ContractModule } from './contract/contract.module';
import { SalaryProfileModule } from './salary-profile/salary-profile.module';
import { InsuranceProfileModule } from './insurance-profile/insurance-profile.module';
import { InsurancePolicyModule } from './insurance-policy/insurance-policy.module';
/**
 * HR Core (TASK-020..023, Sprint 2): Department/Position/Workplace catalogs + EmployeeProfile.
 * Contract/Salary/Insurance (TASK-028/032/038/039, Sprint 3): see Docs/DOCS_DECISION_LOG.md
 * for the 2026-09-22 scope decision on what this sprint slice does and does not cover.
 */
@Module({
	imports: [
		DepartmentModule,
		PositionModule,
		EmployeeModule,
		WorkplaceModule,
		ShiftTemplateModule,
		AssignmentModule,
		ContractModule,
		SalaryProfileModule,
		InsuranceProfileModule,
		InsurancePolicyModule,
	],
})
export class HrModule {}
