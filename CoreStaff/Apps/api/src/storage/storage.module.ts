import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Private object storage (TASK-029). No Mongo — injectable S3 client only. */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}