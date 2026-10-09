import { renderToStaticMarkup } from 'react-dom/server';
import { GrossEarningsCard, TaxableIncomeCard, TaxDeductionsCard, PitTaxDetails, PayslipPreviewDialog } from '../src/screens/hr/PayslipPreviewDialog';

// gross = 16.000.000 + 3.130.000 + 1.000.000 + 2.000.000 + 5.100.000 = 27.230.000
// cờ OT tắt → taxableIncome = 27.230.000 − 5.100.000 = 22.130.000
// taxableEarnings = 22.130.000 − 1.680.000 (BH) − 15.500.000 (bản thân) = 4.950.000
// PIT bậc 1 = 4.950.000 × 5% = 247.500 → net = 27.230.000 − 1.680.000 − 247.500 = 25.302.500
const basePayslip = {
  _id: 'p1',
  employeeName: 'Hoài Bảo',
  employeeCode: 'TVS-0112',
  grossEarnings: 27_230_000,
  netSalary: 25_302_500,
  pitAmount: 247_500,
  taxableIncome: 22_130_000,
  taxableEarnings: 4_950_000,
  personalDeduction: 15_500_000,
  dependentDeduction: 0,
  // Chi tiết lương công: 20.000.000 / 25 ngày = 800.000/ngày × 20 ngày = 16.000.000
  monthlyBaseSalary: 20_000_000,
  standardWorkingDays: 25,
  payableWorkingDays: 20,
  hourlyRate: 100_000,
  socialInsurance: 1_280_000,
  healthInsurance: 240_000,
  unemploymentInsurance: 160_000,
  status: 'GENERATED',
  earningBreakdown: [
    { type: 'BASE_SALARY', label: 'Lương cơ bản theo công', amount: 16_000_000, taxable: true },
    { type: 'ALLOWANCE', label: 'Tổng phụ cấp', amount: 3_130_000, taxable: true },
    { type: 'ATTENDANCE_BONUS', label: 'Thưởng chuyên cần', amount: 1_000_000, taxable: true },
    { type: 'KPI_BONUS', label: 'Thưởng KPI', amount: 2_000_000, taxable: true },
    { type: 'OVERTIME', label: 'Tiền làm thêm giờ', amount: 5_100_000, taxable: false },
  ],
  allowanceBreakdown: [
    { type: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 730_000, taxable: true },
    { type: 'PHONE', label: 'Phụ cấp điện thoại', amount: 400_000, taxable: true },
    { type: 'RESPONSIBILITY', label: 'Phụ cấp trách nhiệm', amount: 1_500_000, taxable: true },
    { type: 'TRANSPORT', label: 'Phụ cấp đi lại', amount: 500_000, taxable: true },
  ],
  otBreakdown: {
    totalMinutes: 1080,
    workingDayMinutes: 120,
    weeklyOffMinutes: 0,
    publicHolidayMinutes: 960,
    hourlyRate: 100_000,
    otPay: 5_100_000,
    overtimeTaxable: false,
    breakdown: [
      { type: 'WORKING_DAY', label: 'Ngày thường', minutes: 120, coefficient: 1.5, amount: 300_000 },
      { type: 'PUBLIC_HOLIDAY', label: 'Lễ, Tết', minutes: 960, coefficient: 3.0, amount: 4_800_000 },
    ],
  },
  pitBreakdown: [{ bracket: 1, income: 4_950_000, rate: 5, tax: 247_500 }],
};

test('§1 GROSS — itemizes every earning component, no OT tax-split block', () => {
  const html = renderToStaticMarkup(<GrossEarningsCard payslip={basePayslip} />);

  for (const label of ['Lương cơ bản theo công', 'Phụ cấp ăn trưa', 'Phụ cấp điện thoại', 'Phụ cấp trách nhiệm', 'Phụ cấp đi lại', 'Thưởng chuyên cần', 'Thưởng KPI', 'Tiền làm thêm giờ']) {
    expect(html).toContain(label);
  }
  expect(html).toContain('Tổng Gross');
  expect(html).toContain('27.230.000');
  // Khối "Chi tiết làm thêm giờ" (bảng thuế OT) đã bỏ khỏi Gross.
  expect(html).not.toContain('Chi tiết làm thêm giờ');
  expect(html).not.toContain('Miễn thuế TNCN');
  expect(html).not.toContain('Chịu thuế TNCN');
});

test('§1 GROSS — lương cơ bản và OT có nút Chi tiết, chi tiết ẩn tới khi bấm', () => {
  const html = renderToStaticMarkup(<GrossEarningsCard payslip={basePayslip} />);

  // Nút "Chi tiết" xuất hiện cho dòng lương cơ bản và dòng OT.
  expect(html).toContain('Chi tiết');
  // Nút là <button> nên nội dung chi tiết chưa render ở server markup.
  expect(html).not.toContain('Ngày công chuẩn');
  expect(html).not.toContain('Tiền công 1 ngày');
});

test('§1 GROSS — không đủ dữ liệu ngày công thì ẩn nút Chi tiết lương cơ bản', () => {
  const withBase = renderToStaticMarkup(<GrossEarningsCard payslip={basePayslip} />);
  const withoutBase = renderToStaticMarkup(
    <GrossEarningsCard
      payslip={{ ...basePayslip, monthlyBaseSalary: undefined, standardWorkingDays: undefined }}
    />,
  );

  // Còn 2 nút khi đủ dữ liệu (lương cơ bản + OT), rụng còn 1 khi thiếu ngày công.
  // Khớp `Chi tiết</button>` để không đếm nhầm nhãn tĩnh "Chi tiết phụ cấp".
  expect(withBase.match(/Chi tiết<\/button>/g)).toHaveLength(2);
  expect(withoutBase.match(/Chi tiết<\/button>/g)).toHaveLength(1);
});

test('§2 TAXABLE INCOME — shows backend taxableIncome and OT tax policy marker', () => {
  const html = renderToStaticMarkup(<TaxableIncomeCard payslip={basePayslip} />);

  for (const label of ['Thu nhập chịu thuế trước giảm trừ', 'Lương cơ bản theo công', 'Thưởng chuyên cần', 'Thưởng KPI', 'Tổng phụ cấp', 'Tiền làm thêm giờ chịu thuế']) {
    expect(html).toContain(label);
  }
  // Cờ tắt → Taxable OT = 0, và tổng lấy thẳng từ backend.
  expect(html).toContain('Tổng thu nhập chịu thuế');
  expect(html).toContain('22.130.000');
  // Dấu * mở tooltip chính sách thuế OT.
  expect(html).toContain('aria-label="Chính sách thuế TNCN cho tiền tăng ca"');
  expect(html).toContain('tiền tăng ca được miễn thuế');
  // R1: mọi phụ cấp đều chịu thuế nên không còn nhãn Miễn thuế/Chịu thuế trên từng dòng phụ cấp.
  expect(html).not.toContain('>Miễn thuế<');
});

test('§2 — bật cờ OT thì tooltip nói toàn bộ tiền tăng ca chịu thuế', () => {
  const html = renderToStaticMarkup(
    <TaxableIncomeCard
      payslip={{
        ...basePayslip,
        taxableIncome: 27_230_000,
        otBreakdown: { ...basePayslip.otBreakdown, overtimeTaxable: true },
      }}
    />,
  );

  expect(html).toContain('toàn bộ tiền tăng ca chịu thuế');
  expect(html).toContain('5.100.000');
});

test('§3 TAX DEDUCTIONS — insurance + family deductions yield taxable earnings', () => {
  const html = renderToStaticMarkup(<TaxDeductionsCard payslip={basePayslip} />);

  for (const label of ['Các khoản giảm trừ thuế', 'Bảo hiểm (BHXH + BHYT + BHTN)', 'Giảm trừ bản thân', 'Thu nhập tính thuế']) {
    expect(html).toContain(label);
  }
  expect(html).toContain('15.500.000');
  expect(html).toContain('4.950.000');
  // Không phụ thuộc nào → dòng giảm trừ người phụ thuộc ẩn.
  expect(html).not.toContain('Giảm trừ người phụ thuộc');
});

test('§3 — hiển thị giảm trừ người phụ thuộc khi có', () => {
  const html = renderToStaticMarkup(
    <TaxDeductionsCard
      payslip={{
        ...basePayslip,
        dependentDeduction: 12_400_000,
        dependents: [
          { fullName: 'Bé A', relationship: 'CON' },
          { fullName: 'Bé B', relationship: 'CON' },
        ],
      }}
    />,
  );

  expect(html).toContain('Giảm trừ người phụ thuộc (2 người)');
  expect(html).toContain('12.400.000');
});

test('§4 PIT — progressive brackets and total tax', () => {
  const html = renderToStaticMarkup(<PitTaxDetails payslip={basePayslip} />);

  expect(html).toContain('Thuế TNCN (PIT)');
  expect(html.replaceAll(' ', ' ')).toContain('4.950.000 ₫ × 5%');
  expect(html).toContain('Thuế TNCN phải nộp');
  expect(html).toContain('247.500');
});

test('§4 — không phát sinh thuế thì nói rõ thay vì bảng rỗng', () => {
  const html = renderToStaticMarkup(
    <PitTaxDetails payslip={{ ...basePayslip, pitAmount: 0, pitBreakdown: [] }} />,
  );

  expect(html).toContain('Không phát sinh thuế TNCN.');
});

test('NET — banner hiện công thức Gross − Tổng khấu trừ = Net', () => {
  const html = renderToStaticMarkup(
    <PayslipPreviewDialog open onClose={() => {}} payslip={basePayslip} periodLabel="09/2026" />,
  );

  // Tổng khấu trừ = 1.680.000 (BH) + 247.500 (PIT) + 0 = 1.927.500
  expect(html).toContain('Lương thực nhận (Net)');
  expect(html).toContain('Tổng khấu trừ');
  // Công thức: 27.230.000 − 1.927.500 = 25.302.500 (bỏ qua khoảng trắng/&nbsp;)
  const flat = html.replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
  expect(flat).toMatch(/27\.230\.000\s*₫\s*−\s*1\.927\.500\s*₫\s*=\s*25\.302\.500\s*₫/);
});
