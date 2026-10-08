import { buildPayslipEarnings } from './payslip.service';

describe('payslip earning breakdown', () => {
  it('reconciles salary, itemized allowances, attendance bonus, KPI bonus, and overtime to gross', () => {
    const result = buildPayslipEarnings({
      proratedBaseSalary: 16_000_000,
      totalAllowances: 3_130_000,
      allowanceBreakdown: [
        { type: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 730_000, taxable: false },
        { type: 'PHONE', label: 'Phụ cấp điện thoại', amount: 400_000, taxable: true },
        { type: 'RESPONSIBILITY', label: 'Phụ cấp trách nhiệm', amount: 1_500_000, taxable: false },
        { type: 'TRANSPORT', label: 'Phụ cấp đi lại', amount: 500_000, taxable: true },
      ],
      attendanceBonus: 1_000_000,
      kpiBonus: 2_000_000,
      otPay: 5_100_000,
      overtimeTaxable: true,
    });

    expect(result.grossEarnings).toBe(27_230_000);
    expect(result.earningBreakdown).toEqual([
      expect.objectContaining({ type: 'BASE_SALARY', amount: 16_000_000 }),
      expect.objectContaining({ type: 'ALLOWANCE', amount: 3_130_000 }),
      expect.objectContaining({ type: 'ATTENDANCE_BONUS', amount: 1_000_000 }),
      expect.objectContaining({ type: 'KPI_BONUS', amount: 2_000_000 }),
      expect.objectContaining({ type: 'OVERTIME', amount: 5_100_000, taxable: true }),
    ]);
    expect(result.allowanceBreakdown.reduce((sum, item) => sum + item.amount, 0)).toBe(3_130_000);
    expect(result.earningBreakdown.reduce((sum, item) => sum + item.amount, 0)).toBe(result.grossEarnings);
  });

  it('marks every allowance taxable regardless of the legacy snapshot flag (R1)', () => {
    const result = buildPayslipEarnings({
      proratedBaseSalary: 10_000_000,
      totalAllowances: 1_130_000,
      allowanceBreakdown: [
        { type: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 730_000, taxable: false },
        { type: 'PHONE', label: 'Phụ cấp điện thoại', amount: 400_000, taxable: true },
      ],
    });

    expect(result.allowanceBreakdown.every((item) => item.taxable === true)).toBe(true);
  });

  it('marks overtime taxable only when the company flag is on (R2)', () => {
    // Cờ là nhị phân và áp cho TOÀN BỘ tiền OT: bật → chịu thuế, tắt → miễn hết.
    const fullyTaxed = buildPayslipEarnings({
      proratedBaseSalary: 10_000_000,
      otPay: 500_000,
      overtimeTaxable: true,
    });
    const fullyExempt = buildPayslipEarnings({
      proratedBaseSalary: 10_000_000,
      otPay: 500_000,
      overtimeTaxable: false,
    });

    expect(fullyTaxed.earningBreakdown.find((item) => item.type === 'OVERTIME')?.taxable).toBe(true);
    expect(fullyExempt.earningBreakdown.find((item) => item.type === 'OVERTIME')?.taxable).toBe(false);
  });
});
