import { Fragment, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/dialog";
import { Badge } from '@/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Separator } from '@/components/separator';
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
import { Calendar, ChevronDown, ChevronUp, User, Building2, Wallet } from 'lucide-react';

export type PayslipRow = {
  _id: string;
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

interface Props {
  open: boolean;
  onClose: () => void;
  payslip: PayslipRow | null;
  periodLabel: string;
}

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
export function SectionNumber({ value }: { value: number | '=' }) {
  return (
    <span
      className={
        value === '='
          ? 'grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-600 text-sm font-bold text-white'
          : 'grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground'
      }
      aria-hidden="true"
    >
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
  variant = 'card',
  children,
}: {
  index?: number;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  variant?: 'card' | 'sheet';
  children: ReactNode;
}) {
  const inner = (
    <>
      {/* Dải màu ở hàng tiêu đề bảng, theo thói quen các bảng khác trong dự án
          (TimesheetReviewScreen, ManagerDepartmentScreen) để hàng tiêu đề tách khỏi dữ liệu. */}
      <div className="overflow-hidden rounded-lg border border-border bg-card [&_thead]:bg-muted/60 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
        {children}
      </div>
    </>
  );

  if (variant === 'sheet') {
    return (
      <section className="border-t border-border first:border-t-0">
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div className="flex items-start gap-3">
            {typeof index === 'number' && <SectionNumber value={index} />}
            <div>
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">{title}</h2>
              {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
        <div className="px-6 py-4">{inner}</div>
      </section>
    );
  }

  return (
    <Card className="gap-0 bg-muted/50 py-0">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border py-4">
        <div className="flex items-start gap-3">
          {typeof index === 'number' && <SectionNumber value={index} />}
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">{title}</CardTitle>
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

export function GrossEarningsCard({
  payslip,
  variant,
}: {
  payslip: PayslipRow;
  /** 'sheet' — khối phẳng trong tờ phiếu của nhân viên; mặc định là card rời. */
  variant?: 'card' | 'sheet';
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
  const otLines = (otBreakdown?.breakdown ?? []).filter((line) => line.amount > 0);

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
  const rows: GrossRow[] = summaryRows.flatMap((item, idx): GrossRow[] => {
    // Có breakdown từng loại phụ cấp thì in từng loại, bỏ dòng gộp "Tổng phụ cấp"
    // (in cả hai là đếm trùng). Không có thì giữ dòng gộp.
    // R1: mọi phụ cấp đều chịu thuế nên phần chịu thuế = nguyên số tiền.
    if (item.type === 'ALLOWANCE' && allowances.length > 0) {
      return allowances.map((allowance, allowanceIdx) => ({
        key: `ALLOWANCE-${allowance.type}-${allowanceIdx}`,
        label: allowance.label,
        amount: allowance.amount,
        taxable: allowance.amount,
      }));
    }
    const isOvertime = item.type === 'OVERTIME';
    return [
      {
        key: `${item.type}-${idx}`,
        label: item.label,
        amount: item.amount,
        taxable: isOvertime ? taxableOt : item.amount,
        detail: item.type === 'BASE_SALARY' ? baseDetail : isOvertime ? otDetail : undefined,
        taxMarker: isOvertime,
        subRows: isOvertime
          ? otLines.map((line, lineIdx) => ({
              key: `${line.type}-${lineIdx}`,
              label: `${line.label} — ${line.minutes / 60} giờ × (${formatCurrency(otBreakdown?.hourlyRate || 0)} × ${line.coefficient})`,
              amount: line.amount,
              taxable: overtimeTaxable ? line.amount : 0,
            }))
          : undefined,
      },
    ];
  });

  // Tiền làm thêm giờ là khoản mục cố định của card 1 — backend cắt dòng này khỏi
  // earningBreakdown khi otPay = 0 (và phiếu cũ chưa từng có), nên thiếu thì dựng lại.
  if (!rows.some((row) => row.key.startsWith('OVERTIME'))) {
    rows.push({
      key: 'OVERTIME-fallback',
      label: 'Tiền làm thêm giờ',
      amount: otBreakdown?.otPay ?? 0,
      taxable: taxableOt,
      detail: otDetail,
      taxMarker: true,
    });
  }

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
        {rows.map((row) => (
          <Fragment key={row.key}>
            <TableRow>
              <TableCell>
                <span className="font-medium text-foreground">{row.label}</span>
                {row.taxMarker && (
                  <Tooltip
                    content={
                      overtimeTaxable
                        ? 'Chính sách thuế TNCN của công ty: toàn bộ tiền tăng ca chịu thuế.'
                        : 'Chính sách thuế TNCN của công ty: tiền tăng ca được miễn thuế, không vào thu nhập chịu thuế.'
                    }
                  >
                    <span className="ml-1 cursor-help font-semibold text-primary" aria-label="Chính sách thuế TNCN cho tiền tăng ca">*</span>
                  </Tooltip>
                )}
                {row.detail && (
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.detail}</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.amount)}</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {formatCurrency(row.taxable)}
              </TableCell>
            </TableRow>
            {row.subRows?.map((subRow) => (
              <TableRow key={subRow.key} className="bg-muted/30 hover:bg-muted/30">
                <TableCell className="pl-6 text-xs font-normal text-muted-foreground">{subRow.label}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCurrency(subRow.amount)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {formatCurrency(subRow.taxable)}
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow className="hover:bg-muted/50">
          <TableCell className="py-3 text-sm font-semibold uppercase tracking-wide text-foreground">
            Tổng cộng Gross
          </TableCell>
          <TableCell className="py-3 text-right font-mono text-lg font-bold text-foreground">
            {formatCurrency(totalEarnings)}
          </TableCell>
          <TableCell />
        </TableRow>
        <TableRow className="hover:bg-muted/50">
          <TableCell className="pb-3 text-xs font-medium text-muted-foreground">
            Thu nhập chịu thuế trước giảm trừ
          </TableCell>
          <TableCell className="pb-3 text-right font-mono text-sm text-muted-foreground" colSpan={2}>
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
      variant={variant}
    >
      {body}
    </PayslipSection>
  );
}

/** §2 — Các khoản giảm trừ khỏi thu nhập chịu thuế, ra Thu nhập tính thuế. */
export function TaxDeductionsCard({
  payslip,
  variant,
}: {
  payslip: PayslipRow;
  /** 'sheet' — khối phẳng trong tờ phiếu của nhân viên; mặc định là card rời. */
  variant?: 'card' | 'sheet';
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
  const insuranceParts = (
    [
      { name: 'BHXH', rate: payslip.socialInsuranceRate, amount: payslip.socialInsurance || 0 },
      { name: 'BHYT', rate: payslip.healthInsuranceRate, amount: payslip.healthInsurance || 0 },
      { name: 'BHTN', rate: payslip.unemploymentInsuranceRate, amount: payslip.unemploymentInsurance || 0 },
    ] as const
  ).filter((part) => part.amount > 0);

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
            {insuranceParts.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowInsuranceParts((open) => !open)}
                aria-expanded={showInsuranceParts}
                className="-mx-1 flex w-full items-start gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/40"
              >
                <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
                  {showInsuranceParts ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </span>
                <span>
                  <span className="font-medium text-foreground">Bảo hiểm (BHXH + BHYT + BHTN)</span>
                  {insuranceDetail && (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{insuranceDetail}</span>
                  )}
                </span>
              </button>
            ) : (
              <>
                <span className="font-medium text-foreground">Bảo hiểm (BHXH + BHYT + BHTN)</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Kỳ này không trích bảo hiểm</span>
              </>
            )}
          </TableCell>
          <TableCell className="text-right font-mono text-destructive">{formatDeduction(totalInsurance)}</TableCell>
        </TableRow>
        {showInsuranceParts &&
          insuranceParts.map((part) => (
            <TableRow key={part.name} className="bg-muted/30 hover:bg-muted/30">
              <TableCell className="pl-8 text-xs text-muted-foreground">{insuranceLabel(part.name, part.rate)}</TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {formatCurrency(part.amount)}
              </TableCell>
            </TableRow>
          ))}
        <TableRow>
          <TableCell>
            <span className="font-medium text-foreground">Giảm trừ bản thân</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Mức giảm trừ gia cảnh cho người nộp thuế
            </span>
          </TableCell>
          <TableCell className="text-right font-mono text-destructive">{formatDeduction(payslip.personalDeduction)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <span className="font-medium text-foreground">Giảm trừ người phụ thuộc</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {dependents > 0 ? `${dependents} người phụ thuộc đã đăng ký` : 'Chưa đăng ký người phụ thuộc'}
            </span>
          </TableCell>
          <TableCell className="text-right font-mono text-destructive">{formatDeduction(payslip.dependentDeduction)}</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold text-foreground">Thu nhập tính thuế</TableCell>
          <TableCell className="text-right font-mono font-semibold text-foreground">
            {formatCurrency(payslip.taxableEarnings || 0)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );

  return (
    <PayslipSection index={2} title="Các khoản giảm trừ thuế" subtitle="Bảo hiểm trích lương và giảm trừ gia cảnh." variant={variant}>
      {body}
    </PayslipSection>
  );
}

/** §3 — Thuế TNCN lũy tiến tính trên Thu nhập tính thuế. */
export function PitTaxDetails({
  payslip,
  variant,
}: {
  payslip: PayslipRow;
  /** 'sheet' — khối phẳng trong tờ phiếu của nhân viên; mặc định là card rời. */
  variant?: 'card' | 'sheet';
}) {
  const brackets = payslip.pitBreakdown ?? [];

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
    <PayslipSection index={3} title="Thuế TNCN (PIT)" variant={variant}>
      {body}
    </PayslipSection>
  );
}

export function PayslipPreviewDialog({ open, onClose, payslip, periodLabel }: Props) {
  if (!payslip) return null;

  const totalInsurance =
    (payslip.socialInsurance || 0) + (payslip.healthInsurance || 0) + (payslip.unemploymentInsurance || 0);
  const effectivePIT = payslip.pitAmount || 0;
  const otherDeductions = payslip.otherDeductions || 0;
  // Tổng khấu trừ = tiền thực sự bị trừ khỏi Gross. Khớp công thức Net của backend:
  // netSalary = gross − insurance − PIT − otherDeductions.
  const totalDeductions = totalInsurance + effectivePIT + otherDeductions;
  const netSalary = payslip.netSalary || 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bảng chi tiết lương - {periodLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-1">
          {/* Employee Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nhân viên</p>
                    <p className="mt-0.5 text-sm font-semibold">{payslip.employeeName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mã NV</p>
                    <p className="mt-0.5 font-mono text-sm">{payslip.employeeCode || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mã số thuế</p>
                    <p className="mt-0.5 font-mono text-sm">{payslip.taxCode || '—'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-sm text-muted-foreground">Trạng thái</span>
                <Badge variant={getStatusBadgeVariant(payslip.status)}>
                  {STATUS_LABELS[payslip.status] || payslip.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* 1. GROSS + thu nhập chịu thuế */}
          <GrossEarningsCard payslip={payslip} />

          {/* 2. TAX DEDUCTIONS */}
          <TaxDeductionsCard payslip={payslip} />

          {/* 3. PIT + tổng khấu trừ */}
          <PitTaxDetails payslip={payslip} />

          <PayslipSection title="Tổng kết &amp; đối soát thực nhận">
            <div className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bảo hiểm</span>
                  <span className="font-mono text-destructive">-{formatCurrency(totalInsurance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Thuế TNCN</span>
                  <span className="font-mono text-destructive">-{formatCurrency(effectivePIT)}</span>
                </div>
                {otherDeductions > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Khấu trừ khác</span>
                    <span className="font-mono text-destructive">-{formatCurrency(otherDeductions)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-foreground">
                  <span>Tổng khấu trừ</span>
                  <span className="font-mono text-lg text-destructive">-{formatCurrency(totalDeductions)}</span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
                    <span className="font-semibold text-foreground">Lương thực nhận (Net)</span>
                  </div>
                  <span className="font-mono text-2xl font-bold text-primary">{formatCurrency(netSalary)}</span>
                </div>
                <p className="mt-2 border-t border-primary/20 pt-2 text-xs text-muted-foreground">
                  {formatCurrency(payslip.grossEarnings || 0)} − {formatCurrency(totalDeductions)} = {formatCurrency(netSalary)}
                </p>
              </div>
            </div>
          </PayslipSection>

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground">
            {payslip.generatedAt && <p>Tạo: {formatDate(payslip.generatedAt)}</p>}
            {payslip.releasedAt && <p>Phát hành: {formatDate(payslip.releasedAt)}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
