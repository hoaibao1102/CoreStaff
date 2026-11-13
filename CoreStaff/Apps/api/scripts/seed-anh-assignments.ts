/**
 * Assignment roster (bảng phân công) for the ANH company: months 2026-09 and 2026-10.
 *
 * The API refuses assignments whose effectiveFrom is in the past
 * (EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST), so backfilled months are written
 * straight to Mongo, like the other seed-*.ts scripts. Idempotent: every row is
 * looked up first and skipped when it exists. Touches only the ANH organization.
 *
 *   npx ts-node-script scripts/seed-anh-assignments.ts           # dry-run
 *   npx ts-node-script scripts/seed-anh-assignments.ts --apply
 */
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import { ShiftScope } from '../src/database/schemas/enums';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const APPLY = process.argv.includes('--apply');
const ORG_CODE = 'ANH';

const MONTHS = [
  { label: '2026-09', from: '2026-09-01', to: '2026-09-30' },
  { label: '2026-10', from: '2026-10-01', to: '2026-10-31' },
];

// email -> department code (same layout as scripts/qa_company_anh.py)
const STAFF: Array<{ email: string; dept: 'KD' | 'KT' }> = [
  { email: 'quanly.kd@anh.local', dept: 'KD' },
  { email: 'nv.kd1@anh.local', dept: 'KD' },
  { email: 'nv.kd2@anh.local', dept: 'KD' },
  { email: 'quanly.kt@anh.local', dept: 'KT' },
  { email: 'nv.kt1@anh.local', dept: 'KT' },
  { email: 'nv.kt2@anh.local', dept: 'KT' },
];

const counts = { created: 0, skipped: 0, planned: 0 };

async function ensure(model: mongoose.Model<any>, query: Record<string, unknown>, doc: Record<string, unknown>, label: string) {
  const existing = await model.findOne(query).lean();
  if (existing) {
    counts.skipped++;
    console.log(`  skip     ${label}`);
    return (existing as any)._id as mongoose.Types.ObjectId;
  }
  if (!APPLY) {
    counts.planned++;
    console.log(`  plan     ${label}`);
    return new mongoose.Types.ObjectId();
  }
  const created = await model.create(doc);
  counts.created++;
  console.log(`  created  ${label}`);
  return (created as any)._id as mongoose.Types.ObjectId;
}

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured in .env');
  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  await db.asPromise();
  for (const { name, schema } of SCHEMA_REGISTRY) if (!db.models[name]) db.model(name, schema);

  try {
    const org = await db.model('Organization').findOne({ code: ORG_CODE }).lean<any>();
    if (!org) throw new Error(`organization ${ORG_CODE} not found — run scripts/qa_company_anh.py first`);
    const organizationId = org._id;
    console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — ${org.name} (${ORG_CODE})`);

    const depts = await db.model('Department').find({ organizationId }).lean<any[]>();
    const deptId = new Map(depts.map((d) => [d.code, d._id]));
    for (const code of ['KD', 'KT']) if (!deptId.get(code)) throw new Error(`department ${code} missing`);

    const workplaceId = await ensure(db.model('Workplace'), { organizationId, code: 'HQ' }, {
      organizationId, code: 'HQ', name: 'Trụ sở chính Ánh',
      address: 'Quận 1, TP. Hồ Chí Minh',
      latitude: 10.7769, longitude: 106.7009, allowedRadiusMeters: 300, maximumAccuracyMeters: 100,
      allowedWifiNetworks: [{ label: 'Văn phòng', ssid: 'Anh_Office', bssid: '00:11:22:33:44:66' }],
      active: true,
    }, 'workplace HQ');

    // Mon–Fri 08:00–17:00 with a 1h lunch; ongoing from 2026-09-01 so both months resolve to it.
    const shiftTemplateId = await ensure(db.model('ShiftTemplate'), { organizationId, code: 'HC-0800' }, {
      organizationId, code: 'HC-0800', name: 'Ca hành chính (08:00 - 17:00)',
      scope: ShiftScope.ORGANIZATION, weekdays: [1, 2, 3, 4, 5],
      effectiveFrom: MONTHS[0].from,
      startTime: '08:00', endTime: '17:00',
      breakStartTime: '12:00', breakEndTime: '13:00', breakMinutes: 60,
      gracePeriodMinutes: 15, active: true,
    }, 'shift HC-0800 (T2–T6, 08:00–17:00)');

    for (const person of STAFF) {
      const user = await db.model('User').findOne({ organizationId, emailN: person.email }).lean<any>();
      if (!user) throw new Error(`user ${person.email} not found`);
      for (const m of MONTHS) {
        await ensure(db.model('Assignment'), { organizationId, userId: user._id, effectiveFrom: m.from }, {
          organizationId, userId: user._id, departmentId: deptId.get(person.dept),
          workplaceId, shiftTemplateId,
          effectiveFrom: m.from, effectiveTo: m.to, active: true,
        }, `${m.label} ${person.dept} ${person.email}`);
      }
    }
    console.log(`\ncreated=${counts.created} skipped=${counts.skipped} planned=${counts.planned}`);
    if (!APPLY) console.log('dry-run only — pass --apply to write');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
