import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceDaySchema } from '../../database/schemas/attendance-day.schema';
import { EmployeeAssignmentSchema } from '../../database/schemas/assignment.schema';
import { CalendarExceptionSchema } from '../../database/schemas/calendar-exception.schema';
import { EmployeeDayOverrideSchema } from '../../database/schemas/employee-day-override.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { LeaveActionSchema } from '../../database/schemas/leave-action.schema';
import { LeaveRequestSchema } from '../../database/schemas/leave-request.schema';
import { ShiftTemplateModule } from '../shift-template/shift-template.module';
import { ManagerModule } from '../manager/manager.module';
import { DayClassificationService } from './day-classification.service';
import { EmployeeLeaveController, HrLeaveController, ManagerLeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: 'LeaveRequest', schema: LeaveRequestSchema },
      { name: 'EmployeeDayOverride', schema: EmployeeDayOverrideSchema },
      { name: 'LeaveAction', schema: LeaveActionSchema },
      { name: 'EmployeeProfile', schema: EmployeeProfileSchema },
      { name: 'Assignment', schema: EmployeeAssignmentSchema },
      { name: 'AttendanceDay', schema: AttendanceDaySchema },
      { name: 'CalendarException', schema: CalendarExceptionSchema },
      { name: 'User', schema: UserSchema },
      { name: 'UserSession', schema: UserSessionSchema },
    ]),
    ManagerModule,
    ShiftTemplateModule,
  ],
  controllers: [EmployeeLeaveController, ManagerLeaveController, HrLeaveController],
  providers: [LeaveService, DayClassificationService, RolesGuard],
  exports: [LeaveService, DayClassificationService],
})
export class LeaveModule {}
