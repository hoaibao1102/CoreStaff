import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TimesheetSummary, TimesheetSummarySchema } from '../../database/schemas/timesheet-summary.schema';
import { AttendanceDay, AttendanceDaySchema } from '../../database/schemas/attendance-day.schema';
import { OvertimeResult, OvertimeResultSchema } from '../../database/schemas/overtime-result.schema';
import { EmployeeProfile, EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { EmployeeAssignment, EmployeeAssignmentSchema } from '../../database/schemas/assignment.schema';
import { TimesheetSummaryService } from './timesheet-summary.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TimesheetSummary.name, schema: TimesheetSummarySchema },
      { name: AttendanceDay.name, schema: AttendanceDaySchema },
      { name: OvertimeResult.name, schema: OvertimeResultSchema },
      { name: EmployeeProfile.name, schema: EmployeeProfileSchema },
      { name: User.name, schema: UserSchema },
      { name: EmployeeAssignment.name, schema: EmployeeAssignmentSchema },
    ]),
  ],
  providers: [TimesheetSummaryService],
  exports: [TimesheetSummaryService],
})
export class TimesheetSummaryModule {}
