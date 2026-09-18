import { BadRequestException } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { StorageService } from './storage.service';

/** Fake AWS client: asserts the exact commands/file payloads the service sends. */
function mockS3() {
  const calls: { op: string; key?: string; body?: Buffer; contentType?: string }[] = [];
  const s3 = {
    send: jest.fn(async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const input = command.input as Record<string, unknown>;
      calls.push({
        op: command.constructor.name,
        key: input.Key as string | undefined,
        body: input.Body as Buffer | undefined,
        contentType: input.ContentType as string | undefined,
      });
      if (command.constructor.name === 'GetObjectCommand' && input.Bucket === 'missing-bucket') {
        return { Body: undefined };
      }
      return { Body: Readable.from('file-bytes') };
    }),
  };
  return { s3: s3 as unknown as S3Client, calls };
}
function setEnv(opts: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('StorageService', () => {
  beforeEach(() => {
    setEnv({
      S3_REGION: 'ap-southeast-1',
      S3_BUCKET: 'corestaff-docs',
      S3_ENDPOINT: undefined,
    });
  });
  afterEach(() => setEnv({ S3_REGION: undefined, S3_BUCKET: undefined, S3_ENDPOINT: undefined }));

  it('reports not configured when region or bucket is missing', () => {
    setEnv({ S3_REGION: 'ap-southeast-1', S3_BUCKET: undefined });
    const s = new StorageService(null as never);
    expect(s.isConfigured()).toBe(false);
    void expect(s.upload('k', Buffer.from('x'), 'text/plain')).rejects.toThrow(BadRequestException);
  });

  it('uploads with the exact bucket/key/body/content-type', async () => {
    const { s3, calls } = mockS3();
    const s = new StorageService(s3);
    await s.upload('org-a/id-1', Buffer.from('pdf'), 'application/pdf');
    expect(calls).toEqual([
      { op: 'PutObjectCommand', key: 'org-a/id-1', body: Buffer.from('pdf'), contentType: 'application/pdf' },
    ]);
  });

  it('downloads a stream for a stored key', async () => {
    const { s3 } = mockS3();
    const stream = await new StorageService(s3).download('org-a/id-1');
    expect(Readable.isReadable(stream)).toBe(true);
    const chunk = await new Promise<string | undefined>((resolve) => stream.once('data', resolve));
    expect(chunk).toBe('file-bytes');
  });

  it('deletes a key', async () => {
    const { s3, calls } = mockS3();
    await new StorageService(s3).remove('org-a/id-1');
    expect(calls).toEqual([{ op: 'DeleteObjectCommand', key: 'org-a/id-1' }]);
  });
});