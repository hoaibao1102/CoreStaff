import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import { TimesheetSummaryService } from '../src/hr/timesheet/timesheet-summary.service';
import { PayrollSnapshotService } from '../src/hr/timesheet/payroll-snapshot.service';

const USER_ID = '6aad6aedf0643efc4ddf03eb';
const PERIOD = '2026-09';

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  await db.asPromise();
  try {
    for (const { name, schema } of SCHEMA_REGISTRY) {
      if (!db.models[name]) db.model(name, schema);
    }
    const User = db.model<any>('User');
    const Profile = db.model<any>('EmployeeProfile');
    const Period = db.model<any>('TimesheetPeriod');
    const Assignment = db.model<any>('Assignment');

    const user: any = await User.findById(USER_ID).lean();
    const profile: any = await Profile.findOne({ organizationId: user.organizationId, userId: user._id }).lean();
    const period: any = await Period.findOne({ organizationId: user.organizationId, period: PERIOD }).lean();
    const assignment: any = await Assignment.findOne({ organizationId: user.organizationId, userId: user._id, active: true }).lean();
    if (!user || !profile || !period || !assignment) throw new Error('Missing user/profile/period/assignment.');

    const summaryService = new TimesheetSummaryService(
      db.model('TimesheetSummary') as any,
      db.model('AttendanceDay') as any,
      db.model('OvertimeResult') as any,
      db.model('EmployeeProfile') as any,
      db.model('User') as any,
      db.model('Assignment') as any,
    );
    const snapshotService = new PayrollSnapshotService(
      db.model('PayrollInputSnapshot') as any,
      db.model('TimesheetSummary') as any,
      db.model('EmployeeProfile') as any,
      db.model('SalaryProfile') as any,
      db.model('OrganizationAllowance') as any,
      db.model('AttendanceBonusPolicy') as any,
      db.model('KpiPayrollInput') as any,
      db.model('InsurancePolicy') as any,
      db.model('InsuranceProfile') as any,
      db.model('TaxPolicy') as any,
    );

    const summaries = await summaryService.previewSummariesForDepartment(
      String(period._id),
      period.period,
      String(user.organizationId),
      String(assignment.departmentId),
    );
    const snapshots = await snapshotService.previewSnapshotsForDepartment(
      String(period._id),
      period.period,
      String(user.organizationId),
      summaries,
    );
    const targetSummary = summaries.find((item: any) => String(item.employeeProfileId) === String(profile._id));
    const targetSnapshot = snapshots.find((item: any) => String(item.employeeProfileId) === String(profile._id));
    console.log(JSON.stringify({
      periodId: String(period._id),
      departmentId: String(assignment.departmentId),
      summaryCount: summaries.length,
      snapshotCount: snapshots.length,
      targetSummary: targetSummary ? {
        fullName: targetSummary.fullName,
        employeeCode: targetSummary.employeeCode,
        workingDays: targetSummary.workingDays,
        presentDays: targetSummary.presentDays,
        totalWorkingMinutes: targetSummary.totalWorkingMinutes,
        lateMinutes: targetSummary.totalLateMinutes,
        earlyMinutes: targetSummary.totalEarlyMinutes,
        incompleteDays: targetSummary.incompleteDays,
        holidayDays: targetSummary.holidayDays,
        otWorkingDayMinutes: targetSummary.otWorkingDayMinutes,
        otPublicHolidayMinutes: targetSummary.otPublicHolidayMinutes,
        totalOvertimeMinutes: targetSummary.totalOvertimeMinutes,
      } : null,
      targetSnapshot: targetSnapshot ? {
        monthlyBaseSalary: targetSnapshot.monthlyBaseSalary,
        proratedBaseSalary: targetSnapshot.proratedBaseSalary,
        totalAllowances: targetSnapshot.totalAllowances,
        nonTaxableAllowances: targetSnapshot.nonTaxableAllowances,
        allowanceBreakdown: targetSnapshot.allowanceBreakdown,
        attendanceBonus: targetSnapshot.attendanceBonus,
        kpiBonus: targetSnapshot.kpiBonus,
        contributionBase: targetSnapshot.contributionBase,
        socialInsurance: targetSnapshot.socialInsurance,
        healthInsurance: targetSnapshot.healthInsurance,
        unemploymentInsurance: targetSnapshot.unemploymentInsurance,
        taxableEarnings: targetSnapshot.taxableEarnings,
      } : null,
    }, null, 2));
    if (!targetSummary || !targetSnapshot) throw new Error('Target employee is absent from manager preview.');
    if (targetSummary.workingDays !== 20 || targetSummary.presentDays !== 22 || targetSummary.holidayDays !== 2 || targetSummary.incompleteDays !== 0) {
      throw new Error('Target attendance summary is inconsistent.');
    }
    if (targetSummary.otWorkingDayMinutes !== 120 || targetSummary.otPublicHolidayMinutes !== 960 || targetSummary.totalOvertimeMinutes !== 1080) {
      throw new Error('Target overtime summary is inconsistent.');
    }
    if (targetSnapshot.proratedBaseSalary !== 16_000_000 || targetSnapshot.totalAllowances !== 3_130_000 || targetSnapshot.attendanceBonus !== 1_000_000 || targetSnapshot.kpiBonus !== 2_000_000) {
      throw new Error('Target compensation snapshot is incomplete.');
    }
  } finally {
    await closeConnection(db);
  }
}

void main().catch((error) => {
  console.error('[verify-target-snapshot-preview] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
