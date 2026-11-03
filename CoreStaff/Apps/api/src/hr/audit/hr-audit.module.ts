import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogSchema } from '../../database/schemas/audit-log.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { AuthModule } from '../../auth/auth.module';
import { HrAuditService } from './hr-audit.service';
import { HrAuditController } from './hr-audit.controller';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: 'AuditLog', schema: AuditLogSchema },
      { name: 'User', schema: UserSchema },
      { name: 'UserSession', schema: UserSessionSchema },
    ]),
  ],
  controllers: [HrAuditController],
  providers: [HrAuditService],
  exports: [HrAuditService],
})
export class HrAuditModule {}
