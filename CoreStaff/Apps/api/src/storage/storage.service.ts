import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

/**
 * TASK-029 / SRS §23.2:2216 — private object storage for employee documents.
 * S3-compatible (AWS S3 for the deployed API on EC2). Bytes are never served
 * publicly: every read goes through an authenticated controller which streams
 * the object with an authorization check first. `storageKey` is always
 * `${organizationId}/${_id}`, so tenant scope is encoded in the key itself.
 *
 * One implementation only — no abstraction layer. If a future host needs a
 * different backend, swap the three methods here.
 */
@Injectable()
export class StorageService {
  private readonly s3: S3Client | null;

  constructor(s3?: S3Client) {
    this.s3 = s3 ?? this.buildClient();
  }

  private buildClient(): S3Client | null {
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
  }

  /** True when region + bucket are configured and credentials present. */
  isConfigured(): boolean {
    const bucket = process.env.S3_BUCKET?.trim();
    const accessKeyId =
      process.env.S3_ACCESS_KEY_ID?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey =
      process.env.S3_SECRET_ACCESS_KEY?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim();
    return Boolean(bucket && accessKeyId && secretAccessKey);
  }

  /** Fail loudly, never hang: miss a key-looking 400 instead of a timeout. */
  private requireClient(): S3Client {
    const client = this.buildClient();
    if (!client || !this.isConfigured()) {
      throw new BadRequestException('STORAGE_NOT_CONFIGURED');
    }
    return client;
  }

  async upload(key: string, body: Buffer | Readable, contentType: string): Promise<void> {
    await this.requireClient().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!.trim(),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /** Returns the object byte stream. Caller must consume/close it. */
  async download(key: string): Promise<Readable> {
    const out: GetObjectCommandOutput = await this.requireClient().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!.trim(), Key: key }),
    );
    if (!out.Body) throw new BadRequestException('STORAGE_OBJECT_MISSING');
    return Readable.from(out.Body as Readable);
  }

  async remove(key: string): Promise<void> {
    await this.requireClient().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!.trim(), Key: key }),
    );
  }
}