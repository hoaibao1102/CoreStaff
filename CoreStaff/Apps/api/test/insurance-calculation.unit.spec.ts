/**
 * BE Unit Tests — Insurance Calculation (TASK-090/091/092)
 *
 * Trước đây file này dựng lại một bản sao của `InsuranceService.calculateContributions`
 * — hàm đó đã bị xoá (D46) vì không caller nào và thiếu sàn luật định. Test nay
 * chạy thẳng engine chuẩn, cũng là engine mà luồng tính lương dùng.
 *
 * Test coverage:
 * - Employee contributions (BHXH 8%, BHYT 1.5%, BHTN 1%)
 * - Sàn + trần áp theo TỪNG loại (§30D.3 / AC-INS-03)
 * - `participates* = false` → khoản đó không phát sinh
 * - Làm tròn ROUND_HALF_UP_TO_VND theo từng dòng
 */

import { describe, expect, it } from '@jest/globals';
import {
  calculateInsuranceContributions,
  roundHalfUpToVnd,
  type InsuranceParticipation,
  type InsurancePolicyLike,
} from '../src/hr/insurance-policy/insurance-calculation';
import { InsuranceContributionType } from '../src/database/schemas/enums';

const CAP = 52_200_000; // 20× lương tối thiểu vùng (2026)

const POLICY: InsurancePolicyLike = {
  socialInsuranceEmployeeRate: 0.08,
  healthInsuranceEmployeeRate: 0.015,
  unemploymentInsuranceEmployeeRate: 0.01,
  salaryBaseRules: [
    { type: InsuranceContributionType.SOCIAL_INSURANCE, floorAmount: null },
    { type: InsuranceContributionType.HEALTH_INSURANCE, floorAmount: null },
    { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, floorAmount: null },
  ],
  capRules: [
    { type: InsuranceContributionType.SOCIAL_INSURANCE, capAmount: CAP },
    { type: InsuranceContributionType.HEALTH_INSURANCE, capAmount: CAP },
    { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, capAmount: CAP },
  ],
  employerContributionRates: [
    { type: InsuranceContributionType.SOCIAL_INSURANCE, rate: 0.175 },
    { type: InsuranceContributionType.HEALTH_INSURANCE, rate: 0 },
    { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, rate: 0.01 },
  ],
};

const FULL: InsuranceParticipation = {
  participatesSocialInsurance: true,
  participatesHealthInsurance: true,
  participatesUnemploymentInsurance: true,
};

const lineOf = (result: ReturnType<typeof calculateInsuranceContributions>, type: InsuranceContributionType) =>
  result.lines.find((l) => l.type === type);

describe('calculateInsuranceContributions — employee rates', () => {
  it('tính đúng BHXH 8% / BHYT 1.5% / BHTN 1% khi lương dưới trần', () => {
    const salary = 25_000_000;
    const result = calculateInsuranceContributions(POLICY, FULL, salary);

    expect(lineOf(result, InsuranceContributionType.SOCIAL_INSURANCE)?.employeeContribution).toBe(roundHalfUpToVnd(salary * 0.08));
    expect(lineOf(result, InsuranceContributionType.HEALTH_INSURANCE)?.employeeContribution).toBe(roundHalfUpToVnd(salary * 0.015));
    expect(lineOf(result, InsuranceContributionType.UNEMPLOYMENT_INSURANCE)?.employeeContribution).toBe(roundHalfUpToVnd(salary * 0.01));
    expect(result.mandatoryEmployeeInsurance).toBe(roundHalfUpToVnd(salary * 0.105));
  });

  it('kẹp trần theo từng loại', () => {
    const result = calculateInsuranceContributions(POLICY, FULL, 100_000_000);

    for (const line of result.lines) {
      expect(line.base).toBe(CAP);
    }
    expect(lineOf(result, InsuranceContributionType.SOCIAL_INSURANCE)?.employeeContribution).toBe(roundHalfUpToVnd(CAP * 0.08));
  });

  it('trả 0 khi lương đóng bảo hiểm bằng 0', () => {
    const result = calculateInsuranceContributions(POLICY, FULL, 0);

    expect(result.mandatoryEmployeeInsurance).toBe(0);
    expect(result.lines.every((l) => l.employeeContribution === 0)).toBe(true);
  });
});

describe('calculateInsuranceContributions — sàn theo từng loại (AC-INS-03)', () => {
  it('nâng base lên sàn của đúng loại đó, không đụng loại khác', () => {
    const policy: InsurancePolicyLike = {
      ...POLICY,
      salaryBaseRules: [
        { type: InsuranceContributionType.SOCIAL_INSURANCE, floorAmount: 5_000_000 },
        { type: InsuranceContributionType.HEALTH_INSURANCE, floorAmount: null },
        { type: InsuranceContributionType.UNEMPLOYMENT_INSURANCE, floorAmount: null },
      ],
    };
    const result = calculateInsuranceContributions(policy, FULL, 3_000_000);

    // BHXH bị đẩy lên sàn, hai khoản còn lại giữ nguyên lương thật.
    expect(lineOf(result, InsuranceContributionType.SOCIAL_INSURANCE)?.base).toBe(5_000_000);
    expect(lineOf(result, InsuranceContributionType.HEALTH_INSURANCE)?.base).toBe(3_000_000);
    expect(lineOf(result, InsuranceContributionType.UNEMPLOYMENT_INSURANCE)?.base).toBe(3_000_000);
  });
});

describe('calculateInsuranceContributions — participation (AC-INS-02)', () => {
  it('không tham gia → không sinh dòng, khoản đó bằng 0', () => {
    const result = calculateInsuranceContributions(POLICY, { ...FULL, participatesHealthInsurance: false }, 25_000_000);

    expect(lineOf(result, InsuranceContributionType.HEALTH_INSURANCE)).toBeUndefined();
    expect(result.lines).toHaveLength(2);
    expect(result.mandatoryEmployeeInsurance).toBe(roundHalfUpToVnd(25_000_000 * 0.09));
  });

  it('không tham gia khoản nào → tổng bằng 0', () => {
    const result = calculateInsuranceContributions(POLICY, {
      participatesSocialInsurance: false,
      participatesHealthInsurance: false,
      participatesUnemploymentInsurance: false,
    }, 25_000_000);

    expect(result.lines).toEqual([]);
    expect(result.mandatoryEmployeeInsurance).toBe(0);
    expect(result.employerInsuranceCost).toBe(0);
  });
});

describe('calculateInsuranceContributions — làm tròn & employer cost', () => {
  it('mọi dòng đều là số nguyên VND', () => {
    const result = calculateInsuranceContributions(POLICY, FULL, 1_234_567);

    for (const line of result.lines) {
      expect(Number.isInteger(line.employeeContribution)).toBe(true);
      expect(Number.isInteger(line.employerContribution)).toBe(true);
    }
  });

  it('cộng chi phí người sử dụng lao động riêng, không trừ vào Net', () => {
    const salary = 25_000_000;
    const result = calculateInsuranceContributions(POLICY, FULL, salary);

    expect(result.employerInsuranceCost).toBe(roundHalfUpToVnd(salary * 0.175) + roundHalfUpToVnd(salary * 0.01));
    expect(result.mandatoryEmployeeInsurance).toBe(roundHalfUpToVnd(salary * 0.105));
  });
});
