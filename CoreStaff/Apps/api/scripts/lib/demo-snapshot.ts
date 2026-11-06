/**
 * Ảnh chụp dữ liệu tenant để `demo:rollback` tua lại trong vài giây thay vì
 * seed lại 3 phút. Hai điểm chụp, chọn bằng `demo:rollback --to=…`:
 *
 *   alt  — ngay sau seed: còn đủ 4 blocker/exceptions để demo nhánh alt.
 *   main — sau khi đã gỡ hộ 3 blocker, chỉ còn selfie NV-KD-002 15/10 (mặc định).
 *
 * Bỏ qua `UserSession` khi chụp và khi xoá: các tab trình duyệt đã đăng nhập
 * trước buổi demo phải giữ nguyên phiên sau khi rollback.
 */
import { EJSON } from 'bson';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Connection, Model } from 'mongoose';

export type SnapshotStage = 'main' | 'alt';

/** What a snapshot needs from the app — `DemoApp` satisfies this, and so does a raw connection. */
export interface SnapshotDb {
  connection: Connection;
  model: (name: string) => Model<any>;
}

const DIR = path.resolve(__dirname, '..', '..', '.demo-snapshot');
const file = (orgCode: string, stage: SnapshotStage) => path.join(DIR, `${orgCode.toUpperCase()}-${stage}.json`);

function orgScopedModels(demo: SnapshotDb): Model<any>[] {
  return demo.connection.modelNames()
    .filter(name => name !== 'Organization' && name !== 'UserSession' && demo.model(name).schema.path('organizationId'))
    .map(name => demo.model(name));
}

const orgFilter = (orgId: any) => ({ organizationId: { $in: [orgId, String(orgId)] } });

export async function saveOrgSnapshot(demo: SnapshotDb, orgCode: string, stage: SnapshotStage): Promise<void> {
  const org: any = await demo.model('Organization').findOne({ code: orgCode }).lean();
  if (!org) throw new Error(`Tenant ${orgCode} chưa tồn tại.`);
  const collections: Record<string, any[]> = { Organization: [org] };
  let rows = 1;
  for (const model of orgScopedModels(demo)) {
    const docs = await model.collection.find(orgFilter(org._id)).toArray();
    if (!docs.length) continue;
    collections[model.modelName] = docs;
    rows += docs.length;
  }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file(orgCode, stage), EJSON.stringify({ orgCode, stage, takenAt: new Date().toISOString(), collections }, { relaxed: false }));
  console.log(`  ✓ Đã chụp trạng thái ${stage}: ${rows} bản ghi → ${path.relative(process.cwd(), file(orgCode, stage))}`);
}

export async function restoreOrgSnapshot(demo: SnapshotDb, orgCode: string, stage: SnapshotStage): Promise<void> {
  const source = file(orgCode, stage);
  if (!fs.existsSync(source)) {
    throw new Error(`Chưa có bản chụp ${stage} của ${orgCode}. Chạy "npm run seed:demo:reset" (tự chụp cả 2) rồi demo lại.`);
  }
  const snapshot: any = EJSON.parse(fs.readFileSync(source, 'utf8'), { relaxed: false });
  const org: any = await demo.model('Organization').findOne({ code: orgCode }).lean();
  if (!org) throw new Error(`Tenant ${orgCode} chưa tồn tại.`);

  // Wipe and refill in parallel batches: this path runs between demo takes, so
  // wall-clock here is the thing that matters. Only collections that actually
  // hold tenant rows are touched — the rest would be 40+ round-trips on a
  // remote cluster to delete nothing.
  const stored = Object.keys(snapshot.collections as Record<string, any[]>).filter(name => name !== 'Organization');
  await Promise.all(stored.map(name => demo.model(name).collection.deleteMany(orgFilter(org._id))));
  await demo.model('Organization').collection.deleteOne({ _id: org._id });

  const entries = Object.entries(snapshot.collections as Record<string, any[]>).filter(([, docs]) => docs.length);
  await Promise.all(entries.map(([name, docs]) => demo.model(name).collection.insertMany(docs, { ordered: true })));
  const rows = entries.reduce((sum, [, docs]) => sum + docs.length, 0);
  console.log(`  ✓ Đã tua tenant ${orgCode} về trạng thái "${stage}" (${rows} bản ghi, chụp lúc ${snapshot.takenAt}).`);
}
