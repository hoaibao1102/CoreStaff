import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { GrossEarningsCard, TaxDeductionsCard, PitTaxDetails, PayslipPreviewDialog } from '../src/screens/hr/PayslipPreviewDialog';

jest.mock('@/components/tooltip', () => ({
  Tooltip: ({ children, content }: { children: ReactNode; content: ReactNode }) => <>{children}<span>{content}</span></>,
}));

jest.mock('@/components/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) => open === false ? null : <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

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
  // 1.280.000 = 8% × 16.000.000; 240.000 = 1,5%; 160.000 = 1%.
  contributionBase: 16_000_000,
  socialInsuranceRate: 0.08,
  healthInsuranceRate: 0.015,
  unemploymentInsuranceRate: 0.01,
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
  // Tổng gross chỉ in ở footer bảng, không lặp ở tiêu đề mục.
  // (Số 27.230.000 xuất hiện lần hai ở dòng "Thu nhập chịu thuế" khi cờ OT bật —
  //  ở đây cờ tắt nên tổng chịu thuế là con số khác.)
  expect(html.match(/Tổng cộng Gross/g)).toHaveLength(1);
  expect(html.match(/27\.230\.000/g)).toHaveLength(1);
  // Dòng gộp "Tổng phụ cấp" bị thay bằng 4 dòng phụ cấp riêng — không đếm trùng.
  expect(html).not.toContain('Tổng phụ cấp');
  // Khối "Chi tiết làm thêm giờ" (bảng thuế OT) đã bỏ khỏi Gross.
  expect(html).not.toContain('Chi tiết làm thêm giờ');
  expect(html).not.toContain('Miễn thuế TNCN');
});

test('§1 GROSS — chi tiết lương công và OT in thẳng thành dòng phụ, không cần bấm', () => {
  const html = renderToStaticMarkup(<GrossEarningsCard payslip={basePayslip} />);

  expect(html).not.toContain('Chi tiết</button>');
  // 20.000.000 ÷ 25 ngày = 800.000/ngày × 20 ngày.
  expect(html).toContain('ngày công chuẩn');
  expect(html).toContain('800.000');
  expect(html).toContain('ngày công thực tế');
  // 120 phút = 2 giờ × (100.000 × 1.5) và 960 phút = 16 giờ × (100.000 × 3).
  expect(html).toContain('2 giờ');
  expect(html).toContain('16 giờ');
  expect(html).toContain('300.000');
  expect(html).toContain('4.800.000');
});

test('§1 GROSS — thiếu dữ liệu ngày công thì bỏ dòng phụ lương cơ bản', () => {
  const withBase = renderToStaticMarkup(<GrossEarningsCard payslip={basePayslip} />);
  const withoutBase = renderToStaticMarkup(
    <GrossEarningsCard
      payslip={{ ...basePayslip, monthlyBaseSalary: undefined, standardWorkingDays: undefined }}
    />,
  );

  expect(withBase).toContain('ngày công chuẩn');
  expect(withoutBase).not.toContain('ngày công chuẩn');
  // Dòng chính của lương cơ bản vẫn còn.
  expect(withoutBase).toContain('Lương cơ bản theo công');
});

test('§1 — cột chịu thuế TNCN và tổng thu nhập chịu thuế nằm ngay trong bảng gross', () => {
  const html = renderToStaticMarkup(<GrossEarningsCard payslip={basePayslip} />);

  expect(html).toContain('Chịu thuế TNCN');
  expect(html).toContain('Thu nhập chịu thuế trước giảm trừ');
  // Cờ OT tắt → OT không vào thu nhập chịu thuế: lấy số backend.
  expect(html).toContain('22.130.000');
  // Dấu * mở tooltip chính sách thuế OT.
  expect(html).toContain('aria-label="Chính sách thuế TNCN cho tiền tăng ca"');
  expect(html).toContain('tiền tăng ca được miễn thuế');
  // R1: mọi phụ cấp đều chịu thuế nên không còn nhãn Miễn thuế/Chịu thuế trên từng dòng phụ cấp.
  expect(html).not.toContain('>Miễn thuế<');
});

/** Ô của dòng "Tiền làm thêm giờ" (dòng cha, không tính dòng phụ bên dưới). */
function overtimeRowCells(html: string) {
  const row = html.slice(html.indexOf('Tiền làm thêm giờ'));
  return row.slice(0, row.indexOf('</tr>')).replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
}

test('§1 — bật cờ OT thì tiền tăng ca vào thẳng thu nhập chịu thuế', () => {
  const html = renderToStaticMarkup(
    <GrossEarningsCard
      payslip={{
        ...basePayslip,
        taxableIncome: 27_230_000,
        otBreakdown: { ...basePayslip.otBreakdown, overtimeTaxable: true },
      }}
    />,
  );

  expect(html).toContain('toàn bộ tiền tăng ca chịu thuế');
  // Toàn bộ OT vào thu nhập chịu thuế → tổng chịu thuế = gross, in ở 2 chỗ
  // (dòng tổng gross và dòng thu nhập chịu thuế) — không lặp ở từng dòng.
  expect(html.match(/27\.230\.000/g)).toHaveLength(2);
  // Cột số tiền luôn là tổng OT; cột chịu thuế bằng đúng tổng đó khi công ty đánh thuế OT.
  expect(overtimeRowCells(html)).toMatch(/5\.100\.000 ₫<\/td>.*5\.100\.000 ₫<\/td>/);
});

test('§1 — dòng tiền làm thêm giờ luôn hiện, kèm số giờ và cột chịu thuế bằng 0 khi miễn thuế', () => {
  const html = renderToStaticMarkup(<GrossEarningsCard payslip={basePayslip} />);

  // 1080 phút = 18 giờ làm thêm trong kỳ, in thành dòng nhỏ dưới tên khoản mục.
  expect(html).toContain('Làm thêm 18 giờ trong kỳ');
  // Cột số tiền vẫn là tổng tiền OT; chỉ cột chịu thuế phụ thuộc chính sách công ty.
  expect(overtimeRowCells(html)).toMatch(/5\.100\.000 ₫<\/td>.*>\s*0 ₫\s*<\/td>/);
});

test('§1 — backend cắt dòng OVERTIME khỏi earningBreakdown thì card 1 vẫn dựng lại khoản mục', () => {
  const html = renderToStaticMarkup(
    <GrossEarningsCard
      payslip={{
        ...basePayslip,
        earningBreakdown: basePayslip.earningBreakdown.filter((item) => item.type !== 'OVERTIME'),
        otBreakdown: undefined,
      }}
    />,
  );

  expect(html).toContain('Tiền làm thêm giờ');
  expect(html).toContain('aria-label="Chính sách thuế TNCN cho tiền tăng ca"');
});

test('§1 — thiếu taxableIncome thì tự cộng từ các dòng chịu thuế', () => {
  const html = renderToStaticMarkup(
    <GrossEarningsCard payslip={{ ...basePayslip, taxableIncome: undefined }} />,
  );

  // 16.000.000 + 3.130.000 + 1.000.000 + 2.000.000 = 22.130.000; OT miễn thuế.
  expect(html).toContain('22.130.000');
});

test('§2 TAX DEDUCTIONS — insurance + family deductions yield taxable earnings', () => {
  const html = renderToStaticMarkup(<TaxDeductionsCard payslip={basePayslip} />);

  for (const label of ['Các khoản giảm trừ thuế', 'Bảo hiểm (BHXH + BHYT + BHTN)', 'Giảm trừ bản thân', 'Thu nhập tính thuế']) {
    expect(html).toContain(label);
  }
  expect(html).toContain('15.500.000');
  expect(html).toContain('4.950.000');
  // Căn cứ trích in ở dòng phụ của mục bảo hiểm, không lặp thành dòng riêng.
  expect(html).toContain('Trích trên lương đóng bảo hiểm');
  expect(html).not.toContain('Lương đóng BHXH (căn cứ trích)');
});

test('§2 — ba khoản giảm trừ luôn là mục cố định, dòng người phụ thuộc không bị ẩn', () => {
  const html = renderToStaticMarkup(<TaxDeductionsCard payslip={basePayslip} />);

  // Không có người phụ thuộc → vẫn in dòng, số tiền bằng 0.
  expect(html).toContain('Giảm trừ người phụ thuộc');
  expect(html).toContain('Chưa đăng ký người phụ thuộc');
});

test('§2 — hiển thị giảm trừ người phụ thuộc khi có', () => {
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

  expect(html).toContain('Giảm trừ người phụ thuộc');
  expect(html).toContain('2 người phụ thuộc đã đăng ký');
  expect(html).toContain('12.400.000');
});

test('§3 PIT — biểu thuế lũy tiến từng phần dạng bảng', () => {
  const html = renderToStaticMarkup(<PitTaxDetails payslip={basePayslip} />);

  expect(html).toContain('Thuế TNCN (PIT)');
  for (const head of ['Bậc thuế', 'Thu nhập tính thuế', 'Thuế suất', 'Thuế phát sinh']) {
    expect(html).toContain(head);
  }
  expect(html).toContain('Bậc 1');
  expect(html).toContain('4.950.000');
  expect(html).toContain('5%');
  expect(html).toContain('Thuế TNCN phải nộp');
  expect(html).toContain('247.500');
});

test('§3 — không phát sinh thuế thì nói rõ thay vì bảng rỗng', () => {
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
