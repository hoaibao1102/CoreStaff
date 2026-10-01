import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { vnTimeToUtc } from '../src/common/vietnam-time';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import {
  AttendanceApprovalStatus,
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  EmploymentStatus,
  InsuranceContributionType,
  Role,
  WorkMode,
  WorkdayType,
} from '../src/database/schemas/enums';
import { KpiSource, KpiStatus } from '../src/database/schemas/compensation.schema';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERIFY = args.includes('--verify');
const USER_ID = args.find((arg) => arg.startsWith('--user-id='))?.split('=')[1] ?? '';
const PERIOD = args.find((arg) => arg.startsWith('--period='))?.split('=')[1] ?? '2026-09';

if (!mongoose.isValidObjectId(USER_ID)) {
  throw new Error(`--user-id must be an exact 24-character ObjectId; got "${USER_ID}".`);
}
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(PERIOD)) {
  throw new Error(`--period must use YYYY-MM; got "${PERIOD}".`);
}

const [yearText, monthText] = PERIOD.split('-');
const year = Number(yearText);
const month = Number(monthText);
const periodStart = new Date(Date.UTC(year, month - 1, 1));
const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
const policyStart = new Date(Date.UTC(year, 0, 1));
const userObjectId = new mongoose.Types.ObjectId(USER_ID);

const allowanceSpecs = [
  {
    code: 'MEAL',
    name: 'Phụ cấp ăn trưa',
    description: 'Dữ liệu demo: hỗ trợ bữa trưa theo tháng.',
    amount: 730_000,
    taxable: false,
    insuranceBased: false,
    prorated: true,
  },
  {
    code: 'TRANSPORT',
    name: 'Phụ cấp đi lại',
    description: 'Dữ liệu demo: hỗ trợ chi phí đi lại.',
    amount: 500_000,
    taxable: true,
    insuranceBased: false,
    prorated: false,
  },
  {
    code: 'PHONE',
    name: 'Phụ cấp điện thoại',
    description: 'Dữ liệu demo: hỗ trợ liên lạc phục vụ công việc.',
    amount: 400_000,
    taxable: true,
    insuranceBased: false,
    prorated: false,
  },
  {
    code: 'RESPONSIBILITY',
    name: 'Phụ cấp trách nhiệm',
    description: 'Dữ liệu demo: ghi nhận trách nhiệm theo vị trí công việc.',
    amount: 1_500_000,
    taxable: true,
    insuranceBased: false,
    prorated: false,
  },
] as const;

const bonusTiers = [
  {
    order: 1,
    percentage: 100,
    conditions: [
      { metric: 'LATE_COUNT', operator: 'EQ', value: 0 },
      { metric: 'EARLY_COUNT', operator: 'EQ', value: 0 },
      { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 },
    ],
  },
];

type Action = 'planned' | 'created' | 'updated' | 'skipped' | 'verified';
const totals = new Map<string, Record<Action, number>>();
function mark(kind: string, action: Action, count = 1) {
  const row = totals.get(kind) ?? { planned: 0, created: 0, updated: 0, skipped: 0, verified: 0 };
  row[action] += count;
  totals.set(kind, row);
}
function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
function septemberWorkdays(): string[] {
  const dates: string[] = [];
  const publicHolidays = new Set([`${PERIOD}-01`, `${PERIOD}-02`]);
  const cursor = new Date(periodStart);
  while (cursor <= periodEnd) {
    const weekday = cursor.getUTCDay();
    const date = isoDate(cursor);
    if (weekday >= 1 && weekday <= 5 && !publicHolidays.has(date)) dates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function createIfMissing(
  model: mongoose.Model<any>,
  query: Record<string, unknown>,
  document: Record<string, unknown>,
  kind: string,
): Promise<mongoose.Types.ObjectId> {
  const existing: any = await model.findOne(query).lean();
  if (existing) {
    mark(kind, 'skipped');
    return existing._id;
  }
  if (!APPLY) {
    mark(kind, 'planned');
    return new mongoose.Types.ObjectId();
  }
  const created: any = await model.create(document);
  mark(kind, 'created');
  return created._id;
}

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
    const Position = db.model<any>('Position');
    const Assignment = db.model<any>('Assignment');
    const ManagerAssignment = db.model<any>('ManagerAssignment');
    const TimesheetPeriod = db.model<any>('TimesheetPeriod');
    const AttendanceDay = db.model<any>('AttendanceDay');
    const AttendanceEvent = db.model<any>('AttendanceEvent');
    const Catalog = db.model<any>('AllowanceCatalog');
    const Allowance = db.model<any>('OrganizationAllowance');
    const BonusTemplate = db.model<any>('AttendanceBonusTemplate');
    const BonusPolicy = db.model<any>('AttendanceBonusPolicy');
    const SalaryProfile = db.model<any>('SalaryProfile');
    const KpiPolicy = db.model<any>('KpiPolicy');
    const KpiInput = db.model<any>('KpiPayrollInput');
    const TaxPolicy = db.model<any>('TaxPolicy');
    const InsurancePolicy = db.model<any>('InsurancePolicy');
    const InsuranceProfile = db.model<any>('InsuranceProfile');

    const user: any = await User.findById(userObjectId).select('_id organizationId email fullName role status').lean();
    if (!user) throw new Error(`User ${USER_ID} does not exist.`);
    if (!user.organizationId) throw new Error(`User ${USER_ID} has no organizationId.`);
    const organizationId = new mongoose.Types.ObjectId(String(user.organizationId));

    const profile: any = await Profile.findOne({ organizationId, userId: userObjectId }).lean();
    if (!profile) throw new Error(`No EmployeeProfile belongs to user ${USER_ID}.`);
    if (![EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION].includes(profile.employmentStatus)) {
      throw new Error(`EmployeeProfile ${profile._id} is ${profile.employmentStatus}, expected ACTIVE or PROBATION.`);
    }

    const assignment: any = await Assignment.findOne({
      organizationId,
      userId: userObjectId,
      active: true,
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: isoDate(periodStart) } }],
    }).populate('workplaceId').populate('shiftTemplateId').populate('departmentId').lean();
    if (!assignment?.departmentId) throw new Error('Employee has no active department Assignment for the target period.');

    const departmentId = new mongoose.Types.ObjectId(String(assignment.departmentId._id ?? assignment.departmentId));
    let managers: any[] = await ManagerAssignment.find({
      organizationId,
      departmentId,
      active: true,
      effectiveFrom: { $lte: periodEnd },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: periodStart } }],
    }).select('managerUserId').lean();
    if (!managers.length && profile.directManagerId) {
      const managerUser: any = await User.findOne({
        _id: profile.directManagerId,
        organizationId,
        role: Role.DEPARTMENT_MANAGER,
        status: 'ACTIVE',
      }).select('_id').lean();
      if (managerUser) {
        const managerAssignmentId = await createIfMissing(
          ManagerAssignment,
          { organizationId, managerUserId: managerUser._id, departmentId, active: true },
          {
            organizationId,
            managerUserId: managerUser._id,
            departmentId,
            effectiveFrom: periodStart,
            active: true,
            createdBy: managerUser._id,
          },
          'ManagerAssignment',
        );
        managers = [{ _id: managerAssignmentId, managerUserId: managerUser._id }];
      }
    }
    if (!managers.length) {
      const fallbackManager: any = await User.findOne({
        organizationId,
        role: Role.DEPARTMENT_MANAGER,
        status: 'ACTIVE',
      }).select('_id').sort({ createdAt: 1 }).lean();
      if (fallbackManager) {
        const managerAssignmentId = await createIfMissing(
          ManagerAssignment,
          { organizationId, managerUserId: fallbackManager._id, departmentId, active: true },
          {
            organizationId,
            managerUserId: fallbackManager._id,
            departmentId,
            effectiveFrom: periodStart,
            active: true,
            createdBy: fallbackManager._id,
          },
          'ManagerAssignment',
        );
        managers = [{ _id: managerAssignmentId, managerUserId: fallbackManager._id }];
      }
    }
    if (!managers.length) {
      throw new Error('Organization has no active DEPARTMENT_MANAGER available for the employee department.');
    }

    const hrUser: any = await User.findOne({ organizationId, role: Role.HR, status: 'ACTIVE' }).select('_id').lean();
    if (!hrUser) throw new Error('Organization has no active HR user to confirm KPI input.');

    const taxPolicyId = await createIfMissing(
      TaxPolicy,
      { organizationId, effectiveFrom: policyStart, active: true },
      {
        organizationId,
        effectiveFrom: policyStart,
        standardDeduction: 11_000_000,
        personalDeduction: 11_000_000,
        dependentDeduction: 4_400_000,
        progressiveBrackets: [
          { upperLimit: 10_000_000, rate: 5 },
          { upperLimit: 30_000_000, rate: 10 },
          { upperLimit: 60_000_000, rate: 20 },
          { upperLimit: 100_000_000, rate: 30 },
          { upperLimit: Number.MAX_SAFE_INTEGER, rate: 35 },
        ],
        roundingRule: 'ROUND_HALF_UP_TO_VND',
        legalReference: 'Dữ liệu demo — HR/pháp lý phải xác nhận trước khi dùng thật',
        version: 1,
        active: true,
      },
      'TaxPolicy',
    );
    const insurancePolicyId = await createIfMissing(
      InsurancePolicy,
      { organizationId, effectiveFrom: policyStart, version: 1 },
      {
        organizationId,
        effectiveFrom: policyStart,
        version: 1,
        legalReference: 'Dữ liệu demo — HR/pháp lý phải xác nhận trước khi dùng thật',
        socialInsuranceEmployeeRate: 0.08,
        healthInsuranceEmployeeRate: 0.015,
        unemploymentInsuranceEmployeeRate: 0.01,
        salaryBaseRules: [
          { type: InsuranceContributionType.SOCIAL_INSURANCE, floorAmount: null },
          { type: InsuranceContributionType.HEALTH_INSURANCE, floorAmount: null },
          { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, floorAmount: null },
        ],
        capRules: [
          { type: InsuranceContributionType.SOCIAL_INSURANCE, capAmount: 52_200_000 },
          { type: InsuranceContributionType.HEALTH_INSURANCE, capAmount: 52_200_000 },
          { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, capAmount: 52_200_000 },
        ],
        employerContributionRates: [
          { type: InsuranceContributionType.SOCIAL_INSURANCE, rate: 0.175 },
          { type: InsuranceContributionType.HEALTH_INSURANCE, rate: 0.03 },
          { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, rate: 0.01 },
        ],
        createdBy: hrUser._id,
      },
      'InsurancePolicy',
    );
    const insuranceProfileId = await createIfMissing(
      InsuranceProfile,
      { organizationId, employeeId: profile._id, effectiveFrom: policyStart },
      {
        organizationId,
        employeeId: profile._id,
        effectiveFrom: policyStart,
        participatesSocialInsurance: true,
        participatesHealthInsurance: true,
        participatesUnemploymentInsurance: true,
        note: 'Dữ liệu demo phục vụ kiểm thử payroll tháng 09/2026.',
        version: 1,
        createdBy: hrUser._id,
      },
      'InsuranceProfile',
    );

    const existingPeriod: any = await TimesheetPeriod.findOne({ organizationId, period: PERIOD }).lean();
    let periodId: mongoose.Types.ObjectId;
    if (existingPeriod) {
      if (existingPeriod.status === 'CLOSED') throw new Error(`${PERIOD} is already CLOSED; refusing to mutate historical attendance.`);
      periodId = existingPeriod._id;
      mark('TimesheetPeriod', VERIFY ? 'verified' : 'skipped');
    } else {
      periodId = await createIfMissing(
        TimesheetPeriod,
        { organizationId, period: PERIOD },
        {
          organizationId,
          period: PERIOD,
          status: 'OPEN',
          version: 1,
          startDate: periodStart,
          endDate: periodEnd,
          managerSnapshotClosed: false,
          departmentSnapshots: [],
          active: true,
        },
        'TimesheetPeriod',
      );
    }

    const shift = assignment.shiftTemplateId;
    const workplace = assignment.workplaceId;
    const shiftSnapshot = {
      shiftTemplateId: shift?._id ? String(shift._id) : undefined,
      shiftName: shift?.name ?? 'Ca hành chính',
      startTime: shift?.startTime ?? '08:00',
      endTime: shift?.endTime ?? '17:00',
      breakMinutes: shift?.breakMinutes ?? 60,
      gracePeriodMinutes: shift?.gracePeriodMinutes ?? 10,
    };
    const workplaceSnapshot = {
      workplaceId: workplace?._id ? String(workplace._id) : undefined,
      workplaceName: workplace?.name ?? 'Văn phòng chính',
      workplaceType: workplace?.type ?? WorkMode.IN_OFFICE,
      address: workplace?.address,
      latitude: workplace?.latitude,
      longitude: workplace?.longitude,
      allowedRadiusMeters: workplace?.allowedRadiusMeters,
    };
    const employeeSnapshot = {
      employeeCode: profile.employeeCode,
      fullName: user.fullName,
      departmentId: String(departmentId),
      departmentName: assignment.departmentId?.name,
    };

    const workdays = septemberWorkdays();
    for (const workDate of workdays) {
      const existingDay: any = await AttendanceDay.findOne({ organizationId, employeeId: userObjectId, workDate }).lean();
      const checkInAt = new Date(vnTimeToUtc(workDate, shiftSnapshot.startTime));
      const checkOutAt = new Date(vnTimeToUtc(workDate, shiftSnapshot.endTime));
      const attendanceValues = {
        organizationId,
        employeeId: userObjectId,
        periodId,
        workDate,
        workMode: WorkMode.IN_OFFICE,
        workdayType: WorkdayType.WORKING_DAY,
        attendanceStatus: AttendanceStatus.COMPLETED,
        overallApprovalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
        checkInAt,
        checkOutAt,
        workingMinutes: 480,
        lateMinutes: 0,
        earlyMinutes: 0,
        shiftSnapshot,
        workplaceSnapshot,
        employeeSnapshot,
      };
      const isComplete = existingDay &&
        existingDay.attendanceStatus === AttendanceStatus.COMPLETED &&
        existingDay.workingMinutes === 480 &&
        existingDay.lateMinutes === 0 &&
        existingDay.earlyMinutes === 0 &&
        String(existingDay.periodId ?? '') === String(periodId);
      if (!APPLY) {
        mark('AttendanceDay', existingDay ? (isComplete ? 'skipped' : 'planned') : 'planned');
        if (!existingDay || !isComplete) mark('AttendanceEvent', 'planned', 2);
        continue;
      }
      const day: any = existingDay
        ? await AttendanceDay.findByIdAndUpdate(existingDay._id, { $set: attendanceValues }, { new: true, runValidators: true })
        : await AttendanceDay.create(attendanceValues);
      mark('AttendanceDay', existingDay ? (isComplete ? 'skipped' : 'updated') : 'created');
      const eventBase = {
        organizationId,
        attendanceDayId: day._id,
        employeeId: userObjectId,
        method: AttendanceMethod.NETWORK,
        publicIp: '127.0.0.1',
        address: workplaceSnapshot.workplaceName,
        validationStatus: 'VALID',
        approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
        isFallback: false,
        note: 'Dữ liệu seed đủ công tháng 09/2026 theo yêu cầu kiểm thử payroll.',
      };
      for (const [eventType, recordedAt] of [
        [AttendanceEventType.CHECK_IN, checkInAt],
        [AttendanceEventType.CHECK_OUT, checkOutAt],
      ] as const) {
        const result = await AttendanceEvent.updateOne(
          { organizationId, attendanceDayId: day._id, eventType },
          { $set: { ...eventBase, eventType, recordedAt } },
          { upsert: true, runValidators: true },
        );
        mark('AttendanceEvent', result.upsertedCount ? 'created' : 'updated');
      }
    }

    const allowanceIds: mongoose.Types.ObjectId[] = [];
    for (const spec of allowanceSpecs) {
      const catalogId = await createIfMissing(
        Catalog,
        { code: spec.code },
        {
          code: spec.code,
          defaultName: spec.name,
          description: spec.description,
          defaultTaxable: spec.taxable,
          defaultInsuranceBased: spec.insuranceBased,
          active: true,
        },
        'AllowanceCatalog',
      );
      const allowanceId = await createIfMissing(
        Allowance,
        { organizationId, code: spec.code },
        {
          organizationId,
          catalogId,
          code: spec.code,
          name: spec.name,
          description: spec.description,
          amount: spec.amount,
          taxable: spec.taxable,
          insuranceBased: spec.insuranceBased,
          prorated: spec.prorated,
          effectiveFrom: policyStart,
          version: 1,
          active: true,
        },
        'OrganizationAllowance',
      );
      allowanceIds.push(allowanceId);
    }

    const templateId = await createIfMissing(
      BonusTemplate,
      { code: 'ATTENDANCE_FULL_1M' },
      {
        code: 'ATTENDANCE_FULL_1M',
        name: 'Chuyên cần đủ công 1 triệu',
        tiers: bonusTiers,
        templateVersion: 1,
        active: true,
      },
      'AttendanceBonusTemplate',
    );
    const bonusPolicyId = await createIfMissing(
      BonusPolicy,
      { organizationId, name: 'Chuyên cần toàn công ty 1 triệu', effectiveFrom: policyStart },
      {
        organizationId,
        templateId,
        name: 'Chuyên cần toàn công ty 1 triệu',
        calculationBase: 'FIXED_AMOUNT',
        bonusAmount: 1_000_000,
        tiers: bonusTiers,
        conditions: [],
        effectiveFrom: policyStart,
        version: 1,
        active: true,
        scope: 'ALL',
        departmentIds: [],
      },
      'AttendanceBonusPolicy',
    );

    let salary: any = await SalaryProfile.findOne({
      organizationId,
      employeeProfileId: profile._id,
      active: true,
      effectiveFrom: { $lte: periodEnd },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: periodStart } }],
    }).sort({ effectiveFrom: -1 }).lean();
    if (!salary) {
      const position: any = profile.positionId
        ? await Position.findOne({ _id: profile.positionId, organizationId }).select('code name').lean()
        : null;
      const salaryByPosition: Record<string, number> = {
        DLEAD: 28_000_000,
        DEV: 18_000_000,
        QA: 16_000_000,
        ACC: 15_000_000,
        OPS: 13_000_000,
        SLM: 24_000_000,
        SLS: 14_000_000,
      };
      const baseSalary = salaryByPosition[String(position?.code ?? '').toUpperCase()] ?? 12_000_000;
      const salaryDocument = {
        organizationId,
        employeeProfileId: profile._id,
        effectiveFrom: periodStart,
        baseSalary,
        insuranceSalary: Math.round(baseSalary * 0.8),
        probationJobSalary: baseSalary,
        probationAgreedSalary: Math.ceil(baseSalary * 0.85),
        probationRate: 0.85,
        organizationAllowanceIds: allowanceIds,
        attendanceBonusPolicyId: bonusPolicyId,
        currency: 'VND',
        roundingRule: 'ROUND_HALF_UP_TO_VND',
        version: 1,
        active: true,
      };
      if (!APPLY) {
        salary = { _id: new mongoose.Types.ObjectId(), ...salaryDocument };
        mark('SalaryProfile', 'planned');
      } else {
        salary = (await SalaryProfile.create(salaryDocument)).toObject();
        mark('SalaryProfile', 'created');
      }
    }
    const missingAllowanceIds = allowanceIds.filter(
      (id) => !(salary.organizationAllowanceIds ?? []).some((current: unknown) => String(current) === String(id)),
    );
    const needsBonus = String(salary.attendanceBonusPolicyId ?? '') !== String(bonusPolicyId);
    if (missingAllowanceIds.length || needsBonus) {
      if (!APPLY) {
        mark('SalaryProfile', 'planned');
      } else {
        await SalaryProfile.updateOne(
          { _id: salary._id, organizationId },
          {
            $addToSet: { organizationAllowanceIds: { $each: missingAllowanceIds } },
            ...(needsBonus ? { $set: { attendanceBonusPolicyId: bonusPolicyId } } : {}),
          },
        );
        mark('SalaryProfile', 'updated');
      }
    } else {
      mark('SalaryProfile', VERIFY ? 'verified' : 'skipped');
    }

    const kpiPolicyId = await createIfMissing(
      KpiPolicy,
      { organizationId, name: 'KPI toàn công ty — mức A', effectiveFrom: policyStart },
      {
        organizationId,
        name: 'KPI toàn công ty — mức A',
        policyType: 'GRADE',
        baseAmount: 2_000_000,
        tiers: [{ name: 'A', percentage: 100, minScore: 90, maxScore: 100, order: 1 }],
        effectiveFrom: policyStart,
        version: 1,
        active: true,
        scope: 'ALL',
        departmentIds: [],
      },
      'KpiPolicy',
    );
    const existingKpi: any = await KpiInput.findOne({ organizationId, employeeProfileId: profile._id, period: PERIOD }).lean();
    if (existingKpi) {
      if (existingKpi.status !== KpiStatus.CONFIRMED) {
        if (!APPLY) mark('KpiPayrollInput', 'planned');
        else {
          await KpiInput.updateOne(
            { _id: existingKpi._id, organizationId },
            {
              $set: {
                policyId: kpiPolicyId,
                departmentId,
                score: 95,
                tierName: 'A',
                tierPercentage: 100,
                baseAmount: 2_000_000,
                amount: 2_000_000,
                source: KpiSource.MANUAL,
                note: 'KPI tháng 09/2026 đã đánh giá và HR xác nhận.',
                status: KpiStatus.CONFIRMED,
                confirmedAt: new Date(),
                confirmedBy: hrUser._id,
                evaluatedAt: new Date(),
                evaluatedBy: hrUser._id,
              },
              $inc: { version: 1 },
            },
          );
          mark('KpiPayrollInput', 'updated');
        }
      } else mark('KpiPayrollInput', VERIFY ? 'verified' : 'skipped');
    } else {
      await createIfMissing(
        KpiInput,
        { organizationId, employeeProfileId: profile._id, period: PERIOD },
        {
          organizationId,
          employeeProfileId: profile._id,
          departmentId,
          policyId: kpiPolicyId,
          period: PERIOD,
          score: 95,
          tierName: 'A',
          tierPercentage: 100,
          baseAmount: 2_000_000,
          amount: 2_000_000,
          source: KpiSource.MANUAL,
          note: 'KPI tháng 09/2026 đã đánh giá và HR xác nhận.',
          status: KpiStatus.CONFIRMED,
          version: 1,
          confirmedAt: new Date(),
          confirmedBy: hrUser._id,
          evaluatedAt: new Date(),
          evaluatedBy: hrUser._id,
        },
        'KpiPayrollInput',
      );
    }

    const attendanceCount = await AttendanceDay.countDocuments({
      organizationId,
      employeeId: userObjectId,
      periodId,
      workDate: { $in: workdays },
      attendanceStatus: AttendanceStatus.COMPLETED,
      workingMinutes: 480,
      lateMinutes: 0,
      earlyMinutes: 0,
    });
    const assignedSalary: any = APPLY || VERIFY
      ? await SalaryProfile.findById(salary._id).lean()
      : salary;
    const kpiAfter: any = APPLY || VERIFY
      ? await KpiInput.findOne({ organizationId, employeeProfileId: profile._id, period: PERIOD }).lean()
      : existingKpi;

    console.log(`\nTarget employee seed ${VERIFY ? 'VERIFY' : APPLY ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`userId=${USER_ID} profileId=${profile._id} organizationId=${organizationId}`);
    console.log(`period=${PERIOD} periodId=${periodId} status=${existingPeriod?.status ?? 'OPEN (planned)'}`);
    console.log(`departmentId=${departmentId} effectiveManagers=${managers.length}`);
    console.log(`workdays=${workdays.length} completeAttendance=${attendanceCount}/${workdays.length}`);
    console.log('allowances=' + allowanceSpecs.map((item) => `${item.code}:${item.amount}`).join(', '));
    console.log(`attendanceBonus=1000000 scope=ALL policyId=${bonusPolicyId}`);
    console.log(`taxPolicyId=${taxPolicyId} insurancePolicyId=${insurancePolicyId} insuranceProfileId=${insuranceProfileId}`);
    console.log(`kpi=${kpiAfter?.status ?? (APPLY ? 'UNKNOWN' : 'CONFIRMED (planned)')} amount=${kpiAfter?.amount ?? 2_000_000}`);
    console.log(`salaryAllowanceLinks=${assignedSalary?.organizationAllowanceIds?.length ?? 0}`);
    console.log('managerClosePending=' + String(existingPeriod?.managerSnapshotClosed !== true));
    console.log('\nActions:');
    for (const [kind, row] of totals) {
      console.log(`${kind.padEnd(28)} planned=${row.planned} created=${row.created} updated=${row.updated} skipped=${row.skipped} verified=${row.verified}`);
    }

    if (VERIFY) {
      const linkedIds = new Set((assignedSalary?.organizationAllowanceIds ?? []).map((id: unknown) => String(id)));
      const missingLinks = allowanceIds.filter((id) => !linkedIds.has(String(id)));
      const failures = [
        attendanceCount !== workdays.length ? `attendance ${attendanceCount}/${workdays.length}` : '',
        missingLinks.length ? `${missingLinks.length} allowance links missing` : '',
        String(assignedSalary?.attendanceBonusPolicyId ?? '') !== String(bonusPolicyId) ? 'attendance bonus not linked' : '',
        kpiAfter?.status !== KpiStatus.CONFIRMED ? 'KPI not confirmed' : '',
        Number(kpiAfter?.amount ?? 0) !== 2_000_000 ? 'KPI amount is not 2,000,000' : '',
        existingPeriod?.managerSnapshotClosed === true ? 'manager snapshot is already closed' : '',
        !taxPolicyId ? 'tax policy missing' : '',
        !insurancePolicyId ? 'insurance policy missing' : '',
        !insuranceProfileId ? 'insurance profile missing' : '',
      ].filter(Boolean);
      if (failures.length) throw new Error(`Verification failed: ${failures.join('; ')}`);
      console.log('\nVerification passed: employee is ready for the manager-close step.');
    } else if (!APPLY) {
      console.log('\nNo data was written. Re-run with --apply to persist missing records.');
    }
  } finally {
    await closeConnection(db);
  }
}

void main().catch((error) => {
  console.error('[seed-target-september-payroll] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
