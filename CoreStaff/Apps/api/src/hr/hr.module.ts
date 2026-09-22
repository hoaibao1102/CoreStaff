import { Module } from '@nestjs/common';
import { DepartmentModule } from './department/department.module';
import { PositionModule } from './position/position.module';
import { EmployeeModule } from './employee/employee.module';
import { WorkplaceModule } from './workplace/workplace.module';
import { ShiftTemplateModule } from './shift-template/shift-template.module';
import { AssignmentModule } from './assignment/assignment.module';
import { InsuranceProfileModule } from './insurance-profile/insurance-profile.module';
import { InsurancePolicyModule } from './insurance-policy/insurance-policy.module';
/**
 * HR Core (TASK-020..023, Sprint 2): Department/Position/Workplace catalogs + EmployeeProfile.
 * Insurance (TASK-038/039, Sprint 3): see Docs/DOCS_DECISION_LOG.md D32 for scope notes.
 * Contract (TASK-028) and SalaryProfile (TASK-032) are owned by `hr/employment-contract`
 * and `hr/compensation` (merged from origin/deploy, 2026-09-22) — not duplicated here.
 */
@Module({
	imports: [
		DepartmentModule,
		PositionModule,
		EmployeeModule,
		WorkplaceModule,
		ShiftTemplateModule,
		AssignmentModule,
		InsuranceProfileModule,
		InsurancePolicyModule,
	],
})
export class HrModule {}
