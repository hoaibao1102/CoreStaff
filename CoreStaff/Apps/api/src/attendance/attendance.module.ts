import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { HaversineService } from './services/haversine.service';
import { NetworkValidatorService } from './services/network-validator.service';
import { AttendanceCalculatorService } from './services/attendance-calculator.service';
import { StorageModule } from '../storage/storage.module';
import { AttendanceDaySchema } from '../database/schemas/attendance-day.schema';
import { AttendanceEventSchema } from '../database/schemas/attendance-event.schema';
import { EvidenceSchema } from '../database/schemas/evidence.schema';
import { EmployeeAssignmentSchema } from '../database/schemas/assignment.schema';
import { WorkplaceSchema } from '../database/schemas/workplace.schema';
import { ShiftTemplateSchema } from '../database/schemas/shift-template.schema';
import { ManagerAssignmentSchema } from '../database/schemas/manager-assignment.schema';
import { ManagerRequestSchema } from '../database/schemas/manager-request.schema';
import { EmployeeProfileSchema } from '../database/schemas/employee-profile.schema';
import { UserSchema } from '../database/schemas/user.schema';
import { UserSessionSchema } from '../database/schemas/user-session.schema';
import { IdempotencyRecordSchema } from '../database/schemas/idempotency-record.schema';
import { ShiftTemplateModule } from '../hr/shift-template/shift-template.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'AttendanceDay', schema: AttendanceDaySchema },
      { name: 'AttendanceEvent', schema: AttendanceEventSchema },
      { name: 'Evidence', schema: EvidenceSchema },
      { name: 'Assignment', schema: EmployeeAssignmentSchema },
      { name: 'Workplace', schema: WorkplaceSchema },
      { name: 'ShiftTemplate', schema: ShiftTemplateSchema },
      { name: 'ManagerAssignment', schema: ManagerAssignmentSchema },
      { name: 'ManagerRequest', schema: ManagerRequestSchema },
      { name: 'EmployeeProfile', schema: EmployeeProfileSchema },
      { name: 'User', schema: UserSchema },
      { name: 'UserSession', schema: UserSessionSchema },
      { name: 'IdempotencyRecord', schema: IdempotencyRecordSchema },
    ]),
    StorageModule,
    ShiftTemplateModule,
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    HaversineService,
    NetworkValidatorService,
    AttendanceCalculatorService,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
