import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { PayrollInputSnapshot, PayrollInputSnapshotDocument } from '../../database/schemas/payroll-input-snapshot.schema';
import { TimesheetSummary, TimesheetSummaryDocument } from '../../database/schemas/timesheet-summary.schema';
import { EmployeeProfile, EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import {
  SalaryProfile,
  SalaryProfileDocument,
  OvertimePayPolicy,
  OvertimePayPolicyDocument,
} from '../../database/schemas/compensation.schema';
import { InsurancePolicy, InsurancePolicyDocument } from '../../database/schemas/insurance-policy.schema';
import { InsuranceProfile, InsuranceProfileDocument } from '../../database/schemas/insurance-profile.schema';
import { TaxPolicy, TaxPolicyDocument } from '../../database/schemas/tax-policy.schema';
import { EmploymentStatus, InsuranceContributionType } from '../../database/schemas/enums';
import { calculateInsuranceContributions } from '../insurance-policy/insurance-calculation';
import { PitService } from '../payroll/pit.service';
import { resolveOvertimeRates } from '../policies/policies-domain';
import { NO_KPI_EARNINGS_CONTRACT } from '../payroll/payroll-earnings-contract';
import { createHash } from 'node:crypto';
import { canonicalPayloadHash } from '../payroll/payroll-artifact-foundation';

/**
 * Hệ số tiền làm thêm giờ (SRS §30D.2). Constants này CHỈ còn là fallback khi
 * tổ chức chưa cấu hình `OvertimePayPolicy` — luồng tính lương đọc hệ số hiệu
 * lực qua `resolveOvertimeRatesForPeriod` bên dưới.
 */
export const OVERTIME_RATES = {
  workingDay: 1.5,
  weeklyOff: 2.0,
  publicHoliday: 3.0,
} as const;

export interface EffectiveOvertimeRates {
  workingDay: number;
  weeklyOff: number;
  publicHoliday: number;
}

export interface OvertimeRatesSource extends EffectiveOvertimeRates {
  policyId: string | null;
  version: number | null;
  legalReference: string;
  /** 'OVERTIME_PAY_POLICY' when configured, 'FROZEN_STATIC_RATES_V1' when fallback. */
  contract: string;
}

/**
 * Chọn hệ số hiệu lực cho một kỳ lương. Policy có hiệu lực được xét tại ngày
 * đầu kỳ — cùng mốc với SalaryProfile/InsurancePolicy/TaxPolicy trong file này,
 * nên toàn bộ snapshot đứng trên một lát cắt thời gian duy nhất.
 *
 * Không có policy → rơi về `OVERTIME_RATES`. Hành vi này giữ cho tổ chức cũ
 * (chưa seed policy) tính lương được thay vì nổ, và được ghi rõ trong
 * `overtimeRateEvidence.contract` để hậu kiểm đọc ra được nguồn số.
 */
export async function resolveOvertimeRatesForPeriod(
  model: Model<OvertimePayPolicyDocument> | null | undefined,
  organizationId: string,
  periodKey: string,
  session?: ClientSession,
): Promise<OvertimeRatesSource> {
  const at = new Date(`${periodKey}-01T00:00:00.000Z`);
  const policy = model
    ? await model
        .findOne({
          organizationId: new Types.ObjectId(organizationId),
          active: true,
          effectiveFrom: { $lte: at },
          $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: at } }],
        })
        .sort({ effectiveFrom: -1 })
        .session(session ?? null)
        .lean() as OvertimePayPolicy | null
    : null;
  if (!policy) {
    return { ...OVERTIME_RATES, policyId: null, version: null, legalReference: '', contract: 'FROZEN_STATIC_RATES_V1' };
  }
  // `resolveOvertimeRates` is the single owner of the rate → type mapping and of
  // the "rates may not be negative" rule; calling it here keeps payroll and the
  // HR preview endpoint on one code path.
  const resolved = resolveOvertimeRates(
    {
      workingDayRate: policy.workingDayRate,
      weeklyOffRate: policy.weeklyOffRate,
      publicHolidayRate: policy.publicHolidayRate,
      version: policy.version,
      legalReference: policy.legalReference,
    },
    [],
  );
  return {
    workingDay: policy.workingDayRate,
    weeklyOff: policy.weeklyOffRate,
    publicHoliday: policy.publicHolidayRate,
    policyId: String((policy as any)._id),
    version: resolved.policyVersion,
    legalReference: policy.legalReference,
    contract: 'OVERTIME_PAY_POLICY',
  };
}

export function resolvePayrollWorkdays(summary: Pick<TimesheetSummary, 'workingDays' | 'presentDays' | 'absentDays' | 'unpaidLeaveDays'> & Partial<Pick<TimesheetSummary, 'calculationContract' | 'standardWorkUnits' | 'payableWorkUnits'>>) {
  if (summary.calculationContract === 'VERSIONED_WORK_CREDIT_V2') {
    return {
      standardWorkingDays: Math.max(0, summary.standardWorkUnits ?? 0),
      payableWorkingDays: Math.max(0, summary.payableWorkUnits ?? 0),
    };
  }
  const standardWorkingDays = Math.max(0, summary.workingDays ?? 0);
  const nonPayableDays = Math.max(0, (summary.absentDays ?? 0) + (summary.unpaidLeaveDays ?? 0));
  return {
    standardWorkingDays,
    payableWorkingDays: Math.max(0, standardWorkingDays - nonPayableDays),
  };
}

/**
 * Lương đóng bảo hiểm = lương cơ bản hợp đồng − tổng phụ cấp **có tích tính BH**
 * (không âm). Một chỗ khai duy nhất — hồ sơ lương, snapshot và FE đều dùng cùng
 * công thức để số hiện trên màn khớp số chốt kỳ.
 *
 * QC 4.11: chỉ phụ cấp `insuranceBased = true` mới trừ khỏi căn cứ đóng BH;
 * phụ cấp không tích không được trừ. Đây là chủ ý theo QC — luật VN thông
 * thường cộng phụ cấp vào căn cứ, không trừ; đổi hướng nếu nghiệp vụ chốt khác.
 */
export function deriveInsuranceSalary(monthlyBaseSalary: number, insuranceBearingAllowances: number): number {
  return Math.max(0, monthlyBaseSalary - insuranceBearingAllowances);
}

/**
 * Tiền công 1 giờ dùng cho OT = lương tháng / (ngày công chuẩn × 8).
 * Một chỗ khai duy nhất — snapshot lưu lại, payslip đọc lại (B1).
 */
export function hourlyRateFor(monthlyBaseSalary: number, standardWorkingDays: number, standardWorkMinutes?: number): number {
  if (standardWorkMinutes !== undefined) {
    return standardWorkMinutes > 0 ? monthlyBaseSalary / (standardWorkMinutes / 60) : 0;
  }
  return standardWorkingDays > 0 ? monthlyBaseSalary / (standardWorkingDays * 8) : 0;
}

/**
 * Tiền OT = số phút / 60 × tiền công 1 giờ × hệ số. Cùng một biểu thức cho cả
 * snapshot lẫn payslip, để `Σ breakdown[].amount` luôn bằng `otPay` (B1).
 */
export function computeOvertimePay(minutes: number, hourlyRate: number, coefficient: number): number {
  return Math.round((minutes * coefficient * hourlyRate) / 60);
}

/**
 * Hệ số đã đóng băng trong snapshot. Không thấy `overtimeRateEvidence` nghĩa là
 * snapshot sinh trước khi nối `OvertimePayPolicy` → dùng đúng hằng số mà nó đã
 * được tính bằng. Payslip không bao giờ đọc policy hiện hành.
 */
export function overtimeRatesOf(snapshot: any): EffectiveOvertimeRates {
  const evidence = Array.isArray(snapshot?.overtimeRateEvidence) ? snapshot.overtimeRateEvidence[0] : undefined;
  const num = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
  return {
    workingDay: num(evidence?.workingDay, OVERTIME_RATES.workingDay),
    weeklyOff: num(evidence?.weeklyOff, OVERTIME_RATES.weeklyOff),
    publicHoliday: num(evidence?.publicHoliday, OVERTIME_RATES.publicHoliday),
  };
}

/**
 * TASK-081/082 / SRS §30C.2 — Generate immutable PayrollInputSnapshots.
 *
 * Runs inside the close-period transaction (TASK-078) after TimesheetSummary is created.
 * Reads from:
 * - TimesheetSummary → work counts, OT minutes, leave days
 * - EmployeeProfile → personal info, dependents
 * - SalaryProfile → base salary
 * - InsurancePolicy → BHXH/BHYT/BHTN rates
 * - TaxPolicy → personal/dependent deductions
 *
 * Creates one PayrollInputSnapshot per employee — immutable data cho payroll calculation.
 */
@Injectable()
export class PayrollSnapshotService {
  constructor(
    @InjectModel('PayrollInputSnapshot')
    private readonly snapshotModel: Model<PayrollInputSnapshotDocument>,
    @InjectModel('TimesheetSummary')
    private readonly summaryModel: Model<TimesheetSummaryDocument>,
    @InjectModel('EmployeeProfile')
    private readonly employeeProfileModel: Model<EmployeeProfileDocument>,
    @InjectModel('SalaryProfile')
    private readonly salaryProfileModel: Model<SalaryProfileDocument>,
    @InjectModel('OrganizationAllowance')
    private readonly allowanceModel: Model<any>,
    @InjectModel('AttendanceBonusPolicy')
    private readonly attendanceBonusPolicyModel: Model<any>,
    @InjectModel('InsurancePolicy')
    private readonly insurancePolicyModel: Model<InsurancePolicyDocument>,
    @InjectModel('InsuranceProfile')
    private readonly insuranceProfileModel: Model<InsuranceProfileDocument>,
    @InjectModel('TaxPolicy')
    private readonly taxPolicyModel: Model<TaxPolicyDocument>,
    // Optional last so positional construction in scripts/specs stays valid.
    @Optional()
    @InjectModel('OvertimePayPolicy')
    private readonly overtimePayPolicyModel?: Model<OvertimePayPolicyDocument>,
  ) {}

  /**
   * Generate snapshots for all employees in a closed period.
   * Called inside the close-period transaction (TASK-078).
   *
   * @param periodId — The closed TimesheetPeriod id
   * @param periodKey — Period key in 'YYYY-MM' format
   * @param organizationId — Organization id
   * @param session — MongoDB session for atomicity
   * @returns Number of snapshots created
   */
  async generateSnapshots(
    periodId: string,
    periodKey: string,
    organizationId: string,
    session: ClientSession,
  ): Promise<number> {
    return this.generateSnapshotsForDepartment(periodId, periodKey, organizationId, undefined, session);
  }

  /**
   * Generate snapshots for employees in a specific department, or all employees if departmentId is omitted.
   */
  async generateSnapshotsForDepartment(
    periodId: string,
    periodKey: string,
    organizationId: string,
    departmentId: string | undefined,
    session: ClientSession,
  ): Promise<number> {
    // Step 1: Get all summaries for this period (optionally filtered by department)
    const summaryQuery: any = { periodId: new Types.ObjectId(periodId), organizationId: new Types.ObjectId(organizationId) };
    if (departmentId) {
      summaryQuery.departmentId = new Types.ObjectId(departmentId);
    }
    const summaries = await this.summaryModel
      .find(summaryQuery)
      .session(session)
      .lean();


    if (!summaries.length) {
      return 0;
    }

    // Step 2: Get policies effective for this period
    const { insurancePolicy, taxPolicy } = await this.getPolicies(organizationId, periodKey, session);
    // One rate lookup per period — every employee in it is paid on the same
    // effective policy, and the lookup is a read, not a per-row decision.
    const overtimeRates = await resolveOvertimeRatesForPeriod(
      this.overtimePayPolicyModel,
      organizationId,
      periodKey,
      session,
    );

    // Step 3: Generate snapshot for each employee
    let count = 0;
    for (const summary of summaries) {
      await this.createSnapshotForEmployee(
        periodId,
        periodKey,
        organizationId,
        summary,
        insurancePolicy,
        taxPolicy,
        overtimeRates,
        session,
      );
      count++;
    }

    return count;
  }

  /**
   * Preview snapshots for a department without persisting.
   */
  async previewSnapshotsForDepartment(
    periodId: string,
    periodKey: string,
    organizationId: string,
    summaries: TimesheetSummary[],
  ): Promise<any[]> {
    const { insurancePolicy, taxPolicy } = await this.getPolicies(organizationId, periodKey);
    const overtimeRates = await resolveOvertimeRatesForPeriod(
      this.overtimePayPolicyModel,
      organizationId,
      periodKey,
    );
    const results: any[] = [];
    for (const summary of summaries) {
      const snapshot = await this.buildSnapshotForEmployee(
        periodId,
        periodKey,
        organizationId,
        summary,
        insurancePolicy,
        taxPolicy,
        overtimeRates,
      );
      results.push(snapshot);
    }
    return results;
  }

  private async getPolicies(
    organizationId: string,
    periodKey: string,
    session?: ClientSession,
  ): Promise<{ insurancePolicy: any; taxPolicy: any }> {
    const insurancePolicy = await this.insurancePolicyModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        effectiveFrom: { $lte: new Date(`${periodKey}-01T00:00:00.000Z`) },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: new Date(`${periodKey}-01T00:00:00.000Z`) } },
        ],
      })
      .sort({ effectiveFrom: -1 })
      .session(session ?? null)
      .lean();

    const taxPolicy = await this.taxPolicyModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        effectiveFrom: { $lte: new Date(`${periodKey}-01T00:00:00.000Z`) },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: new Date(`${periodKey}-01T00:00:00.000Z`) } },
        ],
      })
      .sort({ effectiveFrom: -1 })
      .session(session ?? null)
      .lean();

    if (!insurancePolicy) throw new NotFoundException('INSURANCE_POLICY_MISSING');
    if (!taxPolicy) throw new NotFoundException('TAX_POLICY_MISSING');
    return { insurancePolicy, taxPolicy };
  }

  /**
   * Create a single snapshot document for one employee in a period.
   */
  private async createSnapshotForEmployee(
    periodId: string,
    periodKey: string,
    organizationId: string,
    summary: TimesheetSummary,
    insurancePolicy: any,
    taxPolicy: any,
    overtimeRates: OvertimeRatesSource,
    session: ClientSession,
  ): Promise<void> {
    const snapshotData = await this.buildSnapshotForEmployee(
      periodId,
      periodKey,
      organizationId,
      summary,
      insurancePolicy,
      taxPolicy,
      overtimeRates,
    );
    const immutablePayload: any = {
      ...snapshotData,
      schemaVersion: 1,
      sourcePeriodVersion: summary.sourcePeriodVersion,
      sourceSummaryId: (summary as any)._id,
      sourceSummaryVersion: summary.version,
      sourceSummaryHash: summary.canonicalPayloadHash ?? summary.sourceHash,
      calculationContract: summary.calculationContract ?? 'LEGACY_WORKING_DAYS_V1',
    };
    immutablePayload.canonicalPayloadHash = canonicalPayloadHash(immutablePayload);
    await this.snapshotModel.create([immutablePayload], { session });
  }

  /**
   * Build a snapshot object for one employee without persisting it.
   */
  private async buildSnapshotForEmployee(
    periodId: string,
    periodKey: string,
    organizationId: string,
    summary: TimesheetSummary,
    insurancePolicy: any,
    taxPolicy: any,
    overtimeRates: OvertimeRatesSource = { ...OVERTIME_RATES, policyId: null, version: null, legalReference: '', contract: 'FROZEN_STATIC_RATES_V1' },
  ): Promise<any> {
    // Fetch employee profile
    const profile = await this.employeeProfileModel
      .findById(summary.employeeProfileId)
      .lean();

    if (!profile) {
      throw new NotFoundException(`EMPLOYEE_PROFILE_NOT_FOUND: ${summary.employeeProfileId}`);
    }

    // Fetch salary profile
    const salaryProfile = await this.salaryProfileModel
      .findOne({
        employeeProfileId: new Types.ObjectId(summary.employeeProfileId),
        organizationId: new Types.ObjectId(organizationId),
        active: true,
        effectiveFrom: { $lte: new Date(`${periodKey}-01T00:00:00.000Z`) },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: new Date(`${periodKey}-01T00:00:00.000Z`) } },
        ],
      })
      .sort({ effectiveFrom: -1 })
      .lean();

    // The seeded/admin-configured month uses the actual standard workday count.
    const monthlyBaseSalary = salaryProfile?.baseSalary ?? 0;
    const { standardWorkingDays, payableWorkingDays } = resolvePayrollWorkdays(summary);
    const proratedBaseSalary = standardWorkingDays > 0
      ? Math.round((monthlyBaseSalary / standardWorkingDays) * payableWorkingDays)
      : 0;

    // Calculate allowances from SalaryProfile (TASK-088)
    const organizationAllowanceIds = salaryProfile?.organizationAllowanceIds ?? [];
    const organizationAllowances = organizationAllowanceIds.length
      ? await this.allowanceModel.find({
          _id: { $in: organizationAllowanceIds },
          organizationId: new Types.ObjectId(organizationId),
          active: true,
        }).lean()
      : [];
    const assignedAmounts = new Map(
      (salaryProfile?.allowances ?? []).map((item: any) => [String(item.allowanceId), item.amount]),
    );
    const allowanceBreakdown = organizationAllowances.map((allowance: any) => ({
      type: allowance.code ?? String(allowance._id),
      label: allowance.name ?? allowance.code ?? 'Phụ cấp',
      amount: assignedAmounts.get(String(allowance._id)) ?? allowance.amount ?? 0,
      // QC 4.11 — only ticked allowances reduce the insurance base.
      insuranceBased: allowance.insuranceBased === true,
      // R1: mọi phụ cấp đều chịu thuế TNCN. Cờ `OrganizationAllowance.taxable`
      // vẫn còn trong schema (deprecated) nhưng không còn được đọc ở đây.
      taxable: true,
    }));
    const totalAllowances = allowanceBreakdown.reduce((sum: number, item: any) => sum + item.amount, 0);
    const insuranceAllowances = allowanceBreakdown
      .filter((item: any) => item.insuranceBased)
      .reduce((sum: number, item: any) => sum + item.amount, 0);
    const nonTaxableAllowances = 0;

    const attendanceBonusPolicy: any = salaryProfile?.attendanceBonusPolicyId
      ? await this.attendanceBonusPolicyModel.findOne({
          _id: salaryProfile.attendanceBonusPolicyId,
          organizationId: new Types.ObjectId(organizationId),
          active: true,
        }).lean()
      : null;
    const qualifiesForAttendanceBonus =
      payableWorkingDays >= standardWorkingDays &&
      (summary.totalLateMinutes ?? 0) === 0 &&
      (summary.totalEarlyMinutes ?? 0) === 0 &&
      (summary.absentDays ?? 0) === 0 &&
      (summary.incompleteDays ?? 0) === 0;
    const attendanceBonus = qualifiesForAttendanceBonus ? attendanceBonusPolicy?.bonusAmount ?? 0 : 0;

    // Calculate OT pay — hệ số hiệu lực của kỳ (policy, fallback là OVERTIME_RATES)
    const hourlyRate = hourlyRateFor(
      monthlyBaseSalary,
      standardWorkingDays,
      summary.calculationContract === 'VERSIONED_WORK_CREDIT_V2' ? summary.standardWorkMinutes : undefined,
    );

    // Tiền OT = số giờ × tiền công 1 giờ × hệ số, cộng theo từng loại ngày.
    const otWorkingDayPay = computeOvertimePay(summary.otWorkingDayMinutes, hourlyRate, overtimeRates.workingDay);
    const otWeeklyOffPay = computeOvertimePay(summary.otWeeklyOffMinutes, hourlyRate, overtimeRates.weeklyOff);
    const otPublicHolidayPay = computeOvertimePay(summary.otPublicHolidayMinutes, hourlyRate, overtimeRates.publicHoliday);
    const otPay = otWorkingDayPay + otWeeklyOffPay + otPublicHolidayPay;

    // Cờ công ty: cả tiền OT chịu thuế hay miễn hết. Không chia tiền OT.
    const overtimeTaxable = taxPolicy?.overtimeTaxable === true;

    // Calculate insurance contributions (TASK-090/091/092)
    // Lương đóng bảo hiểm suy ra: lương cơ bản hợp đồng − tổng phụ cấp (không âm).
    // KHÔNG nhập tay nữa — xem Docs/DOCS_DECISION_LOG.md.
    const insuranceSalary = deriveInsuranceSalary(monthlyBaseSalary, insuranceAllowances);
    const insuranceProfile = await this.resolveInsuranceProfile(
      organizationId,
      summary.employeeProfileId,
      periodKey,
    );
    // D40: tham gia BHXH/BHYT/BHTN là nghĩa vụ luật định → thiếu hồ sơ nghĩa là mặc định tham gia.
    const participation = {
      participatesSocialInsurance: insuranceProfile?.participatesSocialInsurance ?? true,
      participatesHealthInsurance: insuranceProfile?.participatesHealthInsurance ?? true,
      participatesUnemploymentInsurance: insuranceProfile?.participatesUnemploymentInsurance ?? true,
    };
    // Engine chuẩn: kẹp sàn/trần theo TỪNG loại và tôn trọng participation.
    const insuranceResult = calculateInsuranceContributions(
      insurancePolicy,
      participation,
      insuranceSalary,
    );
    const insuranceLine = (type: InsuranceContributionType) =>
      insuranceResult.lines.find((line) => line.type === type);
    const socialInsuranceRate = insurancePolicy?.socialInsuranceEmployeeRate ?? 0.08;
    const healthInsuranceRate = insurancePolicy?.healthInsuranceEmployeeRate ?? 0.015;
    const unemploymentInsuranceRate = insurancePolicy?.unemploymentInsuranceEmployeeRate ?? 0.01;
    const contributionBase =
      insuranceLine(InsuranceContributionType.SOCIAL_INSURANCE)?.base ?? insuranceSalary;
    const socialInsurance = insuranceLine(InsuranceContributionType.SOCIAL_INSURANCE)?.employeeContribution ?? 0;
    const healthInsurance = insuranceLine(InsuranceContributionType.HEALTH_INSURANCE)?.employeeContribution ?? 0;
    const unemploymentInsurance = insuranceLine(InsuranceContributionType.UNEMPLOYMENT_INSURANCE)?.employeeContribution ?? 0;

    // Calculate dependent deductions (TASK-095)
    const dependents = profile.dependents?.filter(d => d.status === 'ACTIVE') || [];
    const dependentDeductionPerPerson = taxPolicy?.dependentDeduction ?? PitService.DEPENDENT_DEDUCTION;
    const totalDependentDeductions = dependents.length * dependentDeductionPerPerson;

    // Generate source hash for integrity verification
    const sourceHash = this.generateSourceHash(
      summary,
      salaryProfile,
      insurancePolicy,
      taxPolicy,
      dependents.length,
      0,
      NO_KPI_EARNINGS_CONTRACT,
      { insuranceSalary, participation, standardWorkingDays, payableWorkingDays },
      overtimeRates,
    );

    return {
      periodId: new Types.ObjectId(periodId),
      employeeProfileId: new Types.ObjectId(summary.employeeProfileId),
      userId: summary.userId,
      organizationId: new Types.ObjectId(organizationId),
      departmentId: summary.departmentId ? new Types.ObjectId(summary.departmentId) : undefined,
      periodKey,

      // Earnings inputs
      monthlyBaseSalary,
      proratedBaseSalary,
      standardWorkingDays,
      payableWorkingDays,
      hourlyRate,
      ...(summary.calculationContract === 'VERSIONED_WORK_CREDIT_V2' ? {
        standardWorkUnits: summary.standardWorkUnits,
        standardWorkMinutes: summary.standardWorkMinutes,
        payableWorkUnits: summary.payableWorkUnits,
        dailyWorkCredits: summary.dailyWorkCredits,
        workCreditPolicySnapshots: summary.workCreditPolicySnapshots,
      } : {}),
      // Which rates produced `otPay`, and where they came from — always written so a
      // later policy edit cannot make a closed payslip unexplainable.
      overtimeRateEvidence: [{
        contract: overtimeRates.contract,
        workingDay: overtimeRates.workingDay,
        weeklyOff: overtimeRates.weeklyOff,
        publicHoliday: overtimeRates.publicHoliday,
        policyId: overtimeRates.policyId,
        policyVersion: overtimeRates.version,
        legalReference: overtimeRates.legalReference,
        ...(summary.calculationContract === 'VERSIONED_WORK_CREDIT_V2'
          ? { standardWorkMinutes: summary.standardWorkMinutes }
          : {}),
      }],
      totalAllowances,
      attendanceBonus,
      earningsContract: NO_KPI_EARNINGS_CONTRACT,
      nonTaxableAllowances,
      allowanceBreakdown,
      otMinutesByType: {
        otWorkingDayMinutes: summary.otWorkingDayMinutes,
        otWeeklyOffMinutes: summary.otWeeklyOffMinutes,
        otPublicHolidayMinutes: summary.otPublicHolidayMinutes,
        totalOvertimeMinutes: summary.totalOvertimeMinutes,
      },
      otPay,
      overtimeTaxable,

      // Insurance inputs
      socialInsuranceRate,
      healthInsuranceRate,
      unemploymentInsuranceRate,
      contributionBase,
      socialInsurance,
      healthInsurance,
      unemploymentInsurance,

      // PIT inputs
      taxableEarnings: Math.max(0, proratedBaseSalary + totalAllowances + attendanceBonus + (overtimeTaxable ? otPay : 0) - socialInsurance - healthInsurance - unemploymentInsurance),
      totalDependentDeductions,
      dependentCount: dependents.length,
      taxPolicyVersion: taxPolicy?.version ?? 1,
      legalReference: taxPolicy?.legalReference ?? '',

      // Status & integrity
      status: 'GENERATED',
      version: 1,
      sourceHash,
      generatedAt: new Date(),
    };
  }

  /**
   * Hồ sơ tham gia bảo hiểm hiệu lực của nhân viên tại kỳ lương.
   * `undefined` = chưa có hồ sơ → coi như tham gia đủ (D40).
   */
  private async resolveInsuranceProfile(
    organizationId: string,
    employeeProfileId: string,
    periodKey: string,
  ): Promise<InsuranceProfile | null> {
    const at = new Date(`${periodKey}-01T00:00:00.000Z`);
    return this.insuranceProfileModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        employeeId: new Types.ObjectId(employeeProfileId),
        effectiveFrom: { $lte: at },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: at } },
        ],
      })
      .sort({ effectiveFrom: -1 })
      .lean();
  }

  /**
   * Generate a source hash for integrity verification.
   * Combines key input values — if any change, hash will mismatch → trigger re-generation.
   */
  private generateSourceHash(
    summary: TimesheetSummary,
    salaryProfile: any,
    insurancePolicy: any,
    taxPolicy: any,
    dependentCount: number,
    legacyKpiBonus = 0,
    earningsContract?: string,
    insurance: {
      insuranceSalary: number;
      participation: {
        participatesSocialInsurance: boolean;
        participatesHealthInsurance: boolean;
        participatesUnemploymentInsurance: boolean;
      };
      standardWorkingDays: number;
      payableWorkingDays: number;
    } = {
      insuranceSalary: 0,
      participation: {
        participatesSocialInsurance: true,
        participatesHealthInsurance: true,
        participatesUnemploymentInsurance: true,
      },
      standardWorkingDays: 0,
      payableWorkingDays: 0,
    },
    overtimeRates: EffectiveOvertimeRates & { policyId?: string | null; version?: number | null } = OVERTIME_RATES,
  ): string {
    const assignedAllowances = (salaryProfile?.allowances ?? [])
      .map((item: any) => `${item.allowanceId}:${item.amount}`)
      .sort()
      .join(',');
    const hashInputBase = [
      String(summary.periodId),
      String(summary.employeeProfileId),
      String(summary.totalDays),
      String(summary.workingDays),
      String(summary.totalWorkingMinutes),
      String(summary.otWorkingDayMinutes),
      String(summary.otWeeklyOffMinutes),
      String(summary.otPublicHolidayMinutes),
      String(salaryProfile?._id ?? 'none'),
      String(salaryProfile?.baseSalary ?? 0),
      String(salaryProfile?.attendanceBonusPolicyId ?? 'none'),
      (salaryProfile?.organizationAllowanceIds ?? []).map(String).sort().join(','),
      assignedAllowances,
      String(insurancePolicy?._id ?? 'none'),
      String(taxPolicy?._id ?? 'none'),
      // version chứ không chỉ _id: sửa chính sách là tạo document mới, nhưng giữ
      // version trong hash để đổi cờ overtimeTaxable chắc chắn làm hash lệch.
      String(taxPolicy?.version ?? 0),
      String(taxPolicy?.overtimeTaxable ?? false),
      String(taxPolicy?.dependentDeduction ?? 0),
      String(dependentCount),
      earningsContract === NO_KPI_EARNINGS_CONTRACT
        ? NO_KPI_EARNINGS_CONTRACT
        : String(legacyKpiBonus),
      // Lương đóng bảo hiểm giờ là số DẪN XUẤT (base − phụ cấp) → hash theo input
      // gốc và theo hồ sơ tham gia, để đổi phụ cấp/participation là hash lệch.
      String(insurance.insuranceSalary),
      String(insurance.participation.participatesSocialInsurance),
      String(insurance.participation.participatesHealthInsurance),
      String(insurance.participation.participatesUnemploymentInsurance),
      String(insurance.standardWorkingDays),
      String(insurance.payableWorkingDays),
    ].join('|');

    // Hệ số OT đi vào hash CHỈ khi kỳ đó tính bằng `OvertimePayPolicy` thật.
    // Snapshot cũ (chưa có policy) phải giữ nguyên hash từng byte, nếu không
    // `verifyIntegrity` sẽ báo sai lệch cho toàn bộ lịch sử.
    const overtimeSegment = overtimeRates.policyId
      ? `|${overtimeRates.policyId}|${overtimeRates.version ?? 0}|${overtimeRates.workingDay}|${overtimeRates.weeklyOff}|${overtimeRates.publicHoliday}`
      : '';
    const hashInput = `${hashInputBase}${overtimeSegment}`;

    if (summary.calculationContract === 'VERSIONED_WORK_CREDIT_V2') {
      return canonicalPayloadHash({ legacyInputs: hashInput, calculationContract: summary.calculationContract,
        sourceSummaryHash: summary.canonicalPayloadHash ?? summary.sourceHash });
    }
    return createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Get a single snapshot by period and employee.
   */
  async findOne(
    periodId: string,
    employeeProfileId: string,
  ): Promise<any> {
    const doc = await this.snapshotModel
      .findOne({
        periodId: new Types.ObjectId(periodId),
        employeeProfileId: new Types.ObjectId(employeeProfileId),
      })
      .lean();

    if (!doc) {
      throw new NotFoundException('PAYROLL_SNAPSHOT_NOT_FOUND');
    }

    return doc;
  }

  /**
   * List all snapshots for a period.
   */
  async findByPeriod(periodId: string): Promise<any[]> {
    return this.snapshotModel
      .find({ periodId: new Types.ObjectId(periodId) })
      .sort({ 'employeeSnapshot.fullName': 1 })
      .lean();
  }

  /**
   * List snapshots for a period filtered by department.
   */
  async findByPeriodAndDepartment(periodId: string, departmentId: string): Promise<any[]> {
    return this.snapshotModel
      .find({
        periodId: new Types.ObjectId(periodId),
        departmentId: new Types.ObjectId(departmentId),
      })
      .sort({ fullName: 1 })
      .lean();
  }

  /**
   * List all snapshots for an employee across periods.
   */
  async findByEmployee(employeeProfileId: string): Promise<any[]> {
    return this.snapshotModel
      .find({ employeeProfileId: new Types.ObjectId(employeeProfileId) })
      .sort({ periodKey: -1 })
      .lean();
  }

  /**
   * Verify source integrity — compare stored hash with current source data.
   */
  async verifyIntegrity(snapshotId: string): Promise<boolean> {
    const snapshot = await this.snapshotModel.findById(snapshotId).lean();
    if (!snapshot) return false;

    // Re-read current source data
    const summary = await this.summaryModel
      .findOne({
        periodId: snapshot.periodId,
        employeeProfileId: snapshot.employeeProfileId,
        organizationId: snapshot.organizationId,
      })
      .lean();

    if (!summary) return false;

    const salaryProfile = await this.salaryProfileModel.findOne({
      organizationId: snapshot.organizationId,
      employeeProfileId: snapshot.employeeProfileId,
    }).lean();
    const { insurancePolicy, taxPolicy } = await this.getPolicies(
      String(snapshot.organizationId),
      snapshot.periodKey,
    );
    const profile = await this.employeeProfileModel.findById(snapshot.employeeProfileId).lean();
    const dependentCount = profile?.dependents?.filter((d) => d.status === 'ACTIVE').length ?? 0;
    // Re-resolve the rates rather than trusting the stored evidence: editing the
    // policy must make this hash differ, which is exactly what this method is for.
    const overtimeRates = await resolveOvertimeRatesForPeriod(
      this.overtimePayPolicyModel,
      String(snapshot.organizationId),
      snapshot.periodKey,
    );
    const currentHash = this.generateSourceHash(
      summary as any,
      salaryProfile,
      insurancePolicy,
      taxPolicy,
      dependentCount,
      snapshot.kpiBonus ?? 0,
      snapshot.earningsContract,
      undefined,
      overtimeRates,
    );

    return currentHash === snapshot.sourceHash;
  }
}
