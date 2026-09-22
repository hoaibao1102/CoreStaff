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

/**
 * HR Core: Sprint 2 catalogs + EmployeeProfile (TASK-020..023), Sprint 3
 * EmploymentContract + EmployeeDocument (TASK-028..029, SRS §30A.2),
 * Workplace/ShiftTemplate/Assignment (TASK-024), compensation foundations
 * (TASK-031..035) and effective-dated policies (TASK-036/037).
 */
@Module({
	imports: [DepartmentModule, PositionModule, EmployeeModule, EmploymentContractModule, EmployeeDocumentModule, WorkplaceModule, ShiftTemplateModule, AssignmentModule, CompensationModule, PoliciesModule],
})
export class HrModule {}
