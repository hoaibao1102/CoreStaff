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
        const region = process.env.S3_REGION?.trim() || 'auto';
        const endpoint = process.env.S3_ENDPOINT?.trim(); // Cloudflare R2 / MinIO / LocalStack override
        const bucket = process.env.S3_BUCKET?.trim();
        if (!bucket) return null;

        const accessKeyId =
          process.env.S3_ACCESS_KEY_ID?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim();
        const secretAccessKey =
          process.env.S3_SECRET_ACCESS_KEY?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim();

        return new S3Client({
          region,
          ...(endpoint ? { endpoint } : {}),
          ...(accessKeyId && secretAccessKey
            ? {
                credentials: {
                  accessKeyId,
                  secretAccessKey,
                },
              }
            : {}),
        });
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
