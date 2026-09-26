import { Module } from '@nestjs/common';
import { DepartmentModule } from './department/department.module';
import { PositionModule } from './position/position.module';
import { EmployeeModule } from './employee/employee.module';
import { EmploymentContractModule } from './employment-contract/employment-contract.module';
import { EmployeeDocumentModule } from './employee-document/employee-document.module';
import { WorkplaceModule } from './workplace/workplace.module';
import { ShiftTemplateModule } from './shift-template/shift-template.module';
import { AssignmentModule } from './assignment/assignment.module';
import { CompensationModule } from './compensation/compensation.module';
import { PoliciesModule } from './policies/policies.module';
import { ManagerModule } from './manager/manager.module';
import { InsuranceProfileModule } from './insurance-profile/insurance-profile.module';
import { InsurancePolicyModule } from './insurance-policy/insurance-policy.module';
import { CalendarModule } from './calendar/calendar.module';
import { LeaveModule } from './leave/leave.module';
import { OvertimeModule } from './overtime/overtime.module';

/**
 * HR Core: Sprint 2 catalogs + EmployeeProfile (TASK-020..023), Sprint 3
 * EmploymentContract + EmployeeDocument (TASK-028..029, SRS §30A.2),
 * Workplace/ShiftTemplate/Assignment (TASK-024), compensation foundations
 * (TASK-031..035), effective-dated policies (TASK-036/037), and Insurance
 * (TASK-038/039, see Docs/DOCS_DECISION_LOG.md D32 for scope notes).
 */
@Module({
	imports: [
		DepartmentModule,
		PositionModule,
		EmployeeModule,
		EmploymentContractModule,
		EmployeeDocumentModule,
		WorkplaceModule,
		ShiftTemplateModule,
		AssignmentModule,
		CompensationModule,
		PoliciesModule,
		ManagerModule,
		InsuranceProfileModule,
		InsurancePolicyModule,
		CalendarModule,
		LeaveModule,
		OvertimeModule,
	],
})
export class HrModule {}
