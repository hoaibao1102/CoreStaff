import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformAuditLogSchema } from '../database/schemas/platform-audit-log.schema';
import { UserSchema } from '../database/schemas/user.schema';
import { PlatformAuditService } from './platform-audit.service';

/**
 * Just the writer/reader. Kept apart from PlatformModule so AuthModule can
 * record admin sign-ins without importing PlatformModule (which imports AuthModule).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'PlatformAuditLog', schema: PlatformAuditLogSchema },
      { name: 'User', schema: UserSchema },
    ]),
  ],
  providers: [PlatformAuditService],
  exports: [PlatformAuditService],
})
export class PlatformAuditModule {}
