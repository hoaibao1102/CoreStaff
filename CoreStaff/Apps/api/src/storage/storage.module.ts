import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

/** Private object storage (TASK-029). No Mongo — injectable S3 client only. */
@Module({
  providers: [
    StorageService,
    // StorageService injects S3Client; without this provider Nest's DI throws
    // UnknownDependencies at boot. null when unconfigured → upload/download
    // fail loudly with STORAGE_NOT_CONFIGURED (same path as the ctor fallback).
    {
      provide: S3Client,
      useFactory: () => {
        const region = process.env.S3_REGION?.trim();
        const endpoint = process.env.S3_ENDPOINT?.trim(); // MinIO / LocalStack dev override
        if (!region || !process.env.S3_BUCKET?.trim()) return null;
        return new S3Client({ region, ...(endpoint ? { endpoint } : {}) });
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
