import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TimesheetSummary, TimesheetSummarySchema } from '../../database/schemas/timesheet-summary.schema';
import { AttendanceDay, AttendanceDaySchema } from '../../database/schemas/attendance-day.schema';
import { OvertimeResult, OvertimeResultSchema } from '../../database/schemas/overtime-result.schema';
import { EmployeeProfile, EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { EmployeeAssignmentSchema } from '../../database/schemas/assignment.schema';
import { TimesheetSummaryService } from './timesheet-summary.service';
import { PeriodObligationService } from './period-obligation.service';
import { MongoosePeriodFactSource } from './mongoose-period-fact-source';
import { ShiftTemplateSchema } from '../../database/schemas/shift-template.schema';
import { CalendarExceptionSchema } from '../../database/schemas/calendar-exception.schema';
import { LeaveRequestSchema } from '../../database/schemas/leave-request.schema';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [
    PoliciesModule,
    MongooseModule.forFeature([
      { name: TimesheetSummary.name, schema: TimesheetSummarySchema },
      { name: AttendanceDay.name, schema: AttendanceDaySchema },
      { name: OvertimeResult.name, schema: OvertimeResultSchema },
      { name: EmployeeProfile.name, schema: EmployeeProfileSchema },
      { name: User.name, schema: UserSchema },
      { name: 'Assignment', schema: EmployeeAssignmentSchema },
      { name: 'ShiftTemplate', schema: ShiftTemplateSchema },
      { name: 'CalendarException', schema: CalendarExceptionSchema },
      { name: 'LeaveRequest', schema: LeaveRequestSchema },
    ]),
  ],
  providers: [
    MongoosePeriodFactSource,
    { provide: PeriodObligationService, useFactory: (source: MongoosePeriodFactSource) => new PeriodObligationService(source), inject: [MongoosePeriodFactSource] },
    TimesheetSummaryService,
  ],
  exports: [TimesheetSummaryService, PeriodObligationService],
})
export class TimesheetSummaryModule {}
