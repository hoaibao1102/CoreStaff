import { Module } from '@nestjs/common';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PoliciesService } from '../policies/policies.service';
import { EventsGateway } from '../../events/events.gateway';
import { EventsModule } from '../../events/events.module';
import { registryEntries } from '../../database/schemas/registry';
import { MongoosePeriodFactSource } from '../timesheet/mongoose-period-fact-source';
import { PeriodVersionService } from '../timesheet/period-version.service';
import { AttendanceConfirmationService, CONFIRMATION_MODELS } from './attendance-confirmation.service';
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
import { PeriodVersionModule } from '../timesheet/period-version.module';

@Module({
  imports: [EventsModule, AuthModule, OvertimeModule, PeriodVersionModule, MongooseModule.forFeature([
    ...registryEntries(),
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
  providers: [ManagerScopeService, ManagerAssignmentService, ManagerRequestService, RolesGuard, AttendanceConfirmationService, {
    provide: CONFIRMATION_MODELS,
    inject: [getConnectionToken(), PeriodVersionService, ManagerScopeService, EventsGateway],
    useFactory: (connection:Connection, periodVersion:PeriodVersionService, scope:ManagerScopeService, notify:EventsGateway) => {
      const model=(name:string)=>connection.model(name);
      return {policyRules:new PoliciesService(model('LaborCompliancePolicy') as any,model('OvertimePayPolicy') as any,model('WorkCreditPolicy') as any,periodVersion),source:new MongoosePeriodFactSource(model('EmployeeProfile'),model('Assignment'),model('ShiftTemplate'),model('CalendarException'),model('LeaveRequest'),model('AttendanceDay'),model('OvertimeResult')),requests:model('ManagerRequest'),quotas:model('AttendanceConfirmationQuota'),policies:model('LaborCompliancePolicy'),periods:model('TimesheetPeriod'),days:model('AttendanceDay'),events:model('AttendanceEvent'),audit:model('ApprovalHistory'),shifts:model('ShiftTemplate'),overrides:model('EmployeeDayOverride'),periodVersion,scope,notify};
    },
  }],
  exports: [ManagerScopeService, ManagerAssignmentService, ManagerRequestService],
})
export class ManagerModule {}
