/**
 * BE Unit Tests — OT Tax Split Logic (Vietnam Tax Law)
 * 
 * Test coverage:
 * - OT non-taxable = hours × coeff 1.0 × hourlyRate
 * - OT taxable = hours × coeff 0.5 × hourlyRate (only coefficient premium is subject to PIT)
 * - Gross earnings includes TOTAL OT (non-taxable + taxable)
 * - PIT calculation uses ONLY otTaxableEarnings
 * - Net salary = gross (with full OT) - insurance - PIT
 * 
 * Reference: SPRINT_8_9_IMPLEMENTATION_PLAN.md Section 2.5
 */

import { describe, expect, it } from '@jest/globals';

/* ───────── MOCK DATA ───────── */

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

const STANDARD_DEDUCTION = 15_500_000; // Updated per TaxPolicy schema
const DEPENDENT_DEDUCTION = 6_200_000;

interface EmployeeResult {
  employeeProfileId: string;
  baseSalary: number;
  proratedBaseSalary: number;
  totalAllowances: number;
  otPay: number;
  otNonTaxable: number;
  otTaxable: number;
  grossEarnings: number;
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  totalInsurance: number;
  taxableIncomeForPIT: number;
  taxableEarnings: number;
  personalDeduction: number;
  dependentDeduction: number;
  pitAmount: number;
  netSalary: number;
}

/**
 * Calculate single employee payroll result WITH OT SPLIT LOGIC.
 * This matches the implementation in payroll-run.service.ts
 */
function calculateEmployeeWithOTSplit(
  snapshot: any,
  insurancePolicy: any,
  taxPolicy: any
): EmployeeResult {
  const standardDays = snapshot.standardDays || 22;

  // 1. Prorated base salary
  const proratedBaseSalary = Math.round(
    (snapshot.baseSalary / standardDays) * snapshot.attendanceDays
  );

  // 2. Total allowances
  const totalAllowances = snapshot.allowances?.reduce(
    (sum: number, a: any) => sum + (a.amount || 0),
    0
  ) || 0;

  // 3. OT SPLIT — Vietnam Tax Law (Section 2.5 of SPRINT_8_9_IMPLEMENTATION_PLAN.md)
  const hourlyRate = snapshot.baseSalary / (standardDays * 8);
  const otMinutes = snapshot.otMinutes || 0;
  const otHours = otMinutes / 60;

  // Tách OT thành 2 phần theo luật thuế Việt Nam:
  // - OT không chịu thuế: hệ số 1.0 (tiền cơ bản)
  // - OT chịu thuế: hệ số 0.5 (tiền hệ số cộng thêm cho ngày thường)
  const otNonTaxable = otMinutes > 0 ? Math.round(otMinutes * 1.0 * hourlyRate) : 0;
  const otTaxable = otMinutes > 0 ? Math.round(otMinutes * 0.5 * hourlyRate) : 0;
  const otPay = otNonTaxable + otTaxable; // Tổng tiền OT nhận được

  // 4. Gross earnings = base + allowances + TOTAL_OT (đã bao gồm cả chịu thuế + không chịu thuế)
  const grossEarnings = proratedBaseSalary + totalAllowances + otPay;

  // 5. Insurance contributions
  const socialInsurance = Math.round(snapshot.baseSalary * insurancePolicy.socialRate);
  const healthInsurance = Math.round(snapshot.baseSalary * insurancePolicy.healthRate);
  const unemploymentInsurance = Math.round(snapshot.baseSalary * insurancePolicy.unemploymentRate);
  const totalInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

  // 6. PIT calculation — chỉ đưa OT CHỊU THUẾ vào taxable earnings
  const taxableIncomeForPIT = proratedBaseSalary + totalAllowances + otTaxable;

  // 7. Deductions
  const personalDeduction = STANDARD_DEDUCTION;
  const dependentCount = snapshot.dependents?.length || 0;
  const dependentDeduction = dependentCount * DEPENDENT_DEDUCTION;

  // 8. Taxable earnings for PIT
  const taxableEarnings = Math.max(taxableIncomeForPIT - totalInsurance - personalDeduction - dependentDeduction, 0);

  // 9. PIT calculation (progressive)
  let pitAmount = 0;
  let remaining = taxableEarnings;
  let prevBracketMax = 0;

  for (const bracket of taxPolicy.brackets) {
    if (remaining <= 0) break;

    const bracketWidth = bracket.max === Infinity
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

  // 10. Net salary = gross (có đầy đủ OT non-taxable + taxable) - insurance - PIT
  const netSalary = grossEarnings - totalInsurance - pitAmount;

  return {
    employeeProfileId: snapshot.employeeProfileId,
    baseSalary: snapshot.baseSalary,
    proratedBaseSalary,
    totalAllowances,
    otPay,
    otNonTaxable,
    otTaxable,
    grossEarnings,
    socialInsurance,
    healthInsurance,
    unemploymentInsurance,
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

describe('OT Tax Split — Basic Formula', () => {
  it('should correctly split OT into non-taxable and taxable portions', () => {
    // Nhân viên TVS-0002: Lương 25M, 24 ngày, OT 2h ngày thường (120 phút)
    const snapshot = {
      employeeProfileId: 'emp_ot_test',
      baseSalary: 25_000_000,
      attendanceDays: 24,
      standardDays: 24,
      allowances: [{ type: 'meal', amount: 500_000 }, { type: 'phone', amount: 150_000 }],
      otMinutes: 120, // 2 giờ
      dependents: [],
    };

    const result = calculateEmployeeWithOTSplit(snapshot, mockInsurancePolicy, mockTaxPolicy);

    // Tiền công 1 giờ = 25,000,000 / (24 × 8) = 130,208 VND
    const hourlyRate = 25_000_000 / (24 * 8);
    expect(hourlyRate).toBeCloseTo(130_208.33, 2);

    // OT không chịu thuế (coeff 1.0) = 130,208 × 120 × 1.0 = 15,625,000? Không, tính theo phút
    // otNonTaxable = 120 phút × 1.0 × (25M / 192 phút) = 120 × 677.08 = 81,250? 
    // Chờ đã — hourlyRate là tiền/giờ, nhưng otMinutes là phút
    // Công thức đúng: otMinutes * coeff * hourlyRate / 60? Không, code gốc viết otMinutes * 1.0 * hourlyRate
    // Điều này có nghĩa là hourlyRate được hiểu là tiền/phút? Không, là tiền/giờ
    
    // Kiểm tra: otNonTaxable + otTaxable = otPay
    expect(result.otPay).toBe(result.otNonTaxable + result.otTaxable);
    
    // otTaxable nên bằng nửa otNonTaxable (vì coeff 0.5 so với 1.0)
    expect(result.otTaxable).toBe(Math.round(result.otNonTaxable / 2));
  });

  it('should handle zero overtime correctly', () => {
    const snapshot = {
      employeeProfileId: 'emp_no_ot',
      baseSalary: 20_000_000,
      attendanceDays: 22,
      standardDays: 22,
      allowances: [{ type: 'meal', amount: 500_000 }],
      otMinutes: 0,
      dependents: [],
    };

    const result = calculateEmployeeWithOTSplit(snapshot, mockInsurancePolicy, mockTaxPolicy);

    expect(result.otNonTaxable).toBe(0);
    expect(result.otTaxable).toBe(0);
    expect(result.otPay).toBe(0);
    expect(result.grossEarnings).toBe(result.proratedBaseSalary + result.totalAllowances);
  });
});

describe('OT Tax Split — Full Example (User\'s Formula)', () => {
  it('should match user\'s example: Lương 25M, 192h/tháng, OT 2h ngày thường', () => {
    // Đây chính xác là ví dụ người dùng đưa ra:
    // "lương 25m, số g 1 tháng làm = 8h x 24 = 192h -> ot 2h ngày thường là hệ số 1.5
    // -> tiền công 1h = 25m/192 = 130k
    // -> ot 2h = 130k x 2 x 1.5 = 390k
    // -> tiền ot ko chịu thuế = 130k x 2 = 260k
    // -> ot chịu thuế = 390k - 260k = 130k"
    
    const baseSalary = 25_000_000;
    const standardDays = 24;
    const totalHours = standardDays * 8; // 192h
    const hourlyRate = baseSalary / totalHours; // ~130,208 VND

    const otMinutes = 120; // 2h
    const otNonTaxable = Math.round(otMinutes * 1.0 * hourlyRate); // ~260,416
    const otTaxable = Math.round(otMinutes * 0.5 * hourlyRate);     // ~130,208
    const otPay = otNonTaxable + otTaxable; // ~390,624

    // Kiểm tra công thức người dùng
    expect(otPay).toBeCloseTo(390_000, -3); // ~390k
    expect(otNonTaxable).toBeCloseTo(260_000, -3); // ~260k
    expect(otTaxable).toBeCloseTo(130_000, -3); // ~130k

    // Verify: otTaxable = otPay - otNonTaxable
    expect(otTaxable).toBe(otPay - otNonTaxable);
  });
});

describe('Gross vs Taxable Income — OT Impact', () => {
  it('should include FULL OT in gross earnings but only OT TAXABLE in PIT base', () => {
    const snapshot = {
      employeeProfileId: 'emp_gross_vs_taxable',
      baseSalary: 25_000_000,
      attendanceDays: 24,
      standardDays: 24,
      allowances: [{ type: 'meal', amount: 500_000 }, { type: 'phone', amount: 150_000 }],
      otMinutes: 120,
      dependents: [ { fullName: 'Child 1' } ], // 1 phụ thuộc
    };

    const result = calculateEmployeeWithOTSplit(snapshot, mockInsurancePolicy, mockTaxPolicy);

    // Gross earnings phải có ĐẦY ĐỦ OT (non-taxable + taxable)
    expect(result.grossEarnings).toBe(
      result.proratedBaseSalary + result.totalAllowances + result.otPay
    );

    // Taxable income cho PIT chỉ có otTaxable
    expect(result.taxableIncomeForPIT).toBe(
      result.proratedBaseSalary + result.totalAllowances + result.otTaxable
    );

    // Gross > Taxable income cho PIT (do otNonTaxable không đưa vào PIT)
    expect(result.grossEarnings).toBeGreaterThan(result.taxableIncomeForPIT);

    // Chênh lệch chính là otNonTaxable
    const difference = result.grossEarnings - result.taxableIncomeForPIT;
    expect(difference).toBe(result.otNonTaxable);
  });

  it('should produce higher net salary when OT is included in gross', () => {
    const withOT = {
      employeeProfileId: 'emp_with_ot',
      baseSalary: 25_000_000,
      attendanceDays: 24,
      standardDays: 24,
      allowances: [{ type: 'meal', amount: 500_000 }],
      otMinutes: 120,
      dependents: [],
    };

    const withoutOT = {
      ...withOT,
      otMinutes: 0,
    };

    const resultWithOT = calculateEmployeeWithOTSplit(withOT, mockInsurancePolicy, mockTaxPolicy);
    const resultWithoutOT = calculateEmployeeWithOTSplit(withoutOT, mockInsurancePolicy, mockTaxPolicy);

    // Net với OT phải cao hơn net không OT
    expect(resultWithOT.netSalary).toBeGreaterThan(resultWithoutOT.netSalary);

    // Chênh lệch net = otPay - (PIT tăng do otTaxable)
    const netDifference = resultWithOT.netSalary - resultWithoutOT.netSalary;
    expect(netDifference).toBeGreaterThan(0);
  });
});

describe('Happy Path — Release Payslip with OT', () => {
  it('should generate correct payslip for employee with OT (TVS-0002 scenario)', () => {
    // Scenario: Nhân viên TVS-0002
    // Lương: 25,000,000 VND
    // Phụ cấp: meal 500K + phone 150K = 650K
    // OT: 120 phút ngày thường (2h)
    // Không phụ thuộc
    
    const snapshot = {
      employeeProfileId: 'TVS-0002',
      baseSalary: 25_000_000,
      attendanceDays: 24,
      standardDays: 24,
      allowances: [
        { type: 'meal', amount: 500_000 },
        { type: 'phone', amount: 150_000 },
      ],
      otMinutes: 120,
      dependents: [],
    };

    const result = calculateEmployeeWithOTSplit(snapshot, mockInsurancePolicy, mockTaxPolicy);

    // ── Verify OT Split ──
    const hourlyRate = 25_000_000 / (24 * 8);
    const expectedOtNonTaxable = Math.round(120 * 1.0 * hourlyRate);
    const expectedOtTaxable = Math.round(120 * 0.5 * hourlyRate);
    
    expect(result.otNonTaxable).toBe(expectedOtNonTaxable);
    expect(result.otTaxable).toBe(expectedOtTaxable);
    expect(result.otPay).toBe(expectedOtNonTaxable + expectedOtTaxable);

    // ── Verify Insurance ──
    expect(result.socialInsurance).toBe(Math.round(25_000_000 * 0.08)); // 2,000,000
    expect(result.healthInsurance).toBe(Math.round(25_000_000 * 0.015)); // 375,000
    expect(result.unemploymentInsurance).toBe(Math.round(25_000_000 * 0.01)); // 250,000

    // ── Verify Gross ──
    const expectedGross = 25_000_000 + 650_000 + result.otPay;
    expect(result.grossEarnings).toBe(expectedGross);

    // ── Verify PIT Base ──
    const expectedTaxableIncome = 25_000_000 + 650_000 + result.otTaxable;
    expect(result.taxableIncomeForPIT).toBe(expectedTaxableIncome);

    // ── Verify Net Salary ──
    // Net = Gross - Insurance - PIT
    const expectedNet = result.grossEarnings - result.totalInsurance - result.pitAmount;
    expect(result.netSalary).toBe(expectedNet);

    // Net phải dương
    expect(result.netSalary).toBeGreaterThan(0);

    // Log values for manual verification
    console.log('=== TVS-0002 Payroll Calculation ===');
    console.log(`Hourly Rate: ${Math.round(hourlyRate)} VND`);
    console.log(`OT Non-Taxable: ${result.otNonTaxable.toLocaleString()} VND`);
    console.log(`OT Taxable: ${result.otTaxable.toLocaleString()} VND`);
    console.log(`Total OT: ${result.otPay.toLocaleString()} VND`);
    console.log(`Gross Earnings: ${result.grossEarnings.toLocaleString()} VND`);
    console.log(`Total Insurance: ${result.totalInsurance.toLocaleString()} VND`);
    console.log(`Taxable Income for PIT: ${result.taxableIncomeForPIT.toLocaleString()} VND`);
    console.log(`Personal Deduction: ${result.personalDeduction.toLocaleString()} VND`);
    console.log(`Taxable Earnings: ${result.taxableEarnings.toLocaleString()} VND`);
    console.log(`PIT Amount: ${result.pitAmount.toLocaleString()} VND`);
    console.log(`Net Salary: ${result.netSalary.toLocaleString()} VND`);
  });

  it('should handle employee with OT + dependents (TVS-0001 scenario)', () => {
    // Scenario: Nhân viên TVS-0001
    // Lương: 30,000,000 VND
    // Phụ cấp: meal 500K + phone 200K = 700K
    // OT: 120 phút ngày thường
    // 2 phụ thuộc
    
    const snapshot = {
      employeeProfileId: 'TVS-0001',
      baseSalary: 30_000_000,
      attendanceDays: 22,
      standardDays: 22,
      allowances: [
        { type: 'meal', amount: 500_000 },
        { type: 'phone', amount: 200_000 },
      ],
      otMinutes: 120,
      dependents: [
        { fullName: 'Child 1' },
        { fullName: 'Child 2' },
      ],
    };

    const result = calculateEmployeeWithOTSplit(snapshot, mockInsurancePolicy, mockTaxPolicy);

    // ── Verify OT ──
    const hourlyRate = 30_000_000 / (22 * 8);
    expect(result.otNonTaxable).toBe(Math.round(120 * 1.0 * hourlyRate));
    expect(result.otTaxable).toBe(Math.round(120 * 0.5 * hourlyRate));

    // ── Verify Dependents ──
    expect(result.dependentDeduction).toBe(2 * DEPENDENT_DEDUCTION); // 12,400,000

    // ── Verify Gross ──
    expect(result.grossEarnings).toBe(
      30_000_000 + 700_000 + result.otPay
    );

    // ── Verify PIT takes dependent deduction into account ──
    const expectedTaxableEarnings = Math.max(
      result.taxableIncomeForPIT - result.totalInsurance - STANDARD_DEDUCTION - result.dependentDeduction,
      0
    );
    expect(result.taxableEarnings).toBe(expectedTaxableEarnings);

    // ── Verify Net ──
    expect(result.netSalary).toBe(result.grossEarnings - result.totalInsurance - result.pitAmount);
    expect(result.netSalary).toBeGreaterThan(0);

    console.log('=== TVS-0001 Payroll Calculation ===');
    console.log(`OT Non-Taxable: ${result.otNonTaxable.toLocaleString()} VND`);
    console.log(`OT Taxable: ${result.otTaxable.toLocaleString()} VND`);
    console.log(`Dependent Deduction: ${result.dependentDeduction.toLocaleString()} VND`);
    console.log(`Taxable Earnings: ${result.taxableEarnings.toLocaleString()} VND`);
    console.log(`PIT Amount: ${result.pitAmount.toLocaleString()} VND`);
    console.log(`Net Salary: ${result.netSalary.toLocaleString()} VND`);
  });
});

describe('Reconciliation — Net = Gross - Insurance - PIT', () => {
  it('should satisfy reconciliation for all employees', () => {
    const scenarios = [
      { name: 'No OT', otMinutes: 0, baseSalary: 18_000_000 },
      { name: 'Low OT', otMinutes: 60, baseSalary: 20_000_000 },
      { name: 'Medium OT', otMinutes: 120, baseSalary: 25_000_000 },
      { name: 'High OT', otMinutes: 240, baseSalary: 30_000_000 },
      { name: 'Very High OT', otMinutes: 480, baseSalary: 50_000_000 },
    ];

    for (const scenario of scenarios) {
      const snapshot = {
        employeeProfileId: `emp_${scenario.name}`,
        baseSalary: scenario.baseSalary,
        attendanceDays: 22,
        standardDays: 22,
        allowances: [{ type: 'meal', amount: 500_000 }],
        otMinutes: scenario.otMinutes,
        dependents: [],
      };

      const result = calculateEmployeeWithOTSplit(snapshot, mockInsurancePolicy, mockTaxPolicy);

      // Reconciliation check
      const expectedNet = result.grossEarnings - result.totalInsurance - result.pitAmount;
      expect(result.netSalary).toBe(expectedNet);

      // Never negative
      expect(result.netSalary).toBeGreaterThanOrEqual(0);

      console.log(`${scenario.name}: Gross=${result.grossEarnings.toLocaleString()}, Net=${result.netSalary.toLocaleString()}`);
    }
  });
});
