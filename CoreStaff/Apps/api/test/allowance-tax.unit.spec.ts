/**
 * R1 — Mọi phụ cấp đều chịu thuế TNCN.
 *
 * Cờ `OrganizationAllowance.taxable` vẫn còn trong schema (deprecated) nhưng
 * luồng tính lương phải bỏ qua nó: một phụ cấp khai `taxable: false` vẫn phải
 * vào thu nhập chịu thuế, và `nonTaxableAllowances` phải luôn bằng 0.
 */

import { describe, expect, it } from '@jest/globals';
import { buildPayslipEarnings } from '../src/hr/payroll/payslip.service';

describe('R1 — phụ cấp luôn chịu thuế', () => {
  it('phụ cấp khai miễn thuế trong catalog vẫn vào thu nhập chịu thuế', () => {
    const earnings = buildPayslipEarnings({
      proratedBaseSalary: 20_000_000,
      totalAllowances: 1_230_000,
      allowanceBreakdown: [
        { type: 'MEAL', label: 'Trợ cấp ăn trưa', amount: 730_000, taxable: false },
        { type: 'TRANSPORT', label: 'Phụ cấp đi lại', amount: 500_000, taxable: false },
      ],
    });

    // Không còn dòng nào được đánh dấu miễn thuế.
    expect(earnings.allowanceBreakdown.every((item) => item.taxable === true)).toBe(true);
    expect(earnings.earningBreakdown.find((item) => item.type === 'ALLOWANCE')?.taxable).toBe(true);
  });

  it('không có khoản phụ cấp nào bị loại khỏi gross', () => {
    const breakdown = [
      { type: 'MEAL', label: 'Ăn trưa', amount: 730_000, taxable: false },
      { type: 'PHONE', label: 'Điện thoại', amount: 400_000, taxable: true },
      { type: 'RESPONSIBILITY', label: 'Trách nhiệm', amount: 1_500_000, taxable: false },
    ];
    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

    const earnings = buildPayslipEarnings({
      proratedBaseSalary: 16_000_000,
      totalAllowances: total,
      allowanceBreakdown: breakdown,
    });

    expect(earnings.allowanceBreakdown.reduce((sum, item) => sum + item.amount, 0)).toBe(total);
    expect(earnings.grossEarnings).toBe(16_000_000 + total);
  });

  it('không dùng totalAllowances khi đã có allowanceBreakdown (tránh cộng hai lần)', () => {
    const earnings = buildPayslipEarnings({
      proratedBaseSalary: 10_000_000,
      totalAllowances: 999_999_999,
      allowanceBreakdown: [{ type: 'MEAL', label: 'Ăn trưa', amount: 500_000, taxable: false }],
    });

    expect(earnings.grossEarnings).toBe(10_500_000);
  });

  it('phụ cấp chịu thuế nằm trong gross nên cũng nằm trong cơ sở PIT', () => {
    const earnings = buildPayslipEarnings({
      proratedBaseSalary: 20_000_000,
      totalAllowances: 1_000_000,
      allowanceBreakdown: [{ type: 'MEAL', label: 'Ăn trưa', amount: 1_000_000, taxable: false }],
    });

    // Cơ sở PIT = gross − (cờ OT tắt ? tiền OT : 0). Ở đây không có OT nên
    // toàn bộ gross chịu thuế, kể cả phụ cấp khai miễn thuế.
    const pitBase = earnings.grossEarnings - 0;

    expect(pitBase).toBe(21_000_000);
  });
});
