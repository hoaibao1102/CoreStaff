import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
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
  private readonly injectedClient: boolean;

  constructor(s3?: S3Client) {
    this.injectedClient = Boolean(s3);
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

  /**
   * Dev-only disk storage. Without an S3 bucket an upload used to keep only the
   * Mongo metadata, so every selfie rendered as a broken image. Never active in
   * production (a missing bucket there must still fail loudly) or in tests.
   */
  private useLocalDisk(): boolean {
    if (this.injectedClient || process.env.S3_BUCKET?.trim()) return false;
    const env = process.env.NODE_ENV;
    return env !== 'production' && env !== 'test';
  }

  /** Root of the dev disk store; override with LOCAL_STORAGE_DIR. */
  localRoot(): string {
    return resolve(process.env.LOCAL_STORAGE_DIR?.trim() || join(process.cwd(), '.local-storage'));
  }

  /** Maps a key to a path inside the store; rejects keys that escape it. */
  localPath(key: string): string {
    const root = this.localRoot();
    const target = resolve(root, key);
    if (target !== root && !target.startsWith(root + sep)) throw new BadRequestException('STORAGE_INVALID_KEY');
    return target;
  }

  /** True when a bucket and a usable client are available (or the dev disk store is on). */
  isConfigured(): boolean {
    if (this.useLocalDisk()) return true;
    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket || !this.s3) return false;
    if (this.injectedClient) return true;
    // AUD-H14: with no explicit keys the AWS provider chain (IAM role, SSO,
    // container credentials) resolves them, so bucket + client is enough. Only
    // a half-specified key pair is a misconfiguration.
    const hasId = Boolean(process.env.S3_ACCESS_KEY_ID?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim());
    const hasSecret = Boolean(process.env.S3_SECRET_ACCESS_KEY?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim());
    return hasId === hasSecret;
  }

  /** Fail loudly, never hang: miss a key-looking 400 instead of a timeout. */
  private requireClient(): S3Client {
    if (!this.s3 || !this.isConfigured()) {
      throw new BadRequestException('STORAGE_NOT_CONFIGURED');
    }
    return this.s3;
  }

  async upload(key: string, body: Buffer | Readable, contentType: string): Promise<void> {
    if (this.useLocalDisk()) {
      const target = this.localPath(key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
      return;
    }
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
    if (this.useLocalDisk()) {
      const target = this.localPath(key);
      try { await stat(target); } catch { throw new BadRequestException('STORAGE_OBJECT_MISSING'); }
      return createReadStream(target);
    }
    const out: GetObjectCommandOutput = await this.requireClient().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!.trim(), Key: key }),
    );
    if (!out.Body) throw new BadRequestException('STORAGE_OBJECT_MISSING');
    return Readable.from(out.Body as Readable);
  }

  async remove(key: string): Promise<void> {
    if (this.useLocalDisk()) {
      await rm(this.localPath(key), { force: true });
      return;
    }
    await this.requireClient().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!.trim(), Key: key }),
    );
  }
}