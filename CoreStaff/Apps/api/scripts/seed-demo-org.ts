/**
 * Demo tenant ANPHAT — seed bằng cách "vận hành" hệ thống thật qua 3 tháng.
 *
 *   npm run seed:demo:dry        # In kế hoạch dữ liệu (không ghi DB)
 *   npm run seed:demo:reset      # Xóa tenant ANPHAT và seed lại từ đầu
 *   npm run seed:demo:rehearsal  # Seed lại + chạy hết luồng kỳ 10 (diễn tập)
 *   npm run verify:demo          # Kiểm tra tính nhất quán dữ liệu hiện có
 *
 * Tùy chọn: --reference-date=YYYY-MM-DD (mặc định: hôm nay theo giờ VN),
 *           --active-status=REVIEWING|OPEN (trạng thái kỳ 10 sau seed),
 *           --org-code=ANPHAT.
 *
 * Nguyên tắc: dữ liệu chấm công từng ngày được tính bằng đúng
 * `calculateAttendance` mà check-in/check-out dùng; mọi thao tác nghiệp vụ
 * (nộp/duyệt phép, OT, giải trình, duyệt selfie, xử lý vắng, xác nhận công,
 * chốt kỳ, tính & phát hành lương) gọi service thật, chạy trên đồng hồ ảo để
 * mốc thời gian giống hệt hệ thống vận hành thật. Không có con số nào được
 * ghi tay vào summary/snapshot/payslip.
 */
import { installVirtualClock, resetVirtualClock, setVirtualNow, vnInstant } from './lib/virtual-clock';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Types } from 'mongoose';
import * as ExcelJS from 'exceljs';

import { hashPassword } from '../src/auth/strategies/bcrypt.strategy';
import { enumerateDates } from '../src/common/date-only';
import { calculateAttendance, requiredWorkingIntervalsForShift } from '../src/attendance/services/attendance-calculator.service';
import { AttendanceEndpointSource } from '../src/database/schemas/attendance-day.schema';
import {
  AttendanceApprovalStatus, AttendanceEventType, AttendanceMethod, AttendanceStatus, CalendarExceptionType,
  ContractStatus, ContractType, EmploymentStatus, EnterpriseInsuranceCostBearer, InsuranceContributionType, LeaveDurationType,
  Role, ShiftScope, WorkdayType, WorkMode,
} from '../src/database/schemas/enums';
import { TimesheetPeriodStatus } from '../src/database/schemas/timesheet-period.schema';
import type { Connection } from 'mongoose';
import { createDemoApp, DemoApp, syncDriverClock } from './lib/demo-app';
import {
  ACCOUNTS, ACTIVE_PERIOD, CONFIRMATIONS, CURRENT_MONTH_LEAVES, CURRENT_PERIOD, DAY_OVERRIDES, DayPlan, DemoAccount,
  EmployeeCode, FORFEITS, hash01, HISTORY_PERIOD, HOLIDAYS, KPI_BASE_AMOUNT, KPI_SCORES, kpiFor, kpiPolicyTiers, LEAVES,
  MANAGER_OF, OFFICE, ORG_NAME, OVERTIMES, planFor, PunchSpec, SELFIE_APPROVALS, SITES,
} from './lib/demo-scenario';
import { printDemoStatus, runDemoFlow } from './demo-flow';

installVirtualClock();

const ARGS = process.argv.slice(2);
const arg = (name: string) => ARGS.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const APPLY = ARGS.includes('--apply');
const RESET = ARGS.includes('--reset');
const VERIFY_ONLY = ARGS.includes('--verify-only');
const REHEARSAL = ARGS.includes('--close-active') || ARGS.includes('--rehearsal');
/** Seed chỉ gieo dữ liệu thô; gỡ blocker là bước riêng `npm run demo:resolve` để demo minh bạch. */
const ORG_CODE = (arg('org-code') ?? 'ANPHAT').toUpperCase();
const ACTIVE_STATUS = (arg('active-status') ?? 'REVIEWING').toUpperCase();
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? 'Demo123456!';

const REAL_NOW = Date.now();
/** Set once the demo app boots; lets the virtual clock jump keep the driver warm. */
let connection: Connection | undefined;
const TODAY_VN = new Date(REAL_NOW + 7 * 3600_000).toISOString().slice(0, 10);
const REFERENCE_DATE = (() => {
  const requested = arg('reference-date') ?? TODAY_VN;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) throw new Error(`--reference-date phải có dạng YYYY-MM-DD (nhận: ${requested})`);
  if (requested < `${CURRENT_PERIOD}-01`) throw new Error(`Ngày tham chiếu ${requested} sớm hơn kỳ hiện tại ${CURRENT_PERIOD}.`);
  if (requested > TODAY_VN) throw new Error(`Ngày tham chiếu ${requested} ở tương lai — hệ thống thật không có chấm công tương lai.`);
  const lastDay = `${CURRENT_PERIOD}-30`;
  if (requested > lastDay) {
    console.warn(`[seed:demo] Ngày tham chiếu ${requested} vượt kỳ ${CURRENT_PERIOD}; dữ liệu dừng ở ${lastDay}.`);
    return lastDay;
  }
  return requested;
})();
const REFERENCE_IS_TODAY = REFERENCE_DATE === TODAY_VN;
/** Tài khoản demo chấm công trực tiếp trên điện thoại hôm nay. */
const LIVE_CHECKIN_CODE: EmployeeCode = 'NV-KD-001';

const EMPLOYEE_ACCOUNTS = ACCOUNTS.filter(a => a.role !== Role.HR) as Array<DemoAccount & { code: EmployeeCode; dept: 'KD' | 'KT' }>;
const HOLIDAY_DATES = new Set(HOLIDAYS.map(h => h.date));

function weekday(date: string) { return new Date(`${date}T00:00:00Z`).getUTCDay(); }
function isWeekend(date: string) { const d = weekday(date); return d === 0 || d === 6; }
function isWorkday(date: string) { return !isWeekend(date) && !HOLIDAY_DATES.has(date); }
function periodOf(date: string) { return date.slice(0, 7); }
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
const fmtMoney = (v: number) => Math.round(v).toLocaleString('vi-VN');

/** Ngày nghỉ cả ngày đã được duyệt: không có bản ghi chấm công là đúng nghiệp vụ. */
function onFullDayLeave(code: EmployeeCode, date: string) {
  return [...LEAVES, ...CURRENT_MONTH_LEAVES.filter(l => l.approved)].some(l => l.code === code
    && l.durationType === LeaveDurationType.FULL_DAY && l.startDate <= date && l.endDate >= date);
}

function dayPlan(account: DemoAccount & { code: EmployeeCode }, date: string): DayPlan | null {
  if (date < account.joinDate) return null;
  const override = DAY_OVERRIDES[`${date}|${account.code}`];
  if (!override && (!isWorkday(date) || onFullDayLeave(account.code, date))) return null;
  return planFor(account.code, date, isWorkday(date));
}

function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const DEVICES: Record<EmployeeCode, string> = {
  'QL-KD-001': 'CoreStaff/1.6.2 (iOS 18.1; iPhone16,2)',
  'QL-KT-001': 'CoreStaff/1.6.2 (Android 15; Pixel 8)',
  'NV-KD-001': 'CoreStaff/1.6.2 (Android 14; SM-A556E)',
  'NV-KD-002': 'CoreStaff/1.6.2 (iOS 17.6; iPhone14,5)',
  'NV-KD-003': 'CoreStaff/1.6.2 (Android 14; Redmi Note 13)',
  'NV-KT-001': 'CoreStaff/1.6.2 (Android 15; SM-S921B)',
  'NV-KT-002': 'CoreStaff/1.6.2 (Android 14; OPPO CPH2581)',
  'NV-KT-003': 'CoreStaff/1.6.2 (iOS 18.0; iPhone15,3)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run: kế hoạch dữ liệu, không cần DB
// ─────────────────────────────────────────────────────────────────────────────
function printPlan() {
  console.log(`\n─── KẾ HOẠCH DỮ LIỆU DEMO [${ORG_CODE}] — ngày tham chiếu ${REFERENCE_DATE} ───`);
  console.log(`Kỳ ${HISTORY_PERIOD}: CLOSED + phát hành lương | Kỳ ${ACTIVE_PERIOD}: ${ACTIVE_STATUS}, còn blocker | Kỳ ${CURRENT_PERIOD}: OPEN, dữ liệu tới ${REFERENCE_DATE}`);
  for (const period of [HISTORY_PERIOD, ACTIVE_PERIOD]) {
    console.log(`\n■ ${period}`);
    for (const [key, override] of Object.entries(DAY_OVERRIDES).filter(([k]) => k.startsWith(period)).sort()) {
      const [date, code] = key.split('|');
      const plan = planFor(code as EmployeeCode, date, isWorkday(date));
      const time = (p: PunchSpec | null) => (p ? `${p.time.slice(0, 5)} ${p.method ?? 'WIFI'}` : '—');
      console.log(`  ${date} ${code.padEnd(10)} vào ${time(plan!.in).padEnd(12)} ra ${time(plan!.out).padEnd(12)} ${override.story}`);
    }
    for (const leave of LEAVES.filter(l => periodOf(l.startDate) === period)) {
      console.log(`  ${leave.startDate}${leave.endDate !== leave.startDate ? `→${leave.endDate}` : ''} ${leave.code.padEnd(10)} ${leave.leaveType}/${leave.durationType}: ${leave.reason}`);
    }
    for (const ot of OVERTIMES.filter(o => periodOf(o.date) === period)) {
      console.log(`  ${ot.date} ${ot.code.padEnd(10)} OT ${ot.windows.map(w => w.join('-')).join(', ')} ${ot.approveAt ? '(duyệt)' : '(CHỜ duyệt)'}: ${ot.reason}`);
    }
  }
  console.log('\nChạy với "npm run seed:demo:reset" để ghi dữ liệu (tính toán bằng service thật).');
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────
interface Ctx {
  demo: DemoApp;
  orgId: Types.ObjectId;
  org: string;
  users: Map<string, Types.ObjectId>;
  profiles: Map<string, Types.ObjectId>;
  depts: Map<string, Types.ObjectId>;
  shift: any;
  workplace: any;
  periods: Map<string, Types.ObjectId>;
  ids: Map<string, string>;
  log: string[];
}

/** Jump the virtual clock and re-stamp the Mongo driver's heartbeat cache. */
function moveClock(when: Date) {
  setVirtualNow(when);
  if (connection) syncDriverClock(connection);
}

async function at<T>(when: Date, label: string, run: () => Promise<T>): Promise<T> {
  if (when.getTime() > REAL_NOW) throw new Error(`Thao tác "${label}" nằm ở tương lai (${when.toISOString()}).`);
  moveClock(when);
  try {
    return await run();
  } catch (error: any) {
    const reason = error?.response?.message ?? error?.message ?? String(error);
    throw new Error(`[${label}] ${Array.isArray(reason) ? reason.join(', ') : reason}`);
  }
}
const vn = (date: string, time: string) => vnInstant(date, time);

async function resetOrg(demo: DemoApp, orgId: Types.ObjectId) {
  const ids = [orgId, String(orgId)];
  let removed = 0;
  for (const name of demo.connection.modelNames()) {
    const model = demo.model(name);
    if (name === 'Organization' || !model.schema.path('organizationId')) continue;
    removed += (await model.deleteMany({ organizationId: { $in: ids } })).deletedCount ?? 0;
  }
  await demo.model('Organization').deleteOne({ _id: orgId });
  console.log(`[seed:demo] Đã xóa ${removed} bản ghi của tenant ${ORG_CODE}.`);
}

async function createWithClock(model: any, when: Date, doc: Record<string, unknown>) {
  moveClock(when);
  return model.create(doc);
}

async function seedMasterData(ctx: Ctx) {
  const { demo, orgId } = ctx;
  const m = demo.model;
  const hrJoin = vn('2023-03-01', '08:30');

  await createWithClock(m('Organization'), vn('2023-03-01', '08:00'), {
    _id: orgId, code: ORG_CODE, name: ORG_NAME, timezone: 'Asia/Ho_Chi_Minh', status: 'ACTIVE',
    evidenceRetentionDays: 90, payrollSeparationOfDuties: false, attendanceOvertimeV2Enabled: true,
  });

  for (const d of [{ code: 'KD', name: 'Phòng Kinh doanh' }, { code: 'KT', name: 'Phòng Kỹ thuật' }]) {
    const row = await createWithClock(m('Department'), hrJoin, { organizationId: orgId, code: d.code, name: d.name, active: true });
    ctx.depts.set(d.code, row._id);
  }
  const positions = new Map<string, Types.ObjectId>();
  for (const p of [
    { code: 'TP-KD', name: 'Trưởng phòng Kinh doanh', dept: 'KD' }, { code: 'NV-KD', name: 'Chuyên viên Kinh doanh', dept: 'KD' },
    { code: 'TP-KT', name: 'Trưởng phòng Kỹ thuật', dept: 'KT' }, { code: 'NV-KT', name: 'Kỹ sư Phần mềm', dept: 'KT' },
  ]) {
    const row = await createWithClock(m('Position'), hrJoin, { organizationId: orgId, departmentId: ctx.depts.get(p.dept), code: p.code, name: p.name, active: true });
    positions.set(p.code, row._id);
  }

  ctx.shift = (await createWithClock(m('ShiftTemplate'), vn('2025-12-20', '10:00'), {
    organizationId: orgId, scope: ShiftScope.ORGANIZATION, code: 'HC-0800', name: 'Ca hành chính (08:00 - 17:00)',
    weekdays: [1, 2, 3, 4, 5], effectiveFrom: '2026-01-01', startTime: '08:00', endTime: '17:00',
    breakMinutes: 60, breakStartTime: '12:00', breakEndTime: '13:00', gracePeriodMinutes: 15, active: true,
  })).toObject();
  ctx.workplace = (await createWithClock(m('Workplace'), vn('2025-12-20', '10:05'), {
    organizationId: orgId, code: 'HQ', name: OFFICE.name, type: 'IN_OFFICE', address: OFFICE.address,
    latitude: OFFICE.latitude, longitude: OFFICE.longitude, allowedRadiusMeters: OFFICE.allowedRadiusMeters,
    maximumAccuracyMeters: OFFICE.maximumAccuracyMeters, allowedWifiNetworks: OFFICE.wifi.map(w => ({ ...w, active: true })),
    allowWifiAttendance: true, allowGpsAttendance: true, allowSelfieFallback: true, defaultShiftTemplateId: ctx.shift._id, active: true,
  })).toObject();

  // Chính sách hiệu lực từ 01/01/2026 (đúng quy định áp dụng cho kỳ lương 2026).
  const policyAt = vn('2025-12-26', '09:00');
  await createWithClock(m('LaborCompliancePolicy'), policyAt, {
    organizationId: orgId, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), normalDailyMinutes: 480, normalWeeklyMinutes: 2880,
    maxCombinedDailyMinutes: 720, maxMonthlyOvertimeMinutes: 2400, maxAnnualOvertimeMinutes: 12000, exceptionalAnnualOvertimeMinutes: 18000,
    warningThresholdPercent: 85, maxRetroactiveFilingDays: 7, minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30,
    maxMonthlyAttendanceConfirmations: 3, probationMinimumRate: 0.85,
    legalReference: 'Bộ luật Lao động 45/2019/QH14; Nghị định 145/2020/NĐ-CP', version: 1, active: true,
  });
  await createWithClock(m('OvertimePayPolicy'), policyAt, {
    organizationId: orgId, workingDayRate: 1.5, weeklyOffRate: 2.0, publicHolidayRate: 3.0,
    legalReference: 'Điều 98 Bộ luật Lao động 45/2019/QH14', effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), version: 1, active: true,
  });
  await createWithClock(m('WorkCreditPolicy'), policyAt, {
    organizationId: orgId, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), halfDayMinimumRatio: 0.5, fullDayMinimumRatio: 0.875,
    paidLeaveCreditEnabled: true, incompleteDayRule: 'BLOCK', version: 1, active: true,
    businessReference: 'Quy chế chấm công An Phát 2026: làm đủ từ 7/8 giờ được 1 công, từ 4 giờ được 0,5 công; nghỉ phép có lương được tính công',
  });
  await createWithClock(m('TaxPolicy'), policyAt, {
    organizationId: orgId, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), standardDeduction: 15_500_000, personalDeduction: 15_500_000,
    dependentDeduction: 6_200_000, roundingRule: 'ROUND_HALF_UP_TO_VND', overtimeTaxable: false, version: 1, active: true,
    progressiveBrackets: [
      { upperLimit: 10_000_000, rate: 5 }, { upperLimit: 30_000_000, rate: 10 }, { upperLimit: 60_000_000, rate: 20 },
      { upperLimit: 100_000_000, rate: 30 }, { upperLimit: Number.POSITIVE_INFINITY, rate: 35 },
    ],
    legalReference: 'Luật Thuế TNCN 200/QH12; Nghị định 126/2023/NĐ-CP',
  });
  await createWithClock(m('InsurancePolicy'), policyAt, {
    organizationId: orgId, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), legalReference: 'Luật BHXH 41/2024/QH15; Quyết định 595/QĐ-BHXH',
    socialInsuranceEmployeeRate: 0.08, healthInsuranceEmployeeRate: 0.015, unemploymentInsuranceEmployeeRate: 0.01,
    capRules: [
      { type: InsuranceContributionType.SOCIAL_INSURANCE, capAmount: 46_800_000 },
      { type: InsuranceContributionType.HEALTH_INSURANCE, capAmount: 46_800_000 },
      { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, capAmount: 99_200_000 },
    ],
    salaryBaseRules: [
      { type: InsuranceContributionType.SOCIAL_INSURANCE, floorAmount: 4_960_000 },
      { type: InsuranceContributionType.HEALTH_INSURANCE, floorAmount: 4_960_000 },
      { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, floorAmount: 4_960_000 },
    ],
    employerContributionRates: [
      { type: InsuranceContributionType.SOCIAL_INSURANCE, rate: 0.175 },
      { type: InsuranceContributionType.HEALTH_INSURANCE, rate: 0.03 },
      { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, rate: 0.01 },
    ],
    version: 1, active: true,
  });
  const bonusPolicy = await createWithClock(m('AttendanceBonusPolicy'), policyAt, {
    organizationId: orgId, name: 'Thưởng chuyên cần tháng', calculationBase: 'FIXED_AMOUNT', bonusAmount: 1_000_000,
    tiers: [{ order: 1, percentage: 100, conditions: [{ metric: 'LATE_COUNT', operator: 'EQ', value: 0 }, { metric: 'EARLY_COUNT', operator: 'EQ', value: 0 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] }],
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), version: 1, active: true,
  });

  const allowances = new Map<string, { id: Types.ObjectId; amount: number }>();
  for (const a of [
    { code: 'MEAL', name: 'Phụ cấp ăn trưa', amount: 730_000, taxable: false, insuranceBased: false },
    { code: 'RESP', name: 'Phụ cấp trách nhiệm', amount: 2_000_000, taxable: true, insuranceBased: true },
    { code: 'PHONE', name: 'Phụ cấp xăng xe - điện thoại', amount: 500_000, taxable: true, insuranceBased: false },
  ]) {
    const catalog = await m('AllowanceCatalog').findOneAndUpdate(
      { code: a.code },
      { $setOnInsert: { code: a.code, defaultName: a.name, defaultTaxable: a.taxable, defaultInsuranceBased: a.insuranceBased, active: true } },
      { upsert: true, new: true },
    ).lean() as any;
    const row = await createWithClock(m('OrganizationAllowance'), policyAt, {
      organizationId: orgId, catalogId: catalog._id, code: a.code, name: a.name, amount: a.amount, taxable: a.taxable,
      insuranceBased: a.insuranceBased, prorated: false, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), version: 1, active: true,
    });
    allowances.set(a.code, { id: row._id, amount: a.amount });
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const managers = new Map<string, Types.ObjectId>();
  for (const acc of [...ACCOUNTS].sort((a, b) => Number(b.role === Role.DEPARTMENT_MANAGER) - Number(a.role === Role.DEPARTMENT_MANAGER))) {
    const joinedAt = vn(acc.joinDate < '2026-01-01' ? acc.joinDate : addDays(acc.joinDate, -3), '08:30');
    const user = await createWithClock(m('User'), joinedAt, {
      organizationId: orgId, email: acc.email, fullName: acc.fullName, phone: acc.phone, passwordHash, role: acc.role,
      status: 'ACTIVE', mustChangePassword: false, failedLoginCount: 0,
    });
    ctx.users.set(acc.code, user._id);
    if (acc.role === Role.HR) continue;
    const deptId = ctx.depts.get(acc.dept!)!;
    const profile = await createWithClock(m('EmployeeProfile'), joinedAt, {
      organizationId: orgId, userId: user._id, employeeCode: acc.code, email: acc.email, phone: acc.phone,
      employmentType: 'FULL_TIME', employmentStatus: EmploymentStatus.ACTIVE,
      dateOfBirth: new Date(`${acc.dateOfBirth}T00:00:00.000Z`), gender: acc.gender, address: acc.address,
      taxCode: acc.taxCode, socialInsuranceCode: acc.socialInsuranceCode, bankAccount: acc.bankAccount,
      departmentId: deptId, positionId: positions.get(acc.position!), workplaceId: ctx.workplace._id,
      directManagerId: acc.role === Role.EMPLOYEE ? managers.get(acc.dept!) : undefined,
      joinDate: new Date(`${acc.joinDate}T00:00:00.000Z`),
      dependents: (acc.dependents ?? []).map(d => ({ ...d, isDisabled: false, active: true, status: 'ACTIVE', version: 1 })),
    });
    ctx.profiles.set(acc.code, profile._id);
    if (acc.role === Role.DEPARTMENT_MANAGER) managers.set(acc.dept!, profile._id);

    for (const c of acc.contracts ?? []) {
      const ended = c.expiryDate && c.expiryDate < TODAY_VN;
      await createWithClock(m('EmploymentContract'), vn(addDays(c.effectiveDate, -2), '15:00'), {
        organizationId: orgId, employeeProfileId: profile._id, contractType: c.type,
        status: ended ? ContractStatus.EXPIRED : ContractStatus.ACTIVE,
        effectiveDate: new Date(`${c.effectiveDate}T00:00:00.000Z`), expiryDate: c.expiryDate ? new Date(`${c.expiryDate}T00:00:00.000Z`) : undefined,
        statusChangedAt: ended ? new Date(`${c.expiryDate}T17:00:00.000Z`) : undefined, note: c.note,
      });
    }
    await createWithClock(m('Assignment'), joinedAt, {
      organizationId: orgId, userId: user._id, departmentId: deptId, workplaceId: ctx.workplace._id,
      shiftTemplateId: ctx.shift._id, effectiveFrom: acc.joinDate, active: true,
    });

    const assigned = acc.allowances.map(code => allowances.get(code)!);
    const totalAllowances = assigned.reduce((s, a) => s + a.amount, 0);
    const salaryWindows = acc.probation
      ? [
          { from: acc.joinDate, to: acc.probation.until, base: acc.probation.agreedSalary, probation: true },
          { from: addDays(acc.probation.until, 1), to: undefined, base: acc.baseSalary, probation: false },
        ]
      : [{ from: acc.joinDate < '2026-01-01' ? '2026-01-01' : acc.joinDate, to: undefined, base: acc.baseSalary, probation: false }];
    for (const [index, w] of salaryWindows.entries()) {
      await createWithClock(m('SalaryProfile'), vn(addDays(w.from, -3), '10:00'), {
        organizationId: orgId, employeeProfileId: profile._id, effectiveFrom: new Date(`${w.from}T00:00:00.000Z`),
        effectiveTo: w.to ? new Date(`${w.to}T00:00:00.000Z`) : undefined, baseSalary: w.base,
        insuranceSalary: Math.max(0, w.base - totalAllowances),
        ...(w.probation ? { probationJobSalary: acc.baseSalary, probationAgreedSalary: w.base, probationRate: w.base / acc.baseSalary } : {}),
        organizationAllowanceIds: assigned.map(a => a.id), allowances: assigned.map(a => ({ allowanceId: a.id, amount: a.amount })),
        attendanceBonusPolicyId: bonusPolicy._id, currency: 'VND', roundingRule: 'ROUND_HALF_UP_TO_VND', version: index + 1, active: true,
      });
      await createWithClock(m('InsuranceProfile'), vn(addDays(w.from, -3), '10:05'), {
        organizationId: orgId, employeeId: profile._id, effectiveFrom: new Date(`${w.from}T00:00:00.000Z`),
        effectiveTo: w.to ? new Date(`${w.to}T00:00:00.000Z`) : undefined,
        participatesSocialInsurance: !w.probation, participatesHealthInsurance: !w.probation, participatesUnemploymentInsurance: !w.probation,
        note: w.probation ? 'Hợp đồng thử việc — chưa thuộc diện đóng BHXH bắt buộc' : undefined, version: index + 1, createdBy: ctx.users.get('HR-001'),
      });
    }
  }
  for (const [dept, code] of Object.entries(MANAGER_OF)) {
    await createWithClock(m('ManagerAssignment'), vn('2023-05-02', '09:00'), {
      organizationId: orgId, managerUserId: ctx.users.get(code), departmentId: ctx.depts.get(dept),
      effectiveFrom: new Date('2023-05-02T00:00:00.000Z'), active: true, createdBy: ctx.users.get('HR-001'),
    });
  }

  // Chính sách KPI công ty (một bậc chung, áp cho mọi phòng ban) — HR khai qua
  // CompensationService, đúng endpoint màn hình Lương → Chính sách KPI.
  const kpiPolicyAt = vn('2025-12-26', '10:20');
  await at(kpiPolicyAt, 'Khai báo chính sách KPI', async () => {
    const row: any = await demo.compensation.createKpiPolicy(ctx.org, {
      name: 'Chính sách KPI An Phát 2026', policyType: 'GRADE', baseAmount: KPI_BASE_AMOUNT,
      tiers: kpiPolicyTiers(),
      effectiveFrom: '2026-01-01', scope: 'ALL',
    });
    ctx.ids.set('kpi-policy', String(row._id));
  });

  // Bảo hiểm doanh nghiệp (tự nguyện, công ty chịu phí) — HR khai qua service thật.
  await at(vn('2025-12-26', '10:30'), 'Khai báo bảo hiểm doanh nghiệp', () =>
    demo.enterpriseInsurance.create(ctx.org, String(ctx.users.get('HR-001')), {
      effectiveFrom: '2026-01-01', provider: 'Bảo Việt',
      coverageDescription: 'Bảo hiểm tai nạn con người 24/24 + chăm sóc sức khỏe cơ bản cho toàn bộ nhân viên chính thức',
      premiumPerEmployee: null, costBearer: EnterpriseInsuranceCostBearer.EMPLOYER,
      note: 'Dữ liệu demo — nhà cung cấp/mức phí là minh họa, HR thay bằng hợp đồng thật khi cần.',
    }));

  // Lịch nghỉ lễ do HR khai báo qua CalendarService (tự làm mới OT/phiên bản kỳ).
  for (const h of HOLIDAYS) {
    await at(vn('2026-08-20', '09:30'), `Khai báo ngày lễ ${h.date}`, () =>
      ctx.demo.calendar.create(ctx.org, String(ctx.users.get('HR-001')), { date: h.date, type: CalendarExceptionType.PUBLIC_HOLIDAY, name: h.name }));
  }
}

async function createPeriod(ctx: Ctx, period: string, createdAt: Date) {
  const [y, mth] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, mth, 0)).toISOString().slice(0, 10);
  // Chèn trực tiếp: create() chặn khi kỳ trước còn mở (lỗ hổng đã biết) trong khi
  // V2 bắt buộc có kỳ bao phủ ngày chấm công đầu tháng.
  const row = await createWithClock(ctx.demo.model('TimesheetPeriod'), createdAt, {
    organizationId: ctx.orgId, period, status: TimesheetPeriodStatus.OPEN, version: 1, active: true,
    startDate: new Date(`${period}-01T00:00:00.000Z`), endDate: new Date(`${last}T00:00:00.000Z`),
  });
  ctx.periods.set(period, row._id);
}

async function seedKpi(ctx: Ctx, period: string) {
  const [y, mth] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, mth, 0)).toISOString().slice(0, 10);
  for (const acc of EMPLOYEE_ACCOUNTS) {
    const score = KPI_SCORES[period]?.[acc.code];
    if (score === undefined) continue;
    const kpi = kpiFor(score);
    await createWithClock(ctx.demo.model('KpiPayrollInput'), vn(last, '17:30'), {
      organizationId: ctx.orgId, employeeProfileId: ctx.profiles.get(acc.code), departmentId: ctx.depts.get(acc.dept),
      policyId: ctx.ids.get('kpi-policy'), period,
      ...kpi, source: 'MANUAL', note: `Đánh giá KPI tháng ${period.slice(5)}/${period.slice(0, 4)}`, status: 'CONFIRMED', version: 1,
      evaluatedBy: ctx.users.get(MANAGER_OF[acc.dept]), evaluatedAt: vn(last, '15:00'),
      confirmedBy: ctx.users.get('HR-001'), confirmedAt: vn(last, '17:30'),
    });
  }
}

/** Một ngày chấm công, đúng hình dạng mà AttendanceService.checkIn/checkOut ghi. */
async function insertPunchesForDate(ctx: Ctx, date: string) {
  const m = ctx.demo.model;
  const periodId = ctx.periods.get(periodOf(date));
  if (!periodId) return 0;
  const overrides = await m('EmployeeDayOverride').find({ organizationId: ctx.orgId, date }).lean();
  const days: any[] = [];
  const events: any[] = [];
  const evidences: any[] = [];
  const requests: any[] = [];
  const isToday = REFERENCE_IS_TODAY && date === REFERENCE_DATE;
  const shift = ctx.shift;
  const workplaceSnapshot = {
    workplaceId: String(ctx.workplace._id), workplaceName: ctx.workplace.name, workplaceType: ctx.workplace.type,
    address: ctx.workplace.address, latitude: ctx.workplace.latitude, longitude: ctx.workplace.longitude,
    allowedRadiusMeters: ctx.workplace.allowedRadiusMeters,
  };

  for (const acc of EMPLOYEE_ACCOUNTS) {
    const plan = dayPlan(acc, date);
    if (!plan?.in) continue;
    if (isToday && acc.code === LIVE_CHECKIN_CODE) continue;
    const inAt = vn(date, plan.in.time);
    if (inAt.getTime() > REAL_NOW) continue;
    const outAt = plan.out && vn(date, plan.out.time).getTime() <= REAL_NOW ? vn(date, plan.out.time) : null;
    const userId = ctx.users.get(acc.code)!;
    const mine = overrides.filter((o: any) => String(o.employeeId) === String(userId));
    const required = mine.length
      ? mine.map((o: any) => o.requiredWorkingIntervals ?? []).reduce((a: any[], b: any[]) => intersect(a, b))
      : undefined;
    const shiftSnapshot: any = {
      shiftTemplateId: String(shift._id), shiftName: shift.name, startTime: shift.startTime, endTime: shift.endTime,
      breakMinutes: shift.breakMinutes, gracePeriodMinutes: shift.gracePeriodMinutes,
      breakStartTime: shift.breakStartTime, breakEndTime: shift.breakEndTime,
      requiredWorkingIntervals: required ?? requiredWorkingIntervalsForShift(shift),
      ...(mine.length ? { approvedLeaveIntervals: mine.flatMap((o: any) => o.approvedLeaveIntervals ?? []) } : {}),
    };
    const dayId = new Types.ObjectId();
    const punch = (spec: PunchSpec, recordedAt: Date, eventType: 'CHECK_IN' | 'CHECK_OUT') => {
      const method = spec.method ?? 'WIFI';
      const eventId = new Types.ObjectId();
      const seed = `${acc.code}|${date}|${eventType}`;
      const selfie = method === 'SELFIE';
      const source = selfie ? AttendanceEndpointSource.LEGACY_UNKNOWN : AttendanceEndpointSource.OBSERVED;
      const event: any = {
        _id: eventId, provenance: { source, eventId }, organizationId: ctx.orgId, attendanceDayId: dayId, employeeId: userId, eventType,
        method: selfie ? AttendanceMethod.SELFIE : method === 'WIFI' ? AttendanceMethod.NETWORK : AttendanceMethod.GPS,
        recordedAt, capturedAtClient: new Date(recordedAt.getTime() - Math.floor(800 + hash01(`${seed}|lag`) * 2600)),
        approvalStatus: selfie ? AttendanceApprovalStatus.PENDING : AttendanceApprovalStatus.NOT_REQUIRED,
        validationStatus: 'VALID', userAgent: DEVICES[acc.code], isFallback: selfie && plan.workMode === 'IN_OFFICE',
        createdAt: recordedAt, updatedAt: recordedAt, __v: 0,
      };
      if (method === 'WIFI') {
        const ap = OFFICE.wifi[Math.floor(hash01(`${seed}|ap`) * Math.min(2, OFFICE.wifi.length))];
        Object.assign(event, { wifiSsid: ap.ssid, wifiBssid: ap.bssid, publicIp: OFFICE.publicIp, address: OFFICE.address });
      } else {
        const site = spec.site ? SITES[spec.site] : null;
        const bearing = hash01(`${seed}|bearing`) * 2 * Math.PI;
        const meters = site ? 8 + hash01(`${seed}|m`) * 25 : 18 + hash01(`${seed}|m`) * 95;
        const base = site ?? { latitude: OFFICE.latitude, longitude: OFFICE.longitude };
        const latitude = Number((base.latitude + (meters * Math.cos(bearing)) / 111_320).toFixed(6));
        const longitude = Number((base.longitude + (meters * Math.sin(bearing)) / (111_320 * Math.cos((base.latitude * Math.PI) / 180))).toFixed(6));
        Object.assign(event, {
          latitude, longitude, accuracyMeters: Math.round(6 + hash01(`${seed}|acc`) * 20),
          distanceFromWorkplaceMeters: haversineMeters({ latitude, longitude }, OFFICE),
          address: site?.address ?? OFFICE.address, publicIp: `27.72.${Math.floor(40 + hash01(`${seed}|ip1`) * 200)}.${Math.floor(2 + hash01(`${seed}|ip2`) * 250)}`,
          note: spec.note,
        });
      }
      if (selfie) {
        const evidenceId = new Types.ObjectId();
        evidences.push({
          _id: evidenceId, organizationId: ctx.orgId, ownerUserId: userId, storageKey: `${ctx.org}/evidence/${evidenceId}.jpg`,
          originalFileName: eventType === 'CHECK_IN' ? 'selfie.jpg' : 'checkout-selfie.jpg', mimeType: 'image/jpeg',
          sizeBytes: Math.round(150_000 + hash01(`${seed}|size`) * 120_000), createdAt: recordedAt, updatedAt: recordedAt, __v: 0,
        });
        event.evidenceId = evidenceId;
        const isFallback = plan.workMode === 'IN_OFFICE';
        requests.push({
          organizationId: ctx.orgId, departmentId: ctx.depts.get(acc.dept), employeeId: ctx.profiles.get(acc.code), employeeUserId: userId,
          type: 'ATTENDANCE', workDate: new Date(`${date}T00:00:00.000Z`), status: 'PENDING', version: 1, attendanceDayId: dayId, evidenceId,
          reason: spec.note && spec.note.length >= 10 ? spec.note
            : eventType === 'CHECK_IN'
              ? (isFallback ? 'Chấm công Selfie bổ sung tại văn phòng' : 'Chấm công Selfie ngoài văn phòng (Thực địa)')
              : (isFallback ? 'Chấm công Selfie bổ sung khi ra ca tại văn phòng' : 'Chấm công Selfie ngoài văn phòng khi ra ca (Thực địa)'),
          metadata: { latitude: event.latitude, longitude: event.longitude, accuracyMeters: event.accuracyMeters, address: event.address, isFallback, actionType: eventType },
          createdAt: recordedAt, updatedAt: recordedAt, __v: 0,
        });
      }
      events.push(event);
      return { eventId, source, selfie };
    };

    const checkIn = punch(plan.in, inAt, 'CHECK_IN');
    const calcIn = calculateAttendance(date, inAt, undefined, shiftSnapshot);
    // Ngày lễ/nghỉ tuần đi làm vẫn có bản ghi chấm công, nhưng bản chất ngày là
    // ngày nghỉ — đúng thứ tự ưu tiên lịch mà DayClassificationService dùng.
    const dayType = HOLIDAY_DATES.has(date) ? WorkdayType.PUBLIC_HOLIDAY : isWeekend(date) ? WorkdayType.WEEKLY_OFF : WorkdayType.WORKING_DAY;
    const day: any = {
      _id: dayId, organizationId: ctx.orgId, employeeId: userId, workDate: date, periodId,
      workMode: plan.workMode === 'OUT_OFFICE' ? WorkMode.OUT_OFFICE : WorkMode.IN_OFFICE,
      workdayType: dayType, attendanceStatus: AttendanceStatus.CHECKED_IN,
      overallApprovalStatus: checkIn.selfie ? AttendanceApprovalStatus.PENDING : AttendanceApprovalStatus.NOT_REQUIRED,
      checkInAt: inAt, checkInProvenance: { source: checkIn.source, eventId: checkIn.eventId },
      lateMinutes: calcIn.lateMinutes, earlyMinutes: 0, approvedLeaveMinutes: calcIn.approvedLeaveMinutes,
      requiredWorkingMinutes: calcIn.requiredWorkingMinutes, effectiveCheckInTime: calcIn.effectiveCheckInTime ?? undefined,
      effectiveCheckOutTime: calcIn.effectiveCheckOutTime ?? undefined, shiftSnapshot, workplaceSnapshot,
      createdAt: inAt, updatedAt: inAt, __v: 0,
    };
    if (outAt) {
      const checkOut = punch(plan.out!, outAt, 'CHECK_OUT');
      const calcOut = calculateAttendance(date, inAt, outAt, shiftSnapshot);
      Object.assign(day, {
        checkOutAt: outAt, checkOutProvenance: { source: checkOut.source, eventId: checkOut.eventId },
        workingMinutes: calcOut.workingMinutes ?? 0, earlyMinutes: calcOut.earlyMinutes, approvedLeaveMinutes: calcOut.approvedLeaveMinutes,
        requiredWorkingMinutes: calcOut.requiredWorkingMinutes, attendanceStatus: AttendanceStatus.COMPLETED, updatedAt: outAt,
        ...(checkOut.selfie ? { overallApprovalStatus: AttendanceApprovalStatus.PENDING } : {}),
      });
    }
    days.push(day);
  }

  if (!days.length) return 0;
  await m('AttendanceDay').collection.insertMany(days);
  await m('AttendanceEvent').collection.insertMany(events);
  if (evidences.length) await m('Evidence').collection.insertMany(evidences);
  if (requests.length) await m('ManagerRequest').collection.insertMany(requests);
  // Mỗi lần bấm giờ (V2) claim kỳ công: tăng version và đưa kỳ về REVIEWING.
  await m('TimesheetPeriod').updateOne(
    { _id: periodId, status: { $ne: TimesheetPeriodStatus.CLOSED } },
    { $inc: { version: events.length }, $set: { status: TimesheetPeriodStatus.REVIEWING, managerSnapshotClosed: false, departmentSnapshots: [] } },
  );
  return events.length;
}

function intersect(left: Array<{ from: string; to: string }>, right: Array<{ from: string; to: string }>) {
  return left.flatMap(a => right.map(b => ({ from: a.from > b.from ? a.from : b.from, to: a.to < b.to ? a.to : b.to }))).filter(i => i.from < i.to);
}

interface Action { when: Date; label: string; run: () => Promise<unknown> }

function buildTimeline(ctx: Ctx): Action[] {
  const actions: Action[] = [];
  const hr = () => String(ctx.users.get('HR-001'));
  const user = (code: string) => String(ctx.users.get(code));
  const managerOf = (code: EmployeeCode) => user(MANAGER_OF[EMPLOYEE_ACCOUNTS.find(a => a.code === code)!.dept]);
  const push = (when: Date, label: string, run: () => Promise<unknown>) => { if (when.getTime() <= REAL_NOW) actions.push({ when, label, run }); };

  push(vn('2026-08-31', '16:00'), `Tạo kỳ công ${HISTORY_PERIOD}`, () => createPeriod(ctx, HISTORY_PERIOD, vn('2026-08-31', '16:00')));
  push(vn('2026-09-30', '16:00'), `Tạo kỳ công ${ACTIVE_PERIOD}`, () => createPeriod(ctx, ACTIVE_PERIOD, vn('2026-09-30', '16:00')));
  push(vn('2026-10-31', '16:00'), `Tạo kỳ công ${CURRENT_PERIOD}`, () => createPeriod(ctx, CURRENT_PERIOD, vn('2026-10-31', '16:00')));
  push(vn('2026-09-30', '17:30'), `KPI ${HISTORY_PERIOD}`, () => seedKpi(ctx, HISTORY_PERIOD));
  push(vn('2026-10-31', '17:30'), `KPI ${ACTIVE_PERIOD}`, () => seedKpi(ctx, ACTIVE_PERIOD));

  for (const date of enumerateDates(`${HISTORY_PERIOD}-01`, REFERENCE_DATE)) {
    push(vn(date, '05:00'), `Chấm công ${date}`, () => insertPunchesForDate(ctx, date));
  }

  for (const spec of LEAVES) {
    const key = `leave|${spec.code}|${spec.startDate}`;
    push(vn(...spec.submitAt), `${spec.code} gửi đơn nghỉ ${spec.startDate}`, async () => {
      const row: any = await ctx.demo.leave.create(ctx.org, user(spec.code), {
        startDate: spec.startDate, endDate: spec.endDate, leaveType: spec.leaveType, durationType: spec.durationType, reason: spec.reason,
      });
      ctx.ids.set(key, String(row._id));
    });
    if (spec.approveAt) push(vn(...spec.approveAt), `QL duyệt đơn nghỉ ${spec.code} ${spec.startDate}`, () =>
      ctx.demo.leave.managerDecision(ctx.org, managerOf(spec.code), ctx.ids.get(key)!, true, spec.approveComment));
    if (spec.applyAt) push(vn(...spec.applyAt), `HR áp dụng đơn nghỉ ${spec.code} ${spec.startDate}`, () =>
      ctx.demo.leave.apply(ctx.org, hr(), ctx.ids.get(key)!));
  }
  for (const spec of CURRENT_MONTH_LEAVES) {
    const key = `leave|${spec.code}|${spec.startDate}`;
    push(vn('2026-10-30', spec.approved ? '10:20' : '20:10'), `${spec.code} gửi đơn nghỉ ${spec.startDate}`, async () => {
      const row: any = await ctx.demo.leave.create(ctx.org, user(spec.code), {
        startDate: spec.startDate, endDate: spec.endDate, leaveType: spec.leaveType, durationType: spec.durationType, reason: spec.reason,
      });
      ctx.ids.set(key, String(row._id));
    });
    if (spec.approved) {
      push(vn('2026-10-30', '14:15'), `QL duyệt đơn nghỉ ${spec.code} ${spec.startDate}`, () =>
        ctx.demo.leave.managerDecision(ctx.org, managerOf(spec.code), ctx.ids.get(key)!, true, spec.approveComment));
      push(vn('2026-11-02', '08:40'), `HR áp dụng đơn nghỉ ${spec.code} ${spec.startDate}`, () =>
        ctx.demo.leave.apply(ctx.org, hr(), ctx.ids.get(key)!));
    }
  }

  for (const spec of OVERTIMES) {
    spec.windows.forEach(([from, to], index) => {
      const key = `ot|${spec.code}|${spec.date}|${index}`;
      const fileAt = new Date(vn(...spec.fileAt).getTime() + index * 90_000);
      push(fileAt, `${spec.code} khai OT ${spec.date} ${from}-${to}`, async () => {
        const row: any = await ctx.demo.requests.createMine(ctx.org, user(spec.code), {
          type: 'OVERTIME', workDate: spec.date, reason: spec.reason, workDescription: spec.workDescription,
          requestedStart: `${spec.date}T${from}:00+07:00`, requestedEnd: `${spec.date}T${to}:00+07:00`,
        } as any);
        ctx.ids.set(key, String(row._id));
      });
      if (spec.approveAt) {
        push(new Date(vn(...spec.approveAt).getTime() + index * 45_000), `QL duyệt OT ${spec.code} ${spec.date} ${from}-${to}`, () =>
          ctx.demo.requests.decide(ctx.org, managerOf(spec.code), ctx.ids.get(key)!, 'APPROVED', 1, spec.approveComment));
      }
    });
  }

  for (const spec of CONFIRMATIONS) {
    const key = `confirm|${spec.code}|${spec.date}`;
    push(vn(...spec.fileAt), `${spec.code} gửi giải trình ${spec.date}`, async () => {
      const preview: any = await ctx.demo.requests.attendanceConfirmationPreview(ctx.org, user(spec.code), spec.date);
      if (!preview.canSubmit) throw new Error(`không thể gửi giải trình: ${preview.blockedReasons.join(', ')}`);
      const row: any = await ctx.demo.requests.createMine(ctx.org, user(spec.code), {
        requestKind: 'ATTENDANCE_CONFIRMATION', type: 'ATTENDANCE', workDate: spec.date, reason: spec.reason, previewHash: preview.contextHash,
      } as any, `demo-confirm-${spec.code}-${spec.date}`);
      ctx.ids.set(key, String(row._id));
    });
    if (spec.approveAt) push(vn(...spec.approveAt), `QL duyệt giải trình ${spec.code} ${spec.date}`, () =>
      ctx.demo.requests.decide(ctx.org, managerOf(spec.code), ctx.ids.get(key)!, 'APPROVED', 1, 'Đã xác minh, đồng ý bổ sung công', undefined, undefined, `demo-approve-${spec.code}-${spec.date}`));
  }

  for (const spec of SELFIE_APPROVALS) {
    push(vn(...spec.at), `QL duyệt selfie ${spec.code} ${spec.date}`, async () => {
      const rows: any[] = await ctx.demo.model('ManagerRequest').find({
        organizationId: ctx.orgId, employeeUserId: ctx.users.get(spec.code), type: 'ATTENDANCE', status: 'PENDING',
        evidenceId: { $exists: true }, workDate: new Date(`${spec.date}T00:00:00.000Z`),
      }).sort({ createdAt: 1 }).lean();
      for (const row of rows) {
        await ctx.demo.requests.decide(ctx.org, managerOf(spec.code), String(row._id), 'APPROVED', row.version, spec.comment ?? 'Đã kiểm tra ảnh và vị trí, xác nhận có mặt');
      }
    });
  }

  for (const spec of FORFEITS) {
    push(vn(...spec.at), `QL xử lý vắng không phép ${spec.code} ${spec.date}`, async () => {
      const day: any = await ctx.demo.model('AttendanceDay').findOne({ organizationId: ctx.orgId, employeeId: ctx.users.get(spec.code), workDate: spec.date }).lean();
      return ctx.demo.periods.resolveMissingPunchAsAbsent(ctx.org, String(day.periodId), String(day._id),
        { userId: managerOf(spec.code), role: Role.DEPARTMENT_MANAGER }, spec.reason);
    });
  }

  // ── Đóng kỳ 09: nhân viên xác nhận → QL xác nhận phòng → HR chốt → lương ──
  const historyId = () => String(ctx.periods.get(HISTORY_PERIOD));
  push(vn('2026-10-01', '08:20'), `HR mở rà soát kỳ ${HISTORY_PERIOD}`, async () => {
    const period: any = await ctx.demo.model('TimesheetPeriod').findById(historyId()).lean();
    if (period.status === TimesheetPeriodStatus.OPEN) await ctx.demo.periods.updateStatus(ctx.org, historyId(), TimesheetPeriodStatus.REVIEWING, hr());
  });
  EMPLOYEE_ACCOUNTS.forEach((acc, index) => {
    const when = new Date(vn('2026-10-01', '08:45').getTime() + index * 47 * 60_000);
    push(when, `${acc.code} xác nhận bảng công ${HISTORY_PERIOD}`, async () => {
      const review = await ctx.demo.reviews.getOwnReview(ctx.org, historyId(), user(acc.code));
      if (review.hasUnresolvedDays) throw new Error('bảng công còn ngày chưa xử lý');
      return ctx.demo.reviews.acknowledge(ctx.org, historyId(), user(acc.code), { expectedPeriodVersion: review.periodVersion, projectionHash: review.projectionHash });
    });
  });
  for (const [dept, when] of [['KD', vn('2026-10-02', '15:10')], ['KT', vn('2026-10-02', '16:25')]] as const) {
    push(when, `QL ${dept} xác nhận công phòng ${HISTORY_PERIOD}`, async () => {
      const period: any = await ctx.demo.model('TimesheetPeriod').findById(historyId()).lean();
      return ctx.demo.periods.confirmDepartment(ctx.org, historyId(), user(MANAGER_OF[dept]), { departmentId: String(ctx.depts.get(dept)), expectedPeriodVersion: period.version });
    });
  }
  push(vn('2026-10-03', '09:30'), `HR chốt kỳ ${HISTORY_PERIOD}`, () => ctx.demo.periods.hrClosePeriod(ctx.org, historyId(), hr()));
  push(vn('2026-10-05', '10:00'), `HR tạo & tính bảng lương ${HISTORY_PERIOD}`, async () => {
    const run: any = await ctx.demo.payrollRuns.create({ organizationId: ctx.org, timesheetPeriodId: historyId(), notes: 'Bảng lương tháng 09/2026', userId: hr() });
    ctx.ids.set('run|history', String(run._id));
    await ctx.demo.payrollRuns.calculate(String(run._id), hr());
  });
  push(vn('2026-10-06', '14:30'), `HR khóa bảng lương ${HISTORY_PERIOD}`, () => ctx.demo.payrollRuns.lock(ctx.ids.get('run|history')!, hr()));
  push(vn('2026-10-09', '16:00'), `HR phát hành phiếu lương ${HISTORY_PERIOD}`, () => ctx.demo.payslips.releaseForPayrollRun(ctx.ids.get('run|history')!, hr()));

  return actions.sort((a, b) => a.when.getTime() - b.when.getTime());
}

async function finalizeStatuses(ctx: Ctx) {
  const periods = ctx.demo.model('TimesheetPeriod');
  const active = ACTIVE_STATUS === 'OPEN' ? TimesheetPeriodStatus.OPEN : TimesheetPeriodStatus.REVIEWING;
  await periods.updateOne({ _id: ctx.periods.get(ACTIVE_PERIOD), status: { $in: ['OPEN', 'REVIEWING'] } }, { $set: { status: active } });
  // Kỳ hiện tại chỉ dùng để nhận chấm công; chưa đưa vào rà soát.
  await periods.updateOne({ _id: ctx.periods.get(CURRENT_PERIOD), status: { $in: ['OPEN', 'REVIEWING'] } }, { $set: { status: TimesheetPeriodStatus.OPEN } });
}

async function seed() {
  const demo = await createDemoApp();
  try {
    const existing: any = await demo.model('Organization').findOne({ code: ORG_CODE }).lean();
    if (existing && !RESET) {
      console.log(`[seed:demo] Tenant ${ORG_CODE} đã tồn tại. Dùng "npm run seed:demo:reset" để seed lại từ đầu.`);
      return;
    }
    if (existing) await resetOrg(demo, existing._id);

    const orgId = new Types.ObjectId();
    connection = demo.connection;
    const ctx: Ctx = {
      demo, orgId, org: String(orgId), users: new Map(), profiles: new Map(), depts: new Map(),
      shift: null, workplace: null, periods: new Map(), ids: new Map(), log: [],
    };
    const started = Date.now();
    console.log(`[seed:demo] Dựng dữ liệu nền cho ${ORG_CODE}...`);
    await seedMasterData(ctx);

    const timeline = buildTimeline(ctx);
    console.log(`[seed:demo] Mô phỏng ${timeline.length} thao tác từ ${HISTORY_PERIOD}-01 tới ${REFERENCE_DATE}...`);
    let lastMonth = '';
    for (const action of timeline) {
      const month = new Date(action.when.getTime() + 7 * 3600_000).toISOString().slice(0, 7);
      if (month !== lastMonth) { console.log(`  · ${month}`); lastMonth = month; }
      await at(action.when, action.label, action.run);
    }
    resetVirtualClock();
    await finalizeStatuses(ctx);

    const importDir = path.resolve(__dirname, '..', 'demo-import');
    await generateDemoImportFiles(importDir);

    console.log(`[seed:demo] Hoàn tất sau ${Math.round((Date.now() - started) / 1000)} giây.`);
    if (REHEARSAL) {
      console.log(`\n[seed:demo] Chế độ diễn tập: chạy trọn luồng kỳ ${ACTIVE_PERIOD}...`);
      await runDemoFlow(demo, { orgCode: ORG_CODE, step: 'all', keep: [], skipAck: [] });
    }
    await printDemoStatus(demo, ORG_CODE);
    printAccounts();
  } finally {
    resetVirtualClock();
    await demo.close();
  }
}

function printAccounts() {
  console.log(`\nTÀI KHOẢN DEMO (mật khẩu chung: ${DEMO_PASSWORD})`);
  for (const acc of ACCOUNTS) {
    console.log(`  ${acc.email.padEnd(34)} ${acc.code.padEnd(10)} ${acc.role.padEnd(18)} ${acc.fullName}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify: đối chiếu dữ liệu đã seed với chính logic của hệ thống
// ─────────────────────────────────────────────────────────────────────────────
async function verify() {
  const demo = await createDemoApp();
  try {
    const org: any = await demo.model('Organization').findOne({ code: ORG_CODE }).lean();
    if (!org) { console.log(`Tenant ${ORG_CODE} chưa tồn tại.`); process.exitCode = 1; return; }
    const orgId = org._id;
    const problems: string[] = [];
    if (org.attendanceOvertimeV2Enabled !== true) problems.push('Organization chưa bật attendanceOvertimeV2Enabled');

    // Chính sách công ty: KPI (scope ALL) + bảo hiểm doanh nghiệp phải có bản ghi hiệu lực
    // tại ngày tham chiếu, và mọi KpiPayrollInput đã xác nhận phải trỏ đúng policy.
    const kpiPolicies: any[] = await demo.model('KpiPolicy').find({ organizationId: orgId, active: true }).lean();
    const kpiPolicy = kpiPolicies.find(p => p.scope === 'ALL' && p.effectiveFrom <= new Date(`${REFERENCE_DATE}T23:59:59Z`));
    if (!kpiPolicy) problems.push('Thiếu KpiPolicy hiệu lực (scope ALL)');
    else {
      const inputs: any[] = await demo.model('KpiPayrollInput').find({ organizationId: orgId, status: 'CONFIRMED' }).lean();
      for (const input of inputs) {
        if (String(input.policyId ?? '') !== String(kpiPolicy._id)) problems.push(`KpiPayrollInput ${input.period}/${input.employeeProfileId} không trỏ tới KpiPolicy`);
        else if (input.amount !== Math.round((input.baseAmount ?? 0) * (input.tierPercentage ?? 0) / 100)) problems.push(`KpiPayrollInput ${input.period}/${input.employeeProfileId} lệch bậc: ${input.amount}`);
      }
    }
    const enterprisePolicies: any[] = await demo.model('EnterpriseInsurancePolicy').find({ organizationId: orgId }).lean();
    if (!enterprisePolicies.length) problems.push('Thiếu EnterpriseInsurancePolicy');

    const days: any[] = await demo.model('AttendanceDay').find({ organizationId: orgId }).lean();
    let recomputed = 0;
    for (const day of days) {
      if (!day.checkInAt || !day.checkOutAt || !day.shiftSnapshot?.startTime) continue;
      if (day.checkOutProvenance?.source === 'CONFIRMED_SCHEDULE' || day.checkInProvenance?.source === 'CONFIRMED_SCHEDULE') continue;
      const calc = calculateAttendance(day.workDate, new Date(day.checkInAt), new Date(day.checkOutAt), day.shiftSnapshot);
      recomputed++;
      if (calc.lateMinutes !== day.lateMinutes || calc.earlyMinutes !== day.earlyMinutes || calc.workingMinutes !== day.workingMinutes) {
        problems.push(`Ngày công ${day.workDate} (${day.employeeId}) lệch calculator: lưu ${day.lateMinutes}/${day.earlyMinutes}/${day.workingMinutes}, tính ${calc.lateMinutes}/${calc.earlyMinutes}/${calc.workingMinutes}`);
      }
      if (new Date(day.checkInAt).toISOString().slice(0, 10) !== day.workDate && new Date(new Date(day.checkInAt).getTime() + 7 * 3600_000).toISOString().slice(0, 10) !== day.workDate) {
        problems.push(`Ngày công ${day.workDate} có giờ vào thuộc ngày khác theo giờ VN`);
      }
    }
    const requests: any[] = await demo.model('ManagerRequest').find({ organizationId: orgId }).lean();
    for (const r of requests) {
      if (new Date(r.workDate).toISOString().slice(11) !== '00:00:00.000Z') problems.push(`ManagerRequest ${r._id} có workDate không ở 00:00Z (lệch múi giờ)`);
    }
    const results: any[] = await demo.model('OvertimeResult').find({ organizationId: orgId }).lean();
    for (const r of requests.filter(x => x.type === 'OVERTIME' && x.status === 'APPROVED')) {
      const result = results.find(x => String(x.overtimeRequestId) === String(r._id));
      if (!result) problems.push(`OT ${r._id} đã duyệt nhưng chưa có OvertimeResult`);
      else if (result.workDate !== new Date(r.workDate).toISOString().slice(0, 10)) problems.push(`OT ${r._id} lệch ngày: yêu cầu ${new Date(r.workDate).toISOString().slice(0, 10)}, kết quả ${result.workDate}`);
      else if (result.eligibleMinutes <= 0) problems.push(`OT ${r._id} (${result.workDate}) có 0 phút hợp lệ: ${result.calculationNote}`);
    }

    const history: any = await demo.model('TimesheetPeriod').findOne({ organizationId: orgId, period: HISTORY_PERIOD }).lean();
    if (history?.status !== 'CLOSED') problems.push(`Kỳ ${HISTORY_PERIOD} chưa CLOSED`);
    else {
      const summaries: any[] = await demo.model('TimesheetSummary').find({ periodId: history._id, sourcePeriodVersion: history.version }).lean();
      const payslips: any[] = await demo.model('Payslip').find({ organizationId: orgId }).lean();
      const run: any = await demo.model('PayrollRun').findOne({ organizationId: orgId, timesheetPeriodId: history._id }).lean();
      if (summaries.length !== EMPLOYEE_ACCOUNTS.length) problems.push(`Kỳ ${HISTORY_PERIOD} có ${summaries.length}/${EMPLOYEE_ACCOUNTS.length} TimesheetSummary`);
      if (run?.status !== 'RELEASED') problems.push(`Bảng lương ${HISTORY_PERIOD} ở trạng thái ${run?.status ?? 'không có'}`);
      for (const s of summaries) {
        const ot = results.filter(r => String(r.employeeId) === String(s.userId) && r.periodKey === HISTORY_PERIOD && r.classificationStatus === 'FINAL');
        const expected = ot.reduce((sum, r) => sum + r.eligibleMinutes, 0);
        if (expected !== s.totalOvertimeMinutes) problems.push(`Summary ${s.employeeCode}: OT ${s.totalOvertimeMinutes} phút ≠ OT FINAL ${expected} phút`);
        const slip = payslips.find(p => String(p.employeeProfileId) === String(s.employeeProfileId) && String(p.payrollRunId) === String(run?._id));
        if (!slip) problems.push(`Thiếu phiếu lương ${HISTORY_PERIOD} của ${s.employeeCode}`);
        else if (expected > 0 && !(slip.otBreakdown?.otPay > 0)) problems.push(`Phiếu lương ${s.employeeCode} có OT ${expected} phút nhưng tiền OT = 0`);
      }
    }
    const enterprise = enterprisePolicies[0];
    console.log(`\n─── VERIFY [${ORG_CODE}] ───`);
    console.log(`Đã tính lại ${recomputed} ngày công bằng calculator, ${requests.length} yêu cầu, ${results.length} kết quả OT.`);
    if (kpiPolicy) console.log(`KpiPolicy: ${kpiPolicy.name} (scope ${kpiPolicy.scope}) — mức cơ sở ${fmtMoney(kpiPolicy.baseAmount)} đ, ${kpiPolicy.tiers.length} bậc, hiệu lực ${new Date(kpiPolicy.effectiveFrom).toISOString().slice(0, 10)}`);
    if (enterprise) console.log(`EnterpriseInsurancePolicy: ${enterprise.provider} — chịu phí ${enterprise.costBearer}, hiệu lực ${new Date(enterprise.effectiveFrom).toISOString().slice(0, 10)}`);
    await printDemoStatus(demo, ORG_CODE);
    if (problems.length) {
      console.log(`\n✗ ${problems.length} điểm không nhất quán:`);
      for (const p of problems.slice(0, 60)) console.log(`  - ${p}`);
      process.exitCode = 1;
    } else {
      console.log('\n✓ Dữ liệu nhất quán giữa chấm công, OT, bảng công và bảng lương.');
    }
  } finally {
    await demo.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File mẫu import nhân viên
// ─────────────────────────────────────────────────────────────────────────────
async function generateDemoImportFiles(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  const header = [
    'Mã nhân viên', 'Họ và tên', 'Email', 'Vai trò', 'Số điện thoại', 'Ngày vào làm', 'Ngày sinh', 'Giới tính', 'Số CCCD', 'Mã số thuế',
    'Số BHXH', 'Số tài khoản ngân hàng', 'Địa chỉ', 'Phòng ban', 'Chức danh', 'Quản lý trực tiếp', 'Lương cơ bản', 'Lương hiệu lực từ ngày',
    'Chính sách thưởng chuyên cần', 'Bảo hiểm hiệu lực từ ngày', 'Loại hợp đồng', 'Ngày hiệu lực hợp đồng',
  ];
  const valid = new ExcelJS.Workbook();
  const sheet = valid.addWorksheet('NhanVien');
  sheet.addRow(header);
  sheet.addRow(['NV-KD-004', 'Nguyễn Thị Kim Oanh', 'oanh.nguyen@anphat.local', 'Nhân viên', '0901234567', '01/12/2026', '15/05/1996', 'Nữ', '079196000001', '8000000001',
    '7900000001', '1900123456789', 'Quận 7, TP.HCM', 'KD', 'NV-KD', 'QL-KD-001', 18000000, '01/12/2026', 'ATTENDANCE_FULL', '01/12/2026', 'Có thời hạn', '01/12/2026']);
  sheet.addRow(['NV-KT-004', 'Trần Đình Trọng', 'trong.tran@anphat.local', 'Nhân viên', '0901234568', '01/12/2026', '20/08/1998', 'Nam', '079198000002', '8000000002',
    '7900000002', '1900123456780', 'Thủ Đức, TP.HCM', 'KT', 'NV-KT', 'QL-KT-001', 22000000, '01/12/2026', 'ATTENDANCE_FULL', '01/12/2026', 'Thử việc', '01/12/2026']);
  const deps = valid.addWorksheet('NguoiPhuThuoc');
  deps.addRow(['Mã nhân viên', 'Họ và tên người phụ thuộc', 'Ngày sinh', 'Mối quan hệ với nhân viên', 'Số CCCD']);
  deps.addRow(['NV-KD-004', 'Nguyễn Văn Bé', '01/10/2020', 'CON', '079220000001']);
  await valid.xlsx.writeFile(path.join(dirPath, '01_nhan_vien_hop_le.xlsx'));

  const missing = new ExcelJS.Workbook();
  missing.addWorksheet('NhanVien').addRows([['Mã nhân viên', 'Họ và tên', 'Email', 'Ngày vào làm'], ['NV-TEST-001', 'Thiếu Phòng Ban', 'test1@anphat.local', '01/12/2026']]);
  missing.addWorksheet('NguoiPhuThuoc');
  await missing.xlsx.writeFile(path.join(dirPath, '02_loi_thieu_cot_bat_buoc.xlsx'));

  const duplicate = new ExcelJS.Workbook();
  duplicate.addWorksheet('NhanVien').addRows([
    ['Mã nhân viên', 'Họ và tên', 'Email', 'Vai trò', 'Số điện thoại', 'Ngày vào làm', 'Phòng ban', 'Chức danh'],
    ['NV-KD-001', 'Trùng Mã Nam', 'trung.nam@anphat.local', 'Nhân viên', '0901234999', '01/12/2026', 'KD', 'NV-KD'],
  ]);
  duplicate.addWorksheet('NguoiPhuThuoc');
  await duplicate.xlsx.writeFile(path.join(dirPath, '03_loi_trung_ma_nhan_vien.xlsx'));

  const badEmail = new ExcelJS.Workbook();
  badEmail.addWorksheet('NhanVien').addRows([
    ['Mã nhân viên', 'Họ và tên', 'Email', 'Vai trò', 'Số điện thoại', 'Ngày vào làm', 'Phòng ban', 'Chức danh'],
    ['NV-KD-099', 'Sai Email', 'email-khong-co-domain', 'Nhân viên', '0901234998', '01/12/2026', 'KD', 'NV-KD'],
  ]);
  badEmail.addWorksheet('NguoiPhuThuoc');
  await badEmail.xlsx.writeFile(path.join(dirPath, '04_loi_email_khong_hop_le.xlsx'));
}

async function main() {
  if (VERIFY_ONLY) return verify();
  if (!APPLY) return printPlan();
  return seed();
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((error) => {
  console.error('[seed:demo] Thất bại:', error?.message ?? error);
  if (process.env.DEBUG_SEED) console.error(error);
  process.exit(1);
});
