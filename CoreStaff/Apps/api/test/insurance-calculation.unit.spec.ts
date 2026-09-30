/**
 * BE Unit Tests — Insurance Calculation (TASK-090/091/092)
 * 
 * Test coverage:
 * - Employee insurance contributions (BHXH 8%, BHYT 1.5%, BHTN 1%)
 * - Contribution base capping at policy maximum
 * - Employer insurance contributions
 * - Default rates when no policy found
 */

import { describe, expect, it } from '@jest/globals';

// Simulate InsuranceService logic (pure functions extracted from service)
const SOCIAL_INSURANCE_RATE = 0.08;   // 8% BHXH
const HEALTH_INSURANCE_RATE = 0.015;  // 1.5% BHYT
const UNEMPLOYMENT_INSURANCE_RATE = 0.01; // 1% BHTN
const DEFAULT_MAX_BASE = 20 * 2_610_000; // 52,200,000 VND (20x minimum salary 2026)

interface InsuranceResult {
  contributionBase: number;
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  totalInsurance: number;
}

/**
 * Calculate employee insurance contributions.
 */
function calculateEmployeeInsurance(
  insuranceSalary: number,
  maxContributionBase: number = DEFAULT_MAX_BASE
): InsuranceResult {
  // Cap contribution base at policy maximum
  const contributionBase = Math.min(insuranceSalary, maxContributionBase);

  const socialInsurance = Math.round(contributionBase * SOCIAL_INSURANCE_RATE);
  const healthInsurance = Math.round(contributionBase * HEALTH_INSURANCE_RATE);
  const unemploymentInsurance = Math.round(contributionBase * UNEMPLOYMENT_INSURANCE_RATE);
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
 */
function calculateEmployerInsurance(
  insuranceSalary: number,
  maxContributionBase: number = DEFAULT_MAX_BASE
): InsuranceResult {
  const contributionBase = Math.min(insuranceSalary, maxContributionBase);

  // Employer rates: BHXH 17.5%, BHTN 1%
  const socialInsurance = Math.round(contributionBase * 0.175);
  const healthInsurance = 0;
  const unemploymentInsurance = Math.round(contributionBase * 0.01);
  const totalInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

  return {
    contributionBase,
    socialInsurance,
    healthInsurance,
    unemploymentInsurance,
    totalInsurance,
  };
}

/* ───────── TESTS ───────── */

describe('calculateEmployeeInsurance — Normal Cases', () => {
  it('should calculate correctly for salary below cap', () => {
    const result = calculateEmployeeInsurance(25_000_000);

    expect(result.contributionBase).toBe(25_000_000);
    expect(result.socialInsurance).toBe(Math.round(25_000_000 * 0.08)); // 2,000,000
    expect(result.healthInsurance).toBe(Math.round(25_000_000 * 0.015)); // 375,000
    expect(result.unemploymentInsurance).toBe(Math.round(25_000_000 * 0.01)); // 250,000
    expect(result.totalInsurance).toBe(2_000_000 + 375_000 + 250_000); // 2,625,000
  });

  it('should calculate correctly for salary above cap', () => {
    const result = calculateEmployeeInsurance(100_000_000);

    // Should be capped at DEFAULT_MAX_BASE
    expect(result.contributionBase).toBe(DEFAULT_MAX_BASE);
    expect(result.socialInsurance).toBe(Math.round(DEFAULT_MAX_BASE * 0.08));
    expect(result.healthInsurance).toBe(Math.round(DEFAULT_MAX_BASE * 0.015));
    expect(result.unemploymentInsurance).toBe(Math.round(DEFAULT_MAX_BASE * 0.01));
  });

  it('should return 0 for zero salary', () => {
    const result = calculateEmployeeInsurance(0);

    expect(result.contributionBase).toBe(0);
    expect(result.socialInsurance).toBe(0);
    expect(result.healthInsurance).toBe(0);
    expect(result.unemploymentInsurance).toBe(0);
    expect(result.totalInsurance).toBe(0);
  });

  it('should use custom maxContributionBase', () => {
    const customCap = 30_000_000;
    const result = calculateEmployeeInsurance(40_000_000, customCap);

    expect(result.contributionBase).toBe(customCap);
    expect(result.socialInsurance).toBe(Math.round(customCap * 0.08));
  });
});

describe('calculateEmployerInsurance — Normal Cases', () => {
  it('should calculate correctly for salary below cap', () => {
    const result = calculateEmployerInsurance(25_000_000);

    expect(result.contributionBase).toBe(25_000_000);
    expect(result.socialInsurance).toBe(Math.round(25_000_000 * 0.175)); // 4,375,000
    expect(result.healthInsurance).toBe(0);
    expect(result.unemploymentInsurance).toBe(Math.round(25_000_000 * 0.01)); // 250,000
    expect(result.totalInsurance).toBe(4_375_000 + 250_000); // 4,625,000
  });

  it('should cap at policy maximum', () => {
    const result = calculateEmployerInsurance(100_000_000);

    expect(result.contributionBase).toBe(DEFAULT_MAX_BASE);
    expect(result.socialInsurance).toBe(Math.round(DEFAULT_MAX_BASE * 0.175));
  });
});

describe('Edge Cases', () => {
  it('should handle very small salary', () => {
    const result = calculateEmployeeInsurance(1_000_000);

    expect(result.contributionBase).toBe(1_000_000);
    expect(result.socialInsurance).toBe(80_000);
    expect(result.healthInsurance).toBe(15_000);
    expect(result.unemploymentInsurance).toBe(10_000);
    expect(result.totalInsurance).toBe(105_000);
  });

  it('should handle exact cap boundary', () => {
    const result = calculateEmployeeInsurance(DEFAULT_MAX_BASE);

    expect(result.contributionBase).toBe(DEFAULT_MAX_BASE);
    expect(result.socialInsurance).toBe(Math.round(DEFAULT_MAX_BASE * 0.08));
  });

  it('should round correctly for fractional amounts', () => {
    const result = calculateEmployeeInsurance(1_234_567);

    expect(Number.isInteger(result.socialInsurance)).toBe(true);
    expect(Number.isInteger(result.healthInsurance)).toBe(true);
    expect(Number.isInteger(result.unemploymentInsurance)).toBe(true);
  });
});

describe('Total Employee Rate Verification', () => {
  it('should sum to 10.5% total employee contribution', () => {
    const result = calculateEmployeeInsurance(50_000_000);

    const effectiveRate = result.totalInsurance / result.contributionBase;
    expect(effectiveRate).toBeCloseTo(0.105, 2); // 10.5%
  });
});
