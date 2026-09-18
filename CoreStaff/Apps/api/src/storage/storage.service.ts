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
    const region = process.env.S3_REGION?.trim();
    const endpoint = process.env.S3_ENDPOINT?.trim(); // MinIO / LocalStack dev override
    if (!region || !process.env.S3_BUCKET?.trim()) return null;
    return new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
    });
  }

  /** True when region + bucket are configured (S3_REGION / S3_BUCKET present). */
  isConfigured(): boolean {
    return Boolean(this.s3 && process.env.S3_BUCKET?.trim());
  }

  /** Fail loudly, never hang: miss a key-looking 400 instead of a timeout. */
  private requireClient(): S3Client {
    if (!this.s3 || !process.env.S3_BUCKET?.trim()) {
      throw new BadRequestException('STORAGE_NOT_CONFIGURED');
    }
    return this.s3;
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