/** @jest-environment jsdom */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PayslipDetailScreen } from '../src/screens/Employee/PayslipDetailScreen';
import { PayslipDetailPage } from '../src/screens/hr/PayslipPreviewDialog';

jest.mock('../src/config/api', () => ({
  resolveApiBase: async () => ({ base: 'https://api.test' }),
  apiUrl: (base: string, path: string) => base + path,
}));

const payslip = {
  _id: 'p1',
  employeeName: 'Hoài Bảo',
  employeeCode: 'TVS-0112',
  taxCode: '8402918472',
  periodLabel: '09/2026',
  // 20.000.000 + 5.000.000 + 2.000.000 = 27.000.000
  grossEarnings: 27_000_000,
  monthlyBaseSalary: 26_000_000,
  standardWorkingDays: 26,
  payableWorkingDays: 20, // 26.000.000 ÷ 26 × 20 = 20.000.000
  socialInsurance: 1_280_000,
  healthInsurance: 240_000,
  unemploymentInsurance: 160_000,
  pitAmount: 247_500,
  otherDeductions: 0,
  netSalary: 25_072_500,
  // 22.130.000 − 1.680.000 − 15.500.000 − 0 = 4.950.000
  taxableIncome: 22_130_000,
  taxableEarnings: 4_950_000,
  personalDeduction: 15_500_000,
  dependentDeduction: 0,
  status: 'RELEASED',
  releasedAt: '2026-10-01T03:00:00.000Z',
  earningBreakdown: [
    { type: 'BASE_SALARY', label: 'Lương cơ bản theo công', amount: 20_000_000 },
    { type: 'KPI_BONUS', label: 'Thưởng KPI', amount: 5_000_000 },
    { type: 'OVERTIME', label: 'Tiền làm thêm giờ', amount: 2_000_000 },
  ],
  pitBreakdown: [{ bracket: 1, income: 4_950_000, rate: 5, tax: 247_500 }],
};

let container: HTMLDivElement;
let root: Root;
let calls: Array<{ method: string; path: string }> = [];
let detail: unknown = payslip;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  calls = [];
  detail = payslip;
  globalThis.fetch = jest.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const path = String(url).replace('https://api.test', '');
    calls.push({ method: options?.method || 'GET', path });
    const data = path.endsWith('/viewed') ? null : detail;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data }),
    } as Response;
  }) as unknown as typeof fetch;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

async function render(payslipId = 'p1') {
  await act(async () => root.render(createElement(PayslipDetailScreen, { apiBase: 'https://api.test', payslipId })));
}

test('phiếu lương mở dạng trang: đủ 4 mục, sơ đồ công thức và số thực nhận', async () => {
  await render();
  const html = container.innerHTML;

  // React escape `&` thành `&amp;` trong innerHTML.
  for (const label of ['Tổng thu nhập (Gross)', 'Thu nhập chịu thuế trước giảm trừ', 'Các khoản giảm trừ thuế', 'Thuế TNCN (PIT)', 'Tổng kết &amp; đối soát thực nhận']) {
    expect(html).toContain(label);
  }
  // Mỗi mục là một bảng thật, không còn dropdown chi tiết.
  expect(container.querySelectorAll('table').length).toBeGreaterThanOrEqual(4);
  expect(html).toContain('ngày công chuẩn');
  expect(html).toContain('Số tiền thực nhận (Net)');
  expect(html).toContain('27.000.000');
  expect(html).toContain('25.072.500');
  // 1.680.000 bảo hiểm + 247.500 thuế = 1.927.500 tổng khấu trừ
  expect(html).toContain('1.927.500');
  // Đối soát khớp: 27.000.000 − 1.927.500 = 25.072.500
  expect(html).toContain('Khớp');
});

test('phiếu lương là một khung duy nhất, các mục xếp dọc ngăn bằng đường kẻ', async () => {
  await render();

  // Một tờ phiếu: đúng một vỏ ring bọc ngoài, 5 mục bên trong.
  expect(container.querySelectorAll('div.ring-1')).toHaveLength(1);
  expect(container.querySelectorAll('.ring-1 > section')).toHaveLength(5);
  for (const index of ['1', '2', '3', '4']) {
    expect(container.querySelector(`.ring-1 > section:nth-child(${Number(index) + 1})`)?.textContent).toBeTruthy();
  }
  // Không còn sơ đồ công thức 5 khối ở đầu trang.
  expect(container.innerHTML).not.toContain('Tổng Gross');
});

test('đối soát lệch thì không khoe "Khớp"', async () => {
  detail = { ...payslip, netSalary: 25_000_000 };
  await render();
  expect(container.innerHTML).toContain('Lệch số');
});

test('mục bảo hiểm ở card 2 gập/mở được phần trích chi tiết', async () => {
  await render();

  const findToggle = () =>
    [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((btn) =>
      btn.textContent?.includes('Bảo hiểm'),
    );
  const toggle = findToggle();
  expect(toggle).toBeDefined();
  // Mặc định gập: dòng con BHXH/BHYT/BHTN chưa in.
  expect(toggle!.getAttribute('aria-expanded')).toBe('false');
  expect(container.innerHTML).not.toContain('1.280.000');
  expect(container.innerHTML).toContain('1.680.000');

  await act(async () => toggle!.click());

  expect(findToggle()!.getAttribute('aria-expanded')).toBe('true');
  expect(container.innerHTML).toContain('1.280.000');
});

test('mục giảm trừ chỉ liệt kê khoản trừ, thu nhập tính thuế chuyển sang mục 3', async () => {
  await render();
  const html = container.innerHTML;

  // Mục 2 chỉ liệt kê khoản trừ; mục 3 in bảng nối số về nguồn và ra kết quả.
  const sections = container.querySelectorAll('.ring-1 > section');
  expect(sections[1].textContent).not.toContain('Thu nhập tính thuế');
  expect(sections[2].textContent).toContain('Thu nhập tính thuế');
  expect(html).toContain('Lấy từ');
  expect(html).toContain('22.130.000');
  expect(html).toContain('4.950.000');
  expect(html).not.toContain('không âm');
});

test('giảm trừ vượt thu nhập thì ghi rõ đã về 0, không âm', async () => {
  detail = { ...payslip, taxableIncome: 10_000_000, taxableEarnings: 0, pitAmount: 0, pitBreakdown: [] };
  await render();
  expect(container.innerHTML).toContain('đã về 0, không âm');
});

test('từng mục có nút "?" mở công thức bằng chữ', async () => {
  await render();

  const helpButtons = [...container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Cách tính:"]')];
  expect(helpButtons.map((btn) => btn.getAttribute('aria-label'))).toEqual([
    'Cách tính: Tổng thu nhập (Gross)',
    'Cách tính: Các khoản giảm trừ thuế',
    'Cách tính: Thu nhập tính thuế',
    'Cách tính: Thuế TNCN (PIT)',
    'Cách tính: Tổng kết & đối soát thực nhận',
  ]);
  // Công thức nằm trong tooltip, không in sẵn ra bảng.
  expect(container.innerHTML).not.toContain('Phụ cấp + Thưởng chuyên cần');
});

test('chỉ đánh dấu đã xem khi phiếu ở trạng thái RELEASED', async () => {
  await render();
  expect(calls.filter((call) => call.path.endsWith('/viewed'))).toHaveLength(1);
  expect(container.innerHTML).toContain('Đã Xem');

  calls = [];
  detail = { ...payslip, status: 'GENERATED' };
  await render();
  expect(calls.filter((call) => call.path.endsWith('/viewed'))).toHaveLength(0);
});

test('trang HR dùng chung bố cục và gọi endpoint HR, không đánh dấu đã xem', async () => {
  detail = { ...payslip, payrollRunId: 'r9' };
  await act(async () => root.render(
    createElement(PayslipDetailPage, { apiBase: 'https://api.test', payslipId: 'p1', mode: 'hr' }),
  ));
  const html = container.innerHTML;

  // Cùng một tờ phiếu: vỏ ring bọc ngoài, 5 mục, dòng Net xanh.
  expect(container.querySelectorAll('.ring-1 > section')).toHaveLength(5);
  expect(html).toContain('Số tiền thực nhận (Net)');
  expect(html).toContain('25.072.500');
  for (const label of ['Cách tính: Tổng thu nhập (Gross)', 'Cách tính: Thuế TNCN (PIT)']) {
    expect(container.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
  }
  // Nhãn nút quay lại của HR, và endpoint HR chứ không phải self-service.
  expect(html).toContain('Bảng lương');
  // Quay về đúng kỳ lương → dialog chi tiết tự mở lại.
  expect(container.querySelector('a[href="/hr/payroll-runs?run=r9"]')).not.toBeNull();
  expect(calls.map((call) => call.path)).toEqual(['/api/payslips/p1']);
});
