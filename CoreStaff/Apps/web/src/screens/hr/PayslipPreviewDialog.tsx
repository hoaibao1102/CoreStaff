import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Card, CardContent, CardHeader } from '@/components/card';
import { navigationEvent } from '@/components/AppLink';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Separator } from '@/components/separator';
import { Skeleton } from '@/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table';
import { Tooltip } from '@/components/tooltip';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { hrRequest } from '@/services/hrService';
import { employeeRequest } from '@/services/employeeService';

export type PayslipRow = {
  _id: string;
  /** Bảng lương sinh ra phiếu — HR dùng để quay về đúng kỳ lương. */
  payrollRunId?: string;
  employeeName: string;
  employeeCode?: string;
  taxCode?: string;
  grossEarnings: number;
  netSalary: number;
  pitAmount: number;
  /** §2 — thu nhập chịu thuế trước giảm trừ (backend tính). */
  taxableIncome?: number;
  /** §3 — thu nhập tính thuế sau bảo hiểm + giảm trừ gia cảnh. */
  taxableEarnings?: number;
  otherDeductions?: number;
  personalDeduction?: number;
  dependentDeduction?: number;
  /** Lương cơ bản theo hợp đồng (chưa chia ngày công) — dùng cho chi tiết lương công. */
  monthlyBaseSalary?: number;
  /** Số ngày công chuẩn của kỳ. */
  standardWorkingDays?: number;
  /** Số ngày công thực tế được trả lương. */
  payableWorkingDays?: number;
  /** Tiền công 1 giờ = monthlyBaseSalary / (standardWorkingDays × 8). */
  hourlyRate?: number;
  contributionBase?: number;
  socialInsuranceRate?: number;
  healthInsuranceRate?: number;
  unemploymentInsuranceRate?: number;
  socialInsurance?: number;
  healthInsurance?: number;
  unemploymentInsurance?: number;
  earningBreakdown?: Array<{ type: string; label: string; amount: number; taxable?: boolean }>;
  allowanceBreakdown?: Array<{ type: string; label: string; amount: number; taxable?: boolean }>;
  otBreakdown?: {
    totalMinutes: number;
    totalHours?: number;
    workingDayMinutes: number;
    weeklyOffMinutes: number;
    publicHolidayMinutes: number;
    hourlyRate: number;
    otPay: number;
    /** Cờ công ty: true = cả tiền OT chịu thuế, false = miễn hết. */
    overtimeTaxable?: boolean;
    breakdown: Array<{
      type: string;
      label: string;
      minutes: number;
      coefficient: number;
      amount: number;
    }>;
  };
  deductionBreakdown?: Array<{ type: string; label: string; amount: number }>;
  pitBreakdown?: Array<{ bracket: number; income: number; rate: number; tax: number }>;
  dependents?: Array<{ fullName: string; relationship: string; birthDate?: string }>;
  status: string;
  generatedAt?: string;
  releasedAt?: string;
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

/** Số giờ làm thêm: tối đa 2 chữ số thập phân, không hiện đuôi ".00". */
const formatHours = (value: number) =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)} giờ`;

export const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const STATUS_LABELS: Record<string, string> = {
  GENERATED: 'Đã Tạo',
  RELEASED: 'Đã Phát Hành',
  VIEWED: 'Đã Xem',
};

/** `0.08 * 100` ra 8.000000000000002 — làm tròn để không in số rác lên phiếu lương. */
const formatRate = (rate?: number) => Number(((rate || 0) * 100).toFixed(2));

/** Ô số thứ tự mục — ô vuông navy như mẫu phiếu lương giấy. */
export function SectionNumber({ value }: { value: number }) {
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded bg-primary text-[11px] font-bold leading-none text-primary-foreground" aria-hidden="true">
      {value}
    </span>
  );
}

/**
 * Khung chung của mọi mục phiếu lương: vỏ xám, bảng trắng bên trong.
 * Dùng chung cho dialog HR và trang chi tiết để hai nơi không lệch nhau.
 *
 * `variant="card"` (mặc định) — mục là một card xám riêng, dùng cho dialog HR.
 * `variant="sheet"` — mục là một khối phẳng nối tiếp trong cùng tờ phiếu,
 *   ngăn bằng đường kẻ ngang, dùng cho trang phiếu lương của nhân viên.
 */
export function PayslipSection({
  index,
  title,
  subtitle,
  action,
  formula,
  wideTooltip = false,
  variant = 'card',
  children,
}: {
  index?: number;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Công thức bằng chữ của mục — in trong tooltip "?" cạnh tiêu đề. */
  formula?: ReactNode;
  /** Tooltip công thức chứa bảng nhiều dòng — mở rộng bề ngang. */
  wideTooltip?: boolean;
  variant?: 'card' | 'sheet';
  children: ReactNode;
}) {
  const heading = (
    <div className="flex min-w-0 items-center gap-2">
      <h2 className="font-heading text-[13px] font-bold uppercase tracking-wide text-foreground">{title}</h2>
      {formula && (
        <Tooltip content={formula} wide={wideTooltip}>
          <button
            type="button"
            aria-label={`Cách tính: ${title}`}
            className="grid size-5 shrink-0 cursor-help place-items-center rounded-full border border-border text-[11px] font-bold leading-none text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            ?
          </button>
        </Tooltip>
      )}
    </div>
  );

  const inner = (
    <>
      {/* Dải màu ở hàng tiêu đề bảng, theo thói quen các bảng khác trong dự án
          (TimesheetReviewScreen, ManagerDepartmentScreen) để hàng tiêu đề tách khỏi dữ liệu. */}
      <div className="overflow-hidden border-border bg-card [&_thead]:bg-muted/60 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-[10.5px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_td]:px-2.5 [&_td]:py-1.5">
        {children}
      </div>
    </>
  );

  if (variant === 'sheet') {
    // Card tự thân trên lưới 1 trang: tiêu đề + bảng nén, subtitle vào tooltip
    // vì mỗi card chỉ còn ~250–380px bề ngang.
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/60 px-3 py-2">
          {typeof index === 'number' && <SectionNumber value={index} />}
          {heading}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {subtitle && (
              <Tooltip content={subtitle}>
                <button
                  type="button"
                  aria-label={`Giải thích: ${title}`}
                  className="grid size-5 shrink-0 cursor-help place-items-center rounded-full border border-border text-[11px] font-semibold leading-none text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  i
                </button>
              </Tooltip>
            )}
            {action}
          </div>
        </div>
        <div className="min-h-0 flex-1 px-0 py-0 text-[13px] leading-snug [&_[data-slot=table-container]]:h-full [&_td]:py-1.5 [&_td]:text-[13px] [&_td]:whitespace-normal [&_tfoot_td]:pt-2 [&_tfoot_td]:pb-2 [&_th]:whitespace-normal">{inner}</div>
      </section>
    );
  }

  return (
    <Card className="gap-0 bg-muted/50 py-0">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border py-4">
        <div className="flex items-start gap-3">
          {typeof index === 'number' && <SectionNumber value={index} />}
          <div>
            {heading}
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className="py-4">{inner}</CardContent>
    </Card>
  );
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link' | 'success';

export function getStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'VIEWED':
      return 'secondary';
    case 'RELEASED':
      return 'success';
    case 'GENERATED':
      return 'outline';
    default:
      return 'outline';
  }
}

/** Công thức bằng chữ của từng mục — in trong tooltip "?" cho người mới đọc phiếu. */
const GROSS_FORMULA =
  'Tổng Gross = Lương cơ bản theo ngày công + Phụ cấp + Thưởng chuyên cần + Thưởng KPI + Tiền làm thêm giờ.';
const TAX_DEDUCTION_FORMULA =
  'Ba khoản này được trừ khỏi Thu nhập chịu thuế (mục 1): Bảo hiểm (BHXH + BHYT + BHTN), Giảm trừ bản thân, '
  + 'Giảm trừ người phụ thuộc. Phần còn lại là Thu nhập tính thuế — in ở đầu mục 3.';
const INSURANCE_BASE_FORMULA =
  'Lương đóng bảo hiểm = Lương cơ bản hợp đồng − Tổng phụ cấp (không âm), rồi kẹp sàn/trần riêng của từng khoản. '
  + 'BHXH, BHYT, BHTN = Lương đóng bảo hiểm × tỷ lệ của khoản đó.';
const TAXABLE_EARNINGS_FORMULA =
  'Thu nhập tính thuế = Thu nhập chịu thuế − Bảo hiểm (BHXH + BHYT + BHTN) − Giảm trừ bản thân − Giảm trừ người phụ thuộc.';
const PIT_FORMULA =
  'Thuế TNCN = phần thu nhập nằm trong bậc × thuế suất của bậc đó.';

/**
 * Biểu thuế TNCN lũy tiến chuẩn Việt Nam (5 bậc/tháng). In đủ để người đọc thấy
 * thu nhập của mình rơi vào những bậc nào, kể cả bậc kỳ này chưa chạm tới.
 */
const PIT_BRACKET_TABLE = [
  { bracket: 1, range: 'Đến 10.000.000', rate: 5 },
  { bracket: 2, range: 'Trên 10.000.000 đến 30.000.000', rate: 10 },
  { bracket: 3, range: 'Trên 30.000.000 đến 60.000.000', rate: 20 },
  { bracket: 4, range: 'Trên 60.000.000 đến 100.000.000', rate: 30 },
  { bracket: 5, range: 'Trên 100.000.000', rate: 35 },
] as const;

/** Dấu "?" giải thích chính sách thuế của tiền tăng ca. Chỉ dòng OT dùng. */
function TaxMarker({ overtimeTaxable }: { overtimeTaxable: boolean }) {
  return (
    <Tooltip
      content={
        overtimeTaxable
          ? 'Chính sách thuế TNCN của công ty: toàn bộ tiền tăng ca chịu thuế.'
          : 'Chính sách thuế TNCN của công ty: tiền tăng ca được miễn thuế, không vào thu nhập chịu thuế.'
      }
    >
      <button
        type="button"
        aria-label="Chính sách thuế TNCN cho tiền tăng ca"
        className="ml-1 inline-flex cursor-help align-middle text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle className="size-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

export function GrossEarningsCard({
  payslip,
  variant,
  showFormula = false,
}: {
  payslip: PayslipRow;
  /** 'sheet' — khối phẳng trong tờ phiếu của nhân viên; mặc định là card rời. */
  variant?: 'card' | 'sheet';
  /** Bật tooltip "?" giải thích cách cộng ra Gross. */
  showFormula?: boolean;
}) {
  const totalEarnings = payslip.grossEarnings || 0;
  const allowances = payslip.allowanceBreakdown ?? [];
  // Giữ nguyên thứ tự backend trả về, kể cả dòng ALLOWANCE — nó là dòng cha của các phụ cấp.
  const summaryRows = payslip.earningBreakdown ?? [];

  // Chi tiết lương công: lương tháng ÷ ngày công chuẩn = tiền công 1 ngày, × ngày công thực tế.
  const monthlyBaseSalary = payslip.monthlyBaseSalary || 0;
  const standardWorkingDays = payslip.standardWorkingDays || 0;
  const payableWorkingDays = payslip.payableWorkingDays || 0;
  const dailyRate = standardWorkingDays > 0 ? monthlyBaseSalary / standardWorkingDays : 0;
  const hasBaseDetail = monthlyBaseSalary > 0 && standardWorkingDays > 0;

  // Chi tiết OT: giờ × (tiền công 1 giờ × hệ số) = thành tiền.
  const otBreakdown = payslip.otBreakdown;
  // In đủ mọi loại OT backend trả về — bỏ dòng nào thì các dòng con cộng lại
  // không còn khớp `otPay` ở dòng cha.
  const otLines = otBreakdown?.breakdown ?? [];

  // Dòng phụ giải thích cách ra số tiền, in ngay dưới tên khoản mục.
  const baseDetail = hasBaseDetail
    ? `${formatCurrency(monthlyBaseSalary)} ÷ ${standardWorkingDays} ngày công chuẩn = ${formatCurrency(dailyRate)}/ngày × ${payableWorkingDays} ngày công thực tế`
    : undefined;
  // Chính sách thuế công ty: bật → cả tiền OT vào thu nhập chịu thuế, tắt → miễn hết.
  // Khớp `nonTaxableOt` của PitService — không chia nhỏ tiền OT.
  const overtimeTaxable = otBreakdown?.overtimeTaxable === true;
  const taxableOt = overtimeTaxable ? (otBreakdown?.otPay ?? 0) : 0;
  // Số giờ làm thêm cả kỳ — luôn in thành dòng nhỏ dưới tên khoản mục OT.
  const otHours = otBreakdown ? (otBreakdown.totalHours ?? otBreakdown.totalMinutes / 60) : 0;
  const otDetail = otHours > 0 ? `Làm thêm ${formatHours(otHours)} trong kỳ` : undefined;
  // Dòng chi tiết (OT theo loại ngày) thu gọn mặc định — chỉ xổ khi bấm,
  // giữ phiếu gọn một trang. Keyed theo `row.key` để thêm dòng khác sau này.
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  type GrossRow = {
    key: string;
    label: string;
    amount: number;
    /** Phần vào thu nhập chịu thuế TNCN. */
    taxable: number;
    detail?: string;
    /** Gắn dấu * giải thích chính sách thuế — chỉ dòng tiền làm thêm giờ. */
    taxMarker?: boolean;
    subRows?: Array<{ key: string; label: string; amount: number; taxable: number }>;
  };
  // Năm khoản thu nhập là cố định: luôn in đủ kể cả 0 ₫. Backend đã cắt khoản 0
  // khỏi `earningBreakdown` (và phiếu cũ sinh trước đây cũng thiếu hẳn dòng), nên
  // không thể dựa vào breakdown để biết kỳ này có những khoản nào.
  const amountOf = (type: string) => summaryRows.find((item) => item.type === type)?.amount ?? 0;
  // R1: mọi phụ cấp đều chịu thuế nên phần chịu thuế = nguyên số tiền.
  const allowanceRows: GrossRow[] = allowances.length > 0
    // Có breakdown thì in từng loại (kể cả 0 ₫); in thêm dòng gộp là đếm trùng.
    ? allowances.map((allowance, allowanceIdx) => ({
        key: `ALLOWANCE-${allowance.type}-${allowanceIdx}`,
        label: allowance.label,
        amount: allowance.amount,
        taxable: allowance.amount,
      }))
    // Không cấu hình phụ cấp nào thì vẫn giữ dòng tổng để thấy là 0 ₫.
    : [{ key: 'ALLOWANCE', label: 'Tổng phụ cấp', amount: amountOf('ALLOWANCE'), taxable: amountOf('ALLOWANCE') }];

  const rows: GrossRow[] = [
    {
      key: 'BASE_SALARY',
      label: 'Lương cơ bản theo công',
      amount: amountOf('BASE_SALARY'),
      taxable: amountOf('BASE_SALARY'),
      detail: baseDetail,
    },
    ...allowanceRows,
    {
      key: 'ATTENDANCE_BONUS',
      label: 'Thưởng chuyên cần',
      amount: amountOf('ATTENDANCE_BONUS'),
      taxable: amountOf('ATTENDANCE_BONUS'),
    },
    {
      key: 'KPI_BONUS',
      label: 'Thưởng KPI',
      amount: amountOf('KPI_BONUS'),
      taxable: amountOf('KPI_BONUS'),
    },
    {
      key: 'OVERTIME',
      label: 'Tiền làm thêm giờ',
      amount: amountOf('OVERTIME') || (otBreakdown?.otPay ?? 0),
      taxable: taxableOt,
      detail: otDetail,
      taxMarker: true,
      subRows: otLines.map((line, lineIdx) => ({
        key: `${line.type}-${lineIdx}`,
        label: `${line.label} — ${line.minutes / 60} giờ × (${formatCurrency(otBreakdown?.hourlyRate || 0)} × ${line.coefficient})`,
        amount: line.amount,
        taxable: overtimeTaxable ? line.amount : 0,
      })),
    },
  ];

  const taxableIncome = payslip.taxableIncome ?? rows.reduce((sum, row) => sum + row.taxable, 0);

  const body = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Khoản mục thu nhập</TableHead>
          <TableHead className="text-right">Số tiền (VND)</TableHead>
          <TableHead className="text-right">Chịu thuế TNCN</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const hasSubRows = (row.subRows?.length ?? 0) > 0;
          const isOpen = openRows[row.key] === true;
          return (
          <Fragment key={row.key}>
            <TableRow>
              <TableCell>
                {hasSubRows ? (
                  <button
                    type="button"
                    onClick={() => setOpenRows((current) => ({ ...current, [row.key]: !current[row.key] }))}
                    aria-expanded={isOpen}
                    className="-mx-1 flex min-w-0 items-start gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
                      {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{row.label}</span>
                      {row.taxMarker && <TaxMarker overtimeTaxable={overtimeTaxable} />}
                      {row.detail && (
                        <span className="mt-0.5 block text-[11.5px] font-normal text-muted-foreground">{row.detail}</span>
                      )}
                    </span>
                  </button>
                ) : (
                  <span className="font-medium text-foreground">{row.label}</span>
                )}
                {!hasSubRows && row.taxMarker && <TaxMarker overtimeTaxable={overtimeTaxable} />}
                {!hasSubRows && row.detail && (
                  <span className="mt-0.5 block text-[11.5px] font-normal text-muted-foreground">{row.detail}</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.amount)}</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {formatCurrency(row.taxable)}
              </TableCell>
            </TableRow>
            {isOpen && row.subRows?.map((subRow) => (
              <TableRow key={subRow.key} className="bg-muted/30 hover:bg-muted/30">
                <TableCell className="pl-6 text-[11.5px] font-normal text-muted-foreground">{subRow.label}</TableCell>
                <TableCell className="text-right font-mono text-[11.5px]">{formatCurrency(subRow.amount)}</TableCell>
                <TableCell className="text-right font-mono text-[11.5px] text-muted-foreground">
                  {formatCurrency(subRow.taxable)}
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow className="hover:bg-muted/50">
          <TableCell className="py-2 text-[13px] font-bold uppercase tracking-wide text-foreground">
            Tổng cộng Gross
          </TableCell>
          <TableCell className="py-2 text-right font-mono text-base font-bold text-foreground">
            {formatCurrency(totalEarnings)}
          </TableCell>
          <TableCell />
        </TableRow>
        <TableRow className="hover:bg-muted/50">
          <TableCell className="pb-2 text-[11.5px] font-medium text-muted-foreground">
            Thu nhập chịu thuế trước giảm trừ
          </TableCell>
          <TableCell className="pb-2 text-right font-mono text-[13px] text-muted-foreground" colSpan={2}>
            {formatCurrency(taxableIncome)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );

  return (
    <PayslipSection
      index={1}
      title="Tổng thu nhập (Gross)"
      subtitle="Các khoản thu nhập cấu thành lương gross của kỳ."
      formula={showFormula ? GROSS_FORMULA : undefined}
      variant={variant}
    >
      {body}
    </PayslipSection>
  );
}

/** §2 — Các khoản giảm trừ khỏi Thu nhập chịu thuế. Kết quả để ở đầu mục 3. */
export function TaxDeductionsCard({
  payslip,
  variant,
  showFormula = false,
}: {
  payslip: PayslipRow;
  /** 'sheet' — khối phẳng trong tờ phiếu của nhân viên; mặc định là card rời. */
  variant?: 'card' | 'sheet';
  /** Bật tooltip "?" giải thích các khoản giảm trừ. */
  showFormula?: boolean;
}) {
  const totalInsurance =
    (payslip.socialInsurance || 0) +
    (payslip.healthInsurance || 0) +
    (payslip.unemploymentInsurance || 0);
  const dependents = payslip.dependents?.length || 0;
  const insuranceDetail =
    payslip.contributionBase && payslip.contributionBase > 0
      ? `Trích trên lương đóng bảo hiểm ${formatCurrency(payslip.contributionBase)}`
      : undefined;
  /** "BHXH (8%)" — chỉ kèm tỷ lệ khi phiếu có lưu tỷ lệ, tránh in "(0%)" sai nghĩa. */
  const insuranceLabel = (name: string, rate?: number) =>
    rate ? `${name} (${formatRate(rate)}%)` : name;

  // Ba khoản giảm trừ luôn là 3 hàng cố định của card; bảo hiểm gập sẵn,
  // bấm mới xổ ra phần trích BHXH/BHYT/BHTN.
  const [showInsuranceParts, setShowInsuranceParts] = useState(false);
  // Ba khoản trích luôn đủ mặt khi xổ ra — khoản 0 ₫ vẫn in, để thấy rõ là
  // kỳ này không trích chứ không phải hệ thống bỏ sót.
  const insuranceParts = [
    { name: 'BHXH', rate: payslip.socialInsuranceRate, amount: payslip.socialInsurance || 0 },
    { name: 'BHYT', rate: payslip.healthInsuranceRate, amount: payslip.healthInsurance || 0 },
    { name: 'BHTN', rate: payslip.unemploymentInsuranceRate, amount: payslip.unemploymentInsurance || 0 },
  ] as const;
  const hasInsurance = totalInsurance > 0;

  /** Khoản giảm trừ in dấu trừ khi có tiền; khoản 0 thì không in "−0 ₫". */
  const formatDeduction = (value?: number) => (value ? `-${formatCurrency(value)}` : formatCurrency(0));

  const body = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Khoản giảm trừ</TableHead>
          <TableHead className="text-right">Số tiền</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            {hasInsurance ? (
              <div className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => setShowInsuranceParts((open) => !open)}
                  aria-expanded={showInsuranceParts}
                  className="-mx-1 flex min-w-0 flex-1 items-start gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
                    {showInsuranceParts ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </span>
                  <span>
                    <span className="font-medium text-foreground">Bảo hiểm (BHXH + BHYT + BHTN)</span>
                    {insuranceDetail && (
                      <span className="mt-0.5 block text-[11.5px] font-normal text-muted-foreground">{insuranceDetail}</span>
                    )}
                  </span>
                </button>
                {showFormula && (
                  <Tooltip content={INSURANCE_BASE_FORMULA} wide>
                    <button
                      type="button"
                      aria-label="Cách tính: Lương đóng bảo hiểm"
                      className="mt-0.5 grid size-5 shrink-0 cursor-help place-items-center rounded-full border border-border text-[11px] font-bold leading-none text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      ?
                    </button>
                  </Tooltip>
                )}
              </div>
            ) : (
              <>
                <span className="font-medium text-foreground">Bảo hiểm (BHXH + BHYT + BHTN)</span>
                <span className="mt-0.5 block text-[11.5px] font-normal text-muted-foreground">Kỳ này không trích bảo hiểm</span>
              </>
            )}
          </TableCell>
          <TableCell className="text-right font-mono text-destructive">{formatDeduction(totalInsurance)}</TableCell>
        </TableRow>
        {showInsuranceParts &&
          insuranceParts.map((part) => (
            <TableRow key={part.name} className="bg-muted/30 hover:bg-muted/30">
              <TableCell className="pl-8 text-[11.5px] text-muted-foreground">{insuranceLabel(part.name, part.rate)}</TableCell>
              <TableCell className="text-right font-mono text-[11.5px] text-muted-foreground">
                {formatCurrency(part.amount)}
              </TableCell>
            </TableRow>
          ))}
        <TableRow>
          <TableCell>
            <span className="font-medium text-foreground">Giảm trừ bản thân</span>
            <span className="mt-0.5 block text-[11.5px] font-normal text-muted-foreground">
              Mức giảm trừ gia cảnh cho người nộp thuế
            </span>
          </TableCell>
          <TableCell className="text-right font-mono text-destructive">{formatDeduction(payslip.personalDeduction)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <span className="font-medium text-foreground">Giảm trừ người phụ thuộc</span>
            <span className="mt-0.5 block text-[11.5px] font-normal text-muted-foreground">
              {dependents > 0 ? `${dependents} người phụ thuộc đã đăng ký` : 'Chưa đăng ký người phụ thuộc'}
            </span>
          </TableCell>
          <TableCell className="text-right font-mono text-destructive">{formatDeduction(payslip.dependentDeduction)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  return (
    <PayslipSection index={2} title="Các khoản giảm trừ thuế" subtitle="Bảo hiểm trích lương và giảm trừ gia cảnh." formula={showFormula ? TAX_DEDUCTION_FORMULA : undefined} variant={variant}>
      {body}
    </PayslipSection>
  );
}

/** §3 — Thu nhập tính thuế: kết quả của mục 2, đầu vào của biểu thuế. */
export function TaxableEarningsCard({
  payslip,
  variant,
  index = 3,
  showFormula = false,
}: {
  payslip: PayslipRow;
  /** 'sheet' — khối phẳng trong tờ phiếu của nhân viên; mặc định là card rời. */
  variant?: 'card' | 'sheet';
  /** Số thứ tự mục — đổi được vì mục 3 và 4 có thể tách/gộp. */
  index?: number;
  /** Bật tooltip "?" giải thích công thức. */
  showFormula?: boolean;
}) {
  const totalInsurance =
    (payslip.socialInsurance || 0) +
    (payslip.healthInsurance || 0) +
    (payslip.unemploymentInsurance || 0);
  const taxableIncome = payslip.taxableIncome || 0;
  const taxableEarnings = payslip.taxableEarnings || 0;
  // Giảm trừ vượt thu nhập chịu thuế → backend kẹp về 0; nói rõ để phép trừ không "sai".
  const clampedToZero =
    taxableIncome - totalInsurance - (payslip.personalDeduction || 0) - (payslip.dependentDeduction || 0) < 0;

  return (
    <PayslipSection
      index={index}
      title="Thu nhập tính thuế"
      subtitle="Còn lại sau khi trừ bảo hiểm và giảm trừ gia cảnh — căn cứ tính thuế TNCN."
      formula={showFormula ? TAXABLE_EARNINGS_FORMULA : undefined}
      wideTooltip
      variant={variant}
    >      {/* Cột "Lấy từ" nối số về đúng mục đã in ở trên, để người đọc lần được nguồn. */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Khoản mục</TableHead>
            <TableHead>Lấy từ</TableHead>
            <TableHead className="text-right">Số tiền</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium text-foreground">Thu nhập chịu thuế</TableCell>
            <TableCell className="text-[11.5px] text-muted-foreground">Mục 1</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(taxableIncome)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-muted-foreground">Bảo hiểm (BHXH + BHYT + BHTN)</TableCell>
            <TableCell className="text-[11.5px] text-muted-foreground">Mục 2</TableCell>
            <TableCell className="text-right font-mono text-destructive">−{formatCurrency(totalInsurance)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-muted-foreground">Giảm trừ bản thân</TableCell>
            <TableCell className="text-[11.5px] text-muted-foreground">Mục 2</TableCell>
            <TableCell className="text-right font-mono text-destructive">
              −{formatCurrency(payslip.personalDeduction || 0)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-muted-foreground">Giảm trừ người phụ thuộc</TableCell>
            <TableCell className="text-[11.5px] text-muted-foreground">Mục 2</TableCell>
            <TableCell className="text-right font-mono text-destructive">
              −{formatCurrency(payslip.dependentDeduction || 0)}
            </TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-semibold text-foreground">= Thu nhập tính thuế</TableCell>
            <TableCell className="text-right font-mono font-semibold text-foreground">
              {formatCurrency(taxableEarnings)}
            </TableCell>
          </TableRow>
          {clampedToZero && (
            <TableRow className="hover:bg-muted/50">
              <TableCell colSpan={3} className="pb-3 text-[11.5px] font-normal text-muted-foreground">
                Giảm trừ vượt thu nhập chịu thuế nên thu nhập tính thuế đã về 0, không âm.
              </TableCell>
            </TableRow>
          )}
        </TableFooter>
      </Table>
    </PayslipSection>
  );
}

/** §5 — dựng lại Net từ chính các khoản đã in ở trên, để thấy phép cộng khớp. */
export function NetRecapSection({ payslip, variant, showFormula = false }: {
  payslip: PayslipRow;
  variant?: 'card' | 'sheet';
  showFormula?: boolean;
}) {
  const totalInsurance =
    (payslip.socialInsurance || 0) + (payslip.healthInsurance || 0) + (payslip.unemploymentInsurance || 0);
  const otherDeductions = payslip.otherDeductions || 0;
  const totalDeductions = totalInsurance + (payslip.pitAmount || 0) + otherDeductions;
  const netSalary = payslip.netSalary || 0;
  const gross = payslip.grossEarnings || 0;
  // Đối soát: lệch quá 1₫ thì không khoe "Khớp".
  const reconciled = Math.abs(gross - totalDeductions - netSalary) <= 1;

  return (
    <PayslipSection
      index={5}
      title="Tổng kết & đối soát thực nhận"
      subtitle="Cân đối lại số thực nhận từ chính các khoản đã in ở trên."
      action={reconciled ? <Badge variant="success">Khớp</Badge> : <Badge variant="outline">Lệch số</Badge>}
      formula={showFormula ? 'Tổng thu nhập (Gross) − Bảo hiểm − Thuế TNCN − Khấu trừ khác.' : undefined}
      variant={variant}
    >
      {/* Dải một hàng thay cho bảng 4 dòng: cùng con số, không lặp lại các khoản
          đã in ở mục 1/2/4, và không để khoảng trống giữa nhãn với số. */}
      <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Tổng thu nhập (Gross)</div>
          <div className="font-mono text-[15px] font-semibold text-foreground">{formatCurrency(gross)}</div>
        </div>
        <span className="hidden text-lg font-semibold text-muted-foreground sm:block" aria-hidden="true">−</span>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Tổng khấu trừ</div>
          <div className="font-mono text-[15px] font-semibold text-destructive">−{formatCurrency(totalDeductions)}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            BH {formatCurrency(totalInsurance)} · Thuế {formatCurrency(payslip.pitAmount || 0)} · Khác {formatCurrency(otherDeductions)}
          </div>
        </div>
        <span className="hidden text-lg font-semibold text-muted-foreground sm:block" aria-hidden="true">=</span>
        <div className="min-w-0 flex-1 rounded-md bg-emerald-50 px-3 py-2 dark:bg-emerald-950/40">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Số tiền thực nhận (Net)
          </div>
          <div className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(netSalary)}</div>
        </div>
      </div>
    </PayslipSection>
  );
}

/**
 * Năm mục của một tờ phiếu lương — một nguồn duy nhất cho cả trang nhân viên
 * và trang HR, nên hai bên không thể lệch bố cục.
 *
 * Bố cục A: ghép card theo chiều cao thật để không còn khoảng trống. `items-start`
 * một mình chỉ chuyển khoảng trắng từ trong card xuống dưới card, không làm mất nó;
 * nên mục 2 (ngắn) xếp chồng lên mục 3 ở cột phải, cộng lại vừa đúng chiều cao
 * mục 1 ở cột trái. Hàng dưới ghép mục 4 với mục 5 (dải một hàng).
 *
 *   [ 1 Gross (7)                        ][ 2 Giảm trừ (5) ]
 *   [                                    ][ 3 Tính thuế (5) ]
 *   [ 4 PIT (5) ][ 5 Tổng kết (7)                          ]
 *
 * Cột phải đọc trên→dưới là 2 rồi 3, nên thứ tự 1→5 vẫn đúng. Toàn tờ cao ~680px,
 * vừa A4 ngang (1123 x 794 px @96dpi) không phải cuộn.
 */
export function PayslipSheetItems({ payslip }: { payslip: PayslipRow }) {
  return (
    <div className="grid grid-cols-12 items-start gap-3">
      {/* h-full: nếu mục 2+3 cộng lại cao hơn mục 1, mục 1 giãn theo hàng lưới
          thay vì để hở. Chênh lệch thực tế chỉ vài chục px. */}
      <div className="col-span-12 lg:col-span-7 lg:h-full">
        <GrossEarningsCard payslip={payslip} variant="sheet" showFormula />
      </div>
      <div className="col-span-12 flex flex-col gap-3 lg:col-span-5">
        <TaxDeductionsCard payslip={payslip} variant="sheet" showFormula />
        <TaxableEarningsCard payslip={payslip} variant="sheet" showFormula />
      </div>
      <div className="col-span-12 lg:col-span-5">
        <PitTaxDetails payslip={payslip} variant="sheet" showFormula />
      </div>
      <div className="col-span-12 lg:col-span-7">
        <NetRecapSection payslip={payslip} variant="sheet" showFormula />
      </div>
    </div>
  );
}

type PayslipDetail = PayslipRow & { periodLabel?: string };

function PayslipDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-52 rounded-lg" />
      <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

/**
 * Tờ phiếu lương mở dạng dialog — nhân viên xem phiếu của mình, HR xem phiếu của
 * bất kỳ ai trong tổ chức. Cùng một bố cục, khác endpoint.
 */
export function PayslipDetailPage({ payslipId, mode = 'employee', apiBase, closeHref }: {
  payslipId: string;
  mode?: 'employee' | 'hr';
  /** Mặc định lấy base từ config; HR truyền base sẵn của workspace. */
  apiBase?: string | null;
  /** Nơi quay về khi đóng; HR mặc định mở lại đúng kỳ lương của phiếu. */
  closeHref?: string;
}) {
  const [back, setBack] = useState(() => closeHref ?? (mode === 'hr' ? '/hr/payroll-runs' : '/app/payslips'));

  // Phiếu lương luôn mở trong dialog: ESC, click ngoài, nút X và nút "Danh sách
  // phiếu lương" đều về `back`, nên URL không kẹt ở /payslips/:id.
  return (
    <Dialog open onOpenChange={(open) => {
      if (open) return;
      // Điều hướng SPA (không reload) để giữ nguyên phiên đăng nhập.
      window.history.pushState(null, '', back);
      window.dispatchEvent(new Event(navigationEvent));
    }}>
      {/* layerOffset: HR mở phiếu từ trong dialog chi tiết kỳ lương, phải nằm trên. */}
      {/* max-w-[1200px]: lưới 5 card cần ~1180px mới đủ chỗ cho chữ 13px. */}
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[1200px]" layerOffset={1}>
        <DialogHeader className="gap-0 border-b border-border py-3 pr-16">
          <DialogTitle className="text-base">Phiếu lương</DialogTitle>
          <DialogDescription className="text-xs">
            {mode === 'hr' ? 'Phiếu lương của nhân viên trong kỳ đã chọn.' : 'Phiếu lương của bạn trong kỳ đã chọn.'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {mode === 'hr'
            ? <HrPayslipDetail payslipId={payslipId} apiBase={apiBase} onLoad={(slip) => {
                if (slip.payrollRunId) setBack(`/hr/payroll-runs?run=${slip.payrollRunId}`);
              }} />
            : <EmployeePayslipDetail payslipId={payslipId} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Khung nội dung: chỉ render tờ phiếu; chrome dialog do PayslipDetailPage lo. */
function PayslipSheet({ payslip }: { payslip: PayslipDetail }) {
  const netSalary = payslip.netSalary || 0;

  // Một dải nhận dạng thay cho header cao 120px cũ, để cả phiếu vừa một trang.
  const identity: Array<{ label: string; value: ReactNode }> = [
    { label: 'Nhân viên', value: payslip.employeeName },
    { label: 'Mã nhân viên', value: <span className="font-mono">{payslip.employeeCode || '—'}</span> },
    { label: 'Mã số thuế', value: <span className="font-mono">{payslip.taxCode || '—'}</span> },
    { label: 'Kỳ lương', value: payslip.periodLabel || '—' },
    {
      label: 'Trạng thái',
      value: (
        <Badge variant={getStatusBadgeVariant(payslip.status)}>
          {STATUS_LABELS[payslip.status] || payslip.status}
        </Badge>
      ),
    },
    { label: 'Thực nhận', value: <span className="font-mono font-bold">{formatCurrency(netSalary)}</span> },
  ];

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <dl className="grid grid-cols-2 border-b border-border bg-muted/30 sm:grid-cols-3 lg:grid-cols-6">
        {identity.map(({ label, value }) => (
          <div key={label} className="min-w-0 border-b border-r border-border px-3 py-2 last:border-r-0">
            <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="truncate text-[14px] font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      {(payslip.generatedAt || payslip.releasedAt) && (
        <p className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          {payslip.generatedAt && <>Khởi tạo {formatDate(payslip.generatedAt)}</>}
          {payslip.generatedAt && payslip.releasedAt && ' · '}
          {payslip.releasedAt && <>Phát hành {formatDate(payslip.releasedAt)}</>}
        </p>
      )}

      <div className="p-2.5">
        <PayslipSheetItems payslip={payslip} />
      </div>
    </div>
  );
}

function EmployeePayslipDetail({ payslipId }: { payslipId: string }) {
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const slip = await employeeRequest.get<PayslipDetail>(`/payslips/me/${payslipId}`);
        if (cancelled) return;
        setPayslip(slip);
        // Nhân viên: xem là hành vi ghi nhận, lỗi audit không được che phiếu lương.
        if (slip.status === 'RELEASED') {
          try {
            await employeeRequest.post<void>(`/payslips/me/${payslipId}/viewed`);
            if (!cancelled) setPayslip((current) => (current ? { ...current, status: 'VIEWED' } : current));
          } catch (auditError) {
            console.error('Failed to mark as viewed:', auditError);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Không thể tải phiếu lương. Vui lòng thử lại sau.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [payslipId]);

  if (loading) return <PayslipDetailSkeleton />;

  if (error || !payslip) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Không tìm thấy phiếu lương.'}</AlertDescription>
      </Alert>
    );
  }

  return <PayslipSheet payslip={payslip} />;
}

/** HR xem phiếu của một nhân viên: khác biệt duy nhất là endpoint. */
function HrPayslipDetail({ payslipId, apiBase, onLoad }: {
  payslipId: string;
  apiBase?: string | null;
  /** Phiếu tải xong — dùng để dựng link quay về đúng kỳ lương. */
  onLoad?: (slip: PayslipDetail) => void;
}) {
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const slip = apiBase ? await hrRequest<PayslipDetail>(apiBase, `/api/payslips/${payslipId}`) : null;
        if (cancelled) return;
        if (!slip) throw new Error('Thiếu địa chỉ API.');
        setPayslip(slip);
        onLoad?.(slip);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Không thể tải phiếu lương. Vui lòng thử lại sau.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payslipId, apiBase]);

  if (loading) return <PayslipDetailSkeleton />;

  if (error || !payslip) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Không tìm thấy phiếu lương.'}</AlertDescription>
      </Alert>
    );
  }

  return <PayslipSheet payslip={payslip} />;
}

/** §4 — Thuế TNCN lũy tiến tính trên Thu nhập tính thuế. */
export function PitTaxDetails({
  payslip,
  variant,
  index = 4,
  showFormula = false,
}: {
  payslip: PayslipRow;
  /** 'sheet' — khối phẳng trong tờ phiếu của nhân viên; mặc định là card rời. */
  variant?: 'card' | 'sheet';
  /** Số thứ tự mục — đổi được vì mục 3 và 4 có thể tách/gộp. */
  index?: number;
  /** Bật tooltip "?" giải thích cách tính thuế lũy tiến. */
  showFormula?: boolean;
}) {
  const brackets = payslip.pitBreakdown ?? [];
  // Dải thu nhập và số thuế của bậc đã dùng — tra theo số bậc backend trả về.
  const appliedByBracket = new Map(brackets.map((bracket) => [bracket.bracket, bracket]));
  // Toàn bảng biểu thuế; bậc có phát sinh in đậm kèm số tiền, bậc còn lại chỉ in ngưỡng.
  const bracketFormula = (
    <span className="block space-y-1">
      <span className="block font-semibold">Biểu thuế TNCN lũy tiến</span>
      <span className="block">
        <span className="block text-muted-foreground">
          <span className="inline-block w-14">Bậc</span>
          <span className="inline-block w-16">Thuế suất</span>
          Thu nhập tính thuế của bậc → thuế phát sinh
        </span>
        {PIT_BRACKET_TABLE.map((row) => {
          const applied = appliedByBracket.get(row.bracket);
          return (
            <span key={row.bracket} className={applied ? 'block font-semibold text-foreground' : 'block text-muted-foreground'}>
              <span className="inline-block w-14">{row.bracket}</span>
              <span className="inline-block w-16">{row.rate}%</span>
              {row.range}
              {applied ? ` → ${formatCurrency(applied.income)} × ${row.rate}% = ${formatCurrency(applied.tax)}` : ''}
            </span>
          );
        })}
      </span>
      <span className="mt-1 block">{PIT_FORMULA}</span>
    </span>
  );

  const body = (
    <>
      {brackets.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bậc thuế</TableHead>
              <TableHead>Thu nhập tính thuế</TableHead>
              <TableHead className="text-right">Thuế suất</TableHead>
              <TableHead className="text-right">Thuế phát sinh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brackets.map((bracket, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-muted-foreground">Bậc {bracket.bracket}</TableCell>
                <TableCell className="font-mono">{formatCurrency(bracket.income)}</TableCell>
                <TableCell className="text-right font-mono">{bracket.rate}%</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(bracket.tax)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold text-foreground">Thuế TNCN phải nộp</TableCell>
              <TableCell className="text-right font-mono font-semibold text-destructive">
                -{formatCurrency(payslip.pitAmount || 0)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Không phát sinh thuế TNCN.</p>
          <Separator />
          <div className="flex justify-between font-semibold text-foreground">
            <span>Thuế TNCN phải nộp</span>
            <span className="font-mono text-destructive">-{formatCurrency(payslip.pitAmount || 0)}</span>
          </div>
        </>
      )}
    </>
  );

  return (
    <PayslipSection index={index} title="Thuế TNCN (PIT)" formula={showFormula ? bracketFormula : undefined} wideTooltip variant={variant}>
      {body}
    </PayslipSection>
  );
}
