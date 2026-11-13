/**
 * Labor compliance + overtime pay policy for the ANH company.
 *
 * Without an effective LaborCompliancePolicy, approving an overtime request fails
 * with LABOR_POLICY_NOT_FOUND. Values mirror scripts/seed-full-organization.ts.
 * Idempotent: skipped when the ANH organization already has a policy of that kind.
 * Touches only the ANH organization.
 *
 *   npx ts-node-script scripts/seed-anh-policies.ts           # dry-run
 *   npx ts-node-script scripts/seed-anh-policies.ts --apply
 */
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const APPLY = process.argv.includes('--apply');
const ORG_CODE = 'ANH';

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

    const policies: Array<[string, Record<string, unknown>]> = [
      ['LaborCompliancePolicy', {
        normalDailyMinutes: 480, normalWeeklyMinutes: 2880, maxCombinedDailyMinutes: 720,
        maxMonthlyOvertimeMinutes: 2400, maxAnnualOvertimeMinutes: 20000, exceptionalAnnualOvertimeMinutes: 24000,
        warningThresholdPercent: 80, maxRetroactiveFilingDays: 7, probationMinimumRate: 0.85,
      }],
      ['OvertimePayPolicy', { workingDayRate: 1.5, weeklyOffRate: 2.0, publicHolidayRate: 3.0 }],
    ];

    for (const [model, values] of policies) {
      const existing = await db.model(model).find({ organizationId }).lean<any[]>();
      if (existing.length) {
        console.log(`  skip     ${model} (already ${existing.length}: active=${existing.map((p) => p.active)} from=${existing.map((p) => new Date(p.effectiveFrom).toISOString().slice(0, 10))})`);
        continue;
      }
      if (!APPLY) { console.log(`  plan     ${model}`); continue; }
      await db.model(model).create({
        organizationId, effectiveFrom: new Date('2026-01-01'), legalReference: 'BLLĐ 45/2019/QH14',
        version: 1, active: true, ...values,
      });
      console.log(`  created  ${model}`);
    }
    if (!APPLY) console.log('dry-run only — pass --apply to write');
  } finally {
    await db.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
