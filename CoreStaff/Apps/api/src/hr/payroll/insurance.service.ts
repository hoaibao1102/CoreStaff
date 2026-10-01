import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InsurancePolicy, InsurancePolicyDocument } from '../../database/schemas/insurance-policy.schema';

/**
 * TASK-090/091/092 — Insurance calculation service for employee contributions.
 * 
 * Calculates BHXH (8%), BHYT (1.5%), BHTN (1%) based on InsurancePolicy.
 * Uses contribution base capped at policy maximum.
 */
@Injectable()
export class InsuranceService {
  constructor(
    @InjectModel('InsurancePolicy')
    private readonly insurancePolicyModel: Model<InsurancePolicyDocument>,
  ) {}

  // Employee contribution rates (fixed by law)
  static readonly SOCIAL_INSURANCE_RATE = 0.08;   // 8% BHXH
  static readonly HEALTH_INSURANCE_RATE = 0.015;   // 1.5% BHYT
  static readonly UNEMPLOYMENT_INSURANCE_RATE = 0.01; // 1% BHTN
  static readonly TOTAL_EMPLOYEE_RATE = 0.105;     // 10.5% total

  /**
   * Get effective insurance policy for an organization.
   * Returns default rates if no policy found.
   */
  async getEffectivePolicy(organizationId: string): Promise<{
    socialRate: number;
    healthRate: number;
    unemploymentRate: number;
    maxContributionBase: number;
  }> {
    const policy = await this.insurancePolicyModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        active: true,
      })
      .sort({ effectiveFrom: -1 })
      .lean();

    if (policy) {
      // Get cap from capRules
      const socialCap = policy.capRules?.find(r => r.type === 'SOCIAL_INSURANCE')?.capAmount ?? Infinity;
      const healthCap = policy.capRules?.find(r => r.type === 'HEALTH_INSURANCE')?.capAmount ?? Infinity;
      const unemploymentCap = policy.capRules?.find(r => r.type === 'UNEMPLOYMENT_INSURANCE')?.capAmount ?? Infinity;
      
      const maxBase = Math.min(socialCap, healthCap, unemploymentCap);

      return {
        socialRate: policy.socialInsuranceEmployeeRate || InsuranceService.SOCIAL_INSURANCE_RATE,
        healthRate: policy.healthInsuranceEmployeeRate || InsuranceService.HEALTH_INSURANCE_RATE,
        unemploymentRate: policy.unemploymentInsuranceEmployeeRate || InsuranceService.UNEMPLOYMENT_INSURANCE_RATE,
        maxContributionBase: maxBase === Infinity ? 20 * 2_610_000 : maxBase, // Default cap: 20x minimum salary
      };
    }

    // Return defaults if no policy
    return {
      socialRate: InsuranceService.SOCIAL_INSURANCE_RATE,
      healthRate: InsuranceService.HEALTH_INSURANCE_RATE,
      unemploymentRate: InsuranceService.UNEMPLOYMENT_INSURANCE_RATE,
      maxContributionBase: 20 * 2_610_000, // Default: 20x minimum salary (2026)
    };
  }

  /**
   * Calculate employee insurance contributions.
   * 
   * Formula:
   * - contributionBase = min(insuranceSalary, maxContributionBase)
   * - BHXH = contributionBase × 8%
   * - BHYT = contributionBase × 1.5%
   * - BHTN = contributionBase × 1%
   */
  calculateContributions(
    insuranceSalary: number,
    policy?: {
      socialRate: number;
      healthRate: number;
      unemploymentRate: number;
      maxContributionBase: number;
    }
  ): {
    contributionBase: number;
    socialInsurance: number;
    healthInsurance: number;
    unemploymentInsurance: number;
    totalInsurance: number;
  } {
    const p = policy || {
      socialRate: InsuranceService.SOCIAL_INSURANCE_RATE,
      healthRate: InsuranceService.HEALTH_INSURANCE_RATE,
      unemploymentRate: InsuranceService.UNEMPLOYMENT_INSURANCE_RATE,
      maxContributionBase: 20 * 2_610_000,
    };

    // Cap contribution base at policy maximum
    const contributionBase = Math.min(insuranceSalary, p.maxContributionBase);

    const socialInsurance = Math.round(contributionBase * p.socialRate);
    const healthInsurance = Math.round(contributionBase * p.healthRate);
    const unemploymentInsurance = Math.round(contributionBase * p.unemploymentRate);
    const totalInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

    return {
      contributionBase,
      socialInsurance,
      healthInsurance,
      unemploymentInsurance,
      totalInsurance,
    };
  }

  /**
   * Calculate employer insurance contributions.
   * Employer pays additional ~21.5% on top of employee portion.
   */
  calculateEmployerContributions(
    insuranceSalary: number,
    policy?: {
      socialRate: number;
      healthRate: number;
      unemploymentRate: number;
      maxContributionBase: number;
    }
  ): {
    contributionBase: number;
    socialInsurance: number;
    healthInsurance: number;
    unemploymentInsurance: number;
    totalInsurance: number;
  } {
    const p = policy || {
      socialRate: InsuranceService.SOCIAL_INSURANCE_RATE,
      healthRate: InsuranceService.HEALTH_INSURANCE_RATE,
      unemploymentRate: InsuranceService.UNEMPLOYMENT_INSURANCE_RATE,
      maxContributionBase: 20 * 2_610_000,
    };

    const contributionBase = Math.min(insuranceSalary, p.maxContributionBase);

    // Employer rates: BHXH 17.5%, BHYT 0%, BHTN 0% (varies by region/policy)
    const socialInsurance = Math.round(contributionBase * 0.175); // Employer BHXH
    const healthInsurance = 0; // Employer BHYT is covered separately
    const unemploymentInsurance = Math.round(contributionBase * 0.01); // Employer BHTN
    const totalInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

    return {
      contributionBase,
      socialInsurance,
      healthInsurance,
      unemploymentInsurance,
      totalInsurance,
    };
  }
}
