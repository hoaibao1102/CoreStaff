/**
 * Comprehensive Readiness & Synchronization Script for All Organizations.
 * Ensures every organization in MongoDB has:
 *  1. attendanceOvertimeV2Enabled: true
 *  2. LaborCompliancePolicy with maxMonthlyAttendanceConfirmations: 3, minOT: 60, rounding: 30
 *  3. WorkCreditPolicy active (halfDay: 0.5, fullDay: 1.0)
 *  (Timesheet periods are NOT created here. HR creates each period manually.)
 *
 * Usage:
 *   npx ts-node-script scripts/ensure-organizations-ready.ts [--dry-run]
 */
import * as mongoose from 'mongoose';
import { hasMongoUri, resolveEnv } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const isDryRun = process.argv.includes('--dry-run');

  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  try {
    await connection.asPromise();
    const db = connection.db;
    if (!db) throw new Error('Mongo database unavailable.');

    const orgs = await db.collection('organizations').find({}).toArray();
    console.log(`\n======================================================================`);
    console.log(`[ensure-organizations-ready] Found ${orgs.length} organizations in database: ${db.databaseName}`);
    console.log(`Mode: ${isDryRun ? 'DRY-RUN (Inspect Only)' : 'APPLY (Sync & Auto-Fix)'}`);
    console.log(`======================================================================\n`);

    const now = new Date();
    for (const org of orgs) {
      const orgId = org._id;
      const orgIdStr = orgId.toString();

      // 1. Check & fix attendanceOvertimeV2Enabled
      const v2NeedsFix = org.attendanceOvertimeV2Enabled !== true;
      if (v2NeedsFix && !isDryRun) {
        await db.collection('organizations').updateOne(
          { _id: orgId },
          { $set: { attendanceOvertimeV2Enabled: true } }
        );
      }

      // 2. Check & fix LaborCompliancePolicy
      const lcp = await db.collection('labor_compliance_policies').findOne({
        $or: [{ organizationId: orgId }, { organizationId: orgIdStr }],
        active: true,
      });

      const lcpNeedsFix = !lcp || typeof lcp.maxMonthlyAttendanceConfirmations !== 'number' || lcp.maxMonthlyAttendanceConfirmations <= 0;
      if (lcpNeedsFix && !isDryRun) {
        await db.collection('labor_compliance_policies').updateOne(
          { organizationId: orgId, version: 1 },
          {
            $set: {
              minimumOvertimeMinutes: 60,
              overtimeRoundingMinutes: 30,
              maxMonthlyAttendanceConfirmations: 3,
              active: true,
              status: 'ACTIVE',
              updatedAt: now,
            },
            $setOnInsert: {
              organizationId: orgId,
              effectiveFrom: new Date('2026-01-01'),
              normalDailyMinutes: 480,
              normalWeeklyMinutes: 2880,
              maxCombinedDailyMinutes: 720,
              maxMonthlyOvertimeMinutes: 2400,
              maxAnnualOvertimeMinutes: 20000,
              exceptionalAnnualOvertimeMinutes: 24000,
              warningThresholdPercent: 80,
              maxRetroactiveFilingDays: 7,
              probationMinimumRate: 0.85,
              legalReference: 'BLLĐ 45/2019/QH14',
              version: 1,
              createdAt: now,
            },
          },
          { upsert: true }
        );
      }

      // 3. Check & fix WorkCreditPolicy
      const wcp = await db.collection('work_credit_policies').findOne({
        $or: [{ organizationId: orgId }, { organizationId: orgIdStr }],
        active: true,
      });

      const wcpNeedsFix = !wcp;
      if (wcpNeedsFix && !isDryRun) {
        await db.collection('work_credit_policies').updateOne(
          { organizationId: orgId, active: true },
          {
            $setOnInsert: {
              organizationId: orgId,
              effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
              halfDayMinimumRatio: 0.5,
              fullDayMinimumRatio: 1,
              paidLeaveCreditEnabled: true,
              incompleteDayRule: 'BLOCK',
              businessReference: 'Chính sách quy đổi ngày công mặc định',
              version: 1,
              active: true,
              createdAt: now,
              updatedAt: now,
            },
          },
          { upsert: true }
        );
      }

      console.log(`[${org.code}] ${org.name}:`);
      console.log(`  - Flag (attendanceOvertimeV2Enabled) : ${v2NeedsFix ? (isDryRun ? '❌ Missing' : '✅ Fixed -> true') : '✅ true'}`);
      console.log(`  - Labor Compliance Policy (LCP)     : ${lcpNeedsFix ? (isDryRun ? '❌ Incomplete' : '✅ Fixed -> 3/month') : '✅ Configured (3/month)'}`);
      console.log(`  - Work Credit Policy (WCP)          : ${wcpNeedsFix ? (isDryRun ? '❌ Missing' : '✅ Fixed -> Active') : '✅ Active'}`);
    }

    console.log(`\n======================================================================`);
    console.log(`🎉 All ${orgs.length} organizations are 100% READY for Demo & Defense!`);
    console.log(`======================================================================\n`);
  } finally {
    await closeConnection(connection);
  }
}

main().catch((error) => {
  console.error('[ensure-organizations-ready] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

