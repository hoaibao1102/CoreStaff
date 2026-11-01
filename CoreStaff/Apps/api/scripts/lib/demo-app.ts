/**
 * Boots the real CoreStaff services (no HTTP listener) for the demo scripts, so
 * every approval, close and payroll step runs the exact code the API runs.
 *
 * Same module set as `test/app-factory.ts`, but over the configured
 * `MONGODB_URI`. `MongooseModule.forRoot` without `dbName` resolves the same
 * default database as `DatabaseModule`, i.e. the one the API reads.
 */
import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';
import { resolveEnv, hasMongoUri } from '../../src/config/env';
import { SCHEMA_REGISTRY } from '../../src/database/schemas/registry';
import { AuthModule } from '../../src/auth/auth.module';
import { AttendanceModule } from '../../src/attendance/attendance.module';
import { EventsModule } from '../../src/events/events.module';
import { HrModule } from '../../src/hr/hr.module';
import { CalendarService } from '../../src/hr/calendar/calendar.service';
import { LeaveService } from '../../src/hr/leave/leave.service';
import { ManagerRequestService } from '../../src/hr/manager/manager-request.service';
import { TimesheetPeriodService } from '../../src/hr/timesheet/timesheet-period.service';
import { EmployeeTimesheetReviewService } from '../../src/hr/timesheet/employee-timesheet-review.service';
import { PeriodObligationService } from '../../src/hr/timesheet/period-obligation.service';
import { PayrollRunService } from '../../src/hr/payroll/payroll-run.service';
import { PayslipService } from '../../src/hr/payroll/payslip.service';

export interface DemoApp {
  app: INestApplication;
  connection: Connection;
  model: (name: string) => Model<any>;
  calendar: CalendarService;
  leave: LeaveService;
  requests: ManagerRequestService;
  periods: TimesheetPeriodService;
  reviews: EmployeeTimesheetReviewService;
  obligations: PeriodObligationService;
  payrollRuns: PayrollRunService;
  payslips: PayslipService;
  close: () => Promise<void>;
}

export async function createDemoApp(): Promise<DemoApp> {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured in Apps/api/.env');

  @Module({
    imports: [
      MongooseModule.forRoot(env.mongodbUri!, { serverSelectionTimeoutMS: 15000, retryAttempts: 1 }),
      MongooseModule.forFeature(SCHEMA_REGISTRY.map(({ name, schema }) => ({ name, schema }))),
      EventsModule,
      AuthModule,
      HrModule,
      AttendanceModule,
    ],
  })
  class DemoSeedModule {}

  const app = await NestFactory.create(DemoSeedModule, { logger: ['error'], abortOnError: false });
  await app.init();
  const connection = app.get<Connection>(getConnectionToken());
  const get = <T>(token: new (...args: any[]) => T): T => app.get(token, { strict: false });
  return {
    app,
    connection,
    model: (name: string) => connection.model(name),
    calendar: get(CalendarService),
    leave: get(LeaveService),
    requests: get(ManagerRequestService),
    periods: get(TimesheetPeriodService),
    reviews: get(EmployeeTimesheetReviewService),
    obligations: get(PeriodObligationService),
    payrollRuns: get(PayrollRunService),
    payslips: get(PayslipService),
    close: async () => { await app.close(); },
  };
}
