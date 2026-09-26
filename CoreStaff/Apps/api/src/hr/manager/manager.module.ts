import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { ManagerAssignmentSchema } from '../../database/schemas/manager-assignment.schema';
import { ManagerRequestSchema } from '../../database/schemas/manager-request.schema';
import { DepartmentSchema } from '../../database/schemas/department.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { PositionSchema } from '../../database/schemas/position.schema';
import { WorkplaceSchema } from '../../database/schemas/workplace.schema';
import { AttendanceDaySchema } from '../../database/schemas/attendance-day.schema';
import { AttendanceEventSchema } from '../../database/schemas/attendance-event.schema';
import { EmployeeAssignmentSchema } from '../../database/schemas/assignment.schema';
import { ManagerController } from './manager.controller';
import { ManagerScopeService } from './manager-scope.service';
import { ManagerAssignmentService } from './manager-assignment.service';
import { ManagerRequestService } from './manager-request.service';
import { OvertimeModule } from '../overtime/overtime.module';
import { HrOvertimeController, ManagerOvertimeController, OvertimeController } from '../overtime/overtime.controller';

@Module({
  imports: [AuthModule, OvertimeModule, MongooseModule.forFeature([
    { name: 'ManagerAssignment', schema: ManagerAssignmentSchema },
    { name: 'ManagerRequest', schema: ManagerRequestSchema },
    { name: 'Assignment', schema: EmployeeAssignmentSchema },
    { name: 'Department', schema: DepartmentSchema },
    { name: 'EmployeeProfile', schema: EmployeeProfileSchema },
    { name: 'Position', schema: PositionSchema },
    { name: 'Workplace', schema: WorkplaceSchema },
    { name: 'User', schema: UserSchema },
    { name: 'UserSession', schema: UserSessionSchema },
    { name: 'AttendanceDay', schema: AttendanceDaySchema },
    { name: 'AttendanceEvent', schema: AttendanceEventSchema },
  ])],
  controllers: [ManagerController, OvertimeController, ManagerOvertimeController, HrOvertimeController],
  providers: [ManagerScopeService, ManagerAssignmentService, ManagerRequestService, RolesGuard],
  exports: [ManagerScopeService, ManagerAssignmentService, ManagerRequestService],
})
export class ManagerModule {}
