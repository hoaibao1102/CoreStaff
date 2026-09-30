/**
 * Full-system seed for a single coherent organization.
 *
 * Creates everything needed to exercise the CoreStaff platform end-to-end:
 * organization, users, employee profiles, departments, positions, workplace,
 * shift template, manager/employee assignments, contracts, compensation,
 * policies (labor, overtime, tax, insurance), insurance profiles, calendar
 * exceptions, timesheet period, attendance, leave, timesheet summaries,
 * payroll input snapshots, a payroll run, and payslips.
 *
 * Run dry-run:  npm run seed:full:org
 * Run apply:    npm run seed:full:org -- --apply
 */

import * as mongoose from 'mongoose';
import * as crypto from 'node:crypto';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import { hashPassword } from '../src/auth/strategies/bcrypt.strategy';
import {
  ContractStatus,
  ContractType,
  EmploymentStatus,
  Gender,
  LeaveRequestStatus,
  LeaveType,
  Role,
  ShiftScope,
  WorkdayType,
  AttendanceStatus,
  AttendanceEventType,
  AttendanceMethod,
  WorkMode,
  CalendarExceptionType,
  normalizeEmail,
} from '../src/database/schemas/enums';
import { InsuranceContributionType } from '../src/database/schemas/enums';
import { userFields } from '../src/database/seed/provision';

const APPLY = process.argv.includes('--apply');
const ORG_CODE = 'FLOW';
const ORG_NAME = 'Flow Software JSC';
const PERIOD = '2026-09';
const PERIOD_START = new Date('2026-09-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-09-30T23:59:59.999Z');

const password = process.env.SEED_PASSWORD || 'FlowDemo1!';

/** Progressive PIT brackets for Vietnam 2026 (VND/month). */
const DEFAULT_TAX_BRACKETS = [
  { upperLimit: 10_000_000, rate: 5 },
  { upperLimit: 30_000_000, rate: 10 },
  { upperLimit: 60_000_000, rate: 20 },
  { upperLimit: 100_000_000, rate: 30 },
  { upperLimit: Infinity, rate: 35 },
];

/** Compute PIT and related deduction fields locally for seeding payslips. */
async function computePit(
  grossEarnings: number,
  totalInsurance: number,
  profileId: mongoose.Types.ObjectId,
  organizationId: mongoose.Types.ObjectId,
  snapshot: any,
): Promise<{
  taxableEarnings: number;
  personalDeduction: number;
  dependentDeduction: number;
  pitAmount: number;
  breakdown: Array<{ bracket: number; income: number; rate: number; tax: number }>;
}> {
  const EmployeeProfile = mongoose.model('EmployeeProfile');
  const profile = await EmployeeProfile.findById(profileId).lean();
  const activeDependents = ((profile as any)?.dependents || []).filter(
    (d: any) => d.status === 'ACTIVE' || !d.status,
  ).length;
  const personalDeduction = 15_500_000;
  const dependentDeduction = activeDependents * 6_200_000;
  // Taxable gross = gross earnings - non-taxable allowances - OT non-taxable portion
  const nonTaxableAllowances = snapshot.nonTaxableAllowances || 0;
  const otNonTaxable = snapshot.otNonTaxableEarnings || 0;
  const taxableGross = grossEarnings - nonTaxableAllowances - otNonTaxable;
  const taxableEarnings = Math.max(
    0,
    taxableGross - totalInsurance - personalDeduction - dependentDeduction,
  );

  let remaining = taxableEarnings;
  let previousLimit = 0;
  let totalTax = 0;
  const breakdown: Array<{ bracket: number; income: number; rate: number; tax: number }> = [];

  for (let i = 0; i < DEFAULT_TAX_BRACKETS.length; i++) {
    if (remaining <= 0) break;
    const bracket = DEFAULT_TAX_BRACKETS[i];
    const bracketWidth = bracket.upperLimit - previousLimit;
    const taxableInBracket = Math.min(remaining, bracketWidth);
    const taxInBracket = taxableInBracket * (bracket.rate / 100);
    totalTax += taxInBracket;
    remaining -= taxableInBracket;
    previousLimit = bracket.upperLimit;
    breakdown.push({ bracket: i + 1, income: taxableInBracket, rate: bracket.rate, tax: Math.round(taxInBracket) });
  }

  return {
    taxableEarnings,
    personalDeduction,
    dependentDeduction,
    pitAmount: Math.round(totalTax),
    breakdown,
  };
}

function buildEarningBreakdown(snapshot: any, grossEarnings: number): Array<{ type: string; label: string; amount: number; taxable: boolean }> {
  const breakdown: Array<{ type: string; label: string; amount: number; taxable: boolean }> = [
    { type: 'BASE_SALARY', label: "Lương cơ bản", amount: snapshot.proratedBaseSalary || 0, taxable: true },
  ];

  // Allowances: split taxable vs non-taxable for earning breakdown
  const taxableAllowances = (snapshot.allowanceBreakdown || []).filter((a: any) => a.taxable);
  const nonTaxableAllowances = (snapshot.allowanceBreakdown || []).filter((a: any) => !a.taxable);

  if (taxableAllowances.length > 0) {
    breakdown.push({ type: "ALLOWANCE", label: "Trợ cấp chịu thuế", amount: taxableAllowances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0), taxable: true });
  }
  if (nonTaxableAllowances.length > 0) {
    breakdown.push({ type: "ALLOWANCE", label: "Trợ cấp không chịu thuế", amount: nonTaxableAllowances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0), taxable: false });
  }

  if (snapshot.attendanceBonus > 0) {
    breakdown.push({ type: "ATTENDANCE_BONUS", label: "Thưởng chấm công", amount: snapshot.attendanceBonus, taxable: true });
  }
  if (snapshot.kpiBonus > 0) {
    breakdown.push({ type: "KPI_BONUS", label: "Thưởng KPI", amount: snapshot.kpiBonus, taxable: true });
  }
  if (snapshot.otPay > 0) {
    breakdown.push({ type: "OVERTIME", label: "Làm thêm giờ", amount: snapshot.otPay, taxable: false });
  }

  return breakdown;
}

function buildDeductionBreakdown(snapshot: any, pitAmount: number): Array<{ type: string; label: string; amount: number }> {
  return [
    ...(snapshot.socialInsurance > 0 ? [{ type: "SOCIAL_INSURANCE", label: "BHXH (8%)", amount: snapshot.socialInsurance }] : []),
    ...(snapshot.healthInsurance > 0 ? [{ type: "HEALTH_INSURANCE", label: "BHYT (1.5%)", amount: snapshot.healthInsurance }] : []),
    ...(snapshot.unemploymentInsurance > 0 ? [{ type: "UNEMPLOYMENT_INSURANCE", label: "BHTN (1%)", amount: snapshot.unemploymentInsurance }] : []),
    ...(pitAmount > 0 ? [{ type: "PIT", label: "Thuế TNCN", amount: pitAmount }] : []),
  ];
}

interface Summary { planned: number; created: number; skipped: number; }
const summary = new Map<string, Summary>();
function mark(kind: string, result: 'planned' | 'created' | 'skipped') {
  const row = summary.get(kind) ?? { planned: 0, created: 0, skipped: 0 };
  row[result]++;
  summary.set(kind, row);
}

async function insertIfMissing<T extends mongoose.Model<any>>(
  model: T,
  query: Record<string, unknown>,
  doc: Record<string, unknown>,
  kind: string,
): Promise<mongoose.Types.ObjectId> {
  const exists = await model.exists(query);
  if (exists) { mark(kind, 'skipped'); return (exists as any)._id as mongoose.Types.ObjectId; }
  if (!APPLY) { mark(kind, 'planned'); return new mongoose.Types.ObjectId(); }
  const created = await model.create(doc);
  mark(kind, 'created');
  return (created as any)._id as mongoose.Types.ObjectId;
}

async function upsert(Model: mongoose.Model<any>, query: Record<string, unknown>, doc: Record<string, unknown>, kind: string) {
  if (!APPLY) { mark(kind, 'planned'); return new mongoose.Types.ObjectId(); }
  const existing = await Model.findOne(query).lean();
  if (existing) { mark(kind, 'skipped'); return (existing as any)._id as mongoose.Types.ObjectId; }
  const created = await Model.create(doc);
  mark(kind, 'created');
  return (created as any)._id as mongoose.Types.ObjectId;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const vnDateStr = (date: Date) => new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const addDays = (date: Date, count: number) => { const next = new Date(date); next.setUTCDate(next.getUTCDate() + count); return next; };
const workdaysInSeptember = () => {
  const days: string[] = [];
  const d = new Date(PERIOD_START);
  while (d <= PERIOD_END) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) days.push(isoDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
};

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) {
    console.error('[seed:full:org] MONGODB_URI is not configured.');
    process.exit(1);
  }

  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  await db.asPromise();

  for (const { name, schema } of SCHEMA_REGISTRY) {
    if (!db.models[name]) db.model(name, schema);
  }


  const Organization = db.model('Organization');
  const User = db.model('User');
  const Department = db.model('Department');
  const Position = db.model('Position');
  const Workplace = db.model('Workplace');
  const ShiftTemplate = db.model('ShiftTemplate');
  const EmployeeProfile = db.model('EmployeeProfile');
  const EmploymentContract = db.model('EmploymentContract');
  const EmploymentHistory = db.model('EmploymentHistory');
  const ManagerAssignment = db.model('ManagerAssignment');
  const Assignment = db.model('Assignment');
  const LaborPolicy = db.model('LaborCompliancePolicy');
  const OvertimePolicy = db.model('OvertimePayPolicy');
  const TaxPolicy = db.model('TaxPolicy');
  const InsurancePolicy = db.model('InsurancePolicy');
  const SalaryProfile = db.model('SalaryProfile');
  const OrganizationAllowance = db.model('OrganizationAllowance');
  const AllowanceCatalog = db.model('AllowanceCatalog');
  const AttendanceBonusTemplate = db.model('AttendanceBonusTemplate');
  const AttendanceBonusPolicy = db.model('AttendanceBonusPolicy');
  const KpiPayrollInput = db.model('KpiPayrollInput');
  const InsuranceProfile = db.model('InsuranceProfile');
  const CalendarException = db.model('CalendarException');
  const TimesheetPeriod = db.model('TimesheetPeriod');
  const AttendanceDay = db.model('AttendanceDay');
  const AttendanceEvent = db.model('AttendanceEvent');
  const LeaveRequest = db.model('LeaveRequest');
  const LeaveAction = db.model('LeaveAction');
  const EmployeeDayOverride = db.model('EmployeeDayOverride');
  const TimesheetSummary = db.model('TimesheetSummary');
  const PayrollInputSnapshot = db.model('PayrollInputSnapshot');
  const PayrollRun = db.model('PayrollRun');
  const Payslip = db.model("Payslip");
  const KpiPolicy = db.model("KpiPolicy");
  const EmployeeDocument = db.model("EmployeeDocument");
  const ManagerRequest = db.model("ManagerRequest");
  const OvertimeResult = db.model("OvertimeResult");
  const Evidence = db.model("Evidence");
  const ApprovalHistory = db.model("ApprovalHistory");

  // ── Organization ─────────────────────────────────────────────────────────
  const organizationId = await upsert(
    Organization,
    { code: ORG_CODE },
    { code: ORG_CODE, name: ORG_NAME, status: 'ACTIVE', timezone: 'Asia/Ho_Chi_Minh', evidenceRetentionDays: 90, payrollSeparationOfDuties: false },
    'Organization',
  );

  // ── Departments & Positions ──────────────────────────────────────────────
  const departmentData = [
    { code: 'ENG', name: 'Engineering' },
    { code: 'HR', name: 'Human Resources' },
  ];
  const deptIds = new Map<string, mongoose.Types.ObjectId>();
  for (const d of departmentData) {
    deptIds.set(d.code, await upsert(Department, { organizationId, code: d.code }, { organizationId, ...d, active: true }, 'Department'));
  }

  const positionData = [
    { code: 'CEO', name: 'Chief Executive Officer' },
    { code: 'HRBP', name: 'HR Business Partner' },
    { code: 'DLEAD', name: 'Engineering Lead' },
    { code: 'DEV', name: 'Software Developer' },
    { code: 'QA', name: 'QA Engineer' },
  ];
  const posIds = new Map<string, mongoose.Types.ObjectId>();
  for (const p of positionData) {
    posIds.set(p.code, await upsert(Position, { organizationId, code: p.code }, { organizationId, ...p, active: true }, 'Position'));
  }

  // ── Workplace & Shift ────────────────────────────────────────────────────
  const workplaceId = await upsert(
    Workplace,
    { organizationId, code: `${ORG_CODE}-HQ` },
    { organizationId, code: `${ORG_CODE}-HQ`, name: 'Flow Software HQ', type: 'IN_OFFICE', address: 'TP. Hồ Chí Minh', latitude: 10.7769, longitude: 106.7009, allowedRadiusMeters: 200, maximumAccuracyMeters: 100, active: true },
    'Workplace',
  );

  const shiftId = await upsert(
    ShiftTemplate,
    { organizationId, code: 'HC-0800' },
    { organizationId, code: 'HC-0800', name: 'Ca hành chính', scope: ShiftScope.ORGANIZATION, weekdays: [1, 2, 3, 4, 5], effectiveFrom: '2026-01-01', startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 10, active: true },
    'ShiftTemplate',
  );

  // ── Employees ─────────────────────────────────────────────────────────────
  const passwordHash = await hashPassword(password);

  interface EmpDef {
    email: string;
    fullName: string;
    employeeCode: string;
    role: string;
    departmentCode: string;
    positionCode: string;
    managerCode?: string;
    joinDate: string;
    activeDate?: string;
    gender: string;
    phone: string;
    baseSalary: number;
    contractType: string;
    contractStatus: string;
    dependentCount?: number;
  }

  const employees: EmpDef[] = [
    // C-level (CEO) — also a department manager for demo purposes
    { email: 'minh.le@flow.local', fullName: 'Lê Quang Minh', employeeCode: 'FLOW-CEO-001', role: Role.DEPARTMENT_MANAGER, departmentCode: 'ENG', positionCode: 'CEO', joinDate: '2024-01-02', activeDate: '2024-01-02', gender: Gender.MALE, phone: '0901000001', baseSalary: 60_000_000, contractType: ContractType.INDEFINITE_TERM, contractStatus: ContractStatus.ACTIVE },

    // HR department (1 HR only)
    { email: 'huong.nguyen@flow.local', fullName: 'Nguyễn Thị Hương', employeeCode: 'FLOW-HR-001', role: Role.HR, departmentCode: 'HR', positionCode: 'HRBP', joinDate: '2024-02-01', activeDate: '2024-05-01', gender: Gender.FEMALE, phone: '0901000002', baseSalary: 25_000_000, contractType: ContractType.INDEFINITE_TERM, contractStatus: ContractStatus.ACTIVE, dependentCount: 1 },

    // Engineering department (1 manager + 3 employees)
    { email: 'tuan.pham@flow.local', fullName: 'Phạm Anh Tuấn', employeeCode: 'FLOW-ENG-001', role: Role.DEPARTMENT_MANAGER, departmentCode: 'ENG', positionCode: 'DLEAD', managerCode: 'FLOW-CEO-001', joinDate: '2024-03-01', activeDate: '2024-06-01', gender: Gender.MALE, phone: '0901000003', baseSalary: 35_000_000, contractType: ContractType.FIXED_TERM, contractStatus: ContractStatus.ACTIVE, dependentCount: 2 },
    { email: 'linh.tran@flow.local', fullName: 'Trần Thị Linh', employeeCode: 'FLOW-ENG-002', role: Role.EMPLOYEE, departmentCode: 'ENG', positionCode: 'DEV', managerCode: 'FLOW-ENG-001', joinDate: '2025-08-01', gender: Gender.FEMALE, phone: '0901000004', baseSalary: 22_000_000, contractType: ContractType.PROBATION, contractStatus: ContractStatus.ACTIVE },
    { email: 'duc.pham@flow.local', fullName: 'Phạm Văn Đức', employeeCode: 'FLOW-ENG-003', role: Role.EMPLOYEE, departmentCode: 'ENG', positionCode: 'DEV', managerCode: 'FLOW-ENG-001', joinDate: '2025-01-13', activeDate: '2025-04-13', gender: Gender.MALE, phone: '0901000008', baseSalary: 24_000_000, contractType: ContractType.INDEFINITE_TERM, contractStatus: ContractStatus.ACTIVE, dependentCount: 1 },

    // Human Resources department (3 employees, no department manager)
    { email: 'son.hoang@flow.local', fullName: 'Hoàng Văn Sơn', employeeCode: 'FLOW-HR-002', role: Role.DEPARTMENT_MANAGER, departmentCode: 'HR', positionCode: 'HRBP', managerCode: 'FLOW-HR-001', joinDate: '2024-06-01', activeDate: '2024-09-01', gender: Gender.MALE, phone: '0901000005', baseSalary: 28_000_000, contractType: ContractType.INDEFINITE_TERM, contractStatus: ContractStatus.ACTIVE, dependentCount: 1 },
    { email: 'thuy.do@flow.local', fullName: 'Đỗ Thị Thúy', employeeCode: 'FLOW-HR-003', role: Role.EMPLOYEE, departmentCode: 'HR', positionCode: 'HRBP', managerCode: 'FLOW-HR-001', joinDate: '2025-04-01', activeDate: '2025-07-01', gender: Gender.FEMALE, phone: '0901000010', baseSalary: 19_000_000, contractType: ContractType.INDEFINITE_TERM, contractStatus: ContractStatus.ACTIVE },
    { email: 'hung.bui@flow.local', fullName: 'Bùi Đức Hùng', employeeCode: 'FLOW-HR-004', role: Role.EMPLOYEE, departmentCode: 'HR', positionCode: 'HRBP', managerCode: 'FLOW-HR-001', joinDate: '2025-05-05', activeDate: '2025-08-05', gender: Gender.MALE, phone: '0901000011', baseSalary: 17_000_000, contractType: ContractType.PROBATION, contractStatus: ContractStatus.ACTIVE },
  ];

  const userIds = new Map<string, mongoose.Types.ObjectId>();
  const profileIds = new Map<string, mongoose.Types.ObjectId>();

  for (const emp of employees) {
    const emailN = normalizeEmail(emp.email);
    const existingUser = await User.findOne({ organizationId, emailN }).lean();
    let userId: mongoose.Types.ObjectId;
    if (existingUser) {
      userId = (existingUser as any)._id as mongoose.Types.ObjectId;
      if (APPLY && (existingUser as any).role !== emp.role) {
        await User.findByIdAndUpdate(userId, { role: emp.role });
      }
      mark('User', 'skipped');
    } else if (!APPLY) {
      userId = new mongoose.Types.ObjectId();
      mark('User', 'planned');
    } else {
      const created = await User.create(userFields({
        organizationId,
        email: emp.email,
        fullName: emp.fullName,
        passwordHash,
        role: emp.role,
      } as any));
      userId = (created as any)._id;
      mark('User', 'created');
    }
    userIds.set(emp.employeeCode, userId);
  }

  for (const emp of employees) {
    const existingProfile = await EmployeeProfile.findOne({ organizationId, employeeCode: emp.employeeCode }).lean();
    const userId = userIds.get(emp.employeeCode)!;
    const departmentId = deptIds.get(emp.departmentCode);
    const positionId = posIds.get(emp.positionCode);
    const managerEmp = emp.managerCode ? employees.find(e => e.employeeCode === emp.managerCode) : undefined;
    const directManagerId = managerEmp ? userIds.get(managerEmp.employeeCode) : undefined;
    const joinDate = new Date(emp.joinDate);
    const activeDate = emp.activeDate ? new Date(emp.activeDate) : undefined;

    let profileId: mongoose.Types.ObjectId;
    if (existingProfile) {
      profileId = (existingProfile as any)._id as mongoose.Types.ObjectId;
      mark('EmployeeProfile', 'skipped');
    } else if (!APPLY) {
      profileId = new mongoose.Types.ObjectId();
      mark('EmployeeProfile', 'planned');
    } else {
      const profile = await EmployeeProfile.create({
        organizationId,
        userId,
        employeeCode: emp.employeeCode,
        employmentType: 'FULL_TIME',
        employmentStatus: activeDate ? EmploymentStatus.ACTIVE : EmploymentStatus.PROBATION,
        departmentId,
        positionId,
        directManagerId,
        workplaceId,
        joinDate,
        fullName: emp.fullName,
        email: emp.email,
        phone: emp.phone,
        gender: emp.gender,
        taxCode: '0123456789',
        bankAccount: '1234567890123',
        citizenId: '079123456789',
        socialInsuranceCode: '1234567890',
        dependents: Array.from({ length: emp.dependentCount ?? 0 }, (_, i) => ({
          fullName: `Người phụ thuộc ${i + 1} của ${emp.fullName.split(' ').pop()}`,
          relationship: 'CON',
          status: 'ACTIVE',
        })),
      });
      profileId = profile._id as mongoose.Types.ObjectId;
      mark('EmployeeProfile', 'created');
    }
    profileIds.set(emp.employeeCode, profileId);

    // Employment history for active employees
    if (activeDate) {
      await insertIfMissing(EmploymentHistory,
        { organizationId, employeeProfileId: profileId, newStatus: EmploymentStatus.ACTIVE },
        { organizationId, employeeProfileId: profileId, previousStatus: EmploymentStatus.PROBATION, newStatus: EmploymentStatus.ACTIVE, effectiveDate: activeDate, reason: 'Hoàn thành thử việc (seed)', changedBy: userId },
        'EmploymentHistory',
      );
    }

    // Contract
    await insertIfMissing(
      EmploymentContract,
      { organizationId, employeeProfileId: profileId },
      {
        organizationId,
        employeeProfileId: profileId,
        contractType: emp.contractType,
        status: emp.contractStatus,
        effectiveDate: joinDate,
        expiryDate: emp.contractType === ContractType.INDEFINITE_TERM ? undefined : addDays(joinDate, 365),
        note: 'Hợp đồng demo được tạo tự động',
      },
      'EmploymentContract',
    );
  }

  // ── Manager assignments for department managers ──────────────────────────
  const managerAssignments = [
    { empCode: 'FLOW-CEO-001', deptCode: 'ENG' },
    { empCode: 'FLOW-ENG-001', deptCode: 'ENG' },
  ];
  for (const ma of managerAssignments) {
    await insertIfMissing(
      ManagerAssignment,
      { organizationId, managerUserId: userIds.get(ma.empCode), departmentId: deptIds.get(ma.deptCode) },
      { organizationId, managerUserId: userIds.get(ma.empCode), departmentId: deptIds.get(ma.deptCode), effectiveFrom: new Date('2024-01-02'), active: true, createdBy: userIds.get('FLOW-HR-001') },
      'ManagerAssignment',
    );
  }

  // ── Employee assignments ─────────────────────────────────────────────────
  for (const emp of employees) {
    await insertIfMissing(
      Assignment,
      { organizationId, userId: userIds.get(emp.employeeCode) },
      { organizationId, userId: userIds.get(emp.employeeCode), departmentId: deptIds.get(emp.departmentCode), workplaceId, shiftTemplateId: shiftId, effectiveFrom: '2026-01-01', active: true },
      'EmployeeAssignment',
    );
  }

  // ── Allowance catalog ─────────────────────────────────────────────────────
  const allowanceCatalog = [
    { code: 'MEAL', defaultName: 'Phụ cấp ăn trưa', description: 'Hỗ trợ chi phí ăn trưa', defaultTaxable: false, defaultInsuranceBased: false },
    { code: 'FUEL', defaultName: 'Phụ cấp xăng xe', description: 'Hỗ trợ chi phí đi lại', defaultTaxable: false, defaultInsuranceBased: false },
    { code: 'PHONE', defaultName: 'Phụ cấp điện thoại', description: 'Hỗ trợ cước viễn thông', defaultTaxable: true, defaultInsuranceBased: false },
    { code: 'ACCIDENT', defaultName: 'Phụ cấp tai nạn lao động', description: 'Bảo hiểm tai nạn lao động', defaultTaxable: false, defaultInsuranceBased: false },
    { code: 'MATERNITY', defaultName: 'Phụ cấp thai sản', description: 'Hỗ trợ thai sản', defaultTaxable: false, defaultInsuranceBased: false },
    { code: 'RECOVERY', defaultName: 'Phụ cấp dưỡng sức', description: 'Hỗ trợ dưỡng sức sau ốm/thai sản', defaultTaxable: false, defaultInsuranceBased: false },
  ];
  const catalogIds = new Map<string, mongoose.Types.ObjectId>();
  for (const item of allowanceCatalog) {
    catalogIds.set(item.code, await upsert(AllowanceCatalog, { code: item.code }, { ...item, active: true }, 'AllowanceCatalog'));
  }

  // ── Organization allowances ─────────────────────────────────────────────
  const orgAllowances = [
    { code: 'MEAL', name: 'Phụ cấp ăn trưa', amount: 650_000, taxable: false, insuranceBased: false, prorated: true },
    { code: 'FUEL', name: 'Phụ cấp xăng xe', amount: 500_000, taxable: false, insuranceBased: false, prorated: false },
    { code: 'PHONE', name: 'Phụ cấp điện thoại', amount: 300_000, taxable: true, insuranceBased: false, prorated: false },
    { code: 'ACCIDENT', name: 'Phụ cấp tai nạn lao động', amount: 200_000, taxable: false, insuranceBased: false, prorated: false },
    { code: 'MATERNITY', name: 'Phụ cấp thai sản', amount: 500_000, taxable: false, insuranceBased: false, prorated: false },
    { code: 'RECOVERY', name: 'Phụ cấp dưỡng sức', amount: 300_000, taxable: false, insuranceBased: false, prorated: false },
  ];
  const orgAllowanceIds = new Map<string, mongoose.Types.ObjectId>();
  for (const a of orgAllowances) {
    orgAllowanceIds.set(a.code, await upsert(OrganizationAllowance, { organizationId, code: a.code }, { organizationId, catalogId: catalogIds.get(a.code), ...a, effectiveFrom: new Date('2026-01-01'), version: 1, active: true }, 'OrganizationAllowance'));
  }

  // ── Bonus template & policy ─────────────────────────────────────────────
  const bonusTemplateId = await upsert(
    AttendanceBonusTemplate,
    { code: 'ATTENDANCE_100_70_50' },
    { code: 'ATTENDANCE_100_70_50', name: 'Chuyên cần 100/70/50', tiers: [
      { order: 1, percentage: 100, conditions: [{ metric: 'LATE_COUNT', operator: 'EQ', value: 0 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
      { order: 2, percentage: 70, conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 2 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
      { order: 3, percentage: 50, conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 4 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
    ], templateVersion: 1, active: true },
    'AttendanceBonusTemplate',
  );

  const bonusPolicyId = await upsert(
    AttendanceBonusPolicy,
    { organizationId, name: 'Chuyên cần Flow Software 2026' },
    { organizationId, templateId: bonusTemplateId, name: 'Chuyên cần Flow Software 2026', calculationBase: 'FIXED_AMOUNT', bonusAmount: 800_000, tiers: [
      { order: 1, percentage: 100, conditions: [{ metric: 'LATE_COUNT', operator: 'EQ', value: 0 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
      { order: 2, percentage: 70, conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 2 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
      { order: 3, percentage: 50, conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 4 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }] },
    ], conditions: [], effectiveFrom: new Date('2026-01-01'), version: 1, active: true },
    'AttendanceBonusPolicy',
  );

  // ── KPI Policy ───────────────────────────────────────────────────────────
  const kpiPolicyId = await upsert(
    KpiPolicy,
    { organizationId, name: 'Chính sách KPI Flow Software 2026' },
    {
      organizationId,
      name: 'Chính sách KPI Flow Software 2026',
      policyType: 'GRADE',
      baseAmount: 1_000_000,
      tiers: [
        { name: 'Xuất sắc', percentage: 120, minScore: 90, maxScore: 100, order: 1 },
        { name: 'Tốt', percentage: 100, minScore: 80, maxScore: 89, order: 2 },
        { name: 'Đạt', percentage: 80, minScore: 60, maxScore: 79, order: 3 },
        { name: 'Chưa đạt', percentage: 50, minScore: 0, maxScore: 59, order: 4 },
      ],
      effectiveFrom: new Date('2026-01-01'),
      version: 1,
      active: true,
    },
    'KpiPolicy',
  );

  // ── Policies ──────────────────────────────────────────────────────────────
  await upsert(LaborPolicy, { organizationId, version: 1 }, { organizationId, effectiveFrom: new Date('2026-01-01'), normalDailyMinutes: 480, normalWeeklyMinutes: 2880, maxCombinedDailyMinutes: 720, maxMonthlyOvertimeMinutes: 2400, maxAnnualOvertimeMinutes: 20000, exceptionalAnnualOvertimeMinutes: 24000, warningThresholdPercent: 80, maxRetroactiveFilingDays: 7, probationMinimumRate: 0.85, legalReference: 'BLLĐ 45/2019/QH14', version: 1, active: true }, 'LaborCompliancePolicy');

  await upsert(OvertimePolicy, { organizationId, version: 1 }, { organizationId, effectiveFrom: new Date('2026-01-01'), workingDayRate: 1.5, weeklyOffRate: 2.0, publicHolidayRate: 3.0, legalReference: 'BLLĐ 45/2019/QH14', version: 1, active: true }, 'OvertimePayPolicy');

  await upsert(TaxPolicy, { organizationId, version: 2 }, { organizationId, effectiveFrom: new Date('2026-01-01'), personalDeduction: 15_500_000, dependentDeduction: 6_200_000, progressiveBrackets: [
    { upperLimit: 10_000_000, rate: 5 },
    { upperLimit: 30_000_000, rate: 10 },
    { upperLimit: 60_000_000, rate: 20 },
    { upperLimit: 100_000_000, rate: 30 },
    { upperLimit: Infinity, rate: 35 },
  ], roundingRule: 'ROUND_HALF_UP_TO_VND', legalReference: 'Luật Thuế TNCN 200/QH12; Nghị định 126/2023/NĐ-CP', version: 2, active: true }, 'TaxPolicy');

  const insurancePolicyId = await upsert(
    InsurancePolicy,
    { organizationId, version: 1 },
    { organizationId, effectiveFrom: new Date('2026-01-01'), version: 1, legalReference: 'Luật BHXH 58/2014/QH13', socialInsuranceEmployeeRate: 0.08, healthInsuranceEmployeeRate: 0.015, unemploymentInsuranceEmployeeRate: 0.01, salaryBaseRules: [
      { type: InsuranceContributionType.SOCIAL_INSURANCE, floorAmount: null },
      { type: InsuranceContributionType.HEALTH_INSURANCE, floorAmount: null },
      { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, floorAmount: null },
    ], capRules: [
      { type: InsuranceContributionType.SOCIAL_INSURANCE, capAmount: 52_200_000 },
      { type: InsuranceContributionType.HEALTH_INSURANCE, capAmount: 52_200_000 },
      { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, capAmount: 52_200_000 },
    ], employerContributionRates: [
      { type: InsuranceContributionType.SOCIAL_INSURANCE, rate: 0.175 },
      { type: InsuranceContributionType.HEALTH_INSURANCE, rate: 0 },
      { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, rate: 0.01 },
    ] },
    'InsurancePolicy',
  );

  // ── Salary profiles, KPI, insurance profiles ─────────────────────────────
  // Per-employee allowance amounts (PHONE allowance varies by employee)
  const personalAllowancesAmounts: Record<string, number> = {
    'FLOW-CEO-001': 2_000_000,
    'FLOW-HR-001': 1_500_000,
    'FLOW-HR-002': 1_500_000,
    'FLOW-HR-003': 1_000_000,
    'FLOW-HR-004': 800_000,
    'FLOW-ENG-001': 1_800_000,
    'FLOW-ENG-002': 1_200_000,
    'FLOW-ENG-003': 1_000_000,
  };

  for (const emp of employees) {
    const profileId = profileIds.get(emp.employeeCode)!;
    const isProbation = !emp.activeDate;
    const baseSalary = emp.baseSalary;
    // PHONE (taxable) + FUEL (non-taxable) per employee; MEAL is org-wide and prorated
    const personalAllowances = [
      { allowanceId: catalogIds.get('PHONE')!, amount: personalAllowancesAmounts[emp.employeeCode] || 300_000 },
      { allowanceId: catalogIds.get('FUEL')!, amount: 300_000 },
    ];
    await insertIfMissing(
      SalaryProfile,
      { organizationId, employeeProfileId: profileId, effectiveFrom: new Date('2026-09-01') },
      { organizationId, employeeProfileId: profileId, effectiveFrom: new Date('2026-09-01'), baseSalary, insuranceSalary: Math.round(baseSalary * 0.8), organizationAllowanceIds: Array.from(orgAllowanceIds.values()), allowances: personalAllowances, attendanceBonusPolicyId: bonusPolicyId, currency: 'VND', roundingRule: 'ROUND_HALF_UP_TO_VND', version: 1, active: true, ...(isProbation ? { probationJobSalary: baseSalary, probationAgreedSalary: Math.ceil(baseSalary * 0.85), probationRate: 0.85 } : {}) },
      'SalaryProfile',
    );

    // KPI input: derive tier from score to match policy
    const kpiScore = isProbation ? 75 : 90;
    const kpiTier = kpiScore >= 90 ? { name: 'Xuất sắc', percentage: 120 }
      : kpiScore >= 80 ? { name: 'Tốt', percentage: 100 }
      : kpiScore >= 60 ? { name: 'Đạt', percentage: 80 }
      : { name: 'Chưa đạt', percentage: 50 };
    const kpiAmount = Math.round(1_000_000 * (kpiTier.percentage / 100));

    await insertIfMissing(
      KpiPayrollInput,
      { organizationId, employeeProfileId: profileId, period: PERIOD },
      { organizationId, employeeProfileId: profileId, departmentId: deptIds.get(emp.departmentCode), policyId: kpiPolicyId, period: PERIOD, amount: kpiAmount, score: kpiScore, tierName: kpiTier.name, tierPercentage: kpiTier.percentage, baseAmount: 1_000_000, source: 'MANUAL', note: 'Dữ liệu demo KPI', status: isProbation ? 'DRAFT' : 'CONFIRMED', version: 1 },
      'KpiPayrollInput',
    );

    await insertIfMissing(
      InsuranceProfile,
      { organizationId, employeeId: profileId },
      { organizationId, employeeId: profileId, effectiveFrom: new Date('2026-01-01'), participatesSocialInsurance: true, participatesHealthInsurance: true, participatesUnemploymentInsurance: true, version: 1, createdBy: userIds.get('FLOW-HR-001') },
      'InsuranceProfile',
    );

    // Employee documents (contract scan + ID scan for each employee)
    await insertIfMissing(
      EmployeeDocument,
      { organizationId, employeeProfileId: profileId, originalName: 'ContractScan.pdf' },
      {
        organizationId,
        employeeProfileId: profileId,
        contractId: undefined,
        originalName: 'ContractScan.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 128_000,
        storageKey: `${organizationId}/${emp.employeeCode}-contract.pdf`,
        uploadedBy: userIds.get('FLOW-HR-001')!,
      },
      'EmployeeDocument',
    );
  }

  // ── Calendar exceptions ──────────────────────────────────────────────────
  await insertIfMissing(CalendarException, { organizationId, date: '2026-09-02' }, { organizationId, date: '2026-09-02', type: CalendarExceptionType.PUBLIC_HOLIDAY, name: 'Quốc khánh nội bộ Flow', createdBy: userIds.get('FLOW-HR-001') }, 'CalendarException');
  await insertIfMissing(CalendarException, { organizationId, date: '2026-09-13' }, { organizationId, date: '2026-09-13', type: CalendarExceptionType.SPECIAL_WORKING_DAY, name: 'Ngày làm bù', createdBy: userIds.get('FLOW-HR-001') }, 'CalendarException');

  // ── Timesheet period (seeded as CLOSED so the seeded payroll run is consistent) ──
  const timesheetPeriodId = await upsert(
    TimesheetPeriod,
    { organizationId, period: PERIOD },
    {
      organizationId,
      period: PERIOD,
      status: 'CLOSED',
      version: 1,
      startDate: PERIOD_START,
      endDate: PERIOD_END,
      active: true,
      closedBy: userIds.get('FLOW-HR-001'),
      closedAt: new Date('2026-09-25T08:00:00.000Z'),
      managerSnapshotClosed: true,
      managerSnapshotClosedBy: userIds.get('FLOW-HR-001'),
      managerSnapshotClosedAt: new Date('2026-09-25T08:00:00.000Z'),
      departmentSnapshots: [
        { departmentId: deptIds.get('ENG')!, managerUserId: userIds.get('FLOW-ENG-001')!, closedAt: new Date('2026-09-24T17:00:00.000Z') },
        { departmentId: deptIds.get('HR')!, managerUserId: userIds.get('FLOW-HR-001')!, closedAt: new Date('2026-09-24T17:00:00.000Z') },
      ],
    },
    'TimesheetPeriod',
  );

  // ── Attendance days & events ─────────────────────────────────────────────
  const workdays = workdaysInSeptember();
  for (const emp of employees) {
    const userId = userIds.get(emp.employeeCode)!;
    for (const date of workdays) {
      const existing = await AttendanceDay.findOne({ organizationId, employeeId: userId, workDate: date }).lean();
      if (existing) { mark('AttendanceDay', 'skipped'); continue; }
      if (!APPLY) { mark('AttendanceDay', 'planned'); continue; }

      const checkInAt = new Date(`${date}T01:05:00.000Z`); // 08:05 VN
      const checkOutAt = new Date(`${date}T10:10:00.000Z`); // 17:10 VN
      const workingMinutes = (checkOutAt.getTime() - checkInAt.getTime()) / 60000 - 60;

      const day = await AttendanceDay.create({
        organizationId,
        employeeId: userId,
        periodId: timesheetPeriodId,
        workDate: date,
        workMode: WorkMode.IN_OFFICE,
        workdayType: WorkdayType.WORKING_DAY,
        dayResult: 'PRESENT',
        attendanceStatus: AttendanceStatus.COMPLETED,
        overallApprovalStatus: 'NOT_REQUIRED',
        checkInAt,
        checkOutAt,
        workingMinutes: Math.round(workingMinutes),
        lateMinutes: 5,
        earlyMinutes: 0,
        shiftSnapshot: { shiftTemplateId: shiftId, shiftName: 'Ca hành chính', startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 10 },
        workplaceSnapshot: { workplaceId, workplaceName: 'Flow Software HQ', workplaceType: 'IN_OFFICE', address: 'TP. Hồ Chí Minh' },
        employeeSnapshot: { employeeCode: emp.employeeCode, fullName: emp.fullName, departmentId: deptIds.get(emp.departmentCode)?.toString() },
      });
      mark('AttendanceDay', 'created');

      await AttendanceEvent.create({
        organizationId,
        attendanceDayId: day._id,
        employeeId: userId,
        eventType: AttendanceEventType.CHECK_IN,
        method: AttendanceMethod.NETWORK,
        recordedAt: checkInAt,
        publicIp: '127.0.0.1',
        validationStatus: 'VALID',
        approvalStatus: 'NOT_REQUIRED',
        isFallback: false,
      });
      await AttendanceEvent.create({
        organizationId,
        attendanceDayId: day._id,
        employeeId: userId,
        eventType: AttendanceEventType.CHECK_OUT,
        method: AttendanceMethod.NETWORK,
        recordedAt: checkOutAt,
        publicIp: '127.0.0.1',
        validationStatus: 'VALID',
        approvalStatus: 'NOT_REQUIRED',
        isFallback: false,
      });
      mark('AttendanceEvent', 'created');
      mark('AttendanceEvent', 'created');
    }
  }

  // ── Leave request & override for one employee ───────────────────────────
  const leaveUser = userIds.get('FLOW-ENG-001')!;
  const leaveProfile = await EmployeeProfile.findOne({ organizationId, userId: leaveUser }).lean();
  const leaveDeptId = deptIds.get('ENG')!;
  const leaveStart = '2026-09-16';
  const leaveEnd = '2026-09-17';
  let leaveReqId: mongoose.Types.ObjectId;
  if (APPLY) {
    const leaveReq = await LeaveRequest.findOneAndUpdate(
      { organizationId, employeeId: leaveUser, startDate: leaveStart, endDate: leaveEnd },
      { $setOnInsert: { organizationId, employeeId: leaveUser, departmentId: leaveDeptId, startDate: leaveStart, endDate: leaveEnd, leaveType: LeaveType.PAID_LEAVE, reason: 'Nghỉ phép gia đình', status: LeaveRequestStatus.APPROVED, reviewedBy: userIds.get('FLOW-HR-001'), reviewedAt: new Date(), reviewComment: 'Dữ liệu demo' } },
      { upsert: true, new: true },
    ).lean();
    leaveReqId = (leaveReq as any)?._id as mongoose.Types.ObjectId;
    const wasNew = (leaveReq as any)?.__v === 0;
    mark('LeaveRequest', wasNew ? 'created' : 'skipped');
  } else {
    leaveReqId = new mongoose.Types.ObjectId();
    mark('LeaveRequest', 'planned');
  }

  await insertIfMissing(LeaveAction, { organizationId, leaveRequestId: leaveReqId, action: 'APPROVE' }, { organizationId, leaveRequestId: leaveReqId, actorId: userIds.get('FLOW-HR-001'), action: 'APPROVE', previousStatus: LeaveRequestStatus.PENDING_MANAGER, newStatus: LeaveRequestStatus.APPROVED, comment: 'Dữ liệu demo' }, 'LeaveAction');

  for (const date of [leaveStart, leaveEnd]) {
    await insertIfMissing(EmployeeDayOverride, { organizationId, employeeId: leaveUser, date }, { organizationId, employeeId: leaveUser, date, type: LeaveType.PAID_LEAVE, leaveRequestId: leaveReqId, reason: 'Nghỉ phép gia đình', createdBy: userIds.get('FLOW-HR-001') }, 'EmployeeDayOverride');
  }

  // ── Manager requests: overtime request + result ─────────────────────────────
  const otEmployee = employees.find(e => e.employeeCode === 'FLOW-ENG-001')!;
  const otUserId = userIds.get(otEmployee.employeeCode)!;
  const otProfileId = profileIds.get(otEmployee.employeeCode)!;
  const otWorkDateStr = '2026-09-10';
  const otWorkDate = new Date(otWorkDateStr);
  const otRequestId = await insertIfMissing(
    ManagerRequest,
    { organizationId, employeeUserId: otUserId, workDate: otWorkDate, type: 'OVERTIME' },
    {
      organizationId,
      employeeId: otProfileId,
      employeeUserId: otUserId,
      departmentId: deptIds.get('ENG'),
      type: 'OVERTIME',
      workDate: otWorkDate,
      requestedStart: new Date('2026-09-10T10:00:00.000Z'), // 17:00 VN
      requestedEnd: new Date('2026-09-10T13:00:00.000Z'),   // 20:00 VN
      reason: 'Làm thêm demo tăng ca',
      status: 'APPROVED',
      reviewedBy: userIds.get('FLOW-HR-001'),
      reviewedAt: new Date(),
      reviewComment: 'Dữ liệu demo OT',
      workDescription: 'Hoàn thành công việc demo',
      isRetroactive: false,
    },
    'ManagerRequest',
  );

  await insertIfMissing(
    OvertimeResult,
    { organizationId, overtimeRequestId: otRequestId },
    {
      organizationId,
      overtimeRequestId: otRequestId,
      attendanceDayId: undefined,
      employeeId: otUserId,
      departmentId: deptIds.get('ENG'),
      workDate: otWorkDateStr,
      periodKey: PERIOD,
      yearKey: '2026',
      overtimeType: 'OT_WORKING_DAY',
      classificationStatus: 'FINAL',
      requestedMinutes: 180,
      approvedMinutes: 180,
      actualMinutes: 180,
      eligibleMinutes: 180,
      scheduledMinutes: 480,
      policyVersion: 1,
      legalReference: 'BLLĐ 45/2019/QH14',
      inputHash: crypto.createHash('md5').update(`${otRequestId}-${otWorkDateStr}`).digest('hex').slice(0, 16),
      calculatedAt: new Date(),
    },
    'OvertimeResult',
  );

  // ── Timesheet summaries ──────────────────────────────────────────────────
  const totalDaysInPeriod = 30;
  for (const emp of employees) {
    const userId = userIds.get(emp.employeeCode)!;
    const profileId = profileIds.get(emp.employeeCode)!;
    const departmentId = deptIds.get(emp.departmentCode)!;
    const workMinutes = workdays.length * 480;
    const sourceHash = crypto.createHash('md5').update(`${emp.employeeCode}-${PERIOD}`).digest('hex').slice(0, 16);
    // OT for FLOW-ENG-001 only (matches OvertimeResult above)
    const otMinutes = emp.employeeCode === 'FLOW-ENG-001' ? 180 : 0;
    const paidLeaveDays = emp.employeeCode === 'FLOW-ENG-001' ? 2 : 0;
    const presentDays = workdays.length - paidLeaveDays;
    const totalWorkingMinutes = presentDays * 480;
    const summaryDoc = await insertIfMissing(
      TimesheetSummary,
      { periodId: timesheetPeriodId, employeeProfileId: profileId },
      {
        periodId: timesheetPeriodId,
        employeeProfileId: profileId,
        userId,
        organizationId,
        departmentId,
        departmentName: departmentData.find(d => d.code === emp.departmentCode)?.name,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        periodKey: PERIOD,
        totalDays: totalDaysInPeriod,
        workingDays: workdays.length,
        paidLeaveDays,
        unpaidLeaveDays: 0,
        holidayDays: 1,
        absentDays: 0,
        presentDays,
        incompleteDays: 0,
        totalWorkingMinutes,
        totalLateMinutes: presentDays * 5,
        totalEarlyMinutes: 0,
        otWorkingDayMinutes: otMinutes,
        otWeeklyOffMinutes: 0,
        otPublicHolidayMinutes: 0,
        totalOvertimeMinutes: otMinutes,
        sickLeaveDays: 0,
        personalLeaveDays: 0,
        annualLeaveDays: 0,
        otherPaidLeaveDays: paidLeaveDays,
        otherUnpaidLeaveDays: 0,
        sourceHash,
        version: 1,
        generatedAt: new Date(),
      },
      'TimesheetSummary',
    );
  }

  // ── Payroll input snapshots ──────────────────────────────────────────────
  const insurancePolicy = await InsurancePolicy.findById(insurancePolicyId).lean();
  const maxContributionBase = 52_200_000;
  for (const emp of employees) {
    const profileId = profileIds.get(emp.employeeCode)!;
    const userId = userIds.get(emp.employeeCode)!;
    const salaryProfile = await SalaryProfile.findOne({ organizationId, employeeProfileId: profileId }).lean();
    const monthlyBaseSalary = (salaryProfile as any)?.baseSalary ?? emp.baseSalary;
    const insuranceSalary = (salaryProfile as any)?.insuranceSalary ?? Math.round(monthlyBaseSalary * 0.8);

    // Determine present days from summary (FLOW-ENG-001 has 2 paid leave days)
    const paidLeaveDays = emp.employeeCode === 'FLOW-ENG-001' ? 2 : 0;
    const presentDays = workdays.length - paidLeaveDays;
    const proratedBaseSalary = Math.round((monthlyBaseSalary / totalDaysInPeriod) * presentDays);

    // Insurance contribution base: insuranceSalary capped at maxContributionBase
    const contributionBase = Math.min(insuranceSalary, maxContributionBase);
    const socialInsurance = Math.round(contributionBase * 0.08);
    const healthInsurance = Math.round(contributionBase * 0.015);
    const unemploymentInsurance = Math.round(contributionBase * 0.01);
    const totalInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

    // Allowances from salary profile + org-wide MEAL allowance
    const mealAllowance = 650_000;
    const phoneAllowance = ((salaryProfile as any)?.allowances || []).find((a: any) => {
      const code = orgAllowances.find(o => (orgAllowanceIds.get(o.code)?.toString() === (a.allowanceId?.toString?.() || a.allowanceId)))?.code;
      return code === 'PHONE';
    })?.amount || 300_000;
    const fuelAllowance = ((salaryProfile as any)?.allowances || []).find((a: any) => {
      const code = orgAllowances.find(o => (orgAllowanceIds.get(o.code)?.toString() === (a.allowanceId?.toString?.() || a.allowanceId)))?.code;
      return code === 'FUEL';
    })?.amount || 300_000;

    const allowanceBreakdown = [
      { type: 'MEAL', label: 'Phụ cấp ăn trưa', amount: mealAllowance, taxable: false },
      { type: 'FUEL', label: 'Phụ cấp xăng xe', amount: fuelAllowance, taxable: false },
      { type: 'PHONE', label: 'Phụ cấp điện thoại', amount: phoneAllowance, taxable: true },
    ];
    const totalAllowances = allowanceBreakdown.reduce((sum, a) => sum + a.amount, 0);
    const nonTaxableAllowances = allowanceBreakdown.filter(a => !a.taxable).reduce((sum, a) => sum + a.amount, 0);

    // Attendance bonus: everyone has 5 min late each day, so no one gets 100%; give 70% for demo
    const attendanceBonus = 560_000; // 70% of 800_000

    // KPI bonus from confirmed KPI input
    const kpiInput = await KpiPayrollInput.findOne({ organizationId, employeeProfileId: profileId, period: PERIOD }).lean();
    const kpiBonus = (kpiInput as any)?.status === 'CONFIRMED' ? (kpiInput as any).amount || 0 : 0;

    // OT pay for FLOW-ENG-001 (180 minutes on working day)
    const otMinutes = emp.employeeCode === 'FLOW-ENG-001' ? 180 : 0;
    const hourlyRate = monthlyBaseSalary / (26 * 8);
    // Working day OT: coefficient 1.5 => 1.0 non-taxable + 0.5 taxable premium
    const otNonTaxableEarnings = otMinutes > 0 ? Math.round((otMinutes / 60) * hourlyRate * 1.0) : 0;
    const otTaxableEarnings = otMinutes > 0 ? Math.round((otMinutes / 60) * hourlyRate * 0.5) : 0;
    const otPay = otNonTaxableEarnings + otTaxableEarnings;

    const profile = await EmployeeProfile.findById(profileId).lean();
    const activeDependents = ((profile as any)?.dependents || []).filter((d: any) => d.status === 'ACTIVE').length;
    const dependentDeduction = activeDependents * 6_200_000;
    const grossEarnings = proratedBaseSalary + totalAllowances + attendanceBonus + kpiBonus + otPay;
    const taxableEarnings = Math.max(0, grossEarnings - nonTaxableAllowances - otNonTaxableEarnings - totalInsurance - 15_500_000 - dependentDeduction);

    await insertIfMissing(
      PayrollInputSnapshot,
      { periodId: timesheetPeriodId, employeeProfileId: profileId },
      {
        periodId: timesheetPeriodId,
        employeeProfileId: profileId,
        userId,
        organizationId,
        departmentId: deptIds.get(emp.departmentCode),
        periodKey: PERIOD,
        monthlyBaseSalary,
        proratedBaseSalary,
        totalAllowances,
        attendanceBonus,
        kpiBonus,
        otMinutesByType: { otWorkingDayMinutes: otMinutes, otWeeklyOffMinutes: 0, otPublicHolidayMinutes: 0, totalOvertimeMinutes: otMinutes },
        otPay,
        otNonTaxableEarnings,
        otTaxableEarnings,
        nonTaxableAllowances,
        allowanceBreakdown,
        socialInsuranceRate: 0.08,
        healthInsuranceRate: 0.015,
        unemploymentInsuranceRate: 0.01,
        contributionBase,
        socialInsurance,
        healthInsurance,
        unemploymentInsurance,
        taxableEarnings,
        totalDependentDeductions: dependentDeduction,
        dependentCount: activeDependents,
        taxPolicyVersion: 2,
        legalReference: 'Luật Thuế TNCN 200/QH12; Nghị định 126/2023/NĐ-CP',
        status: 'GENERATED',
        sourceHash: crypto.createHash('md5').update(`${profileId}-${PERIOD}`).digest('hex').slice(0, 16),
        version: 1,
        generatedAt: new Date(),
      },
      'PayrollInputSnapshot',
    );
  }

  // ── Payroll run & payslips ───────────────────────────────────────────────
  // Compute totals from snapshots before creating the payroll run.
  let totalGross = 0;
  let totalNet = 0;
  let totalEmployerCost = 0;
  const payslipDocs: Array<{ profileId: mongoose.Types.ObjectId; grossEarnings: number; netSalary: number; employerCost: number }> = [];

  for (const emp of employees) {
    const profileId = profileIds.get(emp.employeeCode)!;
    const snapshot = await PayrollInputSnapshot.findOne({ periodId: timesheetPeriodId, employeeProfileId: profileId }).lean();
    if (!snapshot) continue;

    const proratedBaseSalary = (snapshot as any).proratedBaseSalary || 0;
    const totalAllowances = (snapshot as any).totalAllowances || 0;
    const attendanceBonus = (snapshot as any).attendanceBonus || 0;
    const kpiBonus = (snapshot as any).kpiBonus || 0;
    const otPay = (snapshot as any).otPay || 0;
    const grossEarnings = proratedBaseSalary + totalAllowances + attendanceBonus + kpiBonus + otPay;
    const totalInsurance =
      ((snapshot as any).socialInsurance || 0) +
      ((snapshot as any).healthInsurance || 0) +
      ((snapshot as any).unemploymentInsurance || 0);

    const pitResult = await computePit(grossEarnings, totalInsurance, profileId, organizationId, snapshot as any);
    const netSalary = grossEarnings - totalInsurance - pitResult.pitAmount;

    // Employer cost: employee insurance + employer contributions (BHXH 17.5%, BHTN 1%)
    const contributionBase = (snapshot as any).contributionBase || 0;
    const employerInsurance = Math.round(contributionBase * 0.175) + Math.round(contributionBase * 0.01);
    const employerCost = grossEarnings + employerInsurance;

    payslipDocs.push({ profileId, grossEarnings, netSalary, employerCost });
    totalGross += grossEarnings;
    totalNet += netSalary;
    totalEmployerCost += employerCost;
  }

  const payrollRunId = await upsert(
    PayrollRun,
    { organizationId, timesheetPeriodId },
    {
      organizationId,
      timesheetPeriodId,
      periodLabel: '09/2026',
      status: 'RELEASED',
      runDate: new Date('2026-09-25T09:00:00.000Z'),
      totalGross,
      totalNet,
      totalEmployerCost,
      processedEmployeeCount: employees.length,
      totalEmployeeCount: employees.length,
      notes: 'Bảng lương demo tháng 09/2026',
      version: 4,
      active: true,
    },
    'PayrollRun',
  );

  for (const emp of employees) {
    const profileId = profileIds.get(emp.employeeCode)!;
    const snapshot = await PayrollInputSnapshot.findOne({ periodId: timesheetPeriodId, employeeProfileId: profileId }).lean();
    if (!snapshot) continue;

    const proratedBaseSalary = (snapshot as any).proratedBaseSalary || 0;
    const totalAllowances = (snapshot as any).totalAllowances || 0;
    const attendanceBonus = (snapshot as any).attendanceBonus || 0;
    const kpiBonus = (snapshot as any).kpiBonus || 0;
    const otPay = (snapshot as any).otPay || 0;
    const grossEarnings = proratedBaseSalary + totalAllowances + attendanceBonus + kpiBonus + otPay;
    const totalInsurance =
      ((snapshot as any).socialInsurance || 0) +
      ((snapshot as any).healthInsurance || 0) +
      ((snapshot as any).unemploymentInsurance || 0);

    const pitResult = await computePit(grossEarnings, totalInsurance, profileId, organizationId, snapshot as any);
    const netSalary = grossEarnings - totalInsurance - pitResult.pitAmount;

    // OT breakdown for payslip
    const otBreakdown = (snapshot as any).otPay > 0 ? {
      totalMinutes: (snapshot as any).otMinutesByType?.totalOvertimeMinutes || 0,
      workingDayMinutes: (snapshot as any).otMinutesByType?.otWorkingDayMinutes || 0,
      weeklyOffMinutes: 0,
      publicHolidayMinutes: 0,
      hourlyRate: Math.round(((snapshot as any).monthlyBaseSalary || 0) / (26 * 8)),
      otNonTaxable: (snapshot as any).otNonTaxableEarnings || 0,
      otTaxable: (snapshot as any).otTaxableEarnings || 0,
      otPay: (snapshot as any).otPay || 0,
      breakdown: [
        { type: 'WORKING_DAY', minutes: (snapshot as any).otMinutesByType?.otWorkingDayMinutes || 0, coefficient: 1.5, amount: (snapshot as any).otPay || 0, taxable: false },
      ],
    } : undefined;

    await insertIfMissing(
      Payslip,
      { payrollRunId, employeeProfileId: profileId },
      {
        payrollRunId,
        organizationId,
        employeeProfileId: profileId,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        taxCode: '0123456789',
        periodLabel: '09/2026',
        status: 'RELEASED',
        grossEarnings,
        taxableEarnings: pitResult.taxableEarnings,
        contributionBase: (snapshot as any).contributionBase || 0,
        socialInsuranceRate: (snapshot as any).socialInsuranceRate || 0.08,
        healthInsuranceRate: (snapshot as any).healthInsuranceRate || 0.015,
        unemploymentInsuranceRate: (snapshot as any).unemploymentInsuranceRate || 0.01,
        socialInsurance: (snapshot as any).socialInsurance || 0,
        healthInsurance: (snapshot as any).healthInsurance || 0,
        unemploymentInsurance: (snapshot as any).unemploymentInsurance || 0,
        personalDeduction: pitResult.personalDeduction,
        dependentDeduction: pitResult.dependentDeduction,
        pitAmount: pitResult.pitAmount,
        otherDeductions: 0,
        netSalary,
        earningBreakdown: buildEarningBreakdown(snapshot as any, grossEarnings),
        allowanceBreakdown: (snapshot as any).allowanceBreakdown || [],
        otBreakdown: otBreakdown || undefined,
        deductionBreakdown: buildDeductionBreakdown(snapshot as any, pitResult.pitAmount),
        pitBreakdown: pitResult.breakdown || [],
        dependents: ((await EmployeeProfile.findById(profileId).lean()) as any)?.dependents || [],
        generatedAt: new Date('2026-09-25T09:00:00.000Z'),
        releasedAt: new Date('2026-09-25T10:00:00.000Z'),
      },
      'Payslip',
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n[seed:full:org] ${APPLY ? 'APPLY' : 'DRY-RUN'} — organization ${ORG_CODE} (${organizationId})`);
  for (const [kind, s] of summary) {
    console.log(`  ${kind.padEnd(28)} planned=${s.planned} created=${s.created} skipped=${s.skipped}`);
  }
  if (!APPLY) {
    console.log('\n⚠️  DRY RUN — Add --apply to create records.');
  }

  await closeConnection(db);
}

void main().catch(err => { console.error('[seed:full:org] failed:', err); process.exit(1); });
