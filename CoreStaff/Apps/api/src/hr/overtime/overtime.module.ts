import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceDaySchema } from '../../database/schemas/attendance-day.schema';
import { CalendarExceptionSchema } from '../../database/schemas/calendar-exception.schema';
import { EmployeeDayOverrideSchema } from '../../database/schemas/employee-day-override.schema';
import { ManagerRequestSchema } from '../../database/schemas/manager-request.schema';
import { OvertimeResultSchema } from '../../database/schemas/overtime-result.schema';
import { PoliciesModule } from '../policies/policies.module';
import { ShiftTemplateModule } from '../shift-template/shift-template.module';
import { OvertimeService } from './overtime.service';

/**
 * TASK-068/069/070 — overtime classification, eligible calculation and labor
 * limit enforcement (SRS §15.11, FR-OT-02, §30B.2).
 *
 * Deliberately exports the service only, no controllers: the HTTP routes live in
 * `ManagerModule`, which already owns `ManagerRequestService` and needs this
 * service for the approval hook. Declaring the controllers here would force
 * ManagerModule ↔ OvertimeModule into a `forwardRef` cycle for nothing.
 */
@Module({
  imports: [
    PoliciesModule,
    ShiftTemplateModule,
    MongooseModule.forFeature([
      { name: 'ManagerRequest', schema: ManagerRequestSchema },
      { name: 'OvertimeResult', schema: OvertimeResultSchema },
      { name: 'AttendanceDay', schema: AttendanceDaySchema },
      { name: 'CalendarException', schema: CalendarExceptionSchema },
      { name: 'EmployeeDayOverride', schema: EmployeeDayOverrideSchema },
    ]),
  ],
  providers: [OvertimeService],
  exports: [OvertimeService],
})
export class OvertimeModule {}
