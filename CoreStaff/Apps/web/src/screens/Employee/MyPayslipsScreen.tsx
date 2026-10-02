import { useState, useEffect } from 'react';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Badge } from '@/components/badge';
import { Alert, AlertDescription } from '@/components/alert';
import { Skeleton } from '@/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table';
import { employeeRequest } from '@/services/employeeService';
import { PayslipPreviewDialog, type PayslipRow } from '@/screens/hr/PayslipPreviewDialog';
import { FileText, RefreshCw, Eye } from 'lucide-react';

/** Format currency to VND */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

type Payslip = PayslipRow & {
  periodLabel: string;
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

  useEffect(() => {
    if (!hasLoaded) {
      loadMyPayslips();
    }
  }, []);

  const totalNet = payslips.reduce((sum, s) => sum + s.netSalary, 0);
  const selectedPayslip = payslips.find((slip) => slip._id === expandedSlipId) ?? null;

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
                            variant="ghost"
                            className="min-h-10 text-primary"
                            onClick={() => {
                              setExpandedSlipId(slip._id);
                              if (slip.status === 'RELEASED') {
                                handleViewed(slip._id, true);
                              }
                            }}
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Xem chi tiết
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Reuse the HR payslip preview so both roles always share the same layout. */}
          <PayslipPreviewDialog
            open={expandedSlipId !== null}
            onClose={() => setExpandedSlipId(null)}
            payslip={selectedPayslip}
            periodLabel={selectedPayslip?.periodLabel ?? ''}
          />
        </>
      )}
    </div>
  );
}
