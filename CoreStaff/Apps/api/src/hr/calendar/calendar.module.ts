import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalendarExceptionSchema } from '../../database/schemas/calendar-exception.schema';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { PoliciesModule } from '../policies/policies.module';
import { OvertimeModule } from '../overtime/overtime.module';

@Module({
  imports: [AuthModule, PoliciesModule, OvertimeModule, MongooseModule.forFeature([
    { name: 'CalendarException', schema: CalendarExceptionSchema },
    { name: 'User', schema: UserSchema },
    { name: 'UserSession', schema: UserSessionSchema },
  ])],
  controllers: [CalendarController], providers: [CalendarService, RolesGuard], exports: [CalendarService],
})
export class CalendarModule {}
