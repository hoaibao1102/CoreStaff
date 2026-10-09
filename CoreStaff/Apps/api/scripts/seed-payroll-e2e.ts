/**
 * TASK-13A — Idempotent E2E payroll seed for `period=YYYY-MM`.
 *
 * Usage:
 *   npm run seed:payroll:e2e:dry -- --period=2026-09
 *   npm run seed:payroll:e2e -- --period=2026-09
 *   npm run seed:payroll:e2e -- --period=2026-09 --reset-fixture
 *
 * The seed creates only the *inputs* an E2E flow needs to drive the real
 * workflow (Manager approve -> HR close -> HR calculate -> HR lock -> HR
 * release -> Employee self-view). Snapshot/PayrollRun/Payslip states are
 * produced via API calls during E2E, not pre-seeded here.
 *
 * All amounts are integer VND. Values follow the spec in `.hermes/plans/2026-09-30_*`
 * with the working-month based on 22 standard days × 8 hours.
 *
 * Re-running the script is a no-op (idempotent): it upserts by deterministic
 * keys (organization code, employee email, period key, snapshot version).
 */
import * as crypto from 'node:crypto';
import * as path from 'node:path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import { hashPassword } from '../src/auth/strategies/bcrypt.strategy';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import {
  AttendanceStatus,
  ContractStatus,
  ContractType,
  EmploymentStatus,
  Gender,
  Role,
  ShiftScope,
  WorkdayType,
} from '../src/database/schemas/enums';
import { userFields } from '../src/database/seed/provision';
import { InsuranceContributionType } from '../src/database/schemas/enums';
import {
  computeEmployeeInsurance,
  computePayrollLedger,
  STANDARD_WORKING_DAYS,
} from './payroll-ledger';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');
const RESET = ARGS.includes('--reset-fixture');
const periodArg = ARGS.find(a => a.startsWith('--period='));
const PERIOD = periodArg ? periodArg.split('=')[1] : '2026-09';
if (!/^\d{4}-\d{2}$/.test(PERIOD)) {
  console.error(`[seed:payroll:e2e] Invalid --period "${PERIOD}", expected YYYY-MM.`);
  process.exit(2);
}
const [YEAR_STR, MONTH_STR] = PERIOD.split('-');
const PERIOD_YEAR = Number(YEAR_STR);
const PERIOD_MONTH = Number(MONTH_STR);
const PERIOD_START = new Date(Date.UTC(PERIOD_YEAR, PERIOD_MONTH - 1, 1, 0, 0, 0, 0));
const PERIOD_END = new Date(Date.UTC(PERIOD_YEAR, PERIOD_MONTH, 0, 23, 59, 59, 999));
const STANDARD_WORKING_MINUTES = STANDARD_WORKING_DAYS * 8 * 60;

const ORG_CODE = 'E2E';
const ORG_NAME = `CoreStaff E2E Payroll ${PERIOD}`;
const DEMO_PASSWORD = process.env.SEED_E2E_PASSWORD ?? 'E2ePayroll1!';

const FIXTURE_ACCOUNTS = {
  employee: { email: 'emp.test@corestaff.local', fullName: 'Nguyễn Văn Test', code: 'E2E-EMP-001', role: Role.EMPLOYEE },
  manager: { email: 'manager.test@corestaff.local', fullName: 'Trần Thị Manager', code: 'E2E-MGR-001', role: Role.DEPARTMENT_MANAGER },
  hr: { email: 'hr.test@corestaff.local', fullName: 'Lê Thị HR', code: 'E2E-HR-001', role: Role.HR },
};

const FIXTURE_AMOUNTS = {
  baseSalary: 25_000_000,
  mealAllowance: 730_000,
  responsibilityAllowance: 1_500_000,
  otWorkingDayMinutes: 600,
  otWeeklyOffMinutes: 240,
  attendanceBonus: 1_000_000,
  kpiBonus: 2_000_000,
  insuranceSocialRate: 0.08,
  insuranceHealthRate: 0.015,
  insuranceUnemploymentRate: 0.01,
};

const VN_PERSONAL_DEDUCTION = 11_000_000;
const VN_DEPENDENT_DEDUCTION = 4_400_000;
const VN_INSURANCE_CAP = 52_200_000;

const PROGRESSIVE_BRACKETS = [
  { upperLimit: 10_000_000, rate: 5 },
  { upperLimit: 30_000_000, rate: 10 },
  { upperLimit: 60_000_000, rate: 20 },
  { upperLimit: 100_000_000, rate: 30 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 35 },
];

interface Summary { planned: number; created: number; skipped: number; removed: number; }
const summary = new Map<string, Summary>();
function mark(kind: string, result: 'planned' | 'created' | 'skipped' | 'removed', n = 1) {
  const row = summary.get(kind) ?? { planned: 0, created: 0, skipped: 0, removed: 0 };
  row[result] += n;
  summary.set(kind, row);
}

function pad(n: number): string { return n < 10 ? `0${n}` : String(n); }
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function workdaysInPeriod(): string[] {
  const out: string[] = [];
  const d = new Date(PERIOD_START);
  while (d <= PERIOD_END) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(isoDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
function saturdaysInPeriod(): string[] {
  const out: string[] = [];
  const d = new Date(PERIOD_START);
  while (d <= PERIOD_END) {
    if (d.getUTCDay() === 6) out.push(isoDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function upsertByQuery(
  model: mongoose.Model<any>,
  query: Record<string, unknown>,
  doc: Record<string, unknown>,
  kind: string,
): Promise<mongoose.Types.ObjectId> {
  const existing = await model.findOne(query).lean();
  if (existing) { mark(kind, 'skipped'); return (existing as any)._id as mongoose.Types.ObjectId; }
  if (!APPLY) { mark(kind, 'planned'); return new mongoose.Types.ObjectId(); }
  const created = await model.create(doc);
  mark(kind, 'created');
  return (created as any)._id as mongoose.Types.ObjectId;
}

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) {
    console.error('[seed:payroll:e2e] MONGODB_URI is not configured. Run seed against an empty MongoDB or update .env.');
    process.exit(1);
  }

  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  await db.asPromise();
  for (const { name, schema } of SCHEMA_REGISTRY) {
    if (!db.models[name]) db.model(name, schema);
  }

  const Organization = db.model('Organization');
  const Department = db.model('Department');
  const Position = db.model('Position');
  const Workplace = db.model('Workplace');
  const ShiftTemplate = db.model('ShiftTemplate');
  const User = db.model('User');
  const EmployeeProfile = db.model('EmployeeProfile');
  const EmploymentContract = db.model('EmploymentContract');
  const ManagerAssignment = db.model('ManagerAssignment');
  const Assignment = db.model('Assignment');
  const LaborPolicy = db.model('LaborCompliancePolicy');
  const OvertimePolicy = db.model('OvertimePayPolicy');
  const TaxPolicy = db.model('TaxPolicy');
  const InsurancePolicy = db.model('InsurancePolicy');
  const AttendanceBonusPolicy = db.model('AttendanceBonusPolicy');
  const AllowanceCatalog = db.model('AllowanceCatalog');
  const OrganizationAllowance = db.model('OrganizationAllowance');
  const SalaryProfile = db.model('SalaryProfile');
  const KpiPayrollInput = db.model('KpiPayrollInput');
  const InsuranceProfile = db.model('InsuranceProfile');
  const TimesheetPeriod = db.model('TimesheetPeriod');
  const AttendanceDay = db.model('AttendanceDay');
  const AttendanceEvent = db.model('AttendanceEvent');
  const OvertimeResult = db.model('OvertimeResult');

  if (RESET && APPLY) {
    const orgQuery = { code: ORG_CODE };
    const org: any = await Organization.findOne(orgQuery).lean();
    if (org) {
      const orgId = org._id;
      const profileIds = await EmployeeProfile.find({ organizationId: orgId }).select('_id').lean();
      const userIds = await User.find({ organizationId: orgId }).select('_id').lean();
      await Promise.all([
        TimesheetPeriod.deleteMany({ organizationId: orgId }),
        AttendanceDay.deleteMany({ organizationId: orgId }),
        AttendanceEvent.deleteMany({ organizationId: orgId }),
        OvertimeResult.deleteMany({ organizationId: orgId }),
        KpiPayrollInput.deleteMany({ organizationId: orgId }),
        SalaryProfile.deleteMany({ organizationId: orgId }),
        InsuranceProfile.deleteMany({ organizationId: orgId }),
        Assignment.deleteMany({ organizationId: orgId }),
        ManagerAssignment.deleteMany({ organizationId: orgId }),
        EmploymentContract.deleteMany({ organizationId: orgId }),
        EmployeeProfile.deleteMany({ organizationId: orgId }),
        User.deleteMany({ organizationId: orgId }),
        OrganizationAllowance.deleteMany({ organizationId: orgId }),
        AllowanceCatalog.deleteMany({}),
        AttendanceBonusPolicy.deleteMany({ organizationId: orgId }),
        TaxPolicy.deleteMany({ organizationId: orgId }),
        InsurancePolicy.deleteMany({ organizationId: orgId }),
        LaborPolicy.deleteMany({ organizationId: orgId }),
        OvertimePolicy.deleteMany({ organizationId: orgId }),
        ShiftTemplate.deleteMany({ organizationId: orgId }),
        Workplace.deleteMany({ organizationId: orgId }),
        Position.deleteMany({ organizationId: orgId }),
        Department.deleteMany({ organizationId: orgId }),
        Organization.deleteOne({ _id: orgId }),
      ]);
      mark('Organization', 'removed');
    }
  }

  const organizationId = await upsertByQuery(
    Organization,
    { code: ORG_CODE },
    {
      code: ORG_CODE,
      name: ORG_NAME,
      status: 'ACTIVE',
      timezone: 'Asia/Ho_Chi_Minh',
      evidenceRetentionDays: 90,
      payrollSeparationOfDuties: false,
    },
    'Organization',
  );

  const departmentId = await upsertByQuery(
    Department,
    { organizationId, code: `${ORG_CODE}-IT` },
    { organizationId, code: `${ORG_CODE}-IT`, name: 'Engineering', active: true },
    'Department',
  );

  const positionId = await upsertByQuery(
    Position,
    { organizationId, code: 'DEV' },
    { organizationId, code: 'DEV', name: 'Software Developer', active: true },
    'Position',
  );

  const managerPositionId = await upsertByQuery(
    Position,
    { organizationId, code: 'DLEAD' },
    { organizationId, code: 'DLEAD', name: 'Engineering Lead', active: true },
    'Position',
  );

  const hrPositionId = await upsertByQuery(
    Position,
    { organizationId, code: 'HRBP' },
    { organizationId, code: 'HRBP', name: 'HR Business Partner', active: true },
    'Position',
  );

  const workplaceId = await upsertByQuery(
    Workplace,
    { organizationId, code: `${ORG_CODE}-HQ` },
    {
      organizationId,
      code: `${ORG_CODE}-HQ`,
      name: 'CoreStaff E2E HQ',
      type: 'IN_OFFICE',
      address: 'TP. Hồ Chí Minh',
      latitude: 10.7769,
      longitude: 106.7009,
      allowedRadiusMeters: 200,
      maximumAccuracyMeters: 100,
      active: true,
    },
    'Workplace',
  );

  const shiftId = await upsertByQuery(
    ShiftTemplate,
    { organizationId, code: `${ORG_CODE}-HC-0800` },
    {
      organizationId,
      code: `${ORG_CODE}-HC-0800`,
      name: 'Ca hành chính E2E',
      scope: ShiftScope.ORGANIZATION,
      weekdays: [1, 2, 3, 4, 5],
      effectiveFrom: '2026-01-01',
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 60,
      gracePeriodMinutes: 10,
      active: true,
    },
    'ShiftTemplate',
  );

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const accountsByCode = new Map<string, mongoose.Types.ObjectId>();
  const accountsByEmail = new Map<string, mongoose.Types.ObjectId>();

  for (const acct of Object.values(FIXTURE_ACCOUNTS)) {
    const id = await upsertByQuery(
      User,
      { organizationId, email: acct.email },
      userFields({
        organizationId,
        email: acct.email,
        fullName: acct.fullName,
        passwordHash,
        role: acct.role,
      } as any),
      'User',
    );
    accountsByCode.set(acct.code, id);
    accountsByEmail.set(acct.email, id);
  }

  const empUserId = accountsByCode.get(FIXTURE_ACCOUNTS.employee.code)!;
  const mgrUserId = accountsByCode.get(FIXTURE_ACCOUNTS.manager.code)!;
  const hrUserId = accountsByCode.get(FIXTURE_ACCOUNTS.hr.code)!;

  const empProfileId = await upsertByQuery(
    EmployeeProfile,
    { organizationId, employeeCode: FIXTURE_ACCOUNTS.employee.code },
    {
      organizationId,
      userId: empUserId,
      employeeCode: FIXTURE_ACCOUNTS.employee.code,
      employmentType: 'FULL_TIME',
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId,
      positionId,
      directManagerId: mgrUserId,
      workplaceId,
      joinDate: new Date('2026-01-15'),
      fullName: FIXTURE_ACCOUNTS.employee.fullName,
      email: FIXTURE_ACCOUNTS.employee.email,
      phone: '0909000001',
      gender: Gender.MALE,
      taxCode: '1234567890',
      bankAccount: '9876543210',
      citizenId: '079200000001',
      socialInsuranceCode: '1234567890',
      dependents: [
        {
          _id: new mongoose.Types.ObjectId(),
          fullName: 'Nguyễn Bé Test',
          relationship: 'CON',
          status: 'ACTIVE',
          isDisabled: false,
        },
      ],
    },
    'EmployeeProfile',
  );

  const mgrProfileId = await upsertByQuery(
    EmployeeProfile,
    { organizationId, employeeCode: FIXTURE_ACCOUNTS.manager.code },
    {
      organizationId,
      userId: mgrUserId,
      employeeCode: FIXTURE_ACCOUNTS.manager.code,
      employmentType: 'FULL_TIME',
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId,
      positionId: managerPositionId,
      workplaceId,
      joinDate: new Date('2024-01-02'),
      fullName: FIXTURE_ACCOUNTS.manager.fullName,
      email: FIXTURE_ACCOUNTS.manager.email,
      phone: '0909000002',
      gender: Gender.FEMALE,
      taxCode: '1234567891',
      bankAccount: '9876543211',
      citizenId: '079200000002',
      socialInsuranceCode: '1234567891',
      dependents: [],
    },
    'EmployeeProfile',
  );

  const hrProfileId = await upsertByQuery(
    EmployeeProfile,
    { organizationId, employeeCode: FIXTURE_ACCOUNTS.hr.code },
    {
      organizationId,
      userId: hrUserId,
      employeeCode: FIXTURE_ACCOUNTS.hr.code,
      employmentType: 'FULL_TIME',
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId,
      positionId: hrPositionId,
      workplaceId,
      joinDate: new Date('2024-02-01'),
      fullName: FIXTURE_ACCOUNTS.hr.fullName,
      email: FIXTURE_ACCOUNTS.hr.email,
      phone: '0909000003',
      gender: Gender.FEMALE,
      taxCode: '1234567892',
      bankAccount: '9876543212',
      citizenId: '079200000003',
      socialInsuranceCode: '1234567892',
      dependents: [],
    },
    'EmployeeProfile',
  );

  await upsertByQuery(
    EmploymentContract,
    { organizationId, employeeProfileId: empProfileId },
    {
      organizationId,
      employeeProfileId: empProfileId,
      contractType: ContractType.INDEFINITE_TERM,
      status: ContractStatus.ACTIVE,
      effectiveDate: new Date('2026-01-15'),
      note: 'Hợp đồng E2E auto-generated',
    },
    'EmploymentContract',
  );

  await upsertByQuery(
    ManagerAssignment,
    { organizationId, managerUserId: mgrUserId, departmentId },
    {
      organizationId,
      managerUserId: mgrUserId,
      departmentId,
      effectiveFrom: new Date('2024-01-02'),
      active: true,
      createdBy: hrUserId,
    },
    'ManagerAssignment',
  );

  for (const userId of [empUserId, mgrUserId, hrUserId]) {
    await upsertByQuery(
      Assignment,
      { organizationId, userId },
      {
        organizationId,
        userId,
        departmentId,
        workplaceId,
        shiftTemplateId: shiftId,
        effectiveFrom: '2026-01-01',
        active: true,
      },
      'Assignment',
    );
  }

  await upsertByQuery(
    LaborPolicy,
    { organizationId, version: 1 },
    {
      organizationId,
      effectiveFrom: new Date(`${PERIOD_YEAR - 1}-01-01`),
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
      active: true,
    },
    'LaborPolicy',
  );

  await upsertByQuery(
    OvertimePolicy,
    { organizationId, version: 1 },
    {
      organizationId,
      effectiveFrom: new Date(`${PERIOD_YEAR - 1}-01-01`),
      workingDayRate: 1.5,
      weeklyOffRate: 2.0,
      publicHolidayRate: 3.0,
      legalReference: 'BLLĐ 45/2019/QH14',
      version: 1,
      active: true,
    },
    'OvertimePolicy',
  );

  await upsertByQuery(
    TaxPolicy,
    { organizationId, effectiveFrom: new Date(`${PERIOD_YEAR - 1}-01-01`) },
    {
      organizationId,
      effectiveFrom: new Date(`${PERIOD_YEAR - 1}-01-01`),
      personalDeduction: VN_PERSONAL_DEDUCTION,
      dependentDeduction: VN_DEPENDENT_DEDUCTION,
      progressiveBrackets: PROGRESSIVE_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
      legalReference: 'Luật Thuế TNCN 200/QH12',
      version: 1,
      active: true,
    },
    'TaxPolicy',
  );

  await upsertByQuery(
    InsurancePolicy,
    { organizationId, effectiveFrom: new Date(`${PERIOD_YEAR - 1}-01-01`) },
    {
      organizationId,
      effectiveFrom: new Date(`${PERIOD_YEAR - 1}-01-01`),
      legalReference: 'Luật BHXH 58/2014/QH13',
      socialInsuranceEmployeeRate: FIXTURE_AMOUNTS.insuranceSocialRate,
      healthInsuranceEmployeeRate: FIXTURE_AMOUNTS.insuranceHealthRate,
      unemploymentInsuranceEmployeeRate: FIXTURE_AMOUNTS.insuranceUnemploymentRate,
      salaryBaseRules: [
        { type: InsuranceContributionType.SOCIAL_INSURANCE, floorAmount: null },
        { type: InsuranceContributionType.HEALTH_INSURANCE, floorAmount: null },
        { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, floorAmount: null },
      ],
      capRules: [
        { type: InsuranceContributionType.SOCIAL_INSURANCE, capAmount: VN_INSURANCE_CAP },
        { type: InsuranceContributionType.HEALTH_INSURANCE, capAmount: VN_INSURANCE_CAP },
        { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, capAmount: VN_INSURANCE_CAP },
      ],
      employerContributionRates: [
        { type: InsuranceContributionType.SOCIAL_INSURANCE, rate: 0.175 },
        { type: InsuranceContributionType.HEALTH_INSURANCE, rate: 0 },
        { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, rate: 0.01 },
      ],
      version: 1,
      active: true,
    },
    'InsurancePolicy',
  );

  const mealCatalogId = await upsertByQuery(
    AllowanceCatalog,
    { code: 'MEAL' },
    { code: 'MEAL', defaultName: 'Phụ cấp ăn trưa', description: 'Hỗ trợ ăn trưa', defaultTaxable: false, defaultInsuranceBased: false, active: true },
    'AllowanceCatalog',
  );
  const respCatalogId = await upsertByQuery(
    AllowanceCatalog,
    { code: 'RESP' },
    { code: 'RESP', defaultName: 'Phụ cấp trách nhiệm/điện thoại', description: 'Phụ cấp chịu thuế', defaultTaxable: true, defaultInsuranceBased: false, active: true },
    'AllowanceCatalog',
  );

  await upsertByQuery(
    OrganizationAllowance,
    { organizationId, code: 'MEAL' },
    { organizationId, catalogId: mealCatalogId, code: 'MEAL', name: 'Phụ cấp ăn trưa', amount: FIXTURE_AMOUNTS.mealAllowance, taxable: false, insuranceBased: false, prorated: false, effectiveFrom: new Date(`${PERIOD_YEAR - 1}-01-01`), version: 1, active: true },
    'OrganizationAllowance',
  );
  await upsertByQuery(
    OrganizationAllowance,
    { organizationId, code: 'RESP' },
    { organizationId, catalogId: respCatalogId, code: 'RESP', name: 'Phụ cấp trách nhiệm', amount: FIXTURE_AMOUNTS.responsibilityAllowance, taxable: true, insuranceBased: false, prorated: false, effectiveFrom: new Date(`${PERIOD_YEAR - 1}-01-01`), version: 1, active: true },
    'OrganizationAllowance',
  );

  await upsertByQuery(
    AttendanceBonusPolicy,
    { organizationId, name: `E2E Attendance Bonus ${PERIOD}` },
    {
      organizationId,
      name: `E2E Attendance Bonus ${PERIOD}`,
      calculationBase: 'FIXED_AMOUNT',
      bonusAmount: FIXTURE_AMOUNTS.attendanceBonus,
      tiers: [
        { order: 1, percentage: 100, conditions: [{ metric: 'LATE_COUNT', operator: 'EQ', value: 0 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
      ],
      conditions: [],
      effectiveFrom: new Date(`${PERIOD_YEAR - 1}-01-01`),
      version: 1,
      active: true,
    },
    'AttendanceBonusPolicy',
  );

  const salaryEffective = new Date(`${PERIOD_YEAR}-${pad(PERIOD_MONTH)}-01`);
  await upsertByQuery(
    SalaryProfile,
    { organizationId, employeeProfileId: empProfileId, effectiveFrom: salaryEffective },
    {
      organizationId,
      employeeProfileId: empProfileId,
      effectiveFrom: salaryEffective,
      baseSalary: FIXTURE_AMOUNTS.baseSalary,
      // Số dẫn xuất: lương cơ bản − tổng phụ cấp gán cho nhân viên (D46).
      insuranceSalary: FIXTURE_AMOUNTS.baseSalary
        - FIXTURE_AMOUNTS.mealAllowance
        - FIXTURE_AMOUNTS.responsibilityAllowance,
      // Snapshot dựng allowanceBreakdown từ organizationAllowanceIds, nên phải ghi
      // danh sách id — thiếu nó thì tổng phụ cấp = 0 và base bảo hiểm lệch ledger.
      organizationAllowanceIds: [mealCatalogId, respCatalogId],
      allowances: [
        { allowanceId: mealCatalogId, amount: FIXTURE_AMOUNTS.mealAllowance },
        { allowanceId: respCatalogId, amount: FIXTURE_AMOUNTS.responsibilityAllowance },
      ],
      currency: 'VND',
      roundingRule: 'ROUND_HALF_UP_TO_VND',
      version: 1,
      active: true,
    },
    'SalaryProfile',
  );

  await upsertByQuery(
    KpiPayrollInput,
    { organizationId, employeeProfileId: empProfileId, periodKey: PERIOD },
    {
      organizationId,
      employeeProfileId: empProfileId,
      userId: empUserId,
      periodKey: PERIOD,
      grade: 'A',
      score: 95,
      baseAmount: FIXTURE_AMOUNTS.kpiBonus,
      confirmedAmount: FIXTURE_AMOUNTS.kpiBonus,
      confirmationStatus: 'CONFIRMED',
      confirmedBy: hrUserId,
      confirmedAt: new Date(),
    },
    'KpiPayrollInput',
  );

  await upsertByQuery(
    InsuranceProfile,
    { organizationId, employeeId: empProfileId, effectiveFrom: salaryEffective },
    {
      organizationId,
      employeeId: empProfileId,
      effectiveFrom: salaryEffective,
      socialInsuranceNumber: '1234567890',
      healthInsuranceNumber: '1234567890',
      version: 1,
      active: true,
    },
    'InsuranceProfile',
  );

  await upsertByQuery(
    TimesheetPeriod,
    { organizationId, period: PERIOD },
    {
      organizationId,
      period: PERIOD,
      startDate: PERIOD_START,
      endDate: PERIOD_END,
      status: 'OPEN',
      version: 1,
      active: true,
    },
    'TimesheetPeriod',
  );

  const workdays = workdaysInPeriod();
  const saturdays = saturdaysInPeriod();
  const standardWorkingDays = workdays.length;

  for (const workDate of workdays) {
    const checkInAt = new Date(`${workDate}T01:00:00.000Z`);
    const checkOutAt = new Date(`${workDate}T10:00:00.000Z`);
    await upsertByQuery(
      AttendanceDay,
      { organizationId, employeeProfileId: empProfileId, workDate },
      {
        organizationId,
        employeeProfileId: empProfileId,
        userId: empUserId,
        workDate,
        attendanceStatus: AttendanceStatus.COMPLETED,
        workdayType: WorkdayType.WORKING_DAY,
        checkInAt,
        checkOutAt,
        workingMinutes: 480,
        lateMinutes: 0,
        earlyMinutes: 0,
        shiftSnapshot: { startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 10 },
        employeeSnapshot: { departmentId },
        status: 'CONFIRMED',
      },
      'AttendanceDay',
    );

    await upsertByQuery(
      AttendanceEvent,
      { organizationId, employeeProfileId: empProfileId, workDate, type: 'CHECK_IN' },
      {
        organizationId,
        employeeProfileId: empProfileId,
        userId: empUserId,
        workDate,
        type: 'CHECK_IN',
        recordedAt: checkInAt,
        source: 'SEED',
      },
      'AttendanceEvent',
    );
    await upsertByQuery(
      AttendanceEvent,
      { organizationId, employeeProfileId: empProfileId, workDate, type: 'CHECK_OUT' },
      {
        organizationId,
        employeeProfileId: empProfileId,
        userId: empUserId,
        workDate,
        type: 'CHECK_OUT',
        recordedAt: checkOutAt,
        source: 'SEED',
      },
      'AttendanceEvent',
    );
  }

  const otWorkingDaySlots = [
    { minutes: 120, workDate: workdays[0] },
    { minutes: 120, workDate: workdays[1] },
    { minutes: 120, workDate: workdays[2] },
    { minutes: 120, workDate: workdays[3] },
    { minutes: 120, workDate: workdays[4] },
  ];
  let wdAccum = 0;
  for (const slot of otWorkingDaySlots) {
    if (wdAccum >= FIXTURE_AMOUNTS.otWorkingDayMinutes) break;
    const minutes = Math.min(slot.minutes, FIXTURE_AMOUNTS.otWorkingDayMinutes - wdAccum);
    wdAccum += minutes;
    await upsertByQuery(
      OvertimeResult,
      { organizationId, employeeProfileId: empProfileId, workDate: slot.workDate, classification: 'WORKING_DAY' },
      {
        organizationId,
        employeeProfileId: empProfileId,
        userId: empUserId,
        workDate: slot.workDate,
        classification: 'WORKING_DAY',
        eligibleMinutes: minutes,
        overtimeType: 'WORKING_DAY',
        requestedMinutes: minutes,
        rate: 1.5,
        approvedBy: mgrUserId,
        approvedAt: new Date(),
        classificationStatus: 'FINAL',
      },
      'OvertimeResult',
    );
  }

  const weeklyOffSlots = [
    { minutes: 120, workDate: saturdays[0] },
    { minutes: 120, workDate: saturdays[1] },
  ];
  let weAccum = 0;
  for (const slot of weeklyOffSlots) {
    if (weAccum >= FIXTURE_AMOUNTS.otWeeklyOffMinutes) break;
    const minutes = Math.min(slot.minutes, FIXTURE_AMOUNTS.otWeeklyOffMinutes - weAccum);
    weAccum += minutes;
    if (!slot.workDate) continue;
    await upsertByQuery(
      OvertimeResult,
      { organizationId, employeeProfileId: empProfileId, workDate: slot.workDate, classification: 'WEEKLY_OFF' },
      {
        organizationId,
        employeeProfileId: empProfileId,
        userId: empUserId,
        workDate: slot.workDate,
        classification: 'WEEKLY_OFF',
        eligibleMinutes: minutes,
        overtimeType: 'WEEKLY_OFF',
        requestedMinutes: minutes,
        rate: 2.0,
        approvedBy: mgrUserId,
        approvedAt: new Date(),
        classificationStatus: 'FINAL',
      },
      'OvertimeResult',
    );
  }

  const ledger = computePayrollLedger({
    baseSalary: FIXTURE_AMOUNTS.baseSalary,
    attendanceDays: standardWorkingDays,
    standardDays: STANDARD_WORKING_DAYS,
    taxableAllowances: FIXTURE_AMOUNTS.responsibilityAllowance,
    nonTaxableAllowances: FIXTURE_AMOUNTS.mealAllowance,
    attendanceBonus: FIXTURE_AMOUNTS.attendanceBonus,
    kpiBonus: FIXTURE_AMOUNTS.kpiBonus,
    otWorkingDayMinutes: FIXTURE_AMOUNTS.otWorkingDayMinutes,
    otWeeklyOffMinutes: FIXTURE_AMOUNTS.otWeeklyOffMinutes,
    dependentCount: 1,
    insurance: computeEmployeeInsurance({
      // Lương đóng BHXH là số dẫn xuất: lương cơ bản − tổng phụ cấp (D46).
      baseSalary: FIXTURE_AMOUNTS.baseSalary
        - FIXTURE_AMOUNTS.mealAllowance
        - FIXTURE_AMOUNTS.responsibilityAllowance,
      socialRate: FIXTURE_AMOUNTS.insuranceSocialRate,
      healthRate: FIXTURE_AMOUNTS.insuranceHealthRate,
      unemploymentRate: FIXTURE_AMOUNTS.insuranceUnemploymentRate,
      cap: VN_INSURANCE_CAP,
    }),
  });

  console.log('\n──────────────────────────────────────────────');
  console.log(`E2E payroll seed (period ${PERIOD}) ${APPLY ? 'APPLIED' : 'DRY-RUN'}`);
  console.log('──────────────────────────────────────────────');
  console.log('Tenant:', ORG_CODE, '/', ORG_NAME);
  console.log('Employee:', FIXTURE_ACCOUNTS.employee.email, '(password:', DEMO_PASSWORD + ')');
  console.log('Manager :', FIXTURE_ACCOUNTS.manager.email);
  console.log('HR      :', FIXTURE_ACCOUNTS.hr.email);
  console.log(`Working days seeded     : ${standardWorkingDays}`);
  console.log(`Standard working minutes: ${STANDARD_WORKING_MINUTES}`);
  console.log(`OT working-day minutes  : ${FIXTURE_AMOUNTS.otWorkingDayMinutes}`);
  console.log(`OT weekly-off minutes   : ${FIXTURE_AMOUNTS.otWeeklyOffMinutes}`);
  console.log('\nExpected ledger (VND):');
  for (const [k, v] of Object.entries(ledger)) {
    if (typeof v === 'number') console.log(`  ${k.padEnd(28)}: ${v.toLocaleString('vi-VN')}`);
  }

  console.log('\nCounts by kind:');
  for (const [kind, row] of summary) {
    console.log(`  ${kind.padEnd(24)} planned=${row.planned} created=${row.created} skipped=${row.skipped} removed=${row.removed}`);
  }

  if (!APPLY) {
    console.log('\n[seed:payroll:e2e] DRY RUN — pass --apply to persist.');
  } else {
    console.log('\n[seed:payroll:e2e] Apply complete.');
  }

  await closeConnection(db);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed:payroll:e2e] failed:', err);
    process.exitCode = 1;
  });
}

export { computeEmployeeInsurance, computePayrollLedger };
export const __seedPeriod = PERIOD;
export const __seedAccounts = FIXTURE_ACCOUNTS;
export const __seedAmounts = FIXTURE_AMOUNTS;
export const __seedLedger = (overrides: Partial<Parameters<typeof computePayrollLedger>[0]> = {}) =>
  computePayrollLedger({
    baseSalary: FIXTURE_AMOUNTS.baseSalary,
    attendanceDays: STANDARD_WORKING_DAYS,
    standardDays: STANDARD_WORKING_DAYS,
    taxableAllowances: FIXTURE_AMOUNTS.responsibilityAllowance,
    nonTaxableAllowances: FIXTURE_AMOUNTS.mealAllowance,
    attendanceBonus: FIXTURE_AMOUNTS.attendanceBonus,
    kpiBonus: FIXTURE_AMOUNTS.kpiBonus,
    otWorkingDayMinutes: FIXTURE_AMOUNTS.otWorkingDayMinutes,
    otWeeklyOffMinutes: FIXTURE_AMOUNTS.otWeeklyOffMinutes,
    dependentCount: 1,
    insurance: computeEmployeeInsurance({
      baseSalary: FIXTURE_AMOUNTS.baseSalary,
      socialRate: FIXTURE_AMOUNTS.insuranceSocialRate,
      healthRate: FIXTURE_AMOUNTS.insuranceHealthRate,
      unemploymentRate: FIXTURE_AMOUNTS.insuranceUnemploymentRate,
      cap: VN_INSURANCE_CAP,
    }),
    ...overrides,
  });
