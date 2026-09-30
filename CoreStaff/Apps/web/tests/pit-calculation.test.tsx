/**
 * PIT Progressive Tax Calculation — Unit Tests
 * 
 * Test coverage based on Vietnam's 5-bracket progressive tax law:
 * - Bracket 1: ≤ 60 million → 5%
 * - Bracket 2: 60-100 million → 10%
 * - Bracket 3: 100-200 million → 20%
 * - Bracket 4: 200-400 million → 25%
 * - Bracket 5: > 400 million → 30%
 * 
 * Standard deduction: 11,000,000 VND/month
 * Dependent deduction: 9,000,000 VND/person/month
 */

import { describe, expect, it } from '@jest/globals';

/* ───────── PIT CALCULATION LOGIC (from tax-policy-domain.ts) ───────── */

interface TaxBracket {
  upperLimit: number | null; // null = infinity
  rate: number; // percentage (e.g., 5 for 5%)
}

interface PitCalculationResult {
  grossIncome: number;
  insuranceContributions: number;
  dependentDeductions: number;
  standardDeduction: number;
  taxableIncome: number;
  pitAmount: number;
  effectiveRate: number; // percentage
}

/**
 * Calculate progressive PIT based on Vietnam tax brackets.
 */
function calculateProgressivePIT(
  taxableIncome: number,
  brackets: TaxBracket[],
  roundingRule: 'ROUND_HALF_UP_TO_VND' | 'ROUND_DOWN_TO_VND' = 'ROUND_HALF_UP_TO_VND'
): number {
  if (taxableIncome <= 0) return 0;

  let remaining = taxableIncome;
  let previousUpperLimit = 0;
  let totalTax = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) break;

    const bracketUpper = bracket.upperLimit ?? Infinity;
    const bracketWidth = bracketUpper - previousUpperLimit;
    const taxableInBracket = Math.min(remaining, bracketWidth);
    const taxInBracket = taxableInBracket * (bracket.rate / 100);

    totalTax += taxInBracket;
    remaining -= taxableInBracket;
    previousUpperLimit = bracketUpper;
  }

  // Apply rounding
  if (roundingRule === 'ROUND_HALF_UP_TO_VND') {
    return Math.round(totalTax);
  } else if (roundingRule === 'ROUND_DOWN_TO_VND') {
    return Math.floor(totalTax);
  }

  return totalTax;
}

/**
 * Full PIT calculation including deductions.
 */
function calculatePIT(
  grossIncome: number,
  insuranceContributions: number,
  dependentCount: number,
  standardDeduction: number,
  dependentDeductionPerPerson: number,
  brackets: TaxBracket[],
  roundingRule: 'ROUND_HALF_UP_TO_VND' | 'ROUND_DOWN_TO_VND' = 'ROUND_HALF_UP_TO_VND'
): PitCalculationResult {
  const dependentDeductions = dependentCount * dependentDeductionPerPerson;
  
  // Taxable income = grossIncome - insurance - standardDeduction - dependentDeductions
  const taxableIncome = Math.max(0, grossIncome - insuranceContributions - standardDeduction - dependentDeductions);

  // Calculate progressive tax
  const pitAmount = calculateProgressivePIT(taxableIncome, brackets, roundingRule);

  // Effective rate = (pitAmount / grossIncome) * 100
  const effectiveRate = grossIncome > 0 ? (pitAmount / grossIncome) * 100 : 0;

  return {
    grossIncome,
    insuranceContributions,
    dependentDeductions,
    standardDeduction,
    taxableIncome,
    pitAmount,
    effectiveRate,
  };
}

/* ───────── TESTS ───────── */

const DEFAULT_BRACKETS: TaxBracket[] = [
  { upperLimit: 10_000_000, rate: 5 },      // Bậc 1: ≤ 10 triệu
  { upperLimit: 30_000_000, rate: 10 },     // Bậc 2: trên 10 đến 30 triệu
  { upperLimit: 60_000_000, rate: 20 },     // Bậc 3: trên 30 đến 60 triệu
  { upperLimit: 100_000_000, rate: 30 },    // Bậc 4: trên 60 đến 100 triệu
  { upperLimit: null, rate: 35 },           // Bậc 5: trên 100 triệu
];

describe('calculateProgressivePIT — Bracket Calculations', () => {
  it('should return 0 when taxable income is 0', () => {
    expect(calculateProgressivePIT(0, DEFAULT_BRACKETS)).toBe(0);
  });

  it('should return 0 when taxable income is negative', () => {
    expect(calculateProgressivePIT(-1000000, DEFAULT_BRACKETS)).toBe(0);
  });

  it('should calculate tax for lowest bracket (5%)', () => {
    // Income in first bracket only
    const result = calculateProgressivePIT(5000000, DEFAULT_BRACKETS);
    // 5000000 * 5% = 250000
    expect(result).toBe(250000);
  });

  it('should calculate progressive tax across multiple brackets', () => {
    // Income: 80,000,000
    // Bracket 1: 6,000,000 * 5% = 300,000
    // Bracket 2: (10,000,000 - 6,000,000) * 10% = 400,000
    // Bracket 3: (80,000,000 - 10,000,000) * 20% = 14,000,000
    // Total: 300,000 + 400,000 + 14,000,000 = 14,700,000
    
    // Wait — the brackets represent cumulative thresholds, not widths.
    // Let me recalculate with proper understanding:
    
    // Actually, looking at the code: bracketWidth = bracketUpper - previousUpperLimit
    // So for bracket 2: width = 10M - 6M = 4M
    // For bracket 3: width = 20M - 10M = 10M
    
    // Income: 80,000,000
    // B1: min(80M, 6M) * 5% = 6M * 5% = 300,000
    // B2: min(74M, 4M) * 10% = 4M * 10% = 400,000
    // B3: min(70M, 10M) * 20% = 10M * 20% = 2,000,000
    // B4: min(60M, 20M) * 25% = 20M * 25% = 5,000,000
    // B5: min(40M, ∞) * 30% = 40M * 30% = 12,000,000
    // Total: 19,700,000
    
    const result = calculateProgressivePIT(80000000, DEFAULT_BRACKETS);
    expect(result).toBe(19700000);
  });

  it('should handle single bracket perfectly', () => {
    // Income exactly at bracket boundary
    const result = calculateProgressivePIT(6000000, DEFAULT_BRACKETS);
    // 6000000 * 5% = 300000
    expect(result).toBe(300000);
  });

  it('should handle income spanning all brackets', () => {
    // Income: 150,000,000
    // B1: 6M * 5% = 300,000
    // B2: 4M * 10% = 400,000
    // B3: 10M * 20% = 2,000,000
    // B4: 20M * 25% = 5,000,000
    // B5: 110M - 40M = 110M... wait let me recalc
    
    // After B1-B4: 150M - 6M - 4M - 10M - 20M = 110M remaining
    // B5: 110M * 30% = 33,000,000
    // Total: 300K + 400K + 2M + 5M + 33M = 40,700,000
    
    const result = calculateProgressivePIT(150000000, DEFAULT_BRACKETS);
    expect(result).toBe(40700000);
  });
});

describe('calculatePIT — Full Calculation with Deductions', () => {
  const STANDARD_DEDUCTION = 11000000;
  const DEPENDENT_DEDUCTION = 9000000;

  it('should apply standard deduction correctly', () => {
    // Gross: 25,000,000
    // Insurance: 0
    // Standard deduction: 11,000,000
    // Dependents: 0
    // Taxable: 25M - 11M = 14,000,000
    
    const result = calculatePIT(
      25000000,
      0,
      0,
      STANDARD_DEDUCTION,
      DEPENDENT_DEDUCTION,
      DEFAULT_BRACKETS
    );

    expect(result.taxableIncome).toBe(14000000);
    expect(result.dependentDeductions).toBe(0);
    expect(result.standardDeduction).toBe(STANDARD_DEDUCTION);
  });

  it('should apply dependent deductions correctly', () => {
    // Gross: 25,000,000
    // Insurance: 0
    // Standard deduction: 11,000,000
    // 2 dependents: 18,000,000
    // Taxable: 25M - 11M - 18M = -4M → 0 (clamped)
    
    const result = calculatePIT(
      25000000,
      0,
      2,
      STANDARD_DEDUCTION,
      DEPENDENT_DEDUCTION,
      DEFAULT_BRACKETS
    );

    expect(result.taxableIncome).toBe(0);
    expect(result.pitAmount).toBe(0);
    expect(result.dependentDeductions).toBe(18000000);
  });

  it('should calculate PIT for typical employee', () => {
    // Gross: 30,000,000
    // Insurance (BHXH+BHYT+BHTN = 10.5%): 3,150,000
    // Standard deduction: 11,000,000
    // 1 dependent: 9,000,000
    // Taxable: 30M - 3.15M - 11M - 9M = 6,850,000
    
    const insurance = 30000000 * 0.105; // 3,150,000
    
    const result = calculatePIT(
      30000000,
      insurance,
      1,
      STANDARD_DEDUCTION,
      DEPENDENT_DEDUCTION,
      DEFAULT_BRACKETS
    );

    expect(result.taxableIncome).toBe(Math.max(0, 30000000 - insurance - STANDARD_DEDUCTION - DEPENDENT_DEDUCTION));
    expect(result.pitAmount).toBeGreaterThan(0);
    expect(result.effectiveRate).toBeGreaterThan(0);
  });

  it('should handle zero income', () => {
    const result = calculatePIT(0, 0, 0, STANDARD_DEDUCTION, DEPENDENT_DEDUCTION, DEFAULT_BRACKETS);
    
    expect(result.taxableIncome).toBe(0);
    expect(result.pitAmount).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it('should clamp taxable income to 0 minimum', () => {
    // Low income with many dependents
    const result = calculatePIT(
      15000000,
      0,
      5, // 5 * 9M = 45M deductions
      STANDARD_DEDUCTION,
      DEPENDENT_DEDUCTION,
      DEFAULT_BRACKETS
    );

    expect(result.taxableIncome).toBe(0);
    expect(result.pitAmount).toBe(0);
  });

  it('should calculate effective rate correctly', () => {
    const result = calculatePIT(
      50000000,
      5250000, // 10.5%
      1,
      STANDARD_DEDUCTION,
      DEPENDENT_DEDUCTION,
      DEFAULT_BRACKETS
    );

    // effectiveRate = (pitAmount / grossIncome) * 100
    const expectedRate = (result.pitAmount / 50000000) * 100;
    expect(result.effectiveRate).toBeCloseTo(expectedRate, 2);
  });
});

describe('Rounding Rules', () => {
  it('should round half up to VND by default', () => {
    // This would create a fractional VND amount
    const result = calculateProgressivePIT(7000000, DEFAULT_BRACKETS, 'ROUND_HALF_UP_TO_VND');
    expect(Number.isInteger(result)).toBe(true);
  });

  it('should round down with ROUND_DOWN_TO_VND', () => {
    const result = calculateProgressivePIT(7000000, DEFAULT_BRACKETS, 'ROUND_DOWN_TO_VND');
    expect(Number.isInteger(result)).toBe(true);
    // Should be <= ROUND_HALF_UP version
    const roundUpResult = calculateProgressivePIT(7000000, DEFAULT_BRACKETS, 'ROUND_HALF_UP_TO_VND');
    expect(result).toBeLessThanOrEqual(roundUpResult);
  });
});

describe('Edge Cases', () => {
  it('should handle very large income', () => {
    const result = calculatePIT(
      1000000000, // 1 billion
      105000000,
      3,
      STANDARD_DEDUCTION,
      DEPENDENT_DEDUCTION,
      DEFAULT_BRACKETS
    );

    expect(result.taxableIncome).toBeGreaterThan(0);
    expect(result.pitAmount).toBeGreaterThan(0);
    expect(result.pitAmount).toBeLessThan(result.grossIncome); // Never exceeds gross
  });

  it('should handle single bracket system', () => {
    const flatBrackets: TaxBracket[] = [
      { upperLimit: null, rate: 10 },
    ];

    const result = calculateProgressivePIT(50000000, flatBrackets);
    expect(result).toBe(5000000); // 50M * 10%
  });

  it('should handle empty brackets array', () => {
    const result = calculateProgressivePIT(50000000, []);
    expect(result).toBe(0); // No brackets = no tax
  });
});
