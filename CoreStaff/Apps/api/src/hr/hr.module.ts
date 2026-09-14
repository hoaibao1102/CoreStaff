import { Module } from '@nestjs/common';
import { DepartmentModule } from './department/department.module';
import { PositionModule } from './position/position.module';
import { EmployeeModule } from './employee/employee.module';

/** HR Core (TASK-020..023, Sprint 2): Department/Position catalogs + EmployeeProfile. */
@Module({
	imports: [DepartmentModule, PositionModule, EmployeeModule],
})
export class HrModule {}
