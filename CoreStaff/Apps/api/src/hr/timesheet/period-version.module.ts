import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TimesheetPeriod, TimesheetPeriodSchema } from '../../database/schemas/timesheet-period.schema';
import { PeriodVersionService } from './period-version.service';

/**
 * TASK-073 — standalone so Leave/Manager/Attendance can bump the period version
 * without importing TimesheetPeriodModule (which imports ManagerModule).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TimesheetPeriod.name, schema: TimesheetPeriodSchema },
    ]),
  ],
  providers: [PeriodVersionService],
  exports: [PeriodVersionService],
})
export class PeriodVersionModule {}
