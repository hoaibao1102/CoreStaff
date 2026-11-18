import * as mongoose from 'mongoose';
import { crc32, deflateSync } from 'node:zlib';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { EvidenceSchema } from '../src/database/schemas/evidence.schema';
import { StorageService } from '../src/storage/storage.service';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Dev only: seeded Evidence rows point at storage keys that never held bytes, so
 * their selfies show as broken images. This writes a placeholder portrait to the
 * local disk store for every Evidence row whose file is missing, and fixes the
 * row's mimeType to match. Rows with a real file are left alone.
 *
 * Usage (from Apps/api):  npx ts-node-script scripts/backfill-local-evidence.ts
 * Refuses to run when S3_BUCKET is set: that store is the source of truth.
 */
const W = 480;
const H = 640;

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body) >>> 0, body.length + 4);
  return out;
}

/** Soft gradient with a head-and-shoulders silhouette, tinted per seed. */
function placeholderPng(seed: number): Buffer {
  const hue = (seed * 47) % 360;
  const tint = (l: number) => {
    const k = (n: number) => (n + hue / 30) % 12;
    const a = 0.35 * Math.min(l, 1 - l);
    return [0, 8, 4].map((n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
  };
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < W; x++) {
      const head = ((x - W / 2) / 85) ** 2 + ((y - 230) / 105) ** 2 <= 1;
      const body = ((x - W / 2) / 190) ** 2 + ((y - 560) / 210) ** 2 <= 1;
      const [r, g, b] = head || body ? tint(0.34) : tint(0.82 - (y / H) * 0.18);
      const o = row + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main(): Promise<void> {
  if (process.env.S3_BUCKET?.trim()) { console.error('[backfill] S3_BUCKET is set; refusing to touch real storage.'); process.exitCode = 1; return; }
  const env = resolveEnv();
  if (!hasMongoUri(env)) { console.error('[backfill] No Mongo URI configured.'); process.exitCode = 1; return; }
  const storage = new StorageService(null as never);
  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  try {
    await connection.asPromise();
    const Evidence = connection.model('Evidence', EvidenceSchema);
    const rows = await Evidence.find({}).select('_id storageKey').lean<Array<{ _id: mongoose.Types.ObjectId; storageKey: string }>>().exec();
    let written = 0;
    for (const [i, row] of rows.entries()) {
      const target = storage.localPath(row.storageKey);
      if (await stat(target).then(() => true, () => false)) continue;
      const png = placeholderPng(i);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, png);
      await Evidence.updateOne({ _id: row._id }, { $set: { mimeType: 'image/png', sizeBytes: png.length } }).exec();
      written++;
    }
    console.log(`[backfill] ${written} placeholder(s) written, ${rows.length - written} already had a file (store: ${storage.localRoot()}).`);
  } finally {
    await connection.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
