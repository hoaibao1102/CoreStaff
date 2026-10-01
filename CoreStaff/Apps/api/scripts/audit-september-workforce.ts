import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';

const args = process.argv.slice(2);
const ANCHOR_USER_ID = args.find((arg) => arg.startsWith('--anchor-user-id='))?.split('=')[1] ?? '';
const PERIOD = args.find((arg) => arg.startsWith('--period='))?.split('=')[1] ?? '2026-09';

async function main() {
  if (!mongoose.isValidObjectId(ANCHOR_USER_ID)) throw new Error('Invalid --anchor-user-id.');
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  await db.asPromise();
  try {
    for (const { name, schema } of SCHEMA_REGISTRY) if (!db.models[name]) db.model(name, schema);
    const User = db.model<any>('User');
    const Profile = db.model<any>('EmployeeProfile');
    const Assignment = db.model<any>('Assignment');
    const Period = db.model<any>('TimesheetPeriod');
    const AttendanceDay = db.model<any>('AttendanceDay');
    const AttendanceEvent = db.model<any>('AttendanceEvent');
    const Summary = db.model<any>('TimesheetSummary');
    const Snapshot = db.model<any>('PayrollInputSnapshot');
    const Salary = db.model<any>('SalaryProfile');
    const Insurance = db.model<any>('InsuranceProfile');
    const Kpi = db.model<any>('KpiPayrollInput');

    const anchor: any = await User.findById(ANCHOR_USER_ID).select('_id organizationId fullName').lean();
    if (!anchor?.organizationId) throw new Error('Anchor user not found or has no organization.');
    const organizationId = new mongoose.Types.ObjectId(String(anchor.organizationId));
    const period: any = await Period.findOne({ organizationId, period: PERIOD }).lean();
    if (!period) throw new Error(`Timesheet period ${PERIOD} not found.`);
    const profiles: any[] = await Profile.find({ organizationId, employmentStatus: { $in: ['ACTIVE', 'PROBATION'] } }).sort({ employeeCode: 1 }).lean();
    const rows = [];
    for (const profile of profiles) {
      const user: any = await User.findById(profile.userId).select('_id fullName role status').lean();
      const assignment: any = await Assignment.findOne({ organizationId, userId: profile.userId, active: true }).select('departmentId workplaceId shiftTemplateId').lean();
      const days: any[] = await AttendanceDay.find({ organizationId, employeeId: profile.userId, periodId: period._id }).select('_id').lean();
      const events = days.length ? await AttendanceEvent.countDocuments({ organizationId, attendanceDayId: { $in: days.map((day) => day._id) } }) : 0;
      rows.push({
        anchor: String(profile.userId) === ANCHOR_USER_ID,
        userId: String(profile.userId),
        profileId: String(profile._id),
        employeeCode: profile.employeeCode,
        fullName: user?.fullName ?? null,
        employmentStatus: profile.employmentStatus,
        role: user?.role ?? null,
        departmentId: String(assignment?.departmentId ?? profile.departmentId ?? ''),
        assignmentReady: Boolean(assignment?.departmentId && assignment?.shiftTemplateId),
        attendanceDays: days.length,
        attendanceEvents: events,
        summaries: await Summary.countDocuments({ organizationId, periodId: period._id, employeeProfileId: profile._id }),
        snapshots: await Snapshot.countDocuments({ organizationId, periodId: period._id, employeeProfileId: profile._id }),
        salaryProfiles: await Salary.countDocuments({ organizationId, employeeProfileId: profile._id, active: true }),
        insuranceProfiles: await Insurance.countDocuments({ organizationId, employeeId: profile._id }),
        kpiInputs: await Kpi.countDocuments({ organizationId, employeeProfileId: profile._id, period: PERIOD }),
      });
    }
    const targetEmployees = rows.filter((row) => !row.anchor);
    console.log(JSON.stringify({ organizationId: String(organizationId), periodId: String(period._id), periodStatus: period.status, eligibleEmployees: rows.length, anchorEmployees: rows.filter((row) => row.anchor).length, targetEmployees: targetEmployees.length, rows }, null, 2));
    if (rows.length !== 12 || targetEmployees.length !== 11) throw new Error(`Expected 12 employees / 11 targets, got ${rows.length}/${targetEmployees.length}.`);
  } finally {
    await closeConnection(db);
  }
}

void main().catch((error) => {
  console.error('[audit-september-workforce] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
