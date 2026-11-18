/**
 * Audit (and optionally repair) assignment rows HR cannot work with in the UI.
 *
 * HR may only assign — and later edit — employees who are currently working
 * (PROBATION / ACTIVE / ON_LEAVE, SRS §176). Older seed runs left rows that
 * break that rule. This script reports them and, with --apply, soft-deactivates
 * the ones that are safe to retire.
 *
 *   A. Assignment whose organization no longer exists   -> report only
 *   B. Active assignment whose user has NO employee profile in its tenant
 *                                                        -> --apply sets active=false
 *   C. Active assignment whose employee is RESIGNED/TERMINATED
 *                                                        -> report only (history matters)
 *   D. Active assignments of one user+department with overlapping windows
 *                                                        -> report only (HR decides)
 *
 * Nothing is ever hard-deleted. Default is a dry run.
 *
 * Usage:
 *   npx ts-node-script scripts/repair-assignments.ts            # dry run
 *   npx ts-node-script scripts/repair-assignments.ts --apply    # deactivate group B
 */
import * as mongoose from 'mongoose';
import { hasMongoUri, resolveEnv } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';

const WORKING = ['PROBATION', 'ACTIVE', 'ON_LEAVE'];

function rangeOf(row: any): string {
  return `${row.effectiveFrom?.slice(0, 10) ?? '-∞'} → ${row.effectiveTo?.slice(0, 10) ?? 'không thời hạn'}`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');

  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  try {
    await connection.asPromise();
    const db = connection.db;
    if (!db) throw new Error('Mongo database unavailable.');

    const orgs = new Map((await db.collection('organizations').find({}).project({ code: 1 }).toArray()).map(o => [String(o._id), String(o.code)]));
    const profiles = await db.collection('employee_profiles').find({}).project({ userId: 1, organizationId: 1, employmentStatus: 1, employeeCode: 1 }).toArray();
    const profileOf = new Map(profiles.map(p => [`${p.organizationId}|${p.userId}`, p]));
    const users = new Map((await db.collection('users').find({}).project({ email: 1 }).toArray()).map(u => [String(u._id), String(u.email)]));
    const assignments = await db.collection('assignments').find({}).toArray();

    console.log(`[repair-assignments] database=${db.databaseName} assignments=${assignments.length} mode=${apply ? 'APPLY' : 'DRY-RUN'}\n`);

    const orphanOrg = assignments.filter(a => !orgs.has(String(a.organizationId)));
    const live = assignments.filter(a => orgs.has(String(a.organizationId)));
    const noProfile = live.filter(a => a.active && !profileOf.has(`${a.organizationId}|${a.userId}`));
    const notWorking = live.filter(a => {
      const profile = profileOf.get(`${a.organizationId}|${a.userId}`);
      return a.active && profile && !WORKING.includes(String(profile.employmentStatus));
    });

    console.log(`A. Thuộc tổ chức không còn tồn tại (chỉ báo cáo): ${orphanOrg.length}`);
    console.log(`B. Đang hoạt động nhưng người dùng KHÔNG có hồ sơ nhân viên: ${noProfile.length}`);
    for (const a of noProfile) console.log(`   - ${orgs.get(String(a.organizationId))} | ${users.get(String(a.userId)) ?? a.userId} | ${rangeOf(a)} | ${a._id}`);
    console.log(`C. Đang hoạt động nhưng nhân viên đã nghỉ việc (chỉ báo cáo): ${notWorking.length}`);
    for (const a of notWorking) {
      const profile = profileOf.get(`${a.organizationId}|${a.userId}`)!;
      console.log(`   - ${orgs.get(String(a.organizationId))} | ${profile.employeeCode} (${profile.employmentStatus}) | ${rangeOf(a)} | ${a._id}`);
    }

    const groups = new Map<string, any[]>();
    for (const a of live.filter(row => row.active)) {
      const key = `${a.organizationId}|${a.userId}|${a.departmentId}`;
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    let overlaps = 0;
    for (const rows of groups.values()) {
      for (let i = 0; i < rows.length; i += 1) {
        for (let j = i + 1; j < rows.length; j += 1) {
          const from = (r: any) => (r.effectiveFrom ? new Date(r.effectiveFrom).getTime() : -Infinity);
          const to = (r: any) => (r.effectiveTo ? new Date(r.effectiveTo).getTime() : Infinity);
          if (from(rows[i]) <= to(rows[j]) && from(rows[j]) <= to(rows[i])) {
            overlaps += 1;
            console.log(`D. Trùng thời gian: ${orgs.get(String(rows[i].organizationId))} | ${users.get(String(rows[i].userId)) ?? rows[i].userId} | ${rangeOf(rows[i])} <-> ${rangeOf(rows[j])}`);
          }
        }
      }
    }
    console.log(`D. Cặp phân công trùng thời gian (chỉ báo cáo): ${overlaps}`);

    if (!apply) {
      console.log('\nDry run — chưa ghi gì. Chạy lại với --apply để ngưng hoạt động nhóm B.');
      return;
    }
    if (noProfile.length) {
      const result = await db.collection('assignments').updateMany(
        { _id: { $in: noProfile.map(a => a._id) } },
        { $set: { active: false, updatedAt: new Date() } },
      );
      console.log(`\nĐã ngưng hoạt động ${result.modifiedCount} phân công nhóm B (không xóa dữ liệu).`);
    } else {
      console.log('\nKhông có phân công nhóm B cần xử lý.');
    }
  } finally {
    await closeConnection(connection);
  }
}

main().catch((error) => {
  console.error('[repair-assignments] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
