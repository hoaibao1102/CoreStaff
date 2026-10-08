/**
 * BE Unit Tests — OT pay & company tax flag.
 *
 * Tiền OT = số giờ × tiền công 1 giờ × hệ số (ngày thường 1.5).
 * Cờ công ty `overtimeTaxable` quyết định TOÀN BỘ tiền OT có vào thu nhập tính
 * thuế hay không — không còn chia tiền OT thành phần miễn/chịu thuế.
 *
 * Helper dưới đây là bản rút gọn của luồng thật:
 *   payroll-snapshot.service  → sinh otPay + cờ
 *   payroll-run / payslip     → tính gross, bảo hiểm, PIT, net
 */

import { describe, expect, it } from '@jest/globals';

const mockInsurancePolicy = {
  socialRate: 0.08,
  healthRate: 0.015,
  unemploymentRate: 0.01,
  maxContributionBase: 52_200_000,
};

const mockTaxPolicy = {
  brackets: [
    { min: 0, max: 5_000_000, rate: 0.05 },
    { min: 5_000_001, max: 10_000_000, rate: 0.1 },
    { min: 10_000_001, max: 18_000_000, rate: 0.2 },
    { min: 18_000_001, max: 32_000_000, rate: 0.25 },
    { min: 32_000_001, max: Infinity, rate: 0.3 },
  ],
};

const STANDARD_DEDUCTION = 15_500_000;
const DEPENDENT_DEDUCTION = 6_200_000;
const WORKING_DAY_COEFFICIENT = 1.5;

interface EmployeeResult {
  proratedBaseSalary: number;
  totalAllowances: number;
  hourlyRate: number;
  otPay: number;
  overtimeTaxable: boolean;
  grossEarnings: number;
  totalInsurance: number;
  taxableIncomeForPIT: number;
  taxableEarnings: number;
  personalDeduction: number;
  dependentDeduction: number;
  pitAmount: number;
  netSalary: number;
}

/** Rút gọn luồng tính lương thật cho một nhân viên. */
function calculateEmployee(
  snapshot: any,
  insurancePolicy: any,
  taxPolicy: any,
  overtimeTaxable: boolean,
): EmployeeResult {
  const standardDays = snapshot.standardDays || 22;

  const proratedBaseSalary = Math.round(
    (snapshot.baseSalary / standardDays) * snapshot.attendanceDays,
  );
  const totalAllowances =
    snapshot.allowances?.reduce((sum: number, a: any) => sum + (a.amount || 0), 0) || 0;

  // Tiền công 1 giờ, rồi tiền OT = giờ × đơn giá × hệ số.
  const hourlyRate = snapshot.baseSalary / (standardDays * 8);
  const otHours = (snapshot.otMinutes || 0) / 60;
  const otPay = Math.round(otHours * hourlyRate * WORKING_DAY_COEFFICIENT);

  const grossEarnings = proratedBaseSalary + totalAllowances + otPay;

  const socialInsurance = Math.round(snapshot.baseSalary * insurancePolicy.socialRate);
  const healthInsurance = Math.round(snapshot.baseSalary * insurancePolicy.healthRate);
  const unemploymentInsurance = Math.round(snapshot.baseSalary * insurancePolicy.unemploymentRate);
  const totalInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

  // Cờ bật → cả tiền OT chịu thuế; tắt → miễn hết.
  const taxableIncomeForPIT = proratedBaseSalary + totalAllowances + (overtimeTaxable ? otPay : 0);

  const personalDeduction = STANDARD_DEDUCTION;
  const dependentCount = snapshot.dependents?.length || 0;
  const dependentDeduction = dependentCount * DEPENDENT_DEDUCTION;

  const taxableEarnings = Math.max(
    taxableIncomeForPIT - totalInsurance - personalDeduction - dependentDeduction,
    0,
  );

  let pitAmount = 0;
  let remaining = taxableEarnings;
  let prevBracketMax = 0;

  for (const bracket of taxPolicy.brackets) {
    if (remaining <= 0) break;

    const bracketWidth =
      bracket.max === Infinity
        ? remaining
        : Math.min(bracket.max, taxableEarnings) - prevBracketMax;

    if (bracketWidth > 0) {
      const taxableInBracket = Math.min(remaining, bracketWidth);
      pitAmount += Math.round(taxableInBracket * (bracket.rate / 100));
      remaining -= taxableInBracket;
    }

    if (bracket.max !== Infinity) {
      prevBracketMax = bracket.max;
    }
  }

  const netSalary = grossEarnings - totalInsurance - pitAmount;

  return {
    proratedBaseSalary,
    totalAllowances,
    hourlyRate,
    otPay,
    overtimeTaxable,
    grossEarnings,
    totalInsurance,
    taxableIncomeForPIT,
    taxableEarnings,
    personalDeduction,
    dependentDeduction,
    pitAmount,
    netSalary,
  };
}

/* ───────── TESTS ───────── */

describe('Tiền OT — số giờ × đơn giá × hệ số', () => {
  it('lương 25M, 24 ngày, OT 2h ngày thường → 390.625', () => {
    const snapshot = {
      baseSalary: 25_000_000,
      attendanceDays: 24,
      standardDays: 24,
      allowances: [{ type: 'meal', amount: 500_000 }, { type: 'phone', amount: 150_000 }],
      otMinutes: 120, // 2 giờ
      dependents: [],
    };

    const result = calculateEmployee(snapshot, mockInsurancePolicy, mockTaxPolicy, false);

    const hourlyRate = 25_000_000 / (24 * 8); // 130.208,33
    expect(hourlyRate).toBeCloseTo(130_208.33, 2);
    expect(result.otPay).toBe(Math.round(2 * hourlyRate * 1.5)); // 390.625
    expect(result.otPay).toBe(390_625);
  });

  it('không có OT thì otPay = 0 và gross chỉ gồm lương + phụ cấp', () => {
    const snapshot = {
      baseSalary: 20_000_000,
      attendanceDays: 22,
      standardDays: 22,
      allowances: [{ type: 'meal', amount: 500_000 }],
      otMinutes: 0,
      dependents: [],
    };

    const result = calculateEmployee(snapshot, mockInsurancePolicy, mockTaxPolicy, true);

    expect(result.otPay).toBe(0);
    expect(result.grossEarnings).toBe(result.proratedBaseSalary + result.totalAllowances);
  });
});

describe('Cờ thuế OT — nhị phân, áp cho toàn bộ tiền OT', () => {
  const snapshot = {
    baseSalary: 25_000_000,
    attendanceDays: 24,
    standardDays: 24,
    allowances: [{ type: 'meal', amount: 500_000 }, { type: 'phone', amount: 150_000 }],
    otMinutes: 120,
    dependents: [],
  };

  it('cờ TẮT → không đồng tiền OT nào vào thu nhập tính thuế', () => {
    const result = calculateEmployee(snapshot, mockInsurancePolicy, mockTaxPolicy, false);

    expect(result.taxableIncomeForPIT).toBe(
      result.proratedBaseSalary + result.totalAllowances,
    );
    // Chênh lệch giữa gross và cơ sở PIT đúng bằng toàn bộ tiền OT.
    expect(result.grossEarnings - result.taxableIncomeForPIT).toBe(result.otPay);
  });

  it('cờ BẬT → cả tiền OT vào thu nhập tính thuế', () => {
    const result = calculateEmployee(snapshot, mockInsurancePolicy, mockTaxPolicy, true);

    expect(result.taxableIncomeForPIT).toBe(
      result.proratedBaseSalary + result.totalAllowances + result.otPay,
    );
    expect(result.grossEarnings).toBe(result.taxableIncomeForPIT);
  });

  it('bật cờ làm PIT tăng, net giảm — chênh lệch chỉ do thuế', () => {
    const off = calculateEmployee(snapshot, mockInsurancePolicy, mockTaxPolicy, false);
    const on = calculateEmployee(snapshot, mockInsurancePolicy, mockTaxPolicy, true);

    expect(on.grossEarnings).toBe(off.grossEarnings);
    expect(on.pitAmount).toBeGreaterThanOrEqual(off.pitAmount);
    expect(on.netSalary).toBeLessThanOrEqual(off.netSalary);
    expect(off.netSalary - on.netSalary).toBe(on.pitAmount - off.pitAmount);
  });
});

describe('Reconciliation — Net = Gross − bảo hiểm − PIT', () => {
  const scenarios = [
    { name: 'No OT', otMinutes: 0, baseSalary: 18_000_000 },
    { name: 'Low OT', otMinutes: 60, baseSalary: 20_000_000 },
    { name: 'Medium OT', otMinutes: 120, baseSalary: 25_000_000 },
    { name: 'High OT', otMinutes: 240, baseSalary: 30_000_000 },
    { name: 'Very High OT', otMinutes: 480, baseSalary: 50_000_000 },
  ];

  for (const overtimeTaxable of [false, true]) {
    it(`đúng ở cả hai nhánh cờ (overtimeTaxable = ${overtimeTaxable})`, () => {
      for (const scenario of scenarios) {
        const snapshot = {
          baseSalary: scenario.baseSalary,
          attendanceDays: 22,
          standardDays: 22,
          allowances: [{ type: 'meal', amount: 500_000 }],
          otMinutes: scenario.otMinutes,
          dependents: [],
        };

        const result = calculateEmployee(
          snapshot,
          mockInsurancePolicy,
          mockTaxPolicy,
          overtimeTaxable,
        );

        expect(result.netSalary).toBe(result.grossEarnings - result.totalInsurance - result.pitAmount);
        expect(result.netSalary).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
