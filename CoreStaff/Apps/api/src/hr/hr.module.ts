import { Module } from '@nestjs/common';
import { DepartmentModule } from './department/department.module';
import { PositionModule } from './position/position.module';
import { EmployeeModule } from './employee/employee.module';
import { WorkplaceModule } from './workplace/workplace.module';
import { ShiftTemplateModule } from './shift-template/shift-template.module';
import { AssignmentModule } from './assignment/assignment.module';
/** HR Core (TASK-020..023, Sprint 2): Department/Position/Workplace catalogs + EmployeeProfile. */
@Module({
	imports: [DepartmentModule, PositionModule, EmployeeModule, WorkplaceModule, ShiftTemplateModule, AssignmentModule],
})
export class HrModule {}
