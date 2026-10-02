import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { TimesheetPeriod, TimesheetPeriodSchema } from '../../database/schemas/timesheet-period.schema';
import { Department, DepartmentSchema } from '../../database/schemas/department.schema';
import { EmployeeProfile, EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { TimesheetPeriodController } from './timesheet-period.controller';
import { TimesheetPeriodService } from './timesheet-period.service';
import { TimesheetSummaryModule } from './timesheet-summary.module';
import { PayrollSnapshotModule } from './payroll-snapshot.module';
import { ManagerModule } from '../manager/manager.module';
import { PayrollInputSnapshotSchema } from '../../database/schemas/payroll-input-snapshot.schema';
import { PayrollRunSchema } from '../../database/schemas/payroll-run.schema';
import { AttendanceDay, AttendanceDaySchema } from '../../database/schemas/attendance-day.schema';
import { AttendanceEvent, AttendanceEventSchema } from '../../database/schemas/attendance-event.schema';
import { ManagerRequest, ManagerRequestSchema } from '../../database/schemas/manager-request.schema';
import { DepartmentTimesheetConfirmation, DepartmentTimesheetConfirmationSchema } from '../../database/schemas/department-timesheet-confirmation.schema';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: TimesheetPeriod.name, schema: TimesheetPeriodSchema },
			{ name: Department.name, schema: DepartmentSchema },
			{ name: EmployeeProfile.name, schema: EmployeeProfileSchema },
			{ name: 'PayrollInputSnapshot', schema: PayrollInputSnapshotSchema },
			{ name: 'PayrollRun', schema: PayrollRunSchema },
			// TASK-074 — blocker calculation sources
			{ name: AttendanceDay.name, schema: AttendanceDaySchema },
			{ name: AttendanceEvent.name, schema: AttendanceEventSchema },
			{ name: ManagerRequest.name, schema: ManagerRequestSchema },
			{ name: DepartmentTimesheetConfirmation.name, schema: DepartmentTimesheetConfirmationSchema },
			// Required for AuthGuard dependency injection
			{ name: 'User', schema: UserSchema },
			{ name: 'UserSession', schema: UserSessionSchema },
		]),
		TimesheetSummaryModule,
		PayrollSnapshotModule,
		ManagerModule,
	],
	controllers: [TimesheetPeriodController],
	providers: [TimesheetPeriodService],
	exports: [TimesheetPeriodService],
})
export class TimesheetPeriodModule {}
