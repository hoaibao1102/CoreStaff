/**
 * Deterministic Demo Data Seeding & Reset Script for CoreStaff
 *
 * Usage:
 *   npm run seed:demo:dry        # Dry-run: plan only
 *   npm run seed:demo            # Apply incremental / idempotent
 *   npm run seed:demo:reset      # Reset tenant and re-seed clean baseline
 *   npm run seed:demo:rehearsal  # Reset and finalize active period (rehearsal mode)
 *   npm run verify:demo          # Verify existing demo tenant
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import * as ExcelJS from 'exceljs';

import { hashPassword } from '../src/auth/strategies/bcrypt.strategy';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import {
  AttendanceApprovalStatus,
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  ContractStatus,
  ContractType,
  DayResult,
  EmploymentStatus,
  Gender,
  InsuranceContributionType,
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveType,
  Role,
  ShiftScope,
  WorkdayType,
  WorkMode,
} from '../src/database/schemas/enums';
import { TimesheetPeriodStatus } from '../src/database/schemas/timesheet-period.schema';

import { TimesheetSummaryService } from '../src/hr/timesheet/timesheet-summary.service';
import { PayrollSnapshotService } from '../src/hr/timesheet/payroll-snapshot.service';
import { InsuranceService } from '../src/hr/payroll/insurance.service';
import { PitService } from '../src/hr/payroll/pit.service';
import { PayslipService } from '../src/hr/payroll/payslip.service';
import { PayrollRunService } from '../src/hr/payroll/payroll-run.service';
import { canonicalPayloadHash } from '../src/hr/payroll/payroll-artifact-foundation';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');
const RESET = ARGS.includes('--reset');
const CLOSE_ACTIVE = ARGS.includes('--close-active');
const VERIFY_ONLY = ARGS.includes('--verify-only');

const orgArg = ARGS.find(a => a.startsWith('--org-code='));
const ORG_CODE = orgArg ? orgArg.split('=')[1].toUpperCase() : 'ANPHAT';
const ORG_NAME = 'Công ty Cổ phần Công nghệ An Phát';

const refDateArg = ARGS.find(a => a.startsWith('--reference-date='));
const REFERENCE_DATE = refDateArg ? new Date(refDateArg.split('=')[1]) : new Date('2026-10-29');

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? 'Demo123456!';

// 3 periods calculation
function formatYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${m < 10 ? '0' : ''}${m}`;
}

const currentMonthDate = new Date(Date.UTC(REFERENCE_DATE.getUTCFullYear(), REFERENCE_DATE.getUTCMonth(), 1));
const activeMonthDate = new Date(Date.UTC(REFERENCE_DATE.getUTCFullYear(), REFERENCE_DATE.getUTCMonth() - 1, 1));
const historyMonthDate = new Date(Date.UTC(REFERENCE_DATE.getUTCFullYear(), REFERENCE_DATE.getUTCMonth() - 2, 1));

const CURRENT_PERIOD = formatYearMonth(currentMonthDate);
const ACTIVE_PERIOD = formatYearMonth(activeMonthDate);
const HISTORY_PERIOD = formatYearMonth(historyMonthDate);

interface SummaryCount {
  planned: number;
  created: number;
  skipped: number;
  removed: number;
}
const summary = new Map<string, SummaryCount>();
function mark(kind: string, result: 'planned' | 'created' | 'skipped' | 'removed', n = 1) {
  const row = summary.get(kind) ?? { planned: 0, created: 0, skipped: 0, removed: 0 };
  row[result] += n;
  summary.set(kind, row);
}

const PROGRESSIVE_BRACKETS = [
  { upperLimit: 10_000_000, rate: 5 },
  { upperLimit: 30_000_000, rate: 10 },
  { upperLimit: 60_000_000, rate: 20 },
  { upperLimit: 100_000_000, rate: 30 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 35 },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function vnDate(dateStr: string, timeStr = '00:00:00'): Date {
  return new Date(`${dateStr}T${timeStr}+07:00`);
}

function deterministicHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 4294967296;
}

interface NaturalPunch {
  inTimeStr: string;
  outTimeStr: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  workingMinutes: number;
  method: AttendanceMethod;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  distanceFromWorkplaceMeters?: number;
  address?: string;
  wifiBssid?: string;
  wifiSsid?: string;
}

function getNaturalPunch(employeeCode: string, dateStr: string, isToday = false): NaturalPunch {
  const seed = `${employeeCode}-${dateStr}`;
  const hIn = deterministicHash(`${seed}-in`);
  const hOut = deterministicHash(`${seed}-out`);
  const hMethod = deterministicHash(`${seed}-method`);

  // Phân bố phương thức: 60% Wi-Fi, 25% GPS, 15% Selfie
  let method: AttendanceMethod = AttendanceMethod.NETWORK;
  if (hMethod < 0.25) {
    method = AttendanceMethod.GPS;
  } else if (hMethod < 0.40) {
    method = AttendanceMethod.SELFIE;
  }

  // Giờ check-in thông thường: 07:42:00 -> 08:08:59 (dao động 26 phút quanh 07:55)
  const inTotalSeconds = Math.floor(7 * 3600 + 42 * 60 + hIn * (26 * 60));
  const inHours = Math.floor(inTotalSeconds / 3600);
  const inMins = Math.floor((inTotalSeconds % 3600) / 60);
  const inSecs = inTotalSeconds % 60;
  const inTimeStr = `${String(inHours).padStart(2, '0')}:${String(inMins).padStart(2, '0')}:${String(inSecs).padStart(2, '0')}`;

  // Giờ check-out thông thường: 17:02:00 -> 17:35:59 (dao động 33 phút sau 17:00)
  const outTotalSeconds = Math.floor(17 * 3600 + 2 * 60 + hOut * (33 * 60));
  const outHours = Math.floor(outTotalSeconds / 3600);
  const outMins = Math.floor((outTotalSeconds % 3600) / 60);
  const outSecs = outTotalSeconds % 60;
  const outTimeStr = isToday ? null : `${String(outHours).padStart(2, '0')}:${String(outMins).padStart(2, '0')}:${String(outSecs).padStart(2, '0')}`;

  const latDelta = (deterministicHash(`${seed}-lat`) - 0.5) * 0.0004;
  const lngDelta = (deterministicHash(`${seed}-lng`) - 0.5) * 0.0004;
  const latitude = Number((10.7769 + latDelta).toFixed(6));
  const longitude = Number((106.7009 + lngDelta).toFixed(6));
  const accuracyMeters = Math.floor(12 + deterministicHash(`${seed}-acc`) * 16);
  const distanceFromWorkplaceMeters = Math.floor(15 + deterministicHash(`${seed}-dist`) * 60);

  return {
    inTimeStr,
    outTimeStr,
    lateMinutes: 0,
    earlyMinutes: 0,
    workingMinutes: isToday ? 240 : 480,
    method,
    latitude,
    longitude,
    accuracyMeters,
    distanceFromWorkplaceMeters,
    address: 'Tầng 5, Tòa nhà An Phát, Quận 1, TP. Hồ Chí Minh',
    wifiBssid: method === AttendanceMethod.NETWORK ? '00:11:22:33:44:55' : undefined,
    wifiSsid: method === AttendanceMethod.NETWORK ? 'AnPhat_Office' : undefined,
  };
}

function getPeriodDates(periodKey: string): { start: Date; end: Date; allDates: string[]; workdays: string[]; weekends: string[] } {
  const [yearStr, monthStr] = periodKey.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const allDates: string[] = [];
  const workdays: string[] = [];
  const weekends: string[] = [];

  const curr = new Date(start);
  while (curr <= end) {
    const s = isoDate(curr);
    allDates.push(s);
    const day = curr.getUTCDay();
    if (day === 0 || day === 6) {
      weekends.push(s);
    } else {
      workdays.push(s);
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return { start, end, allDates, workdays, weekends };
}

async function upsertDoc(
  model: mongoose.Model<any>,
  query: Record<string, unknown>,
  doc: Record<string, unknown>,
  kind: string,
): Promise<mongoose.Types.ObjectId> {
  const existing = await model.findOne(query).lean();
  if (existing) {
    mark(kind, 'skipped');
    return (existing as any)._id as mongoose.Types.ObjectId;
  }
  if (!APPLY) {
    mark(kind, 'planned');
    return new mongoose.Types.ObjectId();
  }
  const created = await model.create(doc);
  mark(kind, 'created');
  return (created as any)._id as mongoose.Types.ObjectId;
}

// ─────────────────────────────────────────────────────────────
// Demo Accounts Definition
// ─────────────────────────────────────────────────────────────
interface DemoAccountDef {
  email: string;
  fullName: string;
  employeeCode: string;
  role: Role;
  deptCode?: 'KD' | 'KT';
  posCode?: string;
  directManagerCode?: string;
  baseSalary: number;
  phone: string;
  gender: Gender;
  contractType: ContractType;
}

const DEMO_ACCOUNTS: DemoAccountDef[] = [
  {
    email: 'hr@anphat.local',
    fullName: 'Lê Thị Mai HR',
    employeeCode: 'HR-001',
    role: Role.HR,
    baseSalary: 28_000_000,
    phone: '0901000000',
    gender: Gender.FEMALE,
    contractType: ContractType.INDEFINITE_TERM,
  },
  {
    email: 'quan.ly.kinh-doanh@anphat.local',
    fullName: 'Trần Văn Quản Lý KD',
    employeeCode: 'QL-KD-001',
    role: Role.DEPARTMENT_MANAGER,
    deptCode: 'KD',
    posCode: 'TP-KD',
    baseSalary: 32_000_000,
    phone: '0901000001',
    gender: Gender.MALE,
    contractType: ContractType.INDEFINITE_TERM,
  },
  {
    email: 'quan.ly.ky.thuat@anphat.local',
    fullName: 'Nguyễn Văn Quản Lý KT',
    employeeCode: 'QL-KT-001',
    role: Role.DEPARTMENT_MANAGER,
    deptCode: 'KT',
    posCode: 'TP-KT',
    baseSalary: 35_000_000,
    phone: '0901000002',
    gender: Gender.MALE,
    contractType: ContractType.INDEFINITE_TERM,
  },
  {
    email: 'nv.kinh-doanh.1@anphat.local',
    fullName: 'Phạm Hoàng Nam',
    employeeCode: 'NV-KD-001',
    role: Role.EMPLOYEE,
    deptCode: 'KD',
    posCode: 'NV-KD',
    directManagerCode: 'QL-KD-001',
    baseSalary: 18_000_000,
    phone: '0901000011',
    gender: Gender.MALE,
    contractType: ContractType.FIXED_TERM,
  },
  {
    email: 'nv.kinh-doanh.2@anphat.local',
    fullName: 'Vũ Thị Mai',
    employeeCode: 'NV-KD-002',
    role: Role.EMPLOYEE,
    deptCode: 'KD',
    posCode: 'NV-KD',
    directManagerCode: 'QL-KD-001',
    baseSalary: 16_000_000,
    phone: '0901000012',
    gender: Gender.FEMALE,
    contractType: ContractType.FIXED_TERM,
  },
  {
    email: 'nv.kinh-doanh.3@anphat.local',
    fullName: 'Đặng Văn Khoa',
    employeeCode: 'NV-KD-003',
    role: Role.EMPLOYEE,
    deptCode: 'KD',
    posCode: 'NV-KD',
    directManagerCode: 'QL-KD-001',
    baseSalary: 17_000_000,
    phone: '0901000013',
    gender: Gender.MALE,
    contractType: ContractType.PROBATION,
  },
  {
    email: 'nv.ky.thuat.1@anphat.local',
    fullName: 'Lê Quốc Bảo',
    employeeCode: 'NV-KT-001',
    role: Role.EMPLOYEE,
    deptCode: 'KT',
    posCode: 'NV-KT',
    directManagerCode: 'QL-KT-001',
    baseSalary: 24_000_000,
    phone: '0901000021',
    gender: Gender.MALE,
    contractType: ContractType.INDEFINITE_TERM,
  },
  {
    email: 'nv.ky.thuat.2@anphat.local',
    fullName: 'Hoàng Minh Tuấn',
    employeeCode: 'NV-KT-002',
    role: Role.EMPLOYEE,
    deptCode: 'KT',
    posCode: 'NV-KT',
    directManagerCode: 'QL-KT-001',
    baseSalary: 22_000_000,
    phone: '0901000022',
    gender: Gender.MALE,
    contractType: ContractType.FIXED_TERM,
  },
  {
    email: 'nv.ky.thuat.3@anphat.local',
    fullName: 'Bùi Phương Thảo',
    employeeCode: 'NV-KT-003',
    role: Role.EMPLOYEE,
    deptCode: 'KT',
    posCode: 'NV-KT',
    directManagerCode: 'QL-KT-001',
    baseSalary: 20_000_000,
    phone: '0901000023',
    gender: Gender.FEMALE,
    contractType: ContractType.PROBATION,
  },
];

async function generateDemoImportFiles(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // 1. File hợp lệ (Valid import)
  const validWb = new ExcelJS.Workbook();
  const empSheet1 = validWb.addWorksheet('NhanVien');
  empSheet1.addRow([
    'Mã nhân viên', 'Họ và tên', 'Email', 'Vai trò', 'Số điện thoại',
    'Ngày vào làm', 'Ngày sinh', 'Giới tính', 'Số CCCD', 'Mã số thuế',
    'Số BHXH', 'Số tài khoản ngân hàng', 'Địa chỉ', 'Phòng ban', 'Chức danh',
    'Quản lý trực tiếp', 'Lương cơ bản', 'Lương hiệu lực từ ngày',
    'Chính sách thưởng chuyên cần', 'Bảo hiểm hiệu lực từ ngày', 'Loại hợp đồng', 'Ngày hiệu lực hợp đồng',
  ]);
  empSheet1.addRow([
    'NV-KD-004', 'Nguyễn Thị Kim Oanh', 'oanh.nguyen@anphat.local', 'Nhân viên', '0901234567',
    '10/01/2026', '15/05/1996', 'Nữ', '079196000001', '8000000001',
    '7900000001', '1900123456789', 'Quận 7, TP.HCM', 'KD', 'NV-KD',
    'QL-KD-001', 18000000, '10/01/2026',
    'ATTENDANCE_FULL', '10/01/2026', 'Có thời hạn', '10/01/2026',
  ]);
  empSheet1.addRow([
    'NV-KT-004', 'Trần Đình Trọng', 'trong.tran@anphat.local', 'Nhân viên', '0901234568',
    '10/01/2026', '20/08/1998', 'Nam', '079198000002', '8000000002',
    '7900000002', '1900123456780', 'Thủ Đức, TP.HCM', 'KT', 'NV-KT',
    'QL-KT-001', 22000000, '10/01/2026',
    'ATTENDANCE_FULL', '10/01/2026', 'Thử việc', '10/01/2026',
  ]);

  const depSheet1 = validWb.addWorksheet('NguoiPhuThuoc');
  depSheet1.addRow(['Mã nhân viên', 'Họ và tên người phụ thuộc', 'Ngày sinh', 'Mối quan hệ với nhân viên', 'Số CCCD']);
  depSheet1.addRow(['NV-KD-004', 'Nguyễn Văn Bé', '01/10/2020', 'CON', '079220000001']);
  await validWb.xlsx.writeFile(path.join(dirPath, '01_nhan_vien_hop_le.xlsx'));

  // 2. File lỗi thiếu cột bắt buộc
  const invalidWb1 = new ExcelJS.Workbook();
  const empSheet2 = invalidWb1.addWorksheet('NhanVien');
  empSheet2.addRow(['Mã nhân viên', 'Họ và tên', 'Email', 'Ngày vào làm']);
  empSheet2.addRow(['NV-TEST-001', 'Thiếu Phòng Ban', 'test1@anphat.local', '10/01/2026']);
  invalidWb1.addWorksheet('NguoiPhuThuoc');
  await invalidWb1.xlsx.writeFile(path.join(dirPath, '02_loi_thieu_cot_bat_buoc.xlsx'));

  // 3. File lỗi trùng mã nhân viên
  const invalidWb2 = new ExcelJS.Workbook();
  const empSheet3 = invalidWb2.addWorksheet('NhanVien');
  empSheet3.addRow([
    'Mã nhân viên', 'Họ và tên', 'Email', 'Vai trò', 'Số điện thoại',
    'Ngày vào làm', 'Phòng ban', 'Chức danh',
  ]);
  empSheet3.addRow([
    'NV-KD-001', 'Trùng Mã Nam', 'trung.nam@anphat.local', 'Nhân viên', '0901234999',
    '10/01/2026', 'KD', 'NV-KD',
  ]);
  invalidWb2.addWorksheet('NguoiPhuThuoc');
  await invalidWb2.xlsx.writeFile(path.join(dirPath, '03_loi_trung_ma_nhan_vien.xlsx'));

  // 4. File lỗi email sai định dạng
  const invalidWb3 = new ExcelJS.Workbook();
  const empSheet4 = invalidWb3.addWorksheet('NhanVien');
  empSheet4.addRow([
    'Mã nhân viên', 'Họ và tên', 'Email', 'Vai trò', 'Số điện thoại',
    'Ngày vào làm', 'Phòng ban', 'Chức danh',
  ]);
  empSheet4.addRow([
    'NV-KD-099', 'Sai Email', 'email-khong-co-domain', 'Nhân viên', '0901234998',
    '10/01/2026', 'KD', 'NV-KD',
  ]);
  invalidWb3.addWorksheet('NguoiPhuThuoc');
  await invalidWb3.xlsx.writeFile(path.join(dirPath, '04_loi_email_khong_hop_le.xlsx'));
}

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) {
    console.error('[seed:demo] MONGODB_URI is not configured in .env');
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
  const ManagerRequest = db.model('ManagerRequest');
  const LeaveRequest = db.model('LeaveRequest');
  const EmployeeDayOverride = db.model('EmployeeDayOverride');
  const DepartmentTimesheetConfirmation = db.model('DepartmentTimesheetConfirmation');
  const TimesheetSummary = db.model('TimesheetSummary');
  const PayrollInputSnapshot = db.model('PayrollInputSnapshot');
  const PayrollRun = db.model('PayrollRun');
  const Payslip = db.model('Payslip');

  try {
    // ── Check if existing demo org exists ────────────────────────────────────
    const existingOrg: any = await Organization.findOne({ code: ORG_CODE }).lean();

    if (VERIFY_ONLY) {
      console.log(`\n─── VERIFY DEMO TENANT [${ORG_CODE}] ───`);
      if (!existingOrg) {
        console.log(`Demo organization [${ORG_CODE}] does not exist.`);
        return;
      }
      const orgId = existingOrg._id;
      const [
        depts, positions, users, emps, contracts, assignments,
        periods, summaries, snapshots, runs, payslips,
      ] = await Promise.all([
        Department.countDocuments({ organizationId: orgId }),
        Position.countDocuments({ organizationId: orgId }),
        User.countDocuments({ organizationId: orgId }),
        EmployeeProfile.countDocuments({ organizationId: orgId }),
        EmploymentContract.countDocuments({ organizationId: orgId }),
        Assignment.countDocuments({ organizationId: orgId }),
        TimesheetPeriod.countDocuments({ organizationId: orgId }),
        TimesheetSummary.countDocuments({ organizationId: orgId }),
        PayrollInputSnapshot.countDocuments({ organizationId: orgId }),
        PayrollRun.countDocuments({ organizationId: orgId }),
        Payslip.countDocuments({ organizationId: orgId }),
      ]);
      console.log(`Organization: ${existingOrg.name} (${existingOrg.code}) - ID: ${orgId}`);
      console.log(`Departments : ${depts}`);
      console.log(`Positions   : ${positions}`);
      console.log(`Users       : ${users}`);
      console.log(`Profiles    : ${emps}`);
      console.log(`Contracts   : ${contracts}`);
      console.log(`Assignments : ${assignments}`);
      console.log(`Periods     : ${periods}`);
      console.log(`Summaries   : ${summaries}`);
      console.log(`Snapshots   : ${snapshots}`);
      console.log(`Payroll Runs: ${runs}`);
      console.log(`Payslips    : ${payslips}`);
      console.log(`\nDemo tenant is ready and verified.`);
      return;
    }

    // ── Reset demo organization ──────────────────────────────────────────────
    if (RESET && APPLY && existingOrg) {
      const orgId = existingOrg._id;
      console.log(`[seed:demo] Resetting existing demo organization [${ORG_CODE}] (${orgId})...`);
      await Promise.all([
        TimesheetPeriod.deleteMany({ organizationId: orgId }),
        DepartmentTimesheetConfirmation.deleteMany({ organizationId: orgId }),
        AttendanceDay.deleteMany({ organizationId: orgId }),
        AttendanceEvent.deleteMany({ organizationId: orgId }),
        OvertimeResult.deleteMany({ organizationId: orgId }),
        ManagerRequest.deleteMany({ organizationId: orgId }),
        LeaveRequest.deleteMany({ organizationId: orgId }),
        EmployeeDayOverride.deleteMany({ organizationId: orgId }),
        TimesheetSummary.deleteMany({ organizationId: orgId }),
        PayrollInputSnapshot.deleteMany({ organizationId: orgId }),
        PayrollRun.deleteMany({ organizationId: orgId }),
        Payslip.deleteMany({ organizationId: orgId }),
        KpiPayrollInput.deleteMany({ organizationId: orgId }),
        SalaryProfile.deleteMany({ organizationId: orgId }),
        InsuranceProfile.deleteMany({ organizationId: orgId }),
        Assignment.deleteMany({ organizationId: orgId }),
        ManagerAssignment.deleteMany({ organizationId: orgId }),
        EmploymentContract.deleteMany({ organizationId: orgId }),
        EmployeeProfile.deleteMany({ organizationId: orgId }),
        User.deleteMany({ organizationId: orgId }),
        Department.deleteMany({ organizationId: orgId }),
        Position.deleteMany({ organizationId: orgId }),
        Workplace.deleteMany({ organizationId: orgId }),
        ShiftTemplate.deleteMany({ organizationId: orgId }),
        LaborPolicy.deleteMany({ organizationId: orgId }),
        OvertimePolicy.deleteMany({ organizationId: orgId }),
        TaxPolicy.deleteMany({ organizationId: orgId }),
        InsurancePolicy.deleteMany({ organizationId: orgId }),
        AttendanceBonusPolicy.deleteMany({ organizationId: orgId }),
        OrganizationAllowance.deleteMany({ organizationId: orgId }),
        Organization.deleteOne({ _id: orgId }),
      ]);
      console.log(`[seed:demo] Cleared all data for [${ORG_CODE}].`);
    }

    // ── 1. Create Organization ───────────────────────────────────────
    const orgId = await upsertDoc(
      Organization,
      { code: ORG_CODE },
      {
        code: ORG_CODE,
        name: ORG_NAME,
        timezone: 'Asia/Ho_Chi_Minh',
        status: 'ACTIVE',
        evidenceRetentionDays: 90,
        payrollSeparationOfDuties: false,
      },
      'Organization',
    );

    // ── 2. Create Departments ────────────────────────────────────────────────
    const deptMap = new Map<string, mongoose.Types.ObjectId>();
    const DEPT_DEFS = [
      { code: 'KD', name: 'Phòng Kinh doanh' },
      { code: 'KT', name: 'Phòng Kỹ thuật' },
    ];
    for (const d of DEPT_DEFS) {
      const dId = await upsertDoc(
        Department,
        { organizationId: orgId, code: d.code },
        { organizationId: orgId, code: d.code, name: d.name, active: true },
        'Department',
      );
      deptMap.set(d.code, dId);
    }

    // ── 3. Create Positions ──────────────────────────────────────────────────
    const posMap = new Map<string, mongoose.Types.ObjectId>();
    const POS_DEFS = [
      { code: 'TP-KD', name: 'Trưởng phòng Kinh doanh', deptCode: 'KD' },
      { code: 'NV-KD', name: 'Chuyên viên Kinh doanh', deptCode: 'KD' },
      { code: 'TP-KT', name: 'Trưởng phòng Kỹ thuật', deptCode: 'KT' },
      { code: 'NV-KT', name: 'Kỹ sư Phần mềm', deptCode: 'KT' },
    ];
    for (const p of POS_DEFS) {
      const pId = await upsertDoc(
        Position,
        { organizationId: orgId, code: p.code },
        {
          organizationId: orgId,
          departmentId: deptMap.get(p.deptCode)!,
          code: p.code,
          name: p.name,
          active: true,
        },
        'Position',
      );
      posMap.set(p.code, pId);
    }

    // ── 4. Create Workplace ──────────────────────────────────────────────────
    const workplaceId = await upsertDoc(
      Workplace,
      { organizationId: orgId, code: 'HQ' },
      {
        organizationId: orgId,
        code: 'HQ',
        name: 'Trụ sở chính An Phát',
        address: 'Tầng 5, Tòa nhà An Phát, Quận 1, TP. Hồ Chí Minh',
        latitude: 10.7769,
        longitude: 106.7009,
        allowedRadiusMeters: 300,
        maximumAccuracyMeters: 50,
        allowedWifiNetworks: [{ ssid: 'AnPhat_Office', bssid: '00:11:22:33:44:55' }],
        active: true,
      },
      'Workplace',
    );

    // ── 5. Create ShiftTemplate ──────────────────────────────────────────────
    const shiftTemplateId = await upsertDoc(
      ShiftTemplate,
      { organizationId: orgId, code: 'HC-0800' },
      {
        organizationId: orgId,
        code: 'HC-0800',
        name: 'Ca hành chính (08:00 - 17:00)',
        startTime: '08:00',
        endTime: '17:00',
        breakStartTime: '12:00',
        breakEndTime: '13:00',
        breakMinutes: 60,
        gracePeriodMinutes: 15,
        workingHours: 8,
        active: true,
        scope: ShiftScope.ORGANIZATION,
      },
      'ShiftTemplate',
    );

    // ── 6. Policies ──────────────────────────────────────────────────────────
    await upsertDoc(
      LaborPolicy,
      { organizationId: orgId, active: true },
      {
        organizationId: orgId,
        normalDailyMinutes: 480,
        normalWeeklyMinutes: 2880,
        maxCombinedDailyMinutes: 720,
        maxMonthlyOvertimeMinutes: 2400,
        maxAnnualOvertimeMinutes: 12000,
        exceptionalAnnualOvertimeMinutes: 18000,
        warningThresholdPercent: 85,
        probationMinimumRate: 0.85,
        legalReference: 'BLLĐ 45/2019/QH14',
        effectiveFrom: new Date(Date.UTC(2025, 0, 1)),
        version: 1,
        active: true,
      },
      'LaborPolicy',
    );

    await upsertDoc(
      OvertimePolicy,
      { organizationId: orgId, active: true },
      {
        organizationId: orgId,
        workingDayRate: 1.5,
        weeklyOffRate: 2.0,
        publicHolidayRate: 3.0,
        legalReference: 'BLLĐ 45/2019/QH14',
        effectiveFrom: new Date(Date.UTC(2025, 0, 1)),
        version: 1,
        active: true,
      },
      'OvertimePolicy',
    );

    await upsertDoc(
      TaxPolicy,
      { organizationId: orgId, active: true },
      {
        organizationId: orgId,
        effectiveFrom: new Date(Date.UTC(2025, 0, 1)),
        standardDeduction: 11_000_000,
        personalDeduction: 11_000_000,
        dependentDeduction: 4_400_000,
        progressiveBrackets: PROGRESSIVE_BRACKETS,
        roundingRule: 'ROUND_HALF_UP_TO_VND',
        overtimeTaxable: false,
        active: true,
        version: 1,
      },
      'TaxPolicy',
    );

    await upsertDoc(
      InsurancePolicy,
      { organizationId: orgId, active: true },
      {
        organizationId: orgId,
        effectiveFrom: new Date(Date.UTC(2025, 0, 1)),
        legalReference: 'Quyết định 595/QĐ-BHXH',
        socialInsuranceEmployeeRate: 0.08,
        healthInsuranceEmployeeRate: 0.015,
        unemploymentInsuranceEmployeeRate: 0.01,
        capRules: [
          { type: InsuranceContributionType.SOCIAL_INSURANCE, capAmount: 52_200_000 },
          { type: InsuranceContributionType.HEALTH_INSURANCE, capAmount: 52_200_000 },
          { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, capAmount: 52_200_000 },
        ],
        salaryBaseRules: [
          { type: InsuranceContributionType.SOCIAL_INSURANCE, floorAmount: 0 },
          { type: InsuranceContributionType.HEALTH_INSURANCE, floorAmount: 0 },
          { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, floorAmount: 0 },
        ],
        employerContributionRates: [
          { type: InsuranceContributionType.SOCIAL_INSURANCE, rate: 0.175 },
          { type: InsuranceContributionType.HEALTH_INSURANCE, rate: 0.03 },
          { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, rate: 0.01 },
        ],
        active: true,
        version: 1,
      },
      'InsurancePolicy',
    );

    const attendanceBonusPolicyId = await upsertDoc(
      AttendanceBonusPolicy,
      { organizationId: orgId, name: 'Chuyên cần tháng' },
      {
        organizationId: orgId,
        name: 'Chuyên cần tháng',
        calculationBase: 'FIXED_AMOUNT',
        bonusAmount: 1_000_000,
        tiers: [
          { order: 1, percentage: 100, conditions: [{ metric: 'LATE_COUNT', operator: 'EQ', value: 0 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
        ],
        effectiveFrom: new Date('2025-01-01'),
        version: 1,
        active: true,
      },
      'AttendanceBonusPolicy',
    );

    // Organization Allowances
    const allowanceCatalogMeal = await upsertDoc(
      AllowanceCatalog,
      { code: 'MEAL' },
      { code: 'MEAL', defaultName: 'Phụ cấp ăn trưa', isDefaultTaxable: false, isDefaultInsuranceBased: false, active: true },
      'AllowanceCatalog',
    );
    const orgAllowanceMealId = await upsertDoc(
      OrganizationAllowance,
      { organizationId: orgId, code: 'MEAL' },
      {
        organizationId: orgId,
        catalogId: allowanceCatalogMeal,
        code: 'MEAL',
        name: 'Phụ cấp ăn trưa',
        amount: 730_000,
        taxable: false,
        insuranceBased: false,
        prorated: true,
        effectiveFrom: new Date('2025-01-01'),
        version: 1,
        active: true,
      },
      'OrganizationAllowance',
    );

    const allowanceCatalogResp = await upsertDoc(
      AllowanceCatalog,
      { code: 'RESP' },
      { code: 'RESP', defaultName: 'Phụ cấp trách nhiệm', isDefaultTaxable: true, isDefaultInsuranceBased: true, active: true },
      'AllowanceCatalog',
    );
    const orgAllowanceRespId = await upsertDoc(
      OrganizationAllowance,
      { organizationId: orgId, code: 'RESP' },
      {
        organizationId: orgId,
        catalogId: allowanceCatalogResp,
        code: 'RESP',
        name: 'Phụ cấp trách nhiệm',
        amount: 2_000_000,
        taxable: true,
        insuranceBased: true,
        prorated: true,
        effectiveFrom: new Date('2025-01-01'),
        version: 1,
        active: true,
      },
      'OrganizationAllowance',
    );

    // ── 7. Users & Profiles ──────────────────────────────────────────────────
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    const userIdMap = new Map<string, mongoose.Types.ObjectId>();
    const profileIdMap = new Map<string, mongoose.Types.ObjectId>();

    // Seed HR first
    for (const acc of DEMO_ACCOUNTS) {
      const uId = await upsertDoc(
        User,
        { organizationId: orgId, email: acc.email },
        {
          organizationId: orgId,
          email: acc.email,
          fullName: acc.fullName,
          phone: acc.phone,
          passwordHash,
          role: acc.role,
          status: 'ACTIVE',
          mustChangePassword: false,
          failedLoginCount: 0,
        },
        'User',
      );
      userIdMap.set(acc.employeeCode, uId);

      // HR doesn't have an EmployeeProfile in CoreStaff
      if (acc.role === Role.HR) continue;

      const pId = await upsertDoc(
        EmployeeProfile,
        { organizationId: orgId, employeeCode: acc.employeeCode },
        {
          organizationId: orgId,
          userId: uId,
          employeeCode: acc.employeeCode,
          email: acc.email,
          fullName: acc.fullName,
          phone: acc.phone,
          joinDate: new Date('2025-01-02'),
          employmentStatus: EmploymentStatus.ACTIVE,
          departmentId: deptMap.get(acc.deptCode!),
          positionId: posMap.get(acc.posCode!),
          gender: acc.gender,
        },
        'EmployeeProfile',
      );
      profileIdMap.set(acc.employeeCode, pId);

      // Direct Manager link
      if (acc.directManagerCode) {
        const mgrPId = profileIdMap.get(acc.directManagerCode);
        if (mgrPId && APPLY) {
          await EmployeeProfile.updateOne({ _id: pId }, { directManagerId: mgrPId });
        }
      }

      // Contracts
      await upsertDoc(
        EmploymentContract,
        { organizationId: orgId, employeeProfileId: pId },
        {
          organizationId: orgId,
          employeeProfileId: pId,
          contractNumber: `HD-${acc.employeeCode}`,
          contractType: acc.contractType,
          status: ContractStatus.ACTIVE,
          effectiveDate: new Date('2025-01-02'),
          baseSalary: acc.baseSalary,
        },
        'EmploymentContract',
      );

      // Shift & Workplace Assignment
      await upsertDoc(
        Assignment,
        { organizationId: orgId, userId: uId, active: true },
        {
          organizationId: orgId,
          userId: uId,
          workplaceId,
          shiftTemplateId,
          departmentId: deptMap.get(acc.deptCode!),
          active: true,
          startDate: new Date('2025-01-02'),
        },
        'Assignment',
      );

      // Salary Profile
      const isManager = acc.role === Role.DEPARTMENT_MANAGER;
      const allowanceIds = isManager ? [orgAllowanceMealId, orgAllowanceRespId] : [orgAllowanceMealId];
      const personalAllowances = isManager
        ? [
            { allowanceId: orgAllowanceMealId, amount: 730_000 },
            { allowanceId: orgAllowanceRespId, amount: 2_000_000 },
          ]
        : [{ allowanceId: orgAllowanceMealId, amount: 730_000 }];
      const totalAllowances = isManager ? 2_730_000 : 730_000;

      await upsertDoc(
        SalaryProfile,
        { organizationId: orgId, employeeProfileId: pId },
        {
          organizationId: orgId,
          employeeProfileId: pId,
          baseSalary: acc.baseSalary,
          insuranceSalary: Math.max(0, acc.baseSalary - totalAllowances),
          effectiveFrom: new Date('2025-01-02'),
          organizationAllowanceIds: allowanceIds,
          allowances: personalAllowances,
          attendanceBonusPolicyId,
          currency: 'VND',
          roundingRule: 'ROUND_HALF_UP_TO_VND',
          version: 1,
          status: 'ACTIVE',
        },
        'SalaryProfile',
      );

      // Insurance Profile
      await upsertDoc(
        InsuranceProfile,
        { organizationId: orgId, employeeId: pId },
        {
          organizationId: orgId,
          employeeId: pId,
          participatesSocialInsurance: true,
          participatesHealthInsurance: true,
          participatesUnemploymentInsurance: true,
          effectiveFrom: new Date('2025-01-02'),
          version: 1,
          status: 'ACTIVE',
        },
        'InsuranceProfile',
      );
    }

    // Manager Assignments
    const mgrKD = DEMO_ACCOUNTS.find(a => a.employeeCode === 'QL-KD-001')!;
    const mgrKT = DEMO_ACCOUNTS.find(a => a.employeeCode === 'QL-KT-001')!;
    const hrUserId = userIdMap.get('HR-001')!;

    await upsertDoc(
      ManagerAssignment,
      { organizationId: orgId, managerUserId: userIdMap.get(mgrKD.employeeCode)! },
      {
        organizationId: orgId,
        managerUserId: userIdMap.get(mgrKD.employeeCode)!,
        departmentId: deptMap.get('KD')!,
        effectiveFrom: new Date('2025-01-02'),
        createdBy: hrUserId,
        active: true,
      },
      'ManagerAssignment',
    );

    await upsertDoc(
      ManagerAssignment,
      { organizationId: orgId, managerUserId: userIdMap.get(mgrKT.employeeCode)! },
      {
        organizationId: orgId,
        managerUserId: userIdMap.get(mgrKT.employeeCode)!,
        departmentId: deptMap.get('KT')!,
        effectiveFrom: new Date('2025-01-02'),
        createdBy: hrUserId,
        active: true,
      },
      'ManagerAssignment',
    );

    // KPI inputs for August & September
    const nonHrAccounts = DEMO_ACCOUNTS.filter(a => a.role !== Role.HR);
    for (const pKey of [HISTORY_PERIOD, ACTIVE_PERIOD]) {
      for (const acc of nonHrAccounts) {
        const pId = profileIdMap.get(acc.employeeCode)!;
        await upsertDoc(
          KpiPayrollInput,
          { organizationId: orgId, employeeProfileId: pId, period: pKey },
          {
            organizationId: orgId,
            employeeProfileId: pId,
            period: pKey,
            amount: 2_000_000,
            score: 95,
            tierName: 'Xuất sắc',
            tierPercentage: 100,
            baseAmount: 2_000_000,
            status: 'CONFIRMED',
            version: 1,
            confirmedAt: new Date('2026-09-01'),
            confirmedBy: userIdMap.get('HR-001')!,
          },
          'KpiPayrollInput',
        );
      }
    }

    // ── 8. Period 1: History Period (August) ─────────────────────────────────
    const historyInfo = getPeriodDates(HISTORY_PERIOD);
    const historyPeriodId = await upsertDoc(
      TimesheetPeriod,
      { organizationId: orgId, period: HISTORY_PERIOD },
      {
        organizationId: orgId,
        period: HISTORY_PERIOD,
        startDate: historyInfo.start,
        endDate: historyInfo.end,
        status: TimesheetPeriodStatus.CLOSED,
        version: 1,
        active: true,
        closedBy: userIdMap.get('HR-001'),
        closedAt: new Date(historyInfo.end),
        managerSnapshotClosed: true,
        managerSnapshotClosedBy: userIdMap.get('HR-001'),
        managerSnapshotClosedAt: new Date(historyInfo.end),
        departmentSnapshots: [
          { departmentId: deptMap.get('KD')!, managerUserId: userIdMap.get('QL-KD-001')!, closedAt: new Date(historyInfo.end) },
          { departmentId: deptMap.get('KT')!, managerUserId: userIdMap.get('QL-KT-001')!, closedAt: new Date(historyInfo.end) },
        ],
      },
      'TimesheetPeriod',
    );

    // Seed attendance for History Period (all clean, full attendance)
    for (const acc of nonHrAccounts) {
      const uId = userIdMap.get(acc.employeeCode)!;
      for (const dateStr of historyInfo.allDates) {
        const isWeekend = historyInfo.weekends.includes(dateStr);

        if (isWeekend) {
          continue;
        }

        const inTime = vnDate(dateStr, '07:55:00');
        const outTime = vnDate(dateStr, '17:05:00');
        const dayId = await upsertDoc(
            AttendanceDay,
            { organizationId: orgId, employeeId: uId, workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              periodId: historyPeriodId,
              workDate: dateStr,
              workMode: WorkMode.IN_OFFICE,
              workdayType: WorkdayType.WORKING_DAY,
              dayResult: DayResult.PRESENT,
              attendanceStatus: AttendanceStatus.COMPLETED,
              overallApprovalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              checkInAt: inTime,
              checkOutAt: outTime,
              workingMinutes: 480,
              lateMinutes: 0,
              earlyMinutes: 0,
              shiftSnapshot: { startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15 },
              employeeSnapshot: { employeeCode: acc.employeeCode, fullName: acc.fullName, departmentId: String(deptMap.get(acc.deptCode!)) },
            },
            'AttendanceDay',
          );

          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_IN },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: AttendanceEventType.CHECK_IN,
              recordedAt: inTime,
              method: AttendanceMethod.NETWORK,
              wifiBssid: '00:11:22:33:44:55',
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              isFallback: false,
            },
            'AttendanceEvent',
          );

          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_OUT },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: AttendanceEventType.CHECK_OUT,
              recordedAt: outTime,
              method: AttendanceMethod.NETWORK,
              wifiBssid: '00:11:22:33:44:55',
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              isFallback: false,
            },
            'AttendanceEvent',
          );
      }
    }

    // Confirm departments for History Period
    for (const [deptCode, dId] of deptMap.entries()) {
      await upsertDoc(
        DepartmentTimesheetConfirmation,
        { organizationId: orgId, periodId: historyPeriodId, departmentId: dId },
        {
          organizationId: orgId,
          periodId: historyPeriodId,
          departmentId: dId,
          managerId: userIdMap.get(deptCode === 'KD' ? 'QL-KD-001' : 'QL-KT-001')!,
          periodVersion: 1,
          confirmedAt: new Date(historyInfo.end),
          summarySnapshot: {
            employeeCount: 4,
            scheduledWorkDays: historyInfo.workdays.length,
            actualWorkingDays: historyInfo.workdays.length,
            workingMinutes: historyInfo.workdays.length * 480,
            lateMinutes: 0,
            earlyMinutes: 0,
            paidLeaveDays: 0,
            unpaidLeaveDays: 0,
            incompleteDays: 0,
            overtimeMinutes: { workingDay: 0, weeklyOff: 0, publicHoliday: 0, total: 0 },
            blockerCount: 0,
          },
        },
        'DepartmentTimesheetConfirmation',
      );
    }

    // Run payroll for History Period if APPLY
    if (APPLY) {
      const insuranceService = new InsuranceService(InsurancePolicy as any);
      const pitService = new PitService(TaxPolicy as any, EmployeeProfile as any);
      const timesheetSummaryService = new TimesheetSummaryService(
        TimesheetSummary as any,
        AttendanceDay as any,
        OvertimeResult as any,
        EmployeeProfile as any,
        User as any,
        Assignment as any,
      );
      const payrollSnapshotService = new PayrollSnapshotService(
        PayrollInputSnapshot as any,
        TimesheetSummary as any,
        EmployeeProfile as any,
        SalaryProfile as any,
        OrganizationAllowance as any,
        AttendanceBonusPolicy as any,
        KpiPayrollInput as any,
        InsurancePolicy as any,
        InsuranceProfile as any,
        TaxPolicy as any,
      );
      const payslipService = new PayslipService(
        Payslip as any,
        PayrollRun as any,
        PayrollInputSnapshot as any,
        EmployeeProfile as any,
        TaxPolicy as any,
        insuranceService,
        pitService,
      );

      const summaries = await timesheetSummaryService.previewSummariesForDepartment(
        String(historyPeriodId), HISTORY_PERIOD, String(orgId),
      );
      const savedSummaries: any[] = [];
      for (const s of summaries) {
        const payload: any = {
          ...s,
          schemaVersion: 1,
          sourcePeriodVersion: 1,
          calculationContract: 'LEGACY_WORKING_DAYS_V1',
        };
        payload.canonicalPayloadHash = canonicalPayloadHash(payload);
        const doc = await TimesheetSummary.findOneAndUpdate(
          { periodId: s.periodId, employeeProfileId: s.employeeProfileId },
          { $set: payload },
          { upsert: true, new: true },
        ).lean();
        savedSummaries.push(doc);
      }

      const snapshots = await payrollSnapshotService.previewSnapshotsForDepartment(
        String(historyPeriodId), HISTORY_PERIOD, String(orgId), savedSummaries,
      );
      for (let i = 0; i < snapshots.length; i++) {
        const s = snapshots[i];
        const summary = savedSummaries.find(
          (sum) => String(sum.employeeProfileId) === String(s.employeeProfileId),
        ) ?? savedSummaries[i];

        const immutablePayload: any = {
          ...s,
          status: 'GENERATED',
          schemaVersion: 1,
          sourcePeriodVersion: 1,
          sourceSummaryId: summary?._id,
          sourceSummaryVersion: summary?.version ?? 1,
          sourceSummaryHash: summary?.canonicalPayloadHash ?? summary?.sourceHash ?? 'seeded_hash',
          calculationContract: summary?.calculationContract ?? 'LEGACY_WORKING_DAYS_V1',
        };
        immutablePayload.canonicalPayloadHash = canonicalPayloadHash(immutablePayload);

        await PayrollInputSnapshot.findOneAndUpdate(
          { periodId: s.periodId, employeeProfileId: s.employeeProfileId },
          { $set: immutablePayload },
          { upsert: true },
        );
      }

      const payrollRunService = new PayrollRunService(
        PayrollRun as any,
        PayrollInputSnapshot as any,
        TimesheetPeriod as any,
        EmployeeProfile as any,
        insuranceService,
        pitService,
        payslipService,
      );

      const existingRun: any = await PayrollRun.findOne({ organizationId: orgId, timesheetPeriodId: historyPeriodId }).lean();
      if (!existingRun) {
        const run = await payrollRunService.create({
          organizationId: String(orgId),
          timesheetPeriodId: String(historyPeriodId),
          notes: `Bảng lương tháng ${HISTORY_PERIOD}`,
          userId: String(userIdMap.get('HR-001')!),
        });
        const runId = String(run._id);
        await payrollRunService.calculate(runId, String(userIdMap.get('HR-001')!));
        await payrollRunService.lock(runId, String(userIdMap.get('HR-001')!));
        await payslipService.releaseForPayrollRun(runId, String(userIdMap.get('HR-001')!));
        mark('PayrollRun', 'created');
        mark('Payslip', 'created', nonHrAccounts.length);
      }
    }

    // ── 9. Period 2: Active Demo Period (September) ───────────────────────────
    const activeInfo = getPeriodDates(ACTIVE_PERIOD);
    const activePeriodId = await upsertDoc(
      TimesheetPeriod,
      { organizationId: orgId, period: ACTIVE_PERIOD },
      {
        organizationId: orgId,
        period: ACTIVE_PERIOD,
        startDate: activeInfo.start,
        endDate: activeInfo.end,
        status: CLOSE_ACTIVE ? TimesheetPeriodStatus.CLOSED : TimesheetPeriodStatus.OPEN,
        version: 1,
        active: true,
      },
      'TimesheetPeriod',
    );

    for (const acc of nonHrAccounts) {
      const uId = userIdMap.get(acc.employeeCode)!;
      const pId = profileIdMap.get(acc.employeeCode)!;
      for (const dateStr of activeInfo.allDates) {
        const isWeekend = activeInfo.weekends.includes(dateStr);
        const dayNumber = Number(dateStr.slice(8, 10));

        if (isWeekend) {
          // Weekend OT scenario for QL-KT-001 (Sep 12 & Sep 26)
          const isOtWeekend = acc.employeeCode === 'QL-KT-001' && (dayNumber === 12 || dayNumber === 26);
          if (!isOtWeekend) {
            continue;
          }

          const inTime = vnDate(dateStr, '08:00:00');
          const outTime = vnDate(dateStr, '12:00:00');

          const dayId = await upsertDoc(
            AttendanceDay,
            { organizationId: orgId, employeeId: uId, workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              periodId: activePeriodId,
              workDate: dateStr,
              workdayType: WorkdayType.WEEKLY_OFF,
              dayResult: DayResult.PRESENT,
              attendanceStatus: AttendanceStatus.COMPLETED,
              checkInAt: inTime,
              checkOutAt: outTime,
              workingMinutes: 240,
            },
            'AttendanceDay',
          );

          const otReqId = await upsertDoc(
            ManagerRequest,
            { organizationId: orgId, employeeUserId: uId, workDate: vnDate(dateStr, '00:00:00') },
            {
              organizationId: orgId,
              employeeId: pId,
              employeeUserId: uId,
              departmentId: deptMap.get('KT')!,
              type: 'OVERTIME',
              workDate: vnDate(dateStr, '00:00:00'),
              requestedStart: vnDate(dateStr, '08:00:00'),
              requestedEnd: vnDate(dateStr, '12:00:00'),
              reason: 'Bảo trì hệ thống server cuối tuần',
              status: 'APPROVED',
              reviewedBy: userIdMap.get('HR-001')!,
              reviewedAt: vnDate(dateStr, '12:30:00'),
              reviewComment: 'Đã duyệt OT cuối tuần',
              workDescription: 'Bảo trì hệ thống server hạ tầng',
              version: 1,
            },
            'ManagerRequest',
          );

          await upsertDoc(
            OvertimeResult,
            { organizationId: orgId, overtimeRequestId: otReqId },
            {
              organizationId: orgId,
              overtimeRequestId: otReqId,
              attendanceDayId: dayId,
              employeeId: uId,
              departmentId: deptMap.get('KT')!,
              workDate: dateStr,
              periodKey: ACTIVE_PERIOD,
              yearKey: '2026',
              overtimeType: 'OT_WEEKLY_OFF',
              classificationStatus: 'FINAL',
              requestedMinutes: 240,
              approvedMinutes: 240,
              actualMinutes: 240,
              eligibleMinutes: 240,
              scheduledMinutes: 0,
              policyVersion: 1,
              legalReference: 'BLLĐ 45/2019/QH14',
              inputHash: `demo-ot-${otReqId}-${dateStr}`,
              calculatedAt: new Date(),
            },
            'OvertimeResult',
          );

          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_IN },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: AttendanceEventType.CHECK_IN,
              recordedAt: inTime,
              method: AttendanceMethod.NETWORK,
              wifiBssid: '00:11:22:33:44:55',
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              isFallback: false,
            },
            'AttendanceEvent',
          );

          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_OUT },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: AttendanceEventType.CHECK_OUT,
              recordedAt: outTime,
              method: AttendanceMethod.NETWORK,
              wifiBssid: '00:11:22:33:44:55',
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              isFallback: false,
            },
            'AttendanceEvent',
          );

          continue;
        }

        // Scenario 1: NV-KD-003 missing check-in on Sep 15 (blocker)
        if (acc.employeeCode === 'NV-KD-003' && dayNumber === 15) {
          const outTime = vnDate(dateStr, '17:05:00');
          const dayId = await upsertDoc(
            AttendanceDay,
            { organizationId: orgId, employeeId: uId, workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              periodId: activePeriodId,
              workDate: dateStr,
              workdayType: WorkdayType.WORKING_DAY,
              dayResult: DayResult.INCOMPLETE,
              attendanceStatus: AttendanceStatus.CHECKED_IN,
              checkInAt: null,
              checkOutAt: outTime,
              workingMinutes: 0,
            },
            'AttendanceDay',
          );
          // Pending adjustment request for demo
          await upsertDoc(
            ManagerRequest,
            { organizationId: orgId, attendanceDayId: dayId },
            {
              organizationId: orgId,
              employeeId: pId,
              employeeUserId: uId,
              departmentId: deptMap.get('KD')!,
              attendanceDayId: dayId,
              type: 'ATTENDANCE',
              status: 'PENDING',
              workDate: vnDate(dateStr, '00:00:00'),
              reason: 'Quên chấm công vào do vào ca gấp tiếp khách hàng',
              metadata: { adjustmentSource: 'MANUAL_ADJUSTMENT' },
              version: 1,
            },
            'ManagerRequest',
          );
          continue;
        }

        // Scenario 2: NV-KT-003 missing check-out on Sep 18 (blocker)
        if (acc.employeeCode === 'NV-KT-003' && dayNumber === 18) {
          const inTime = vnDate(dateStr, '07:58:00');
          const dayId = await upsertDoc(
            AttendanceDay,
            { organizationId: orgId, employeeId: uId, workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              periodId: activePeriodId,
              workDate: dateStr,
              workdayType: WorkdayType.WORKING_DAY,
              dayResult: DayResult.INCOMPLETE,
              attendanceStatus: AttendanceStatus.CHECKED_IN,
              checkInAt: inTime,
              checkOutAt: null,
              workingMinutes: 0,
            },
            'AttendanceDay',
          );
          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_IN },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: AttendanceEventType.CHECK_IN,
              recordedAt: inTime,
              method: AttendanceMethod.GPS,
              latitude: 10.7769,
              longitude: 106.7009,
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              isFallback: false,
            },
            'AttendanceEvent',
          );
          continue;
        }

        // Scenario 3: NV-KT-002 Approved Paid Leave on Sep 9 & Sep 10
        if (acc.employeeCode === 'NV-KT-002' && (dayNumber === 9 || dayNumber === 10)) {
          await upsertDoc(
            AttendanceDay,
            { organizationId: orgId, employeeId: uId, workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              periodId: activePeriodId,
              workDate: dateStr,
              workdayType: WorkdayType.PAID_LEAVE,
              dayResult: DayResult.PRESENT,
              attendanceStatus: AttendanceStatus.COMPLETED,
              workingMinutes: 480,
            },
            'AttendanceDay',
          );
          continue;
        }

        // Scenario 3b: NV-KT-001 Approved Paid Leave on Sep 21
        if (acc.employeeCode === 'NV-KT-001' && dayNumber === 21) {
          await upsertDoc(
            LeaveRequest,
            { organizationId: orgId, employeeId: uId, startDate: dateStr, endDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              departmentId: deptMap.get('KT')!,
              startDate: dateStr,
              endDate: dateStr,
              leaveType: LeaveType.PAID_LEAVE,
              durationType: LeaveDurationType.FULL_DAY,
              calculatedMinutes: 480,
              leaveEquivalent: 1,
              reason: 'Nghỉ phép thường niên theo quy chế',
              status: LeaveRequestStatus.HR_APPLIED,
              reviewedBy: userIdMap.get('QL-KT-001')!,
              reviewedAt: vnDate('2026-09-18', '14:00:00'),
              reviewComment: 'Đã duyệt phép',
              appliedBy: userIdMap.get('HR-001')!,
              appliedAt: vnDate('2026-09-19', '09:00:00'),
            },
            'LeaveRequest',
          );
          await upsertDoc(
            AttendanceDay,
            { organizationId: orgId, employeeId: uId, workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              periodId: activePeriodId,
              workDate: dateStr,
              workdayType: WorkdayType.PAID_LEAVE,
              dayResult: DayResult.PRESENT,
              attendanceStatus: AttendanceStatus.COMPLETED,
              workingMinutes: 480,
              shiftSnapshot: { startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15 },
              employeeSnapshot: { employeeCode: acc.employeeCode, fullName: acc.fullName, departmentId: String(deptMap.get(acc.deptCode!)) },
            },
            'AttendanceDay',
          );
          continue;
        }

        // Scenario 4: NV-KD-002 Half-day leave (morning) + Late arrival & early departure (afternoon) on Sep 23
        if (acc.employeeCode === 'NV-KD-002' && dayNumber === 23) {
          const leaveReqId = await upsertDoc(
            LeaveRequest,
            { organizationId: orgId, employeeId: uId, startDate: dateStr, endDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              departmentId: deptMap.get('KD')!,
              startDate: dateStr,
              endDate: dateStr,
              leaveType: LeaveType.PAID_LEAVE,
              durationType: LeaveDurationType.MORNING_HALF,
              requestedStart: '08:00',
              requestedEnd: '12:00',
              calculatedMinutes: 240,
              leaveEquivalent: 0.5,
              approvedLeaveIntervals: [{ from: '08:00', to: '12:00' }],
              requiredWorkingIntervals: [{ from: '13:00', to: '17:00' }],
              reason: 'Nghỉ khám sức khỏe định kỳ buổi sáng',
              status: LeaveRequestStatus.HR_APPLIED,
              reviewedBy: userIdMap.get('QL-KD-001')!,
              reviewedAt: vnDate(dateStr, '06:00:00'),
              reviewComment: 'Đã duyệt nghỉ sáng',
              appliedBy: userIdMap.get('HR-001')!,
              appliedAt: vnDate(dateStr, '06:30:00'),
            },
            'LeaveRequest',
          );

          await upsertDoc(
            EmployeeDayOverride,
            { organizationId: orgId, employeeId: uId, date: dateStr, leaveRequestId: leaveReqId },
            {
              organizationId: orgId,
              employeeId: uId,
              date: dateStr,
              type: LeaveType.PAID_LEAVE,
              durationType: LeaveDurationType.MORNING_HALF,
              requestedStart: '08:00',
              requestedEnd: '12:00',
              calculatedMinutes: 240,
              leaveEquivalent: 0.5,
              approvedLeaveIntervals: [{ from: '08:00', to: '12:00' }],
              requiredWorkingIntervals: [{ from: '13:00', to: '17:00' }],
              leaveRequestId: leaveReqId,
              reason: 'Nghỉ khám sức khỏe định kỳ buổi sáng',
              createdBy: userIdMap.get('HR-001')!,
            },
            'EmployeeDayOverride',
          );

          const inTime = vnDate(dateStr, '13:25:00');
          const outTime = vnDate(dateStr, '16:30:00');

          const dayId = await upsertDoc(
            AttendanceDay,
            { organizationId: orgId, employeeId: uId, workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              periodId: activePeriodId,
              workDate: dateStr,
              workdayType: WorkdayType.WORKING_DAY,
              dayResult: DayResult.PRESENT,
              attendanceStatus: AttendanceStatus.COMPLETED,
              checkInAt: inTime,
              checkOutAt: outTime,
              workingMinutes: 185,
              approvedLeaveMinutes: 240,
              requiredWorkingMinutes: 240,
              effectiveCheckInTime: '13:00',
              effectiveCheckOutTime: '17:00',
              lateMinutes: 25,
              earlyMinutes: 30,
              shiftSnapshot: {
                shiftTemplateId,
                shiftName: 'Ca hành chính',
                shiftCode: 'HC-01',
                startTime: '08:00',
                endTime: '17:00',
                breakMinutes: 60,
                requiredWorkingIntervals: [{ from: '13:00', to: '17:00' }],
                approvedLeaveIntervals: [{ from: '08:00', to: '12:00' }],
                gracePeriodMinutes: 0,
              },
            },
            'AttendanceDay',
          );

          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, employeeId: uId, eventType: 'CHECK_IN', workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: 'CHECK_IN',
              workDate: dateStr,
              recordedAt: inTime,
              method: AttendanceMethod.NETWORK,
              wifiBssid: '00:11:22:33:44:55',
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              isFallback: false,
            },
            'AttendanceEvent',
          );

          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, employeeId: uId, eventType: 'CHECK_OUT', workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: 'CHECK_OUT',
              workDate: dateStr,
              recordedAt: outTime,
              method: AttendanceMethod.NETWORK,
              wifiBssid: '00:11:22:33:44:55',
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              isFallback: false,
            },
            'AttendanceEvent',
          );

          continue;
        }

        // Scenario 5: Realistic attendance variations & anomalies
        const punch = getNaturalPunch(acc.employeeCode, dateStr);
        let lateMin = 0;
        let earlyMin = 0;
        let inTimeStr = punch.inTimeStr;
        let outTimeStr = punch.outTimeStr!;
        let punchMethod = punch.method;

        if (acc.employeeCode === 'NV-KD-002') {
          if (dayNumber === 8) {
            inTimeStr = '08:25:00';
            lateMin = 25;
          } else if (dayNumber === 16) {
            inTimeStr = '08:20:00';
            lateMin = 20;
          } else if (dayNumber === 22) {
            outTimeStr = '16:30:00';
            earlyMin = 30;
          }
        } else if (acc.employeeCode === 'NV-KT-002' && dayNumber === 4) {
          outTimeStr = '16:45:00';
          earlyMin = 15;
        } else if (acc.employeeCode === 'NV-KD-001' && dayNumber === 11) {
          outTimeStr = '17:48:30';
        }

        const inTime = vnDate(dateStr, inTimeStr);
        const outTime = vnDate(dateStr, outTimeStr);
        const method = punchMethod;

        const dayId = await upsertDoc(
          AttendanceDay,
          { organizationId: orgId, employeeId: uId, workDate: dateStr },
          {
            organizationId: orgId,
            employeeId: uId,
            periodId: activePeriodId,
            workDate: dateStr,
            workMode: WorkMode.IN_OFFICE,
            workdayType: WorkdayType.WORKING_DAY,
            dayResult: DayResult.PRESENT,
            attendanceStatus: AttendanceStatus.COMPLETED,
            overallApprovalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
            checkInAt: inTime,
            checkOutAt: outTime,
            workingMinutes: Math.max(0, 480 - lateMin - earlyMin),
            lateMinutes: lateMin,
            earlyMinutes: earlyMin,
            shiftSnapshot: { startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15 },
            employeeSnapshot: { employeeCode: acc.employeeCode, fullName: acc.fullName, departmentId: String(deptMap.get(acc.deptCode!)) },
          },
          'AttendanceDay',
        );

        await upsertDoc(
          AttendanceEvent,
          { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_IN },
          {
            organizationId: orgId,
            employeeId: uId,
            attendanceDayId: dayId,
            eventType: AttendanceEventType.CHECK_IN,
            recordedAt: inTime,
            method,
            wifiBssid: method === AttendanceMethod.NETWORK ? (punch.wifiBssid ?? '00:11:22:33:44:55') : undefined,
            wifiSsid: method === AttendanceMethod.NETWORK ? (punch.wifiSsid ?? 'AnPhat_Office') : undefined,
            latitude: method !== AttendanceMethod.NETWORK ? punch.latitude : undefined,
            longitude: method !== AttendanceMethod.NETWORK ? punch.longitude : undefined,
            accuracyMeters: method !== AttendanceMethod.NETWORK ? punch.accuracyMeters : undefined,
            distanceFromWorkplaceMeters: method !== AttendanceMethod.NETWORK ? punch.distanceFromWorkplaceMeters : undefined,
            address: method !== AttendanceMethod.NETWORK ? punch.address : undefined,
            validationStatus: 'VALID',
            approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
            isFallback: false,
          },
          'AttendanceEvent',
        );

        await upsertDoc(
          AttendanceEvent,
          { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_OUT },
          {
            organizationId: orgId,
            employeeId: uId,
            attendanceDayId: dayId,
            eventType: AttendanceEventType.CHECK_OUT,
            recordedAt: outTime,
            method,
            wifiBssid: method === AttendanceMethod.NETWORK ? (punch.wifiBssid ?? '00:11:22:33:44:55') : undefined,
            wifiSsid: method === AttendanceMethod.NETWORK ? (punch.wifiSsid ?? 'AnPhat_Office') : undefined,
            latitude: method !== AttendanceMethod.NETWORK ? punch.latitude : undefined,
            longitude: method !== AttendanceMethod.NETWORK ? punch.longitude : undefined,
            accuracyMeters: method !== AttendanceMethod.NETWORK ? punch.accuracyMeters : undefined,
            distanceFromWorkplaceMeters: method !== AttendanceMethod.NETWORK ? punch.distanceFromWorkplaceMeters : undefined,
            address: method !== AttendanceMethod.NETWORK ? punch.address : undefined,
            validationStatus: 'VALID',
            approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
            isFallback: false,
          },
          'AttendanceEvent',
        );
      }
    }

    // Pending Leave Request for demo approval (Sep 25 - NV-KT-002)
    const nvKt2UserId = userIdMap.get('NV-KT-002')!;
    await upsertDoc(
      LeaveRequest,
      { organizationId: orgId, employeeId: nvKt2UserId, startDate: '2026-09-25', endDate: '2026-09-25' },
      {
        organizationId: orgId,
        employeeId: nvKt2UserId,
        departmentId: deptMap.get('KT')!,
        leaveType: LeaveType.PAID_LEAVE,
        durationType: LeaveDurationType.FULL_DAY,
        calculatedMinutes: 480,
        leaveEquivalent: 1,
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        reason: 'Nghỉ giải quyết việc gia đình cá nhân',
        status: LeaveRequestStatus.PENDING_MANAGER,
      },
      'LeaveRequest',
    );

    // Pending Leave Request for demo approval
    const nvKd2UserId = userIdMap.get('NV-KD-002')!;
    await upsertDoc(
      LeaveRequest,
      { organizationId: orgId, employeeId: nvKd2UserId, startDate: '2026-10-15', endDate: '2026-10-16' },
      {
        organizationId: orgId,
        employeeId: nvKd2UserId,
        departmentId: deptMap.get('KD')!,
        leaveType: LeaveType.PAID_LEAVE,
        startDate: '2026-10-15',
        endDate: '2026-10-16',
        reason: 'Nghỉ phép giải quyết việc gia đình cá nhân',
        status: LeaveRequestStatus.PENDING_MANAGER,
      },
      'LeaveRequest',
    );

    // If CLOSE_ACTIVE is true (rehearsal mode), finalize Period 2 as well
    if (CLOSE_ACTIVE && APPLY) {
      console.log('[seed:demo] Finalizing active period (rehearsal mode)...');
      // Resolve blockers
      await AttendanceDay.updateMany(
        { organizationId: orgId, periodId: activePeriodId, dayResult: DayResult.INCOMPLETE },
        {
          $set: {
            dayResult: DayResult.ABSENT,
            'resolution.type': 'FORFEITED_MISSING_PUNCH',
            'resolution.reason': 'Xử lý ngày thiếu chấm công theo quy chế',
            'resolution.resolvedBy': userIdMap.get('HR-001'),
            'resolution.resolvedAt': new Date(),
          },
        },
      );

      // Confirm both departments
      for (const [deptCode, dId] of deptMap.entries()) {
        await DepartmentTimesheetConfirmation.findOneAndUpdate(
          { organizationId: orgId, periodId: activePeriodId, departmentId: dId },
          {
            $set: {
              organizationId: orgId,
              periodId: activePeriodId,
              departmentId: dId,
              managerId: userIdMap.get(deptCode === 'KD' ? 'QL-KD-001' : 'QL-KT-001')!,
              periodVersion: 1,
              confirmedAt: new Date(activeInfo.end),
              summarySnapshot: {
                employeeCount: 4,
                scheduledWorkDays: activeInfo.workdays.length,
                actualWorkingDays: activeInfo.workdays.length - 1,
                workingMinutes: (activeInfo.workdays.length - 1) * 480,
                lateMinutes: 45,
                earlyMinutes: 30,
                paidLeaveDays: 2,
                unpaidLeaveDays: 0,
                incompleteDays: 0,
                overtimeMinutes: { workingDay: 0, weeklyOff: 480, publicHoliday: 0, total: 480 },
                blockerCount: 0,
              },
            },
          },
          { upsert: true },
        );
      }

      await TimesheetPeriod.updateOne(
        { _id: activePeriodId },
        {
          status: TimesheetPeriodStatus.CLOSED,
          closedBy: userIdMap.get('HR-001'),
          closedAt: new Date(activeInfo.end),
          managerSnapshotClosed: true,
          managerSnapshotClosedBy: userIdMap.get('HR-001'),
          managerSnapshotClosedAt: new Date(activeInfo.end),
          departmentSnapshots: [
            { departmentId: deptMap.get('KD')!, managerUserId: userIdMap.get('QL-KD-001')!, closedAt: new Date(activeInfo.end) },
            { departmentId: deptMap.get('KT')!, managerUserId: userIdMap.get('QL-KT-001')!, closedAt: new Date(activeInfo.end) },
          ],
        },
      );

      const insuranceService = new InsuranceService(InsurancePolicy as any);
      const pitService = new PitService(TaxPolicy as any, EmployeeProfile as any);
      const timesheetSummaryService = new TimesheetSummaryService(
        TimesheetSummary as any,
        AttendanceDay as any,
        OvertimeResult as any,
        EmployeeProfile as any,
        User as any,
        Assignment as any,
      );
      const payrollSnapshotService = new PayrollSnapshotService(
        PayrollInputSnapshot as any,
        TimesheetSummary as any,
        EmployeeProfile as any,
        SalaryProfile as any,
        OrganizationAllowance as any,
        AttendanceBonusPolicy as any,
        KpiPayrollInput as any,
        InsurancePolicy as any,
        InsuranceProfile as any,
        TaxPolicy as any,
      );
      const payslipService = new PayslipService(
        Payslip as any,
        PayrollRun as any,
        PayrollInputSnapshot as any,
        EmployeeProfile as any,
        TaxPolicy as any,
        insuranceService,
        pitService,
      );

      const summaries = await timesheetSummaryService.previewSummariesForDepartment(
        String(activePeriodId), ACTIVE_PERIOD, String(orgId),
      );
      const savedSummaries: any[] = [];
      for (const s of summaries) {
        const payload: any = {
          ...s,
          schemaVersion: 1,
          sourcePeriodVersion: 1,
          calculationContract: 'LEGACY_WORKING_DAYS_V1',
        };
        payload.canonicalPayloadHash = canonicalPayloadHash(payload);
        const doc = await TimesheetSummary.findOneAndUpdate(
          { periodId: s.periodId, employeeProfileId: s.employeeProfileId },
          { $set: payload },
          { upsert: true, new: true },
        ).lean();
        savedSummaries.push(doc);
      }

      const snapshots = await payrollSnapshotService.previewSnapshotsForDepartment(
        String(activePeriodId), ACTIVE_PERIOD, String(orgId), savedSummaries,
      );
      for (let i = 0; i < snapshots.length; i++) {
        const s = snapshots[i];
        const summary = savedSummaries.find(
          (sum) => String(sum.employeeProfileId) === String(s.employeeProfileId),
        ) ?? savedSummaries[i];

        const immutablePayload: any = {
          ...s,
          status: 'GENERATED',
          schemaVersion: 1,
          sourcePeriodVersion: 1,
          sourceSummaryId: summary?._id,
          sourceSummaryVersion: summary?.version ?? 1,
          sourceSummaryHash: summary?.canonicalPayloadHash ?? summary?.sourceHash ?? 'seeded_hash',
          calculationContract: summary?.calculationContract ?? 'LEGACY_WORKING_DAYS_V1',
        };
        immutablePayload.canonicalPayloadHash = canonicalPayloadHash(immutablePayload);

        await PayrollInputSnapshot.findOneAndUpdate(
          { periodId: s.periodId, employeeProfileId: s.employeeProfileId },
          { $set: immutablePayload },
          { upsert: true },
        );
      }

      const payrollRunService = new PayrollRunService(
        PayrollRun as any,
        PayrollInputSnapshot as any,
        TimesheetPeriod as any,
        EmployeeProfile as any,
        insuranceService,
        pitService,
        payslipService,
      );

      const existingRun: any = await PayrollRun.findOne({ organizationId: orgId, timesheetPeriodId: activePeriodId }).lean();
      if (!existingRun) {
        const run = await payrollRunService.create({
          organizationId: String(orgId),
          timesheetPeriodId: String(activePeriodId),
          notes: `Bảng lương tháng ${ACTIVE_PERIOD}`,
          userId: String(userIdMap.get('HR-001')!),
        });
        const runId = String(run._id);
        await payrollRunService.calculate(runId, String(userIdMap.get('HR-001')!));
        await payrollRunService.lock(runId, String(userIdMap.get('HR-001')!));
        await payslipService.releaseForPayrollRun(runId, String(userIdMap.get('HR-001')!));
        mark('PayrollRun', 'created');
        mark('Payslip', 'created', nonHrAccounts.length);
      }
    }

    // ── 10. Period 3: Current Ongoing Period (October) ────────────────────────
    const currentInfo = getPeriodDates(CURRENT_PERIOD);
    const currentPeriodId = await upsertDoc(
      TimesheetPeriod,
      { organizationId: orgId, period: CURRENT_PERIOD },
      {
        organizationId: orgId,
        period: CURRENT_PERIOD,
        startDate: currentInfo.start,
        endDate: currentInfo.end,
        status: TimesheetPeriodStatus.OPEN,
        version: 1,
        active: true,
      },
      'TimesheetPeriod',
    );

    const refDateStr = isoDate(REFERENCE_DATE);
    const datesThroughRef = currentInfo.allDates.filter(d => d <= refDateStr);

    for (const acc of nonHrAccounts) {
      const uId = userIdMap.get(acc.employeeCode)!;
      const pId = profileIdMap.get(acc.employeeCode)!;
      for (const dateStr of datesThroughRef) {
        const isWeekend = currentInfo.weekends.includes(dateStr);
        const isToday = dateStr === refDateStr;
        const dayNumber = Number(dateStr.slice(8, 10));

        if (isWeekend) {
          continue;
        }

        // Scenario Oct-1: NV-KT-002 Approved Paid Leave on Oct 14
        if (acc.employeeCode === 'NV-KT-002' && dayNumber === 14) {
          await upsertDoc(
            LeaveRequest,
            { organizationId: orgId, employeeId: uId, startDate: dateStr, endDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              departmentId: deptMap.get('KT')!,
              startDate: dateStr,
              endDate: dateStr,
              leaveType: LeaveType.PAID_LEAVE,
              durationType: LeaveDurationType.FULL_DAY,
              calculatedMinutes: 480,
              leaveEquivalent: 1,
              reason: 'Nghỉ giải quyết thủ tục giấy tờ hành chính',
              status: LeaveRequestStatus.HR_APPLIED,
              reviewedBy: userIdMap.get('QL-KT-001')!,
              reviewedAt: vnDate('2026-10-12', '10:00:00'),
              reviewComment: 'Đã duyệt phép',
              appliedBy: userIdMap.get('HR-001')!,
              appliedAt: vnDate('2026-10-13', '08:30:00'),
            },
            'LeaveRequest',
          );
          await upsertDoc(
            AttendanceDay,
            { organizationId: orgId, employeeId: uId, workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              periodId: currentPeriodId,
              workDate: dateStr,
              workdayType: WorkdayType.PAID_LEAVE,
              dayResult: DayResult.PRESENT,
              attendanceStatus: AttendanceStatus.COMPLETED,
              workingMinutes: 480,
              shiftSnapshot: { startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15 },
              employeeSnapshot: { employeeCode: acc.employeeCode, fullName: acc.fullName, departmentId: String(deptMap.get(acc.deptCode!)) },
            },
            'AttendanceDay',
          );
          continue;
        }

        // Scenario Oct-2: NV-KT-003 Forgot check-in on Oct 12, submitted adjustment & Manager APPROVED
        if (acc.employeeCode === 'NV-KT-003' && dayNumber === 12) {
          const inTime = vnDate(dateStr, '07:55:00');
          const outTime = vnDate(dateStr, '17:15:20');
          const dayId = await upsertDoc(
            AttendanceDay,
            { organizationId: orgId, employeeId: uId, workDate: dateStr },
            {
              organizationId: orgId,
              employeeId: uId,
              periodId: currentPeriodId,
              workDate: dateStr,
              workMode: WorkMode.IN_OFFICE,
              workdayType: WorkdayType.WORKING_DAY,
              dayResult: DayResult.PRESENT,
              attendanceStatus: AttendanceStatus.COMPLETED,
              overallApprovalStatus: AttendanceApprovalStatus.APPROVED,
              checkInAt: inTime,
              checkOutAt: outTime,
              workingMinutes: 480,
              lateMinutes: 0,
              earlyMinutes: 0,
              shiftSnapshot: { startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15 },
              employeeSnapshot: { employeeCode: acc.employeeCode, fullName: acc.fullName, departmentId: String(deptMap.get(acc.deptCode!)) },
            },
            'AttendanceDay',
          );

          await upsertDoc(
            ManagerRequest,
            { organizationId: orgId, attendanceDayId: dayId },
            {
              organizationId: orgId,
              employeeId: pId,
              employeeUserId: uId,
              departmentId: deptMap.get('KT')!,
              attendanceDayId: dayId,
              type: 'ATTENDANCE',
              status: 'APPROVED',
              workDate: vnDate(dateStr, '00:00:00'),
              reason: 'Điện thoại cá nhân bị sập nguồn không kết nối được mạng buổi sáng, có anh Bảo KT xác nhận vào ca cùng',
              reviewedBy: userIdMap.get('QL-KT-001')!,
              reviewedAt: vnDate(dateStr, '17:30:00'),
              reviewComment: 'Xác nhận vào ca đúng giờ, đồng ý bổ sung công',
              metadata: { adjustmentSource: 'MANUAL_ADJUSTMENT' },
              version: 1,
            },
            'ManagerRequest',
          );

          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_IN },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: AttendanceEventType.CHECK_IN,
              recordedAt: inTime,
              method: AttendanceMethod.NETWORK,
              wifiBssid: '00:11:22:33:44:55',
              wifiSsid: 'AnPhat_Office',
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.APPROVED,
              isFallback: true,
              note: 'Điều chỉnh theo phiếu giải trình đã được Quản lý duyệt',
            },
            'AttendanceEvent',
          );

          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_OUT },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: AttendanceEventType.CHECK_OUT,
              recordedAt: outTime,
              method: AttendanceMethod.NETWORK,
              wifiBssid: '00:11:22:33:44:55',
              wifiSsid: 'AnPhat_Office',
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              isFallback: false,
            },
            'AttendanceEvent',
          );
          continue;
        }

        // Scenario Oct-3: Realistic Variations in Oct
        const punch = getNaturalPunch(acc.employeeCode, dateStr, isToday);
        let lateMin = 0;
        let earlyMin = 0;
        let inTimeStr = punch.inTimeStr;
        let outTimeStr = punch.outTimeStr;
        let punchMethod = punch.method;

        if (isToday) {
          // Today (Oct 29): Everyone is CHECKED_IN with varied realistic check-in times & methods
          if (acc.employeeCode === 'NV-KD-001') {
            inTimeStr = '07:46:12';
            punchMethod = AttendanceMethod.NETWORK;
          } else if (acc.employeeCode === 'NV-KD-002') {
            inTimeStr = '08:09:40';
            punchMethod = AttendanceMethod.SELFIE;
          } else if (acc.employeeCode === 'NV-KD-003') {
            inTimeStr = '08:21:15';
            lateMin = 21;
            punchMethod = AttendanceMethod.GPS;
          } else if (acc.employeeCode === 'QL-KD-001') {
            inTimeStr = '07:51:30';
            punchMethod = AttendanceMethod.NETWORK;
          } else if (acc.employeeCode === 'NV-KT-001') {
            inTimeStr = '07:48:50';
            punchMethod = AttendanceMethod.NETWORK;
          } else if (acc.employeeCode === 'NV-KT-002') {
            inTimeStr = '08:02:10';
            punchMethod = AttendanceMethod.GPS;
          } else if (acc.employeeCode === 'NV-KT-003') {
            inTimeStr = '07:56:45';
            punchMethod = AttendanceMethod.SELFIE;
          } else if (acc.employeeCode === 'QL-KT-001') {
            inTimeStr = '08:05:20';
            punchMethod = AttendanceMethod.NETWORK;
          }
          outTimeStr = null;
        } else {
          // Past days in Oct:
          if (acc.employeeCode === 'NV-KD-001' && dayNumber === 6) {
            inTimeStr = '08:19:30';
            lateMin = 19;
          } else if (acc.employeeCode === 'NV-KD-002' && dayNumber === 16) {
            outTimeStr = '16:35:00';
            earlyMin = 25;
          } else if (acc.employeeCode === 'NV-KT-001' && dayNumber === 20) {
            outTimeStr = '16:38:00';
            earlyMin = 22;
          } else if (acc.employeeCode === 'NV-KD-003' && dayNumber === 22) {
            inTimeStr = '08:24:00';
            lateMin = 24;
          }
        }

        const inTime = vnDate(dateStr, inTimeStr);
        const outTime = outTimeStr ? vnDate(dateStr, outTimeStr) : null;
        const method = punchMethod;

        const dayId = await upsertDoc(
          AttendanceDay,
          { organizationId: orgId, employeeId: uId, workDate: dateStr },
          {
            organizationId: orgId,
            employeeId: uId,
            periodId: currentPeriodId,
            workDate: dateStr,
            workMode: WorkMode.IN_OFFICE,
            workdayType: WorkdayType.WORKING_DAY,
            dayResult: DayResult.PRESENT,
            attendanceStatus: isToday ? AttendanceStatus.CHECKED_IN : AttendanceStatus.COMPLETED,
            overallApprovalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
            checkInAt: inTime,
            checkOutAt: outTime,
            workingMinutes: isToday ? 240 : Math.max(0, 480 - lateMin - earlyMin),
            lateMinutes: lateMin,
            earlyMinutes: earlyMin,
            shiftSnapshot: { startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15 },
            employeeSnapshot: { employeeCode: acc.employeeCode, fullName: acc.fullName, departmentId: String(deptMap.get(acc.deptCode!)) },
          },
          'AttendanceDay',
        );

        await upsertDoc(
          AttendanceEvent,
          { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_IN },
          {
            organizationId: orgId,
            employeeId: uId,
            attendanceDayId: dayId,
            eventType: AttendanceEventType.CHECK_IN,
            recordedAt: inTime,
            method,
            wifiBssid: method === AttendanceMethod.NETWORK ? (punch.wifiBssid ?? '00:11:22:33:44:55') : undefined,
            wifiSsid: method === AttendanceMethod.NETWORK ? (punch.wifiSsid ?? 'AnPhat_Office') : undefined,
            latitude: method !== AttendanceMethod.NETWORK ? punch.latitude : undefined,
            longitude: method !== AttendanceMethod.NETWORK ? punch.longitude : undefined,
            accuracyMeters: method !== AttendanceMethod.NETWORK ? punch.accuracyMeters : undefined,
            distanceFromWorkplaceMeters: method !== AttendanceMethod.NETWORK ? punch.distanceFromWorkplaceMeters : undefined,
            address: method !== AttendanceMethod.NETWORK ? punch.address : undefined,
            validationStatus: 'VALID',
            approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
            isFallback: false,
          },
          'AttendanceEvent',
        );

        if (!isToday && outTime) {
          await upsertDoc(
            AttendanceEvent,
            { organizationId: orgId, attendanceDayId: dayId, eventType: AttendanceEventType.CHECK_OUT },
            {
              organizationId: orgId,
              employeeId: uId,
              attendanceDayId: dayId,
              eventType: AttendanceEventType.CHECK_OUT,
              recordedAt: outTime,
              method,
              wifiBssid: method === AttendanceMethod.NETWORK ? (punch.wifiBssid ?? '00:11:22:33:44:55') : undefined,
              wifiSsid: method === AttendanceMethod.NETWORK ? (punch.wifiSsid ?? 'AnPhat_Office') : undefined,
              latitude: method !== AttendanceMethod.NETWORK ? punch.latitude : undefined,
              longitude: method !== AttendanceMethod.NETWORK ? punch.longitude : undefined,
              accuracyMeters: method !== AttendanceMethod.NETWORK ? punch.accuracyMeters : undefined,
              distanceFromWorkplaceMeters: method !== AttendanceMethod.NETWORK ? punch.distanceFromWorkplaceMeters : undefined,
              address: method !== AttendanceMethod.NETWORK ? punch.address : undefined,
              validationStatus: 'VALID',
              approvalStatus: AttendanceApprovalStatus.NOT_REQUIRED,
              isFallback: false,
            },
            'AttendanceEvent',
          );
        }
      }
    }

    // ── 11. Generate Demo Import Files ────────────────────────────────────────
    const importDir = path.resolve(process.cwd(), 'demo-import');
    await generateDemoImportFiles(importDir);
    console.log(`[seed:demo] Demo import files written to ${importDir}`);

    // ── 12. Print Summary & Accounts Table ────────────────────────────────────
    console.log(`\n───────────────────────────────────────────────────────────────────`);
    console.log(` CoreStaff Demo Seeding Finished (${APPLY ? 'APPLIED' : 'DRY-RUN'})`);
    console.log(` Organization: ${ORG_NAME} [${ORG_CODE}]`);
    console.log(` Periods     : ${HISTORY_PERIOD} (Lịch sử) | ${ACTIVE_PERIOD} (Demo live) | ${CURRENT_PERIOD} (Hiện tại)`);
    console.log(` Reference   : ${refDateStr}`);
    console.log(` Password    : ${DEMO_PASSWORD}`);
    console.log(`───────────────────────────────────────────────────────────────────`);

    console.log('\nDANH SÁCH TÀI KHOẢN DEMO:');
    console.log('┌──────────────────────────────────────┬────────────────────┬─────────────┬──────────────┐');
    console.log('│ Email                                │ Họ và tên          │ Vai trò     │ Phòng ban    │');
    console.log('├──────────────────────────────────────┼────────────────────┼─────────────┼──────────────┤');
    for (const acc of DEMO_ACCOUNTS) {
      const emailCol = acc.email.padEnd(36);
      const nameCol = acc.fullName.padEnd(18);
      const roleCol = acc.role.padEnd(11);
      const deptCol = (acc.deptCode ?? '—').padEnd(12);
      console.log(`│ ${emailCol} │ ${nameCol} │ ${roleCol} │ ${deptCol} │`);
    }
    console.log('└──────────────────────────────────────┴────────────────────┴─────────────┴──────────────┘');

    console.log('\nTỔNG HỢP ENTITIES:');
    for (const [kind, s] of summary.entries()) {
      console.log(`  ${kind.padEnd(30)}: planned=${s.planned}, created=${s.created}, skipped=${s.skipped}`);
    }

    if (!APPLY) {
      console.log('\n[seed:demo] DRY RUN complete — run with "npm run seed:demo:reset" to apply.');
    } else {
      console.log('\n[seed:demo] Demo tenant successfully seeded and ready for presentation!');
    }
  } catch (err) {
    console.error('[seed:demo] Execution failed:', err);
    process.exitCode = 1;
  } finally {
    await closeConnection(db);
  }
}

main();
