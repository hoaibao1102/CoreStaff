import { renderToStaticMarkup } from 'react-dom/server';
import { GrossEarningsCard, PitTaxDetails } from '../src/screens/hr/PayslipPreviewDialog';

test('renders a complete itemized gross income section', () => {
  const html = renderToStaticMarkup(
    <GrossEarningsCard
      payslip={{
        _id: 'p1',
        employeeName: 'Hoài Bảo',
        employeeCode: 'TVS-0112',
        grossEarnings: 27_230_000,
        netSalary: 24_000_000,
        pitAmount: 0,
        status: 'GENERATED',
        earningBreakdown: [
          { type: 'BASE_SALARY', label: 'Lương cơ bản theo công', amount: 16_000_000, taxable: true },
          { type: 'ALLOWANCE', label: 'Tổng phụ cấp', amount: 3_130_000, taxable: true },
          { type: 'ATTENDANCE_BONUS', label: 'Thưởng chuyên cần', amount: 1_000_000, taxable: true },
          { type: 'KPI_BONUS', label: 'Thưởng KPI', amount: 2_000_000, taxable: true },
          { type: 'OVERTIME', label: 'Tiền làm thêm giờ', amount: 5_100_000, taxable: false },
        ],
        allowanceBreakdown: [
          { type: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 730_000, taxable: false },
          { type: 'PHONE', label: 'Phụ cấp điện thoại', amount: 400_000, taxable: true },
          { type: 'RESPONSIBILITY', label: 'Phụ cấp trách nhiệm', amount: 1_500_000, taxable: false },
          { type: 'TRANSPORT', label: 'Phụ cấp đi lại', amount: 500_000, taxable: true },
        ],
        otBreakdown: {
          totalMinutes: 1080,
          workingDayMinutes: 120,
          weeklyOffMinutes: 0,
          publicHolidayMinutes: 960,
          hourlyRate: 100_000,
          otNonTaxable: 1_800_000,
          otTaxable: 3_300_000,
          otPay: 5_100_000,
          breakdown: [],
        },
      }}
    />,
  );

  for (const label of ['Lương cơ bản theo công', 'Phụ cấp ăn trưa', 'Phụ cấp điện thoại', 'Phụ cấp trách nhiệm', 'Phụ cấp đi lại', 'Thưởng chuyên cần', 'Thưởng KPI', 'Tiền làm thêm giờ']) {
    expect(html).toContain(label);
  }
  expect(html).toContain('Miễn thuế');
  expect(html).toContain('Chịu thuế');
  expect(html).toContain('18 giờ');
  expect(html).toContain('27.230.000');
});

test('itemizes taxable income before deductions and labels post-deduction income correctly', () => {
  const html = renderToStaticMarkup(
    <PitTaxDetails
      payslip={{
        _id: 'p1',
        employeeName: 'Hoài Bảo',
        grossEarnings: 27_230_000,
        netSalary: 24_000_000,
        pitAmount: 442_800,
        taxableEarnings: 8_856_000,
        personalDeduction: 11_000_000,
        dependentDeduction: 0,
        socialInsurance: 1_280_000,
        healthInsurance: 240_000,
        unemploymentInsurance: 160_000,
        status: 'GENERATED',
        earningBreakdown: [
          { type: 'BASE_SALARY', label: 'Lương cơ bản theo công', amount: 14_336_000, taxable: true },
          { type: 'ALLOWANCE', label: 'Tổng phụ cấp', amount: 3_130_000, taxable: true },
          { type: 'ATTENDANCE_BONUS', label: 'Thưởng chuyên cần', amount: 1_000_000, taxable: true },
          { type: 'KPI_BONUS', label: 'Thưởng KPI', amount: 2_000_000, taxable: true },
          { type: 'OVERTIME', label: 'Tiền làm thêm giờ', amount: 5_100_000, taxable: false },
        ],
        allowanceBreakdown: [
          { type: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 730_000, taxable: false },
          { type: 'PHONE', label: 'Phụ cấp điện thoại', amount: 400_000, taxable: true },
          { type: 'RESPONSIBILITY', label: 'Phụ cấp trách nhiệm', amount: 1_500_000, taxable: false },
          { type: 'TRANSPORT', label: 'Phụ cấp đi lại', amount: 500_000, taxable: true },
        ],
        otBreakdown: {
          totalMinutes: 1080,
          workingDayMinutes: 120,
          weeklyOffMinutes: 0,
          publicHolidayMinutes: 960,
          hourlyRate: 100_000,
          otNonTaxable: 1_800_000,
          otTaxable: 3_300_000,
          otPay: 5_100_000,
          breakdown: [],
        },
        pitBreakdown: [{ bracket: 1, income: 8_856_000, rate: 5, tax: 442_800 }],
      }}
    />,
  );

  for (const label of [
    'Thu nhập chịu thuế trước giảm trừ',
    'Lương cơ bản theo công',
    'Phụ cấp điện thoại',
    'Phụ cấp đi lại',
    'Thưởng chuyên cần',
    'Thưởng KPI',
    'Phần làm thêm giờ chịu thuế',
    'Bảo hiểm bắt buộc',
    'Giảm trừ bản thân',
    'Thu nhập tính thuế',
  ]) {
    expect(html).toContain(label);
  }
  expect(html).toContain('21.536.000');
  expect(html).toContain('8.856.000');
  expect(html.replaceAll('\u00a0', ' ')).toContain('8.856.000 ₫ × 5%');
  expect(html).not.toContain('>Thu nhập chịu thuế<');
  expect(html).not.toContain('Phụ cấp ăn trưa');
  expect(html).not.toContain('Phụ cấp trách nhiệm');
});
