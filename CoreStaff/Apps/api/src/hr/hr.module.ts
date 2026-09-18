import { Module } from '@nestjs/common';
import { DepartmentModule } from './department/department.module';
import { PositionModule } from './position/position.module';
import { EmployeeModule } from './employee/employee.module';
import { EmploymentContractModule } from './employment-contract/employment-contract.module';
import { EmployeeDocumentModule } from './employee-document/employee-document.module';
import { WorkplaceModule } from './workplace/workplace.module';
import { ShiftTemplateModule } from './shift-template/shift-template.module';
import { AssignmentModule } from './assignment/assignment.module';

/**
 * HR Core: Sprint 2 catalogs + EmployeeProfile (TASK-020..023), Sprint 3
 * EmploymentContract + EmployeeDocument (TASK-028..029, SRS §30A.2),
 * Workplace/ShiftTemplate/Assignment (TASK-024).
 */
@Module({
	imports: [DepartmentModule, PositionModule, EmployeeModule, EmploymentContractModule, EmployeeDocumentModule, WorkplaceModule, ShiftTemplateModule, AssignmentModule],
})
export class HrModule {}
