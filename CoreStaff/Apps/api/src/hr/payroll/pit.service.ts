import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TaxPolicy, TaxPolicyDocument } from '../../database/schemas/tax-policy.schema';
import { EmployeeProfile, EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import {
  calculateProgressivePIT,
  calculateDependentDeduction,
  TaxBracket,
  RoundingRule,
} from '../policies/tax-policy-domain';

/**
 * TASK-094/095/096 — PIT (Personal Income Tax) calculation service.
 * 
 * Provides methods to:
 * - Calculate taxable earnings (TASK-094)
 * - Get personal/dependent deductions (TASK-095)
 * - Calculate progressive PIT (TASK-096)
 */
@Injectable()
export class PitService {
  constructor(
    @InjectModel('TaxPolicy') private readonly taxPolicyModel: Model<TaxPolicyDocument>,
    @InjectModel('EmployeeProfile') private readonly employeeProfileModel: Model<EmployeeProfileDocument>,
  ) {}

  // Standard deduction rates (Vietnam law)
  static readonly STANDARD_DEDUCTION = 15_500_000; // VND/month for self
  static readonly DEPENDENT_DEDUCTION = 6_200_000; // VND/month per dependent

  /**
   * TASK-094: Calculate taxable earnings.
   * 
   * Formula (updated to exclude non-taxable income):
   * TaxableEarnings = max(0, TaxableGross - InsuranceContributions - StandardDeduction - DependentDeductions)
   * 
   * Trong đó:
   * TaxableGross = BaseSalary + TaxableAllowances + AttendanceBonus + OT_Taxable
   *              = Gross - NonTaxableAllowances - OT_NonTaxable
   * 
   * Non-taxable components (KHÔNG đưa vào PIT):
   * - OT không chịu thuế = hệ số 1.0 (tiền cơ bản)
   * - Phụ cấp miễn thuế (meal, transport, ...)
   * - BHXH/BHYT/BHTN phần employee đóng
   * - Giảm trừ bản thân (15.5M)
   * - Giảm trừ người phụ thuộc (6.2M/người)
   */
  async calculateTaxableEarnings(params: {
    grossEarnings: number;
    insuranceContributions: number;
    employeeProfileId: string;
    organizationId: string;
    otNonTaxableEarnings?: number;    // OT không chịu thuế
    nonTaxableAllowances?: number;     // Phụ cấp miễn thuế
  }): Promise<{ taxableEarnings: number; standardDeduction: number; dependentDeduction: number; dependentCount: number }> {
    const { grossEarnings, insuranceContributions, employeeProfileId, organizationId, otNonTaxableEarnings = 0, nonTaxableAllowances = 0 } = params;

    // Get active dependents count
    const profile = await this.employeeProfileModel
      .findById(employeeProfileId)
      .lean();

    const dependents = profile?.dependents?.filter(d => d.status === 'ACTIVE' || !d.status) || [];
    const dependentCount = dependents.length;

    // Get tax policy for current deduction rates
    const taxPolicy = await this.getEffectiveTaxPolicy(organizationId);
    const standardDeduction = taxPolicy?.personalDeduction ?? PitService.STANDARD_DEDUCTION;
    const dependentDeductionPerPerson = taxPolicy?.dependentDeduction ?? PitService.DEPENDENT_DEDUCTION;
    const dependentDeduction = dependentCount * dependentDeductionPerPerson;

    // ── TAXABLE GROSS = Gross - NonTaxableComponents ──
    // Chỉ những phần ĐÓNG THUẾ mới đưa vào tính PIT
    const taxableGross = grossEarnings - otNonTaxableEarnings - nonTaxableAllowances;

    // Taxable earnings = TaxableGross - Insurance - StandardDeduction - DependentDeduction
    const taxableEarnings = Math.max(0, taxableGross - insuranceContributions - standardDeduction - dependentDeduction);

    return {
      taxableEarnings,
      standardDeduction,
      dependentDeduction,
      dependentCount,
    };
  }

  /**
   * TASK-095: Get personal and dependent deductions for an employee.
   */
  async getDeductions(employeeProfileId: string, organizationId: string): Promise<{
    personalDeduction: number;
    dependentDeduction: number;
    totalDeduction: number;
    dependentCount: number;
  }> {
    const profile = await this.employeeProfileModel
      .findById(employeeProfileId)
      .lean();

    const dependents = profile?.dependents?.filter(d => d.status === 'ACTIVE' || !d.status) || [];
    const dependentCount = dependents.length;

    const taxPolicy = await this.getEffectiveTaxPolicy(organizationId);
    const personalDeduction = taxPolicy?.personalDeduction ?? PitService.STANDARD_DEDUCTION;
    const dependentDeductionPerPerson = taxPolicy?.dependentDeduction ?? PitService.DEPENDENT_DEDUCTION;
    const dependentDeduction = dependentCount * dependentDeductionPerPerson;

    return {
      personalDeduction,
      dependentDeduction,
      totalDeduction: personalDeduction + dependentDeduction,
      dependentCount,
    };
  }

  /**
   * TASK-096: Calculate progressive PIT.
   * 
   * Applies Vietnam's 5-tier progressive tax brackets.
   */
  async calculateProgressivePIT(params: {
    taxableEarnings: number;
    organizationId: string;
    roundingRule?: RoundingRule;
  }): Promise<{
    pitAmount: number;
    effectiveRate: number;
    breakdown: Array<{ bracket: number; income: number; rate: number; tax: number }>;
  }> {
    const { taxableEarnings, organizationId, roundingRule = 'ROUND_HALF_UP_TO_VND' } = params;

    if (taxableEarnings <= 0) {
      return { pitAmount: 0, effectiveRate: 0, breakdown: [] };
    }

    const taxPolicy = await this.getEffectiveTaxPolicy(organizationId);
    const brackets = taxPolicy?.progressiveBrackets ?? this.getDefaultBrackets();

    // Calculate progressive tax with breakdown
    let remaining = taxableEarnings;
    let previousLimit = 0;
    let totalTax = 0;
    const breakdown: Array<{ bracket: number; income: number; rate: number; tax: number }> = [];

    for (let i = 0; i < brackets.length; i++) {
      if (remaining <= 0) break;

      const bracket = brackets[i];
      const bracketUpper = bracket.upperLimit ?? Number.POSITIVE_INFINITY;
      const bracketWidth = bracketUpper - previousLimit;
      const taxableInBracket = Math.min(remaining, bracketWidth);
      const taxInBracket = taxableInBracket * (bracket.rate / 100);

      totalTax += taxInBracket;
      remaining -= taxableInBracket;
      previousLimit = bracketUpper;

      breakdown.push({
        bracket: i + 1,
        income: taxableInBracket,
        rate: bracket.rate,
        tax: taxInBracket,
      });
    }

    // Apply rounding
    let roundedTax: number;
    switch (roundingRule) {
      case 'ROUND_DOWN_TO_VND':
        roundedTax = Math.floor(totalTax);
        break;
      case 'ROUND_UP_TO_VND':
        roundedTax = Math.ceil(totalTax);
        break;
      default:
        roundedTax = Math.round(totalTax);
    }

    const effectiveRate = taxableEarnings > 0 ? (roundedTax / taxableEarnings) * 100 : 0;

    return {
      pitAmount: roundedTax,
      effectiveRate,
      breakdown,
    };
  }

  /**
   * Full PIT calculation combining all steps.
   */
  async calculateFullPIT(params: {
    grossEarnings: number;
    insuranceContributions: number;
    employeeProfileId: string;
    organizationId: string;
    roundingRule?: RoundingRule;
    otNonTaxableEarnings?: number;    // OT không chịu thuế
    nonTaxableAllowances?: number;     // Phụ cấp miễn thuế
  }): Promise<{
    taxableEarnings: number;
    personalDeduction: number;
    dependentDeduction: number;
    dependentCount: number;
    pitAmount: number;
    effectiveRate: number;
    totalDeductions: number;
    breakdown: Array<{ bracket: number; income: number; rate: number; tax: number }>;
  }> {
    // Step 1: Calculate taxable earnings (TASK-094)
    const { taxableEarnings, standardDeduction, dependentDeduction, dependentCount } =
      await this.calculateTaxableEarnings({
        grossEarnings: params.grossEarnings,
        insuranceContributions: params.insuranceContributions,
        employeeProfileId: params.employeeProfileId,
        organizationId: params.organizationId,
        otNonTaxableEarnings: params.otNonTaxableEarnings ?? 0,
        nonTaxableAllowances: params.nonTaxableAllowances ?? 0,
      });

    // Step 2: Calculate progressive PIT (TASK-096)
    const { pitAmount, effectiveRate, breakdown } = await this.calculateProgressivePIT({
      taxableEarnings,
      organizationId: params.organizationId,
      roundingRule: params.roundingRule,
    });

    const totalDeductions = params.insuranceContributions + standardDeduction + dependentDeduction;

    return {
      taxableEarnings,
      personalDeduction: standardDeduction,
      dependentDeduction,
      dependentCount,
      pitAmount,
      effectiveRate,
      totalDeductions,
      breakdown,
    };
  }

  /**
   * Preview PIT calculation without saving (used in FE real-time preview).
   */
  async previewPIT(params: {
    grossEarnings: number;
    insuranceContributions: number;
    dependentCount: number;
    organizationId: string;
    roundingRule?: RoundingRule;
    otNonTaxableEarnings?: number;    // OT không chịu thuế
    nonTaxableAllowances?: number;     // Phụ cấp miễn thuế
  }): Promise<{
    taxableEarnings: number;
    personalDeduction: number;
    dependentDeduction: number;
    pitAmount: number;
    effectiveRate: number;
  }> {
    const taxPolicy = await this.getEffectiveTaxPolicy(params.organizationId);
    const personalDeduction = taxPolicy?.personalDeduction ?? PitService.STANDARD_DEDUCTION;
    const dependentDeductionPerPerson = taxPolicy?.dependentDeduction ?? PitService.DEPENDENT_DEDUCTION;
    const dependentDeduction = params.dependentCount * dependentDeductionPerPerson;

    // ── TAXABLE GROSS = Gross - NonTaxableComponents ──
    const taxableGross = params.grossEarnings - (params.otNonTaxableEarnings ?? 0) - (params.nonTaxableAllowances ?? 0);

    const taxableEarnings = Math.max(0, taxableGross - params.insuranceContributions - personalDeduction - dependentDeduction);

    const { pitAmount, effectiveRate } = await this.calculateProgressivePIT({
      taxableEarnings,
      organizationId: params.organizationId,
      roundingRule: params.roundingRule,
    });

    return {
      taxableEarnings,
      personalDeduction,
      dependentDeduction,
      pitAmount,
      effectiveRate,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async getEffectiveTaxPolicy(organizationId: string): Promise<any | null> {
    return this.taxPolicyModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        active: true,
      })
      .sort({ effectiveFrom: -1 })
      .limit(1)
      .lean();
  }

  private getDefaultBrackets(): TaxBracket[] {
    // Vietnam 5-tier monthly brackets (updated)
    return [
      { upperLimit: 10_000_000, rate: 5 },
      { upperLimit: 30_000_000, rate: 10 },
      { upperLimit: 60_000_000, rate: 20 },
      { upperLimit: 100_000_000, rate: 30 },
      { upperLimit: null, rate: 35 },
    ];
  }
}
