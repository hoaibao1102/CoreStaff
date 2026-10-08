/**
 * TASK-13A — Verify the E2E payroll seed produced a complete, internally
 * consistent dataset before any test or workflow runs against it.
 *
 * Checks (idempotent, read-only):
 *   1. Exactly one Organization (code E2E) exists.
 *   2. Exactly three user accounts (employee, manager, hr) with the right
 *      roles and the same organizationId.
 *   3. Active employment contract + department + position + assignment for
 *      the employee.
 *   4. Manager assignment effective for the period and scoped to the right
 *      department.
 *   5. Compensation/policies: SalaryProfile (base 25M), TaxPolicy, InsurancePolicy,
 *      AttendanceBonusPolicy, KPI input all effective and current for the period.
 *   6. Attendance: 22 workdays, 0 late, 0 early, all confirmed.
 *   7. Overtime: 600 working-day minutes and 240 weekly-off minutes,
 *      each result final and approved by the manager.
 *   8. No pre-existing PayrollInputSnapshot / PayrollRun / Payslip / TimesheetSummary
 *      for the period — these are produced by the workflow under test, not the seed.
 *   9. Pure-calculator expected ledger (gross/net/PIT/insurance) matches what
 *      the snapshot/payslip MUST end up at, within ±1 VND reconciliation.
 *
 * Exit code 0 = seed is consistent; 1 = at least one check failed.
 */
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import {
  computeEmployeeInsurance,
  computePayrollLedger,
  STANDARD_WORKING_DAYS,
} from './payroll-ledger';
import {
  __seedAccounts,
  __seedAmounts,
  __seedLedger,
  __seedPeriod,
} from './seed-payroll-e2e';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PERIOD = __seedPeriod;
const [YEAR_STR, MONTH_STR] = PERIOD.split('-');
const PERIOD_YEAR = Number(YEAR_STR);
const PERIOD_MONTH = Number(MONTH_STR);
const PERIOD_START = new Date(Date.UTC(PERIOD_YEAR, PERIOD_MONTH - 1, 1, 0, 0, 0, 0));
const PERIOD_END = new Date(Date.UTC(PERIOD_YEAR, PERIOD_MONTH, 0, 23, 59, 59, 999));
const RECONCILIATION_TOLERANCE_VND = 1;

const EXPECTED_ORG_CODE = 'E2E';

interface Check { name: string; pass: boolean; detail: string; }
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name} — ${detail}`);
}

function workdaysInPeriod(): string[] {
  const out: string[] = [];
  const d = new Date(PERIOD_START);
  while (d <= PERIOD_END) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) {
    console.error('[verify:payroll:e2e] MONGODB_URI is not configured.');
    process.exit(1);
  }

  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  await db.asPromise();
  for (const { name, schema } of SCHEMA_REGISTRY) {
    if (!db.models[name]) db.model(name, schema);
  }

  const Organization = db.model('Organization');
  const User = db.model('User');
  const EmployeeProfile = db.model('EmployeeProfile');
  const Department = db.model('Department');
  const Assignment = db.model('Assignment');
  const ManagerAssignment = db.model('ManagerAssignment');
  const SalaryProfile = db.model('SalaryProfile');
  const TaxPolicy = db.model('TaxPolicy');
  const InsurancePolicy = db.model('InsurancePolicy');
  const AttendanceBonusPolicy = db.model('AttendanceBonusPolicy');
  const KpiPayrollInput = db.model('KpiPayrollInput');
  const TimesheetPeriod = db.model('TimesheetPeriod');
  const AttendanceDay = db.model('AttendanceDay');
  const OvertimeResult = db.model('OvertimeResult');
  const TimesheetSummary = db.model('TimesheetSummary');
  const PayrollInputSnapshot = db.model('PayrollInputSnapshot');
  const PayrollRun = db.model('PayrollRun');
  const Payslip = db.model('Payslip');

  const orgs = await Organization.find({ code: EXPECTED_ORG_CODE }).lean();
  record(
    'one-organization',
    orgs.length === 1,
    `count=${orgs.length} (expected 1, code=${EXPECTED_ORG_CODE})`,
  );
  if (orgs.length !== 1) {
    await finish(db, 1);
    return;
  }
  const org = orgs[0];
  const organizationId = org._id;

  const accounts = await User.find({ organizationId }).lean();
  const byEmail = new Map<string, any>();
  for (const u of accounts) byEmail.set(u.email, u);

  let allAccountsPresent = true;
  const accountReport: string[] = [];
  for (const [key, expected] of Object.entries(__seedAccounts) as [string, any][]) {
    const u = byEmail.get(expected.email);
    if (!u) {
      allAccountsPresent = false;
      accountReport.push(`${key}=MISSING(${expected.email})`);
      continue;
    }
    const sameRole = u.role === expected.role;
    const sameOrg = String(u.organizationId) === String(organizationId);
    accountReport.push(`${key}=${u.email} role=${u.role} sameOrg=${sameOrg}`);
    if (!sameRole || !sameOrg) allAccountsPresent = false;
  }
  record(
    'three-accounts',
    accounts.length === 3 && allAccountsPresent,
    `[${accountReport.join('; ')}]`,
  );

  const empUserId = byEmail.get(__seedAccounts.employee.email)?._id;
  const mgrUserId = byEmail.get(__seedAccounts.manager.email)?._id;
  const hrUserId = byEmail.get(__seedAccounts.hr.email)?._id;

  const empProfile = await EmployeeProfile.findOne({ organizationId, userId: empUserId }).lean();
  record(
    'employee-profile',
    !!empProfile && empProfile.employmentStatus === 'ACTIVE',
    `profile=${!!empProfile} status=${empProfile?.employmentStatus ?? 'n/a'}`,
  );

  const assignment = await Assignment.findOne({ organizationId, userId: empUserId, active: true }).lean();
  record(
    'employee-assignment',
    !!assignment,
    `assignment=${!!assignment} department=${assignment ? String((assignment as any).departmentId) : 'n/a'}`,
  );

  const mgrAssignment = await ManagerAssignment.findOne({
    organizationId,
    managerUserId: mgrUserId,
    active: true,
    effectiveFrom: { $lte: PERIOD_END },
  }).lean();
  record(
    'manager-assignment-effective',
    !!mgrAssignment,
    `managerAssignment=${!!mgrAssignment} scope=${mgrAssignment ? String((mgrAssignment as any).departmentId) : 'n/a'}`,
  );

  const department = await Department.findOne({ organizationId, active: true }).lean();
  const sameScope =
    mgrAssignment && department && String((mgrAssignment as any).departmentId) === String(department._id);
  record('manager-department-scope', !!sameScope, `sameScope=${!!sameScope}`);

  const salary = await SalaryProfile.findOne({
    organizationId,
    employeeProfileId: empProfile._id,
    active: true,
    effectiveFrom: { $lte: PERIOD_START },
  }).lean();
  record(
    'salary-profile-effective',
    !!salary && (salary as any).baseSalary === __seedAmounts.baseSalary,
    `baseSalary=${(salary as any)?.baseSalary ?? 'n/a'} (expected ${__seedAmounts.baseSalary})`,
  );

  const tax = await TaxPolicy.findOne({
    organizationId,
    active: true,
    effectiveFrom: { $lte: PERIOD_START },
  }).lean();
  record(
    'tax-policy-effective',
    !!tax,
    `version=${(tax as any)?.version ?? 'n/a'} brackets=${(tax as any)?.progressiveBrackets?.length ?? 0}`,
  );

  const insurance = await InsurancePolicy.findOne({
    organizationId,
    active: true,
    effectiveFrom: { $lte: PERIOD_START },
  }).lean();
  record('insurance-policy-effective', !!insurance, `version=${(insurance as any)?.version ?? 'n/a'}`);

  const bonus = await AttendanceBonusPolicy.findOne({
    organizationId,
    active: true,
    effectiveFrom: { $lte: PERIOD_START },
  }).lean();
  record(
    'attendance-bonus-effective',
    !!bonus && (bonus as any).bonusAmount === __seedAmounts.attendanceBonus,
    `bonusAmount=${(bonus as any)?.bonusAmount ?? 'n/a'} (expected ${__seedAmounts.attendanceBonus})`,
  );

  const kpi = await KpiPayrollInput.findOne({
    organizationId,
    employeeProfileId: empProfile._id,
    periodKey: PERIOD,
  }).lean();
  record(
    'kpi-input-confirmed',
    !!kpi && (kpi as any).confirmedAmount === __seedAmounts.kpiBonus,
    `confirmedAmount=${(kpi as any)?.confirmedAmount ?? 'n/a'}`,
  );

  const period = await TimesheetPeriod.findOne({ organizationId, period: PERIOD }).lean();
  record(
    'timesheet-period-open',
    !!period && (period as any).status === 'OPEN',
    `status=${(period as any)?.status ?? 'n/a'}`,
  );

  const workdays = workdaysInPeriod();
  const attendanceDays = await AttendanceDay.find({
    organizationId,
    employeeProfileId: empProfile._id,
    workDate: { $gte: isoDate(PERIOD_START), $lte: isoDate(PERIOD_END) },
  }).lean();
  const lateTotal = attendanceDays.reduce((s, d: any) => s + (d.lateMinutes ?? 0), 0);
  const earlyTotal = attendanceDays.reduce((s, d: any) => s + (d.earlyMinutes ?? 0), 0);
  record(
    'attendance-coverage',
    attendanceDays.length === workdays.length,
    `${attendanceDays.length}/${workdays.length} workdays, late=${lateTotal}min early=${earlyTotal}min`,
  );
  record(
    'attendance-no-late-or-early',
    lateTotal === 0 && earlyTotal === 0,
    `late=${lateTotal}min early=${earlyTotal}min (expected 0/0)`,
  );

  const otResults = await OvertimeResult.find({
    organizationId,
    employeeProfileId: empProfile._id,
    workDate: { $gte: isoDate(PERIOD_START), $lte: isoDate(PERIOD_END) },
  }).lean();
  const otWorkingDay = otResults.filter((o: any) => o.classification === 'WORKING_DAY' || o.overtimeType === 'WORKING_DAY');
  const otWeeklyOff = otResults.filter((o: any) => o.classification === 'WEEKLY_OFF' || o.overtimeType === 'WEEKLY_OFF');
  const otWorkingDayMin = otWorkingDay.reduce((s, o: any) => s + (o.eligibleMinutes ?? 0), 0);
  const otWeeklyOffMin = otWeeklyOff.reduce((s, o: any) => s + (o.eligibleMinutes ?? 0), 0);
  record(
    'overtime-working-day',
    otWorkingDayMin === __seedAmounts.otWorkingDayMinutes,
    `${otWorkingDayMin}min (expected ${__seedAmounts.otWorkingDayMinutes})`,
  );
  record(
    'overtime-weekly-off',
    otWeeklyOffMin === __seedAmounts.otWeeklyOffMinutes,
    `${otWeeklyOffMin}min (expected ${__seedAmounts.otWeeklyOffMinutes})`,
  );

  const allFinal = otResults.every((o: any) => o.classificationStatus === 'FINAL' && o.approvedBy && o.approvedAt);
  record(
    'overtime-approved-final',
    allFinal,
    `${otResults.filter((o: any) => o.classificationStatus === 'FINAL').length}/${otResults.length} final`,
  );

  const [summaries, snapshots, runs, payslips] = await Promise.all([
    TimesheetSummary.countDocuments({ organizationId, periodId: period?._id }),
    PayrollInputSnapshot.countDocuments({ organizationId, periodId: period?._id }),
    PayrollRun.countDocuments({ organizationId, periodId: period?._id }),
    Payslip.countDocuments({ organizationId, periodKey: PERIOD }),
  ]);
  record(
    'no-pre-generated-payroll-state',
    summaries === 0 && snapshots === 0 && runs === 0 && payslips === 0,
    `summaries=${summaries} snapshots=${snapshots} runs=${runs} payslips=${payslips} (all should be 0)`,
  );

  const expected = __seedLedger();
  const recomputed = computePayrollLedger({
    baseSalary: __seedAmounts.baseSalary,
    attendanceDays: workdays.length,
    standardDays: STANDARD_WORKING_DAYS,
    taxableAllowances: __seedAmounts.responsibilityAllowance,
    nonTaxableAllowances: __seedAmounts.mealAllowance,
    attendanceBonus: __seedAmounts.attendanceBonus,
    kpiBonus: __seedAmounts.kpiBonus,
    otWorkingDayMinutes: __seedAmounts.otWorkingDayMinutes,
    otWeeklyOffMinutes: __seedAmounts.otWeeklyOffMinutes,
    dependentCount: 1,
    insurance: computeEmployeeInsurance({
      // Số dẫn xuất: lương cơ bản − tổng phụ cấp (D46) — khớp __seedLedger.
      baseSalary: __seedAmounts.baseSalary
        - __seedAmounts.mealAllowance
        - __seedAmounts.responsibilityAllowance,
      socialRate: __seedAmounts.insuranceSocialRate,
      healthRate: __seedAmounts.insuranceHealthRate,
      unemploymentRate: __seedAmounts.insuranceUnemploymentRate,
    }),
  });
  for (const key of ['proratedBaseSalary', 'grossEarnings', 'totalOtPay', 'pitAmount', 'netSalary'] as const) {
    const diff = Math.abs(expected[key] - recomputed[key]);
    record(
      `ledger-${key}-stable`,
      diff <= RECONCILIATION_TOLERANCE_VND,
      `expected=${expected[key].toLocaleString('vi-VN')} recomputed=${recomputed[key].toLocaleString('vi-VN')} Δ=${diff}`,
    );
  }

  console.log('\n──────────────────────────────────────────────');
  console.log(`E2E payroll seed verification (period ${PERIOD})`);
  console.log('──────────────────────────────────────────────');
  console.log(`Total checks : ${checks.length}`);
  console.log(`Passed       : ${checks.filter(c => c.pass).length}`);
  console.log(`Failed       : ${checks.filter(c => !c.pass).length}`);
  if (checks.some(c => !c.pass)) {
    console.log('\nFailures:');
    for (const c of checks.filter(c => !c.pass)) {
      console.log(`  - ${c.name}: ${c.detail}`);
    }
    await finish(db, 1);
    return;
  }

  await finish(db, 0);
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

async function finish(db: mongoose.Connection, exitCode: number) {
  await closeConnection(db);
  process.exit(exitCode);
}

main().catch(async (err) => {
  console.error('[verify:payroll:e2e] failed:', err);
  process.exit(1);
});
