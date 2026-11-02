import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogSchema } from '../../database/schemas/audit-log.schema';
import { HrAuditService } from './hr-audit.service';
import { HrAuditController } from './hr-audit.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'AuditLog', schema: AuditLogSchema }]),
  ],
  controllers: [HrAuditController],
  providers: [HrAuditService],
  exports: [HrAuditService],
})
export class HrAuditModule {}

