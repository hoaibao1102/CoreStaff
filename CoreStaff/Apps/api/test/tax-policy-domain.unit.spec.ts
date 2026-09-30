/**
 * BE Unit Tests — Tax Policy Domain (Pure Functions)
 * 
 * Tests all pure functions in tax-policy-domain.ts:
 * - calculateProgressivePIT() — progressive bracket calculation
 * - calculateInsuranceDeduction() — 10.5% employee insurance
 * - calculateDependentDeduction() — per-dependent deduction
 * - calculatePIT() — full PIT calculation pipeline
 * 
 * These are SIDE-EFFECT FREE functions — no DB, no API calls.
 */

import './env-guard';
import { describe, expect, it } from '@jest/globals';
import {
  calculateProgressivePIT,
  calculateInsuranceDeduction,
  calculateDependentDeduction,
  calculatePIT,
  TaxBracket,
} from '../src/hr/policies/tax-policy-domain';

/* ───────── HELPERS ───────── */

const DEFAULT_BRACKETS: TaxBracket[] = [
  { upperLimit: 10_000_000, rate: 5 },
  { upperLimit: 30_000_000, rate: 10 },
  { upperLimit: 60_000_000, rate: 20 },
  { upperLimit: 100_000_000, rate: 30 },
  { upperLimit: Infinity, rate: 35 },
];

/* ═══════════════════════════════════════════════════
   TEST GROUP 1: calculateProgressivePIT
   ═══════════════════════════════════════════════════ */

describe('calculateProgressivePIT', () => {
  it('should return 0 for negative or zero taxable income', () => {
    expect(calculateProgressivePIT(0, DEFAULT_BRACKETS)).toBe(0);
    expect(calculateProgressivePIT(-1_000_000, DEFAULT_BRACKETS)).toBe(0);
  });

  it('should calculate single bracket correctly (income < 5M)', () => {
    // 3,000,000 × 5% = 150,000
    const result = calculateProgressivePIT(3_000_000, DEFAULT_BRACKETS);
    expect(result).toBe(150_000);
  });

  it('should calculate single bracket correctly (income < 10M)', () => {
    // 3,000,000 × 5% = 150,000
    const result = calculateProgressivePIT(3_000_000, DEFAULT_BRACKETS);
    expect(result).toBe(150_000);
  });

  it('should calculate two brackets correctly (income 10M–30M)', () => {
    // 10M × 5% + 3M × 10% = 500,000 + 300,000 = 800,000
    const result = calculateProgressivePIT(13_000_000, DEFAULT_BRACKETS);
    expect(result).toBe(800_000);
  });

  it('should calculate three brackets correctly (income 30M–60M)', () => {
    // 10M × 5% + 20M × 10% + 10M × 20% = 500K + 2M + 2M = 4,500,000
    const result = calculateProgressivePIT(40_000_000, DEFAULT_BRACKETS);
    expect(result).toBe(4_500_000);
  });

  it('should calculate four brackets correctly (income 60M–100M)', () => {
    // 10M × 5% + 20M × 10% + 30M × 20% + 5M × 30% = 500K + 2M + 6M + 1.5M = 10,000,000
    const result = calculateProgressivePIT(65_000_000, DEFAULT_BRACKETS);
    expect(result).toBe(10_000_000);
  });

  it('should calculate five brackets correctly (income > 100M)', () => {
    // 10M × 5% + 20M × 10% + 30M × 20% + 40M × 30% + 20M × 35%
    // = 500K + 2M + 6M + 12M + 7M = 22,500,000
    const result = calculateProgressivePIT(120_000_000, DEFAULT_BRACKETS);
    expect(result).toBe(22_500_000);
  });

  it('should handle empty brackets array', () => {
    expect(calculateProgressivePIT(10_000_000, [])).toBe(0);
  });

  it('should match example from docstring: taxableIncome = 20M', () => {
    // From docstring (updated for 2026 brackets):
    // 10M × 5% = 500,000
    // 10M × 10% = 1,000,000
    // Total = 1,500,000
    const result = calculateProgressivePIT(20_000_000, DEFAULT_BRACKETS);
    expect(result).toBe(1_500_000);
  });
});

/* ═══════════════════════════════════════════════════
   TEST GROUP 2: calculateInsuranceDeduction
   ═══════════════════════════════════════════════════ */

describe('calculateInsuranceDeduction', () => {
  it('should calculate 10.5% of base salary', () => {
    // 30,000,000 × 10.5% = 3,150,000
    expect(calculateInsuranceDeduction(30_000_000)).toBe(3_150_000);
  });

  it('should return 0 for zero base', () => {
    expect(calculateInsuranceDeduction(0)).toBe(0);
  });

  it('should handle capped base (52,200,000)', () => {
    // 52,200,000 × 10.5% = 5,481,000
    expect(calculateInsuranceDeduction(52_200_000)).toBe(5_481_000);
  });

  it('should handle odd numbers correctly', () => {
    // 10,000,001 × 10.5% = 1,050,000.105 → floating point
    const result = calculateInsuranceDeduction(10_000_001);
    expect(result).toBeCloseTo(1_050_000.105, 2);
  });
});

/* ═══════════════════════════════════════════════════
   TEST GROUP 3: calculateDependentDeduction
   ═══════════════════════════════════════════════════ */

describe('calculateDependentDeduction', () => {
  it('should calculate total dependent deduction', () => {
    // 3 dependents × 6,200,000 = 18,600,000
    expect(calculateDependentDeduction(3, 6_200_000)).toBe(18_600_000);
  });

  it('should return 0 for zero dependents', () => {
    expect(calculateDependentDeduction(0, 6_200_000)).toBe(0);
  });

  it('should use correct 2026 rate (6,200,000)', () => {
    // 1 dependent × 6,200,000 = 6,200,000
    expect(calculateDependentDeduction(1, 6_200_000)).toBe(6_200_000);
  });

  it('should handle large number of dependents', () => {
    // 10 dependents × 6,200,000 = 62,000,000
    expect(calculateDependentDeduction(10, 6_200_000)).toBe(62_000_000);
  });
});

/* ═══════════════════════════════════════════════════
   TEST GROUP 4: calculatePIT (Full Pipeline)
   ═══════════════════════════════════════════════════ */

describe('calculatePIT — Full Pipeline', () => {
  it('should return 0 PIT when gross is below deductions', () => {
    const result = calculatePIT({
      grossEarnings: 10_000_000,
      insuranceBaseSalary: 10_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 0,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(result.taxableIncome).toBe(0);
    expect(result.pit).toBe(0);
    expect(result.taxableEarnings).toBe(0);
  });

  it('should correctly calculate PIT for mid-range salary (25M, 0 deps)', () => {
    // Insurance: 25M × 10.5% = 2,625,000
    // Total deductions: 2,625,000 + 15,500,000 + 0 = 18,125,000
    // Taxable income: 25M - 18,125,000 = 6,875,000
    // PIT: 5M × 5% + 1,875,000 × 10% = 250,000 + 187,500 = 437,500
    const result = calculatePIT({
      grossEarnings: 25_000_000,
      insuranceBaseSalary: 25_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 0,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(result.insuranceDeduction).toBe(2_625_000);
    expect(result.personalDeduction).toBe(15_500_000);
    expect(result.dependentDeduction).toBe(0); // 6.2M × 0 = 0
    expect(result.totalDeductions).toBe(18_125_000);
    expect(result.taxableIncome).toBe(6_875_000);
    expect(result.pit).toBe(437_500);
    expect(result.taxableEarnings).toBe(6_875_000);
  });

  it('should correctly calculate PIT for high salary with dependents (40M, 2 deps)', () => {
    // Insurance: 40M × 10.5% = 4,200,000
    // Dependent deduction: 6,200,000 × 2 = 12,400,000
    // Total deductions: 4,200,000 + 15,500,000 + 12,400,000 = 32,100,000
    // Taxable income: 40M - 32,100,000 = 7,900,000
    // PIT: 5M × 5% + 2,900,000 × 10% = 250,000 + 290,000 = 540,000
    const result = calculatePIT({
      grossEarnings: 40_000_000,
      insuranceBaseSalary: 40_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 2,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(result.insuranceDeduction).toBe(4_200_000);
    expect(result.dependentDeduction).toBe(12_400_000); // 6.2M × 2
    expect(result.totalDeductions).toBe(32_100_000);
    expect(result.taxableIncome).toBe(7_900_000);
    expect(result.pit).toBe(540_000);
  });

  it('should clamp taxable income to 0 when deductions exceed gross', () => {
    const result = calculatePIT({
      grossEarnings: 15_000_000,
      insuranceBaseSalary: 15_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 5, // 31M dependent deduction alone!
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(result.taxableIncome).toBe(0);
    expect(result.pit).toBe(0);
    expect(result.taxableEarnings).toBe(0);
  });

  it('should apply ROUND_DOWN_TO_VND correctly', () => {
    const result = calculatePIT({
      grossEarnings: 50_000_000,
      insuranceBaseSalary: 50_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 1,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_DOWN_TO_VND',
    });

    expect(Number.isInteger(result.pit)).toBe(true);
    expect(result.roundingRule).toBe('ROUND_DOWN_TO_VND');
  });

  it('should apply ROUND_UP_TO_VND correctly', () => {
    const result = calculatePIT({
      grossEarnings: 50_000_000,
      insuranceBaseSalary: 50_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 1,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_UP_TO_VND',
    });

    expect(Number.isInteger(result.pit)).toBe(true);
    expect(result.roundingRule).toBe('ROUND_UP_TO_VND');
  });

  it('should handle maximum contribution base cap (52,200,000)', () => {
    // Employee earns 80M but insurance capped at 52.2M
    const result = calculatePIT({
      grossEarnings: 80_000_000,
      insuranceBaseSalary: 52_200_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 2,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    // Insurance: 52.2M × 10.5% = 5,481,000
    // Dependent: 6.2M × 2 = 12,400,000
    // Total deductions: 5,481,000 + 15,500,000 + 12,400,000 = 33,381,000
    // Taxable: 80M - 33,381,000 = 46,619,000
    expect(result.insuranceDeduction).toBe(5_481_000);
    expect(result.dependentDeduction).toBe(12_400_000);
    expect(result.taxableIncome).toBeGreaterThan(0);
    expect(result.pit).toBeGreaterThan(0);
  });

  it('should satisfy reconciliation: PIT < TaxableIncome always', () => {
    const scenarios = [
      { gross: 20_000_000, deps: 0 },
      { gross: 30_000_000, deps: 1 },
      { gross: 50_000_000, deps: 2 },
      { gross: 80_000_000, deps: 3 },
      { gross: 100_000_000, deps: 5 },
    ];

    for (const scenario of scenarios) {
      const result = calculatePIT({
        grossEarnings: scenario.gross,
        insuranceBaseSalary: scenario.gross,
        personalDeduction: 15_500_000,
        dependentDeduction: 6_200_000,
        dependentCount: scenario.deps,
        brackets: DEFAULT_BRACKETS,
        roundingRule: 'ROUND_HALF_UP_TO_VND',
      });

      if (result.taxableIncome > 0) {
        // PIT must always be less than taxable income (max rate 30%)
        expect(result.pit).toBeLessThan(result.taxableIncome);
        expect(result.pit).toBeGreaterThan(0);
        
        // Effective rate should be reasonable (< 30%)
        const effectiveRate = (result.pit / result.taxableIncome) * 100;
        expect(effectiveRate).toBeLessThan(30);
      }
    }
  });
});
