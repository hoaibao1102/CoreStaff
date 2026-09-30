import { useState, useEffect } from 'react';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Badge } from '@/components/badge';
import { Alert, AlertDescription } from '@/components/alert';
import { Skeleton } from '@/components/skeleton';
import { Separator } from '@/components/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table';
import { employeeRequest } from '@/services/employeeService';
import { FileText, RefreshCw, Wallet, Eye, EyeOff } from 'lucide-react';

/** Format currency to VND */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

/** Format minutes to hours:minutes */
const formatMinutes = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}p`;
};

type Payslip = {
  _id: string;
  periodLabel: string;
  grossEarnings: number;
  netSalary: number;
  pitAmount: number;
  taxableEarnings?: number;
  status: string;
  personalDeduction?: number;
  dependentDeduction?: number;
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
    hourlyRate: number;
    otNonTaxable: number;
    otTaxable: number;
    otPay: number;
    breakdown: Array<{
      type: string;
      label: string;
      minutes: number;
      coefficient: number;
      amount: number;
      nonTaxable: number;
      taxable: number;
    }>;
  };
  deductionBreakdown?: Array<{ type: string; label: string; amount: number }>;
  pitBreakdown?: Array<{ bracket: number; income: number; rate: number; tax: number }>;
  dependents?: Array<{ fullName: string; relationship: string; birthDate?: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  GENERATED: 'Đã Tạo',
  RELEASED: 'Đã Phát Hành',
  VIEWED: 'Đã Xem',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx}>
            <CardContent className="space-y-2 pt-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold">Chưa có bảng lương nào</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Khi bảng lương được phát hành, bạn sẽ thấy danh sách tại đây.
        </p>
      </CardContent>
    </Card>
  );
}

export function MyPayslipsScreen() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [expandedSlipId, setExpandedSlipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMyPayslips = async () => {
    if (hasLoaded && !loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await employeeRequest.get<Payslip[]>('/payslips/me');
      setPayslips(res || []);
      setHasLoaded(true);
    } catch (err: any) {
      console.error('Failed to load payslips:', err);
      setError(err?.message || 'Không thể tải bảng lương. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await employeeRequest.get<Payslip[]>('/payslips/me');
      setPayslips(res || []);
    } catch (err: any) {
      console.error('Failed to refresh payslips:', err);
      setError(err?.message || 'Không thể tải bảng lương. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewed = async (slipId: string, keepOpen?: boolean) => {
    try {
      await employeeRequest.post<void>(`/payslips/me/${slipId}/viewed`);
      if (!keepOpen) {
        setExpandedSlipId(null);
      }
      const res = await employeeRequest.get<Payslip[]>('/payslips/me');
      setPayslips(res || []);
    } catch (error) {
      console.error('Failed to mark as viewed:', error);
    }
  };

  const toggleDetail = (slipId: string) => {
    setExpandedSlipId(expandedSlipId === slipId ? null : slipId);
  };

  useEffect(() => {
    if (!hasLoaded) {
      loadMyPayslips();
    }
  }, []);

  const totalNet = payslips.reduce((sum, s) => sum + s.netSalary, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Bảng Lương Của Tôi
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Xem chi tiết các kỳ lương và khấu trừ của bạn.
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Làm Mới
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tổng Kỳ Lương</p>
            <p className="mt-1 text-2xl font-bold">{payslips.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Đã Xem</p>
            <p className="mt-1 text-2xl font-bold">
              {payslips.filter((s) => s.status === 'VIEWED').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Chưa Xem</p>
            <p className="mt-1 text-2xl font-bold">
              {payslips.filter((s) => s.status === 'RELEASED').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tổng Net Nhận</p>
            <p className="mt-1 text-lg font-bold text-foreground">{formatCurrency(totalNet)}</p>
          </CardContent>
        </Card>
      </div>

      {loading && !hasLoaded ? (
        <LoadingSkeleton />
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : payslips.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Payslips Table */}
          <Card>
            <CardHeader>
              <CardTitle>Danh Sách Bảng Lương</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kỳ</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Bảo Hiểm</TableHead>
                    <TableHead className="text-right">PIT</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-center">Trạng Thái</TableHead>
                    <TableHead className="text-center">Thao Tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((slip) => {
                    const slipInsurance =
                      (slip.socialInsurance || 0) +
                      (slip.healthInsurance || 0) +
                      (slip.unemploymentInsurance || 0);
                    return (
                      <TableRow key={slip._id}>
                        <TableCell className="font-medium">{slip.periodLabel}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(slip.grossEarnings)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          -{formatCurrency(slipInsurance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          -{formatCurrency(slip.pitAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-foreground">
                          {formatCurrency(slip.netSalary)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              slip.status === 'VIEWED'
                                ? 'secondary'
                                : slip.status === 'RELEASED'
                                ? 'default'
                                : 'outline'
                            }
                          >
                            {STATUS_LABELS[slip.status] || slip.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant={expandedSlipId === slip._id ? 'default' : 'outline'}
                            onClick={() => {
                              toggleDetail(slip._id);
                              if (slip.status === 'RELEASED') {
                                handleViewed(slip._id, true);
                              }
                            }}
                          >
                            {expandedSlipId === slip._id ? (
                              <>
                                <EyeOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                Đóng
                              </>
                            ) : (
                              <>
                                <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                Chi tiết
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Expandable Detail Section */}
          {expandedSlipId && <PayslipDetailCard payslip={payslips.find((s) => s._id === expandedSlipId)} onClose={() => setExpandedSlipId(null)} />}
        </>
      )}
    </div>
  );
}

function PayslipDetailCard({
  payslip,
  onClose,
}: {
  payslip: Payslip | undefined;
  onClose: () => void;
}) {
  if (!payslip) return null;

  const totalInsurance =
    (payslip.socialInsurance || 0) +
    (payslip.healthInsurance || 0) +
    (payslip.unemploymentInsurance || 0);
  const totalNonTaxable =
    (payslip.otBreakdown?.otNonTaxable || 0) +
    (payslip.allowanceBreakdown?.filter((a) => !a.taxable).reduce((sum, a) => sum + a.amount, 0) || 0);
  const taxableGross = payslip.grossEarnings - totalNonTaxable;

  return (
    <Card className="border-primary/20">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Chi Tiết Bảng Lương - {payslip.periodLabel}</CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Earnings */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">Thu Nhập</h3>
          <div className="rounded-xl border border-border p-4">
            <div className="space-y-2">
              {payslip.earningBreakdown
                ?.filter((e) => e.type === 'BASE_SALARY' || e.type === 'ATTENDANCE_BONUS')
                .map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.label}</span>
                    <span className="font-mono">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              {payslip.allowanceBreakdown && payslip.allowanceBreakdown.length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phụ Cấp</p>
                  {payslip.allowanceBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{item.label}</span>
                        {!item.taxable ? (
                          <Badge variant="outline" className="h-5 text-xs">Miễn thuế</Badge>
                        ) : (
                          <Badge variant="secondary" className="h-5 text-xs">Chịu thuế</Badge>
                        )}
                      </div>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </>
              )}
              {payslip.otBreakdown && payslip.otBreakdown.totalMinutes > 0 && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Làm Thêm Giờ</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">Tổng giờ OT</span>
                    <span className="font-mono">{formatMinutes(payslip.otBreakdown.totalMinutes)}</span>
                  </div>
                  {payslip.otBreakdown.breakdown.map((ot, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-foreground">{ot.label}</span>
                      <span className="font-mono">{formatCurrency(ot.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-foreground">Tổng OT</span>
                    <span className="font-mono">{formatCurrency(payslip.otBreakdown.otPay)}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-foreground">
                <span>Tổng thu nhập (Gross)</span>
                <span className="font-mono text-base">{formatCurrency(payslip.grossEarnings)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Insurance & Deductions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">Khấu Trừ Bảo Hiểm & Giảm Trừ</h3>
          <div className="rounded-xl border border-border p-4">
            <div className="space-y-2">
              {payslip.contributionBase && payslip.contributionBase > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">Lương đóng BHXH</span>
                  <span className="font-mono">{formatCurrency(payslip.contributionBase)}</span>
                </div>
              )}
              {payslip.socialInsurance && payslip.socialInsurance > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">BHXH ({(payslip.socialInsuranceRate || 0) * 100}%)</span>
                  <span className="font-mono text-destructive">-{formatCurrency(payslip.socialInsurance)}</span>
                </div>
              )}
              {payslip.healthInsurance && payslip.healthInsurance > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">BHYT ({(payslip.healthInsuranceRate || 0) * 100}%)</span>
                  <span className="font-mono text-destructive">-{formatCurrency(payslip.healthInsurance)}</span>
                </div>
              )}
              {payslip.unemploymentInsurance && payslip.unemploymentInsurance > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">BHTN ({(payslip.unemploymentInsuranceRate || 0) * 100}%)</span>
                  <span className="font-mono text-destructive">-{formatCurrency(payslip.unemploymentInsurance)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm font-semibold text-foreground">
                <span>Tổng bảo hiểm</span>
                <span className="font-mono text-destructive">-{formatCurrency(totalInsurance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Giảm trừ bản thân</span>
                <span className="font-mono text-destructive">-{formatCurrency(payslip.personalDeduction || 15_500_000)}</span>
              </div>
              {payslip.dependents && payslip.dependents.length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Người Phụ Thuộc ({payslip.dependents.length} người)
                  </p>
                  {payslip.dependents.map((dep, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-foreground">
                        {dep.fullName} ({dep.relationship === 'CON' ? 'Con' : dep.relationship === 'BO_ME' ? 'Bố/Mẹ' : 'Khác'})
                      </span>
                      <span className="font-mono text-destructive">-{formatCurrency(6_200_000)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold text-foreground">
                    <span>Tổng giảm trừ NPT</span>
                    <span className="font-mono text-destructive">-{formatCurrency(payslip.dependentDeduction || 0)}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-foreground">
                <span>Tổng khấu trừ</span>
                <span className="font-mono text-destructive text-base">
                  -{formatCurrency(totalInsurance + (payslip.personalDeduction || 15_500_000) + (payslip.dependentDeduction || 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PIT */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">Thuế TNCN</h3>
          <div className="rounded-xl border border-border p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Tổng thu nhập (Gross)</span>
                <span className="font-mono font-medium">{formatCurrency(payslip.grossEarnings)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Các khoản không chịu thuế</span>
                <span className="font-mono text-destructive">-{formatCurrency(totalNonTaxable)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-foreground">
                <span>Taxable Gross</span>
                <span className="font-mono">{formatCurrency(taxableGross)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Bảo hiểm xã hội</span>
                <span className="font-mono text-destructive">-{formatCurrency(totalInsurance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Giảm trừ bản thân</span>
                <span className="font-mono text-destructive">-{formatCurrency(payslip.personalDeduction || 15_500_000)}</span>
              </div>
              {payslip.dependentDeduction && payslip.dependentDeduction > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">Giảm trừ người phụ thuộc</span>
                  <span className="font-mono text-destructive">-{formatCurrency(payslip.dependentDeduction)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-foreground">
                <span>Thu nhập chịu thuế</span>
                <span className="font-mono">{formatCurrency(payslip.taxableEarnings || 0)}</span>
              </div>
              {payslip.pitBreakdown && payslip.pitBreakdown.length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Biểu Thuế Lũy Tiến</p>
                  {payslip.pitBreakdown.map((bracket, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-foreground">Bậc {bracket.bracket} ({bracket.rate}%)</span>
                      <span className="font-mono">{formatCurrency(bracket.tax)}</span>
                    </div>
                  ))}
                </>
              )}
              <div className="flex justify-between font-semibold text-foreground">
                <span>PIT phải nộp</span>
                <span className="font-mono text-destructive text-base">-{formatCurrency(payslip.pitAmount)}</span>
              </div>
              {(!payslip.pitBreakdown || payslip.pitBreakdown.length === 0) && payslip.pitAmount === 0 && (
                <p className="text-sm text-muted-foreground">Không phải nộp thuế TNCN.</p>
              )}
            </div>
          </div>
        </div>

        {/* Net Salary Summary */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="font-semibold text-foreground">Lương net thực nhận</span>
            </div>
            <span className="font-mono text-2xl font-bold text-primary">
              {formatCurrency(payslip.netSalary)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
