import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { OrganizationSchema } from '../src/database/schemas/organization.schema';
import { EmployeeProfileSchema } from '../src/database/schemas/employee-profile.schema';
import { PositionSchema } from '../src/database/schemas/position.schema';
import { UserSchema } from '../src/database/schemas/user.schema';
import {
  AllowanceCatalogSchema,
  AttendanceBonusPolicySchema,
  AttendanceBonusTemplateSchema,
  KpiPayrollInputSchema,
  KpiSource,
  KpiStatus,
  LaborCompliancePolicySchema,
  OrganizationAllowanceSchema,
  OvertimePayPolicySchema,
  SalaryProfileSchema,
} from '../src/database/schemas/compensation.schema';
import { EmploymentStatus, Role } from '../src/database/schemas/enums';

const APPLY = process.argv.includes('--apply');
const EFFECTIVE_FROM = new Date('2026-09-01T00:00:00.000Z');
const POLICY_FROM = new Date('2026-01-01T00:00:00.000Z');
const KPI_PERIOD = '2026-09';

/**
 * TASK-036/037 seed configuration (SRS §30B.1, §30D.2) — Vietnam reference:
 * 8h/day, 48h/week, 12h combined daily cap, OT monthly/annual/exceptional caps,
 * 80% warning threshold, OT multipliers 1.5/2.0/3.0. Demo config only — HR/legal
 * must confirm when deploying for real (SRS §30K). Never spread into services.
 */
const LABOR_POLICY_SEED_V1 = {
  effectiveFrom: POLICY_FROM,
  normalDailyMinutes: 480,
  normalWeeklyMinutes: 2880,
  maxCombinedDailyMinutes: 720,
  maxMonthlyOvertimeMinutes: 2400,
  maxAnnualOvertimeMinutes: 20000,
  exceptionalAnnualOvertimeMinutes: 24000,
  warningThresholdPercent: 80,
  probationMinimumRate: 0.85,
  legalReference: 'BLLĐ 45/2019/QH14',
  version: 1,
  active: true,
};
const OVERTIME_POLICY_SEED_V1 = {
  effectiveFrom: POLICY_FROM,
  workingDayRate: 1.5,
  weeklyOffRate: 2.0,
  publicHolidayRate: 3.0,
  legalReference: 'BLLĐ 45/2019/QH14',
  version: 1,
  active: true,
};

const salaryByPosition: Record<string, number> = {
  DLEAD: 28_000_000,
  DEV: 18_000_000,
  QA: 16_000_000,
  ACC: 15_000_000,
  OPS: 13_000_000,
  SLM: 24_000_000,
  SLS: 14_000_000,
};

const kpiByPosition: Record<string, number> = {
  DLEAD: 4_000_000,
  DEV: 2_500_000,
  QA: 2_000_000,
  ACC: 1_500_000,
  OPS: 1_200_000,
  SLM: 3_500_000,
  SLS: 2_000_000,
};

interface Summary { planned: number; created: number; skipped: number }
const summary = new Map<string, Summary>();
function mark(kind: string, result: 'planned' | 'created' | 'skipped') {
  const row = summary.get(kind) ?? { planned: 0, created: 0, skipped: 0 };
  row[result]++;
  summary.set(kind, row);
}

async function insertIfMissing(model: mongoose.Model<any>, query: Record<string, unknown>, doc: Record<string, unknown>, kind: string) {
  const exists = await model.exists(query);
  if (exists) { mark(kind, 'skipped'); return exists._id; }
  if (!APPLY) { mark(kind, 'planned'); return new mongoose.Types.ObjectId(); }
  const created = await model.create(doc);
  mark(kind, 'created');
  return created._id;
}

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured');
  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
  await db.asPromise();

  const Org = db.model('Organization', OrganizationSchema);
  const Profile = db.model('EmployeeProfile', EmployeeProfileSchema);
  const Position = db.model('Position', PositionSchema);
  const User = db.model('User', UserSchema);
  const LaborPolicy = db.model('LaborCompliancePolicy', LaborCompliancePolicySchema);
  const Catalog = db.model('AllowanceCatalog', AllowanceCatalogSchema);
  const Allowance = db.model('OrganizationAllowance', OrganizationAllowanceSchema);
  const BonusTemplate = db.model('AttendanceBonusTemplate', AttendanceBonusTemplateSchema);
  const BonusPolicy = db.model('AttendanceBonusPolicy', AttendanceBonusPolicySchema);
  const Salary = db.model('SalaryProfile', SalaryProfileSchema);
  const Kpi = db.model('KpiPayrollInput', KpiPayrollInputSchema);
  const OvertimePolicy = db.model('OvertimePayPolicy', OvertimePayPolicySchema);

  const catalogRows = [
    { code: 'MEAL', defaultName: 'Phụ cấp ăn trưa', description: 'Hỗ trợ chi phí ăn trưa các ngày làm việc thực tế trong tháng', defaultTaxable: false, defaultInsuranceBased: false },
    { code: 'FUEL', defaultName: 'Phụ cấp xăng xe', description: 'Hỗ trợ chi phí xăng xe đi lại theo vị trí và tính chất công việc', defaultTaxable: false, defaultInsuranceBased: false },
    { code: 'PHONE', defaultName: 'Phụ cấp điện thoại', description: 'Hỗ trợ cước viễn thông liên lạc phục vụ công việc', defaultTaxable: true, defaultInsuranceBased: false },
  ];
  for (const row of catalogRows) {
    await insertIfMissing(Catalog, { code: row.code }, { ...row, active: true }, 'AllowanceCatalog');
  }

  const tiers = [
    { order: 1, percentage: 100, conditions: [{ metric: 'LATE_COUNT', operator: 'EQ', value: 0 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
    { order: 2, percentage: 70, conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 2 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
    { order: 3, percentage: 50, conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 4 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
  ];
  const templateId = await insertIfMissing(
    BonusTemplate,
    { code: 'ATTENDANCE_100_70_50' },
    { code: 'ATTENDANCE_100_70_50', name: 'Chuyên cần 100/70/50', tiers, templateVersion: 1, active: true },
    'AttendanceBonusTemplate',
  );

  const orgs = await Org.find({}).select('_id code name').sort({ code: 1 }).lean();
  for (const org of orgs) {
    const organizationId = org._id;
    await insertIfMissing(
      LaborPolicy,
      { organizationId, version: 1 },
      { organizationId, ...LABOR_POLICY_SEED_V1 },
      'LaborCompliancePolicy',
    );
    await insertIfMissing(
      OvertimePolicy,
      { organizationId, version: 1 },
      { organizationId, ...OVERTIME_POLICY_SEED_V1 },
      'OvertimePayPolicy',
    );

    const catalog = APPLY
      ? await Catalog.find({ code: { $in: catalogRows.map(x => x.code) } }).lean()
      : catalogRows.map(item => ({ _id: new mongoose.Types.ObjectId(), ...item, active: true }));
    const allowanceConfig: Record<string, { amount: number; prorated: boolean }> = {
      MEAL: { amount: org.code === 'TVS' ? 730_000 : 650_000, prorated: true },
      FUEL: { amount: org.code === 'TVS' ? 500_000 : 400_000, prorated: false },
      PHONE: { amount: org.code === 'TVS' ? 400_000 : 300_000, prorated: false },
    };
    const allowanceIds: mongoose.Types.ObjectId[] = [];
    for (const item of catalog) {
      const config = allowanceConfig[item.code];
      const id = await insertIfMissing(
        Allowance,
        { organizationId, code: item.code },
        {
          organizationId, catalogId: item._id, code: item.code, name: item.defaultName,
          amount: config.amount, taxable: item.defaultTaxable,
          insuranceBased: item.defaultInsuranceBased, prorated: config.prorated,
          effectiveFrom: POLICY_FROM, version: 1, active: true,
        },
        'OrganizationAllowance',
      );
      allowanceIds.push(id as mongoose.Types.ObjectId);
    }

    const bonusName = `Chuyên cần ${org.code} 2026`;
    const bonusPolicyId = await insertIfMissing(
      BonusPolicy,
      { organizationId, name: bonusName, effectiveFrom: POLICY_FROM },
      {
        organizationId, templateId, name: bonusName, calculationBase: 'FIXED_AMOUNT',
        bonusAmount: org.code === 'TVS' ? 1_000_000 : 800_000,
        tiers, conditions: [], effectiveFrom: POLICY_FROM, version: 1, active: true,
      },
      'AttendanceBonusPolicy',
    );

    const positions = await Position.find({ organizationId }).select('_id code').lean();
    const positionCode = new Map(positions.map(p => [String(p._id), p.code]));
    const profiles = await Profile.find({ organizationId }).select('_id userId employeeCode employmentStatus positionId').sort({ employeeCode: 1 }).lean();
    const hrUser = await User.findOne({ organizationId, role: Role.HR }).select('_id').lean();

    for (const profile of profiles) {
      const posCode = positionCode.get(String(profile.positionId)) ?? 'STAFF';
      const baseSalary = salaryByPosition[posCode] ?? (String(profile.employeeCode).startsWith('HR-') ? 20_000_000 : 12_000_000);
      const isProbation = profile.employmentStatus === EmploymentStatus.PROBATION;
      const salaryDoc: Record<string, unknown> = {
        organizationId, employeeProfileId: profile._id, effectiveFrom: EFFECTIVE_FROM,
        baseSalary, insuranceSalary: Math.round(baseSalary * 0.8),
        organizationAllowanceIds: allowanceIds, attendanceBonusPolicyId: bonusPolicyId,
        currency: 'VND', roundingRule: 'ROUND_HALF_UP_TO_VND', version: 1, active: true,
      };
      if (isProbation) {
        salaryDoc.probationJobSalary = baseSalary;
        salaryDoc.probationAgreedSalary = Math.ceil(baseSalary * 0.85);
        salaryDoc.probationRate = 0.85;
      }
      await insertIfMissing(
        Salary,
        { organizationId, employeeProfileId: profile._id, effectiveFrom: EFFECTIVE_FROM },
        salaryDoc,
        'SalaryProfile',
      );

      const status = isProbation ? KpiStatus.DRAFT : KpiStatus.CONFIRMED;
      const amount = kpiByPosition[posCode] ?? (String(profile.employeeCode).startsWith('HR-') ? 2_500_000 : 1_000_000);
      await insertIfMissing(
        Kpi,
        { organizationId, employeeProfileId: profile._id, period: KPI_PERIOD },
        {
          organizationId, employeeProfileId: profile._id, period: KPI_PERIOD,
          score: isProbation ? 75 : 90, amount, source: KpiSource.MANUAL,
          note: isProbation ? 'Dữ liệu demo — chờ HR xác nhận' : 'Dữ liệu demo đã xác nhận',
          status, version: status === KpiStatus.CONFIRMED ? 2 : 1,
          ...(status === KpiStatus.CONFIRMED && hrUser ? { confirmedAt: new Date(), confirmedBy: hrUser._id } : {}),
        },
        'KpiPayrollInput',
      );
    }
  }

  console.log(`\nCompensation seed ${APPLY ? 'APPLY' : 'DRY-RUN'} — database "${db.name}"`);
  for (const [kind, s] of summary) console.log(`${kind.padEnd(28)} planned=${s.planned} created=${s.created} skipped=${s.skipped}`);
  if (!APPLY) console.log('\nNo data was written. Re-run with --apply to insert missing records.');
  await db.close();
}

main().catch(e => { console.error('[seed-compensation] failed:', e.message); process.exit(1); });
