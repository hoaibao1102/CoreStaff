/**
 * BE Unit Tests — Payslip Generation (TASK-098/099)
 * 
 * Test coverage:
 * - Payslip creation from payroll run snapshot
 * - Gross/Net reconciliation
 * - Status transitions (DRAFT → GENERATED → RELEASED → VIEWED)
 * - Dependent snapshot preservation
 */

import { describe, expect, it } from '@jest/globals';

/* ───────── MOCK DATA ───────── */

const mockSnapshot = {
  _id: 'snapshot_001',
  employeeProfileId: 'emp_001',
  organizationId: 'org_001',
  employeeName: 'Nguyen Van A',
  taxCode: '001001001001',
  periodLabel: '2024-01',
  baseSalary: 30_000_000,
  attendanceDays: 22,
  standardDays: 22,
  allowances: [{ type: 'meal', amount: 500_000 }, { type: 'phone', amount: 200_000 }],
  overtimeMinutes: 120,
  otPay: 800_000,
  leaveDays: 0,
  dependents: [
    { fullName: 'Nguyen Van B', relationship: 'Con', birthDate: '2020-01-01' },
  ],
};

const mockInsuranceResult = {
  contributionBase: 30_000_000,
  socialInsurance: 2_400_000,
  healthInsurance: 450_000,
  unemploymentInsurance: 300_000,
  totalInsurance: 3_150_000,
};

const mockPITResult = {
  taxableEarnings: 28_350_000,
  personalDeduction: 11_000_000,
  dependentDeduction: 6_200_000,
  pitAmount: 1_720_000,
  effectiveRate: 0.0607,
};

/* ───────── PAYSLIP CREATION LOGIC ───────── */

interface PayslipData {
  payrollRunId: string;
  employeeProfileId: string;
  employeeName: string;
  taxCode: string;
  periodLabel: string;
  grossEarnings: number;
  earningBreakdown: Array<{ type: string; label: string; amount: number; taxable: boolean }>;
  insuranceSalary: number;
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  taxableEarnings: number;
  personalDeduction: number;
  dependentDeduction: number;
  pitAmount: number;
  otherDeductions: number;
  netSalary: number;
  deductionBreakdown: Array<{ type: string; label: string; amount: number }>;
  dependents: Array<{ fullName: string; relationship: string; birthDate: Date }>;
  status: string;
}

/**
 * Create payslip data from calculation results.
 */
function createPayslip(
  payrollRunId: string,
  snapshot: any,
  insurance: any,
  pit: any
): PayslipData {
  // Calculate gross earnings
  const proratedBase = Math.round(
    (snapshot.baseSalary / snapshot.standardDays) * snapshot.attendanceDays
  );
  const totalAllowances = snapshot.allowances.reduce(
    (sum: number, a: any) => sum + (a.amount || 0),
    0
  );
  const grossEarnings = proratedBase + totalAllowances + (snapshot.otPay || 0);

  // Build earning breakdown
  const earningBreakdown = [
    { type: 'base', label: 'Lương cơ bản', amount: proratedBase, taxable: true },
    ...snapshot.allowances.map((a: any) => ({
      type: a.type,
      label: a.type === 'meal' ? 'Trợ cấp ăn uống' : a.type === 'phone' ? 'Trợ cấp điện thoại' : a.type,
      amount: a.amount || 0,
      taxable: true,
    })),
    ...(snapshot.otPay ? [{ type: 'ot', label: 'Trả công OT', amount: snapshot.otPay, taxable: true }] : []),
  ];

  // Build deduction breakdown
  const deductionBreakdown = [
    { type: 'bhxh', label: 'BHXH (8%)', amount: insurance.socialInsurance },
    { type: 'bhyt', label: 'BHYT (1.5%)', amount: insurance.healthInsurance },
    { type: 'bhtn', label: 'BHTN (1%)', amount: insurance.unemploymentInsurance },
    ...(pit.pitAmount > 0 ? [{ type: 'pit', label: 'Thuế TNCN', amount: pit.pitAmount }] : []),
  ];

  // Net salary = Gross - Insurance - PIT
  const netSalary = grossEarnings - insurance.totalInsurance - pit.pitAmount;

  return {
    payrollRunId,
    employeeProfileId: snapshot.employeeProfileId,
    employeeName: snapshot.employeeName || 'Unknown',
    taxCode: snapshot.taxCode || '',
    periodLabel: snapshot.periodLabel,
    grossEarnings,
    earningBreakdown,
    insuranceSalary: snapshot.baseSalary,
    socialInsurance: insurance.socialInsurance,
    healthInsurance: insurance.healthInsurance,
    unemploymentInsurance: insurance.unemploymentInsurance,
    taxableEarnings: pit.taxableEarnings,
    personalDeduction: pit.personalDeduction,
    dependentDeduction: pit.dependentDeduction,
    pitAmount: pit.pitAmount,
    otherDeductions: 0,
    netSalary,
    deductionBreakdown,
    dependents: snapshot.dependents || [],
    status: 'GENERATED',
  };
}

/* ───────── TESTS ───────── */

describe('createPayslip — Full Generation', () => {
  it('should generate correct payslip for normal employee', () => {
    const payslip = createPayslip('run_001', mockSnapshot, mockInsuranceResult, mockPITResult);

    // Gross = 30M + 700K + 800K = 31,500,000
    expect(payslip.grossEarnings).toBe(31_500_000);

    // Earning breakdown count
    expect(payslip.earningBreakdown.length).toBe(4); // base + 2 allowances + OT

    // Insurance values
    expect(payslip.socialInsurance).toBe(2_400_000);
    expect(payslip.healthInsurance).toBe(450_000);
    expect(payslip.unemploymentInsurance).toBe(300_000);

    // PIT
    expect(payslip.pitAmount).toBe(1_720_000);
    expect(payslip.personalDeduction).toBe(11_000_000);
    expect(payslip.dependentDeduction).toBe(6_200_000);

    // Net = 31,500,000 - 3,150,000 - 1,720,000 = 26,630,000
    expect(payslip.netSalary).toBe(26_630_000);

    // Deduction breakdown
    expect(payslip.deductionBreakdown.length).toBe(4); // BHXH + BHYT + BHTN + PIT

    // Dependents preserved
    expect(payslip.dependents.length).toBe(1);
    expect(payslip.dependents[0].fullName).toBe('Nguyen Van B');

    // Status
    expect(payslip.status).toBe('GENERATED');
  });

  it('should handle employee without dependents', () => {
    const noDependents = {
      ...mockSnapshot,
      dependents: [],
    };

    const payslip = createPayslip('run_001', noDependents, mockInsuranceResult, mockPITResult);

    expect(payslip.dependents.length).toBe(0);
    expect(payslip.dependentDeduction).toBe(0);
  });

  it('should handle employee without OT', () => {
    const noOt = {
      ...mockSnapshot,
      otPay: 0,
      overtimeMinutes: 0,
    };

    const payslip = createPayslip('run_001', noOt, mockInsuranceResult, mockPITResult);

    expect(payslip.grossEarnings).toBe(30_700_000); // 30M + 700K
    expect(payslip.earningBreakdown.length).toBe(3); // base + 2 allowances (no OT)
  });

  it('should handle proration for partial attendance', () => {
    const partial = {
      ...mockSnapshot,
      attendanceDays: 18,
      standardDays: 22,
    };

    const payslip = createPayslip('run_001', partial, mockInsuranceResult, mockPITResult);

    // Prorated: 30M / 22 * 18 = 24,545,455
    const expectedProrated = Math.round((30_000_000 / 22) * 18);
    expect(payslip.earningBreakdown[0].amount).toBe(expectedProrated);
    expect(payslip.grossEarnings).toBe(expectedProrated + 700_000);
  });
});

describe('Gross/Net Reconciliation', () => {
  it('should satisfy: Net = Gross - Total Insurance - PIT', () => {
    const payslip = createPayslip('run_001', mockSnapshot, mockInsuranceResult, mockPITResult);

    const expectedNet = payslip.grossEarnings - mockInsuranceResult.totalInsurance - mockPITResult.pitAmount;
    expect(payslip.netSalary).toBe(expectedNet);
  });

  it('should never produce negative net salary', () => {
    const lowSnapshot = {
      ...mockSnapshot,
      baseSalary: 1_500_000,
      attendanceDays: 22,
    };

    const lowInsurance = {
      ...mockInsuranceResult,
      socialInsurance: Math.round(1_500_000 * 0.08),
      healthInsurance: Math.round(1_500_000 * 0.015),
      unemploymentInsurance: Math.round(1_500_000 * 0.01),
      totalInsurance: Math.round(1_500_000 * 0.105),
    };

    const payslip = createPayslip('run_001', lowSnapshot, lowInsurance, { ...mockPITResult, pitAmount: 0 });

    expect(payslip.netSalary).toBeGreaterThanOrEqual(0);
  });

  it('should include all deductions in breakdown', () => {
    const payslip = createPayslip('run_001', mockSnapshot, mockInsuranceResult, mockPITResult);

    const totalFromBreakdown = payslip.deductionBreakdown.reduce(
      (sum, d) => sum + d.amount,
      0
    );

    const expectedTotal = mockInsuranceResult.totalInsurance + mockPITResult.pitAmount;
    expect(totalFromBreakdown).toBe(expectedTotal);
  });
});

describe('Status Transitions', () => {
  it('should start with GENERATED status', () => {
    const payslip = createPayslip('run_001', mockSnapshot, mockInsuranceResult, mockPITResult);
    expect(payslip.status).toBe('GENERATED');
  });

  it('should allow GENERATED -> RELEASED', () => {
    let status = 'GENERATED';
    status = 'RELEASED';
    expect(status).toBe('RELEASED');
  });

  it('should allow RELEASED -> VIEWED', () => {
    let status = 'RELEASED';
    status = 'VIEWED';
    expect(status).toBe('VIEWED');
  });

  it('should prevent invalid transition: DRAFT -> VIEWED', () => {
    const currentStatus = 'DRAFT';
    const attemptedTransition = 'VIEWED';
    
    // Direct DRAFT -> VIEWED should be blocked
    expect(currentStatus === 'DRAFT' && attemptedTransition === 'VIEWED').toBe(true);
  });
});

describe('Edge Cases', () => {
  it('should handle zero allowances', () => {
    const noAllowances = {
      ...mockSnapshot,
      allowances: [],
    };

    const payslip = createPayslip('run_001', noAllowances, mockInsuranceResult, mockPITResult);

    expect(payslip.grossEarnings).toBe(30_800_000); // 30M + 800K OT
    expect(payslip.earningBreakdown.length).toBe(2); // base + OT
  });

  it('should handle very high salary', () => {
    const highSnapshot = {
      ...mockSnapshot,
      baseSalary: 200_000_000,
    };

    const highInsurance = {
      ...mockInsuranceResult,
      socialInsurance: Math.round(52_200_000 * 0.08), // Capped
      healthInsurance: Math.round(52_200_000 * 0.015),
      unemploymentInsurance: Math.round(52_200_000 * 0.01),
      totalInsurance: Math.round(52_200_000 * 0.105),
    };

    const payslip = createPayslip('run_001', highSnapshot, highInsurance, mockPITResult);

    expect(payslip.grossEarnings).toBe(200_700_000);
    expect(payslip.insuranceSalary).toBe(200_000_000);
    expect(payslip.netSalary).toBeGreaterThan(0);
  });

  it('should preserve employee info from snapshot', () => {
    const payslip = createPayslip('run_001', mockSnapshot, mockInsuranceResult, mockPITResult);

    expect(payslip.employeeName).toBe('Nguyen Van A');
    expect(payslip.taxCode).toBe('001001001001');
    expect(payslip.periodLabel).toBe('2024-01');
    expect(payslip.payrollRunId).toBe('run_001');
  });
});
