import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { AppLink } from '@/components/AppLink';
import { Card, CardContent } from '@/components/card';
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
import { employeeRequest } from '@/services/employeeService';
import {
  GrossEarningsCard,
  PitTaxDetails,
  PayslipSection,
  STATUS_LABELS,
  SectionNumber,
  TaxDeductionsCard,
  formatCurrency,
  formatDate,
  getStatusBadgeVariant,
  type PayslipRow,
} from '@/screens/hr/PayslipPreviewDialog';
import { ArrowLeft, ChevronRight, Wallet } from 'lucide-react';

type Payslip = PayslipRow & { periodLabel: string };

/** Sơ đồ 5 khối: Gross − Bảo hiểm − Thuế TNCN − Khác = Net (mọi số lấy từ phiếu lương). */
function FormulaChain({ steps }: { steps: Array<{ key: string; label: string; value: string; hint: string; highlight?: boolean }> }) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex flex-1 items-center gap-2">
          <div
            className={
              step.highlight
                ? 'flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40'
                : 'flex-1 rounded-xl border border-border bg-card px-3 py-2.5'
            }
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{step.label}</p>
            <p className={`mt-1 font-mono text-sm font-bold ${step.highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
              {step.value}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{step.hint}</p>
          </div>
          {idx < steps.length - 1 && (
            <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground lg:block" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export function PayslipDetailScreen({ apiBase, payslipId }: { apiBase?: string; payslipId: string }) {
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const slip = await employeeRequest.get<Payslip>(`/payslips/me/${payslipId}`);
        if (cancelled) return;
        setPayslip(slip);
        // Xem là hành vi ghi nhận, không chặn hiển thị: lỗi audit không được che phiếu lương.
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
  }, [payslipId, apiBase]);

  const backButton = (
    <Button variant="ghost" className="min-h-10 -ml-2" render={<AppLink href="/app/payslips" />}>
      <ArrowLeft aria-hidden="true" />
      Danh sách phiếu lương
    </Button>
  );

  if (loading) return <div className="space-y-6">{backButton}<LoadingSkeleton /></div>;

  if (error || !payslip) {
    return (
      <div className="space-y-6">
        {backButton}
        <Alert variant="destructive">
          <AlertDescription>{error || 'Không tìm thấy phiếu lương.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalInsurance =
    (payslip.socialInsurance || 0) + (payslip.healthInsurance || 0) + (payslip.unemploymentInsurance || 0);
  const otherDeductions = payslip.otherDeductions || 0;
  const totalDeductions = totalInsurance + (payslip.pitAmount || 0) + otherDeductions;
  const netSalary = payslip.netSalary || 0;
  const gross = payslip.grossEarnings || 0;
  // Đối soát: dựng lại Net từ chính các khoản đã in ra; lệch quá 1₫ thì không khoe "khớp".
  const reconciled = Math.abs(gross - totalDeductions - netSalary) <= 1;
  const initials = payslip.employeeName.split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('');

  return (
    <div className="space-y-6">
      {backButton}

      {/* Danh tính nhân viên + kỳ lương */}
      <Card className="gap-0 py-0">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-base font-bold text-foreground" aria-hidden="true">
              {initials}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{payslip.employeeName}</h1>
                {payslip.employeeCode && <Badge variant="outline" className="font-mono">{payslip.employeeCode}</Badge>}
                <Badge variant={getStatusBadgeVariant(payslip.status)}>
                  {STATUS_LABELS[payslip.status] || payslip.status}
                </Badge>
              </div>
              <dl className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <dt>Kỳ lương</dt>
                  <dd className="font-semibold text-foreground">{payslip.periodLabel}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt>Mã số thuế</dt>
                  <dd className="font-mono text-foreground">{payslip.taxCode || '—'}</dd>
                </div>
                {payslip.generatedAt && (
                  <div className="flex items-center gap-2">
                    <dt>Khởi tạo</dt>
                    <dd className="text-foreground">{formatDate(payslip.generatedAt)}</dd>
                  </div>
                )}
                {payslip.releasedAt && (
                  <div className="flex items-center gap-2">
                    <dt>Phát hành</dt>
                    <dd className="text-foreground">{formatDate(payslip.releasedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
          <Badge variant="secondary" className="self-start">
            <Wallet aria-hidden="true" />
            Thực nhận {formatCurrency(netSalary)}
          </Badge>
        </CardContent>
      </Card>

      <FormulaChain
        steps={[
          { key: 'gross', label: 'Tổng Gross', value: formatCurrency(gross), hint: 'Thu nhập trước khấu trừ' },
          { key: 'insurance', label: 'Bảo hiểm', value: `− ${formatCurrency(totalInsurance)}`, hint: 'BHXH + BHYT + BHTN (NLD)' },
          { key: 'pit', label: 'Thuế TNCN', value: `− ${formatCurrency(payslip.pitAmount || 0)}`, hint: 'Biểu thuế lũy tiến' },
          { key: 'other', label: 'Khấu trừ khác', value: `− ${formatCurrency(otherDeductions)}`, hint: 'Tạm ứng, khấu trừ khác' },
          { key: 'net', label: 'Thực nhận (Net)', value: formatCurrency(netSalary), hint: 'Số tiền về tài khoản', highlight: true },
        ]}
      />

      {/* §1 → §4: cùng khung xám - bảng trắng với dialog HR, xếp 2 card một hàng */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrossEarningsCard payslip={payslip} />

        <TaxDeductionsCard payslip={payslip} />

        <PitTaxDetails payslip={payslip} />

        {/* §4: đối soát từ gross về net */}
        <PayslipSection
          title={'Tổng kết & đối soát thực nhận'}
          subtitle="Cân đối lại số thực nhận từ chính các khoản đã in ở trên."
          action={reconciled ? <Badge variant="success">Khớp</Badge> : <Badge variant="outline">Lệch số</Badge>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hạng mục đối soát</TableHead>
                <TableHead className="text-right">Giá trị phát sinh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">Tổng thu nhập (Gross)</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(gross)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Trích nộp bảo hiểm (người lao động)</TableCell>
                <TableCell className="text-right font-mono text-destructive">−{formatCurrency(totalInsurance)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Thuế TNCN phải nộp</TableCell>
                <TableCell className="text-right font-mono text-destructive">−{formatCurrency(payslip.pitAmount || 0)}</TableCell>
              </TableRow>
              {otherDeductions > 0 && (
                <TableRow>
                  <TableCell className="text-muted-foreground">Khấu trừ khác</TableCell>
                  <TableCell className="text-right font-mono text-destructive">−{formatCurrency(otherDeductions)}</TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold text-foreground">Tổng khấu trừ</TableCell>
                <TableCell className="text-right font-mono font-semibold text-destructive">−{formatCurrency(totalDeductions)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <div className="border-t border-border bg-emerald-50 p-4 dark:bg-emerald-950/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <SectionNumber value="=" />
                Số tiền thực nhận (Net)
              </span>
              <span className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(netSalary)}
              </span>
            </div>
            <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-300/80">
              {formatCurrency(gross)} − {formatCurrency(totalDeductions)} = {formatCurrency(netSalary)}
              {reconciled ? ' · khớp với số thực nhận đã phát hành' : ' · lệch với số thực nhận đã phát hành'}
            </p>
          </div>
        </PayslipSection>
      </div>
    </div>
  );
}
