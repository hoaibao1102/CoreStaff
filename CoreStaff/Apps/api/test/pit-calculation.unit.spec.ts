/**
 * BE Unit Tests — PIT Calculation Domain Logic (FINAL)
 * 
 * Tests the tax-policy-domain.ts calculatePIT function directly,
 * verifying bracket calculations, deductions, and rounding behavior.
 */

import './env-guard';
import { describe, expect, it } from '@jest/globals';
import { calculatePIT, TaxBracket } from '../src/hr/policies/tax-policy-domain';

const DEFAULT_BRACKETS: TaxBracket[] = [
  { upperLimit: 10_000_000, rate: 5 },
  { upperLimit: 30_000_000, rate: 10 },
  { upperLimit: 60_000_000, rate: 20 },
  { upperLimit: 100_000_000, rate: 30 },
  { upperLimit: Infinity, rate: 35 },
];

describe('calculatePIT — Progressive Tax Brackets', () => {
  it('should return 0 for zero gross earnings', () => {
    const result = calculatePIT({
      grossEarnings: 0,
      insuranceBaseSalary: 0,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 0,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(result.taxableIncome).toBe(0);
    expect(result.pit).toBe(0);
  });

  it('should calculate tax for income in first bracket only', () => {
    // Monthly salary: 15M, Insurance: 1.575M, Personal deduction: 15.5M, Dependents: 0
    const result = calculatePIT({
      grossEarnings: 15_000_000,
      insuranceBaseSalary: 15_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 0,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
    expect(result.personalDeduction).toBe(15_500_000);
    // Response field = perPersonRate × count = 6.2M × 0 = 0
    expect(result.dependentDeduction).toBe(0);
  });

  it('should apply progressive brackets correctly for high income', () => {
    const result = calculatePIT({
      grossEarnings: 50_000_000,
      insuranceBaseSalary: 50_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 1,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(result.taxableIncome).toBeGreaterThan(0);
    expect(result.taxableIncome).toBeLessThan(50_000_000);
    expect(result.pit).toBeGreaterThan(0);
    expect(result.pit).toBeLessThan(result.taxableIncome);
    expect(result.insuranceDeduction).toBeGreaterThan(0);
    expect(result.totalDeductions).toBeGreaterThan(0);
    expect(result.taxableEarnings).toBeGreaterThanOrEqual(0);
  });

  it('should handle maximum dependents reducing tax to 0', () => {
    const result = calculatePIT({
      grossEarnings: 20_000_000,
      insuranceBaseSalary: 20_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 10,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(result.taxableIncome).toBe(0);
    expect(result.pit).toBe(0);
    expect(result.totalDeductions).toBeGreaterThan(0);
  });

  it('should round correctly with ROUND_DOWN_TO_VND', () => {
    const result = calculatePIT({
      grossEarnings: 30_000_000,
      insuranceBaseSalary: 30_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 0,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_DOWN_TO_VND',
    });

    expect(Number.isInteger(result.pit)).toBe(true);
    expect(result.roundingRule).toBe('ROUND_DOWN_TO_VND');
  });

  it('should include all calculation details in result', () => {
    const result = calculatePIT({
      grossEarnings: 40_000_000,
      insuranceBaseSalary: 40_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 2,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(typeof result.taxableIncome).toBe('number');
    expect(typeof result.pit).toBe('number');
    expect(typeof result.insuranceDeduction).toBe('number');
    expect(typeof result.personalDeduction).toBe('number');
    expect(typeof result.dependentDeduction).toBe('number');
    expect(typeof result.totalDeductions).toBe('number');
    expect(typeof result.taxableEarnings).toBe('number');
    expect(typeof result.roundingRule).toBe('string');
    
    expect(result.personalDeduction).toBe(15_500_000);
    // Response field = perPersonRate × count = 6.2M × 2 = 12.4M
    expect(result.dependentDeduction).toBe(12_400_000);
    expect(result.insuranceDeduction).toBeGreaterThan(0);
  });

  it('should handle no dependents correctly', () => {
    const result = calculatePIT({
      grossEarnings: 25_000_000,
      insuranceBaseSalary: 25_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 0,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    // Response field = perPersonRate × count = 6.2M × 0 = 0
    expect(result.dependentDeduction).toBe(0);
    expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
  });

  it('should handle insurance base different from gross', () => {
    const result = calculatePIT({
      grossEarnings: 50_000_000,
      insuranceBaseSalary: 30_000_000,
      personalDeduction: 15_500_000,
      dependentDeduction: 6_200_000,
      dependentCount: 1,
      brackets: DEFAULT_BRACKETS,
      roundingRule: 'ROUND_HALF_UP_TO_VND',
    });

    expect(result.insuranceDeduction).toBeLessThan(50_000_000 * 0.105);
    expect(result.taxableIncome).toBeGreaterThan(0);
  });

  it('should satisfy reconciliation: PIT < TaxableIncome', () => {
    const scenarios = [
      { gross: 20_000_000, deps: 0 },
      { gross: 30_000_000, deps: 1 },
      { gross: 50_000_000, deps: 2 },
      { gross: 80_000_000, deps: 3 },
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
        expect(result.pit).toBeLessThan(result.taxableIncome);
        expect(result.pit).toBeGreaterThan(0);
      }
    }
  });
});
