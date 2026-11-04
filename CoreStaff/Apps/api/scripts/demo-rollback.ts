/**
 * Tua tenant demo về ảnh chụp đã lưu — bản nhẹ của `demo:rollback`.
 *
 * Nằm ngoài `demo-flow.ts` có chủ đích: rollback chỉ đọc/ghi Mongo, không cần
 * một service nghiệp vụ nào. Đi qua Nest sẽ kéo theo biên dịch cả cây module
 * (~7 giây) trước khi chạm DB; ở đây chỉ nạp `SCHEMA_REGISTRY` (~3 giây).
 *
 *   npm run demo:rollback               # về "main": đúng 1 blocker
 *   npm run demo:rollback -- --to=alt   # về "alt": 4 blocker cho nhánh phụ
 */
import 'reflect-metadata';
import * as mongoose from 'mongoose';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import { hasMongoUri, resolveEnv } from '../src/config/env';
import { restoreOrgSnapshot, SnapshotStage } from './lib/demo-snapshot';

const args = process.argv.slice(2);
const arg = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const ORG_CODE = (arg('org-code') ?? 'ANPHAT').toUpperCase();
const STAGE = (arg('to') ?? 'main').toLowerCase() as SnapshotStage;
if (!['main', 'alt'].includes(STAGE)) throw new Error(`--to không hợp lệ: ${STAGE} (chọn main | alt)`);

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured in Apps/api/.env');

  const connection = mongoose.createConnection(env.mongodbUri!, { serverSelectionTimeoutMS: 15000 });
  try {
    await connection.asPromise();
    for (const { name, schema } of SCHEMA_REGISTRY) connection.model(name, schema);
    console.log(`\n▶ Tua tenant ${ORG_CODE} về trạng thái "${STAGE}"`);
    await restoreOrgSnapshot({ connection, model: (name: string) => connection.model(name) }, ORG_CODE, STAGE);
  } finally {
    await connection.close();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('[demo-rollback] Thất bại:', error?.message ?? error);
  process.exit(1);
});
