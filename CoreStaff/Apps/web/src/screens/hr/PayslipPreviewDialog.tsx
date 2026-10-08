import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/dialog";
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Separator } from '@/components/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs';
import { Tooltip } from '@/components/tooltip';
import { ChevronDown, ChevronRight, Calendar, User, Building2, Wallet } from 'lucide-react';

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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const STATUS_LABELS: Record<string, string> = {
  GENERATED: 'Đã Tạo',
  RELEASED: 'Đã Phát Hành',
  VIEWED: 'Đã Xem',
};

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link' | 'success';

function getStatusBadgeVariant(status: string): BadgeVariant {
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

export function GrossEarningsCard({ payslip }: { payslip: PayslipRow }) {
  const [showBaseDetail, setShowBaseDetail] = useState(false);
  const [showOtDetail, setShowOtDetail] = useState(false);
  const totalEarnings = payslip.grossEarnings || 0;
  const allowances = payslip.allowanceBreakdown ?? [];
  const summaryRows = (payslip.earningBreakdown ?? []).filter((item) => item.type !== 'ALLOWANCE');

  // Chi tiết lương công: lương tháng ÷ ngày công chuẩn = tiền công 1 ngày, × ngày công thực tế.
  const monthlyBaseSalary = payslip.monthlyBaseSalary || 0;
  const standardWorkingDays = payslip.standardWorkingDays || 0;
  const payableWorkingDays = payslip.payableWorkingDays || 0;
  const dailyRate = standardWorkingDays > 0 ? monthlyBaseSalary / standardWorkingDays : 0;
  const hasBaseDetail = monthlyBaseSalary > 0 && standardWorkingDays > 0;

  // Chi tiết OT: giờ × (tiền công 1 giờ × hệ số) = thành tiền.
  const otBreakdown = payslip.otBreakdown;
  const otLines = (otBreakdown?.breakdown ?? []).filter((line) => line.amount > 0);

  const detailToggle = (open: boolean, onToggle: () => void): ReactNode => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs"
      onClick={onToggle}
    >
      {open ? (
        <ChevronDown className="mr-1 h-3 w-3" aria-hidden="true" />
      ) : (
        <ChevronRight className="mr-1 h-3 w-3" aria-hidden="true" />
      )}
      Chi tiết
    </Button>
  );

  return (
    <Card>
      <CardHeader><CardTitle>Tổng thu nhập (Gross)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {summaryRows.map((item, idx) => {
            const isBase = item.type === 'BASE_SALARY';
            const isOt = item.type === 'OVERTIME';
            const detail = isBase ? hasBaseDetail : isOt ? otLines.length > 0 : false;
            const open = isBase ? showBaseDetail : showOtDetail;
            return (
              <div key={`${item.type}-${idx}`}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    {item.label}
                    {detail && detailToggle(open, () => (isBase ? setShowBaseDetail(!showBaseDetail) : setShowOtDetail(!showOtDetail)))}
                  </span>
                  <span className="font-mono">{formatCurrency(item.amount)}</span>
                </div>
                {isBase && showBaseDetail && (
                  <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lương cơ bản tháng</span>
                      <span className="font-mono">{formatCurrency(monthlyBaseSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ngày công chuẩn</span>
                      <span className="font-mono">{standardWorkingDays} ngày</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ngày công thực tế</span>
                      <span className="font-mono">{payableWorkingDays} ngày</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">Tiền công 1 ngày</span>
                      <span className="font-mono">{formatCurrency(dailyRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {formatCurrency(dailyRate)} × {payableWorkingDays} ngày
                      </span>
                      <span className="font-mono font-semibold">{formatCurrency(item.amount)}</span>
                    </div>
                  </div>
                )}
                {isOt && showOtDetail && (
                  <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-xs">
                    {otLines.map((line, lineIdx) => (
                      <div key={`${line.type}-${lineIdx}`} className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          {line.label} — {line.minutes / 60} giờ × ({formatCurrency(otBreakdown?.hourlyRate || 0)} × {line.coefficient})
                        </span>
                        <span className="font-mono font-semibold">{formatCurrency(line.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {allowances.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>Chi tiết phụ cấp</span><span className="font-mono">{formatCurrency(allowances.reduce((sum, item) => sum + item.amount, 0))}</span>
            </div>
            <div className="space-y-2 border-t border-border pt-2">
              {allowances.map((item, idx) => (
                <div key={`${item.type}-${idx}`} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold text-foreground"><span>Tổng Gross</span><span className="font-mono text-lg">{formatCurrency(totalEarnings)}</span></div>
      </CardContent>
    </Card>
  );
}

/** §2 — Thu nhập chịu thuế TRƯỚC giảm trừ (chưa trừ bảo hiểm và giảm trừ gia cảnh). */
export function TaxableIncomeCard({ payslip }: { payslip: PayslipRow }) {
  const earningRows = (payslip.earningBreakdown ?? []).filter(
    (item) => item.type !== 'ALLOWANCE' && item.type !== 'OVERTIME' && item.amount > 0,
  );
  const aggregateAllowance = (payslip.earningBreakdown ?? []).find((item) => item.type === 'ALLOWANCE');
  const totalAllowances =
    (payslip.allowanceBreakdown ?? []).reduce((sum, item) => sum + item.amount, 0) ||
    aggregateAllowance?.amount ||
    0;
  const overtimeTaxable = payslip.otBreakdown?.overtimeTaxable === true;
  // Cờ bật → cả tiền OT chịu thuế; tắt → miễn hết. Không chia tiền OT.
  const taxableOt = overtimeTaxable ? (payslip.otBreakdown?.otPay ?? 0) : 0;
  // `taxableIncome` là số backend đã tính; công thức dưới chỉ là fallback cho
  // payslip sinh trước khi field này tồn tại.
  const taxableIncome =
    payslip.taxableIncome ??
    earningRows.reduce((sum, item) => sum + item.amount, 0) + totalAllowances + taxableOt;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thu nhập chịu thuế trước giảm trừ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {earningRows.map((item, idx) => (
          <div key={`${item.type}-${idx}`} className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-mono">{formatCurrency(item.amount)}</span>
          </div>
        ))}
        {totalAllowances > 0 && (
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Tổng phụ cấp</span>
            <span className="font-mono">{formatCurrency(totalAllowances)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            Tiền làm thêm giờ chịu thuế
            <Tooltip
              content={
                overtimeTaxable
                  ? 'Chính sách thuế TNCN của công ty: toàn bộ tiền tăng ca chịu thuế.'
                  : 'Chính sách thuế TNCN của công ty: tiền tăng ca được miễn thuế, không vào thu nhập tính thuế.'
              }
            >
              <span className="cursor-help font-semibold text-primary" aria-label="Chính sách thuế TNCN cho tiền tăng ca">*</span>
            </Tooltip>
          </span>
          <span className="font-mono">{formatCurrency(taxableOt)}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-semibold text-foreground">
          <span>Tổng thu nhập chịu thuế</span>
          <span className="font-mono">{formatCurrency(taxableIncome)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/** §3 — Các khoản giảm trừ khỏi thu nhập chịu thuế, ra Thu nhập tính thuế. */
export function TaxDeductionsCard({ payslip }: { payslip: PayslipRow }) {
  const [showInsuranceDetail, setShowInsuranceDetail] = useState(false);
  const totalInsurance =
    (payslip.socialInsurance || 0) +
    (payslip.healthInsurance || 0) +
    (payslip.unemploymentInsurance || 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Các khoản giảm trừ thuế</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Bảo hiểm (BHXH + BHYT + BHTN)</span>
              {totalInsurance > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowInsuranceDetail(!showInsuranceDetail)}
                >
                  {showInsuranceDetail ? (
                    <ChevronDown className="mr-1 h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="mr-1 h-3 w-3" aria-hidden="true" />
                  )}
                  Chi tiết
                </Button>
              )}
            </div>
            <span className="font-mono text-sm text-destructive">-{formatCurrency(totalInsurance)}</span>
          </div>
          {showInsuranceDetail && totalInsurance > 0 && (
            <div className="mt-3 space-y-2 border-t pt-3">
              {payslip.contributionBase && payslip.contributionBase > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Lương đóng BHXH</span>
                  <span className="font-mono">{formatCurrency(payslip.contributionBase)}</span>
                </div>
              )}
              {(payslip.socialInsurance || 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">BHXH ({(payslip.socialInsuranceRate || 0) * 100}%)</span>
                  <span className="font-mono">-{formatCurrency(payslip.socialInsurance || 0)}</span>
                </div>
              )}
              {(payslip.healthInsurance || 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">BHYT ({(payslip.healthInsuranceRate || 0) * 100}%)</span>
                  <span className="font-mono">-{formatCurrency(payslip.healthInsurance || 0)}</span>
                </div>
              )}
              {(payslip.unemploymentInsurance || 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">BHTN ({(payslip.unemploymentInsuranceRate || 0) * 100}%)</span>
                  <span className="font-mono">-{formatCurrency(payslip.unemploymentInsurance || 0)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Giảm trừ bản thân</span>
          <span className="font-mono text-destructive">-{formatCurrency(payslip.personalDeduction || 0)}</span>
        </div>
        {(payslip.dependentDeduction || 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Giảm trừ người phụ thuộc ({payslip.dependents?.length || 0} người)
            </span>
            <span className="font-mono text-destructive">-{formatCurrency(payslip.dependentDeduction || 0)}</span>
          </div>
        )}

        <Separator />
        <div className="flex justify-between font-semibold text-foreground">
          <span>Thu nhập tính thuế</span>
          <span className="font-mono">{formatCurrency(payslip.taxableEarnings || 0)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/** §4 — Thuế TNCN lũy tiến tính trên Thu nhập tính thuế. */
export function PitTaxDetails({ payslip }: { payslip: PayslipRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thuế TNCN (PIT)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {payslip.pitBreakdown && payslip.pitBreakdown.length > 0 ? (
          payslip.pitBreakdown.map((bracket, idx) => (
            <div key={idx} className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Bậc {bracket.bracket}: {formatCurrency(bracket.income)} × {bracket.rate}%
              </span>
              <span className="font-mono">{formatCurrency(bracket.tax)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Không phát sinh thuế TNCN.</p>
        )}
        <Separator />
        <div className="flex justify-between font-semibold text-foreground">
          <span>Thuế TNCN phải nộp</span>
          <span className="font-mono text-destructive">-{formatCurrency(payslip.pitAmount || 0)}</span>
        </div>
      </CardContent>
    </Card>
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

          {/* 1. GROSS */}
          <GrossEarningsCard payslip={payslip} />

          {/* 2. TAXABLE INCOME */}
          <TaxableIncomeCard payslip={payslip} />

          {/* 3. TAX DEDUCTIONS */}
          <TaxDeductionsCard payslip={payslip} />

          {/* 4. PIT + tổng khấu trừ */}
          <PitTaxDetails payslip={payslip} />

          <Card>
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>

          {/* Net Salary */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
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
