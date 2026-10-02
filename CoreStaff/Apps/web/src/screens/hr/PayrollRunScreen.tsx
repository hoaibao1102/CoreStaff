import { useState, useEffect } from 'react';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Badge } from '@/components/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table';
import { toast } from '@/components/toast';
import { PayslipPreviewDialog } from './PayslipPreviewDialog';
import { hrErrorMessage, hrRequest } from '@/services/hrService';
import { Calculator, Download, Eye, LockKeyhole, Plus, Send } from 'lucide-react';

/** Format currency to VND */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

/** Status badge colors for payroll/payslip statuses */
const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  CALCULATED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  LOCKED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  RELEASED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  GENERATED: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  VIEWED: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  CALCULATED: 'Đã Tính',
  LOCKED: 'Đã Khóa',
  RELEASED: 'Đã Phát Hành',
  GENERATED: 'Đã Tạo',
  VIEWED: 'Đã Xem',
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700';
  const label = STATUS_LABELS[status] || status;
  return <Badge variant="secondary" className={style}>{label}</Badge>;
}

/** Typed API helpers */
async function payrollGet<T>(base: string, path: string): Promise<T> {
  return hrRequest<T>(base, path);
}

async function payrollPost<T>(base: string, path: string, body?: unknown): Promise<T> {
  return hrRequest<T>(base, path, { method: 'POST', body: JSON.stringify(body) });
}

async function payrollPut<T>(base: string, path: string, body?: unknown): Promise<T> {
  return hrRequest<T>(base, path, { method: 'PUT', body: JSON.stringify(body) });
}

type PayrollRun = {
  _id: string;
  organizationId: string;
  timesheetPeriodId: string;
  periodLabel: string;
  status: string;
  runDate: string;
  totalGross: number;
  totalNet: number;
  processedEmployeeCount: number;
  totalEmployeeCount: number;
};

type TimesheetPeriod = {
  _id: string;
  period: string;
  status: string;
  startDate: string;
  endDate: string;
  managerSnapshotClosed?: boolean;
  departmentSnapshots?: Array<{ departmentId: string; managerUserId: string; closedAt: string }>;
};

type PayslipRow = {
  employeeName: string;
  grossEarnings: number;
  netSalary: number;
  pitAmount: number;
  status: string;
  _id: string;
};

export function PayrollRunScreen({ apiBase, organizationId, timesheetPeriodId }: {
  apiBase: string;
  organizationId: string;
  timesheetPeriodId?: string;
}) {
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [periods, setPeriods] = useState<TimesheetPeriod[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [previewSlip, setPreviewSlip] = useState<PayslipRow | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  useEffect(() => {
    loadPayrollRuns();
    loadClosedPeriods();
  }, []);

  const loadPayrollRuns = async () => {
    try {
      const res = await payrollGet<PayrollRun[]>(apiBase, '/api/payroll-runs');
      console.log('Payroll runs loaded:', res);
      setPayrollRuns(res || []);
    } catch (error) {
      console.error('Failed to load payroll runs:', error);
    }
  };

  const loadClosedPeriods = async () => {
    try {
      // ponytail: load all periods because HR can create a payroll run from any status
      // (the backend will auto-close OPEN/REVIEWING/READY_TO_CLOSE periods).
      const periods = await payrollGet<TimesheetPeriod[]>(apiBase, '/api/hr/timesheet-periods');
      console.log('Eligible periods loaded:', periods);
      setPeriods(periods || []);
    } catch (error) {
      console.error('Failed to load eligible periods:', error);
    }
  };

  const existingPeriodIds = new Set(payrollRuns.map(run => String(run.timesheetPeriodId)));
  const availablePeriods = periods.filter(
    period => period.status === 'CLOSED' && !existingPeriodIds.has(String(period._id)),
  );
  const closedPeriodsWithPayroll = periods.filter(
    period => period.status === 'CLOSED' && existingPeriodIds.has(String(period._id)),
  );

  const handleCreate = async () => {
    if (!selectedPeriodId) {
      toast.warning('Chưa chọn kỳ công', 'Vui lòng chọn một kỳ công đã chốt và chưa có bảng lương.');
      return;
    }
    setLoading(true);
    try {
      await payrollPost(apiBase, '/api/payroll-runs', {
        timesheetPeriodId: selectedPeriodId,
      });
      setCreateModalOpen(false);
      setSelectedPeriodId('');
      await loadPayrollRuns();
      toast.success('Tạo bảng lương thành công');
    } catch (error: any) {
      console.error('Failed to create payroll run:', error);
      const errorCode = error?.code || error?.message;
      if (String(errorCode).includes('PAYROLL_RUN_ALREADY_EXISTS')) {
        await loadPayrollRuns();
        setCreateModalOpen(false);
        setSelectedPeriodId('');
        toast.info('Bảng lương đã tồn tại', 'Hãy dùng nút Tính toán hoặc Xem chi tiết trên dòng bảng lương hiện có.');
      } else {
        toast.error('Không thể tạo bảng lương', hrErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async (runId: string) => {
    setLoading(true);
    try {
      await payrollPut(apiBase, `/api/payroll-runs/${runId}/calculate`);
      await loadPayrollRuns();
    } catch (error: any) {
      console.error('Failed to calculate payroll:', error);
      const msg = error?.response?.data?.message || error?.message || '';
      if (msg.includes('CANNOT_CALCULATE_NON_DRAFT')) {
        // Status đã đổi → reload và thông báo thân thiện
        await loadPayrollRuns();
        alert('Bảng lương đang được tính toán hoặc đã hoàn tất. Vui lòng tải lại trang.');
      } else {
        alert(msg || 'Tính lương thất bại!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async (run: PayrollRun) => {
    const confirmed = window.confirm(
      `Tính lại kỳ lương ${run.periodLabel}? Các phiếu lương chưa phát hành hiện tại sẽ được thay thế bằng kết quả mới.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await payrollPut(apiBase, `/api/payroll-runs/${run._id}/recalculate`);
      if (selectedRun?._id === run._id) {
        setSelectedRun(null);
        setPayslips([]);
        setSummary(null);
      }
      await loadPayrollRuns();
    } catch (error: any) {
      console.error('Failed to recalculate payroll:', error);
      const msg = error?.response?.data?.message || error?.message || '';
      if (msg.includes('CANNOT_RECALCULATE_NON_CALCULATED') || msg.includes('CANNOT_RECALCULATE_RELEASED_PAYSLIPS')) {
        await loadPayrollRuns();
        alert('Chỉ có thể tính lại kỳ lương đã tính nhưng chưa khóa hoặc phát hành.');
      } else {
        alert(msg || 'Tính lại bảng lương thất bại!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async (runId: string) => {
    setLoading(true);
    try {
      await payrollPut(apiBase, `/api/payroll-runs/${runId}/lock`);
      await loadPayrollRuns();
    } catch (error: any) {
      console.error('Failed to lock payroll:', error);
      const msg = error?.response?.data?.message || error?.message || '';
      if (msg.includes('CANNOT_LOCK_NON_CALCULATED')) {
        await loadPayrollRuns();
        alert('Bảng lương chưa hoàn tất tính toán. Vui lòng thử lại sau.');
      } else {
        alert(msg || 'Khóa bảng lương thất bại!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (runId: string) => {
    setLoading(true);
    try {
      await payrollPost(apiBase, `/api/payslips/release/${runId}`);
      await loadPayrollRuns();
    } catch (error: any) {
      console.error('Failed to release payroll:', error);
      const msg = error?.response?.data?.message || error?.message || '';
      if (msg.includes('CANNOT_RELEASE_NON_LOCKED')) {
        await loadPayrollRuns();
        alert('Bảng lương chưa được khóa. Vui lòng thử lại sau.');
      } else {
        alert(msg || 'Phát hành bảng lương thất bại!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewPayslips = async (runId: string) => {
    setLoading(true);
    try {
      const [slipsRes, summaryRes] = await Promise.all([
        payrollGet<PayslipRow[]>(apiBase, '/api/payslips/run/' + runId),
        payrollGet<any>(apiBase, '/api/payslips/run/' + runId + '/summary'),
      ]);
      setPayslips(slipsRes || []);
      setSummary(summaryRes || {});
      setSelectedRun(payrollRuns.find(r => r._id === runId) || null);
    } catch (error) {
      console.error('Failed to load payslips:', error);
      toast.error('Không thể xem chi tiết bảng lương', hrErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async (runId: string) => {
    try {
      const response = await fetch(`${apiBase}/api/payroll-runs/${runId}/export/excel`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorPayload = body.error || body;
        const error = new Error(errorPayload.message || 'Export Excel thất bại.');
        (error as any).code = errorPayload.code;
        (error as any).status = response.status;
        throw error;
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || `payroll-${runId}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export Excel:', error);
      toast.error('Không thể xuất Excel', hrErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Quản lý bảng lương</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tạo kỳ lương, tính toán, khóa và phát hành phiếu lương cho nhân viên.</p>
        </div>
        <Button className="min-h-11" onClick={() => { setSelectedPeriodId(''); setCreateModalOpen(true); }} disabled={loading}>
          <Plus aria-hidden="true" />Tạo bảng lương
        </Button>
      </div>

      {/* Create Modal */}
      <Dialog open={createModalOpen} onOpenChange={(open) => !loading && setCreateModalOpen(open)}>
        <DialogContent className="max-w-xl">
          <DialogHeader className="border-b border-border pr-16">
            <DialogTitle>Tạo bảng lương mới</DialogTitle>
            <DialogDescription>Chọn kỳ công dùng làm nguồn dữ liệu để bắt đầu tính lương.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-6">
              <label htmlFor="payroll-period" className="block text-sm font-medium">Kỳ công <span className="text-destructive">*</span></label>
              <select
                id="payroll-period"
                className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
              >
                <option value="">Chọn kỳ công</option>
                {availablePeriods.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.period} ({new Date(p.startDate).toLocaleDateString('vi-VN')} → {new Date(p.endDate).toLocaleDateString('vi-VN')}) - Đã chốt
                  </option>
                ))}
              </select>
              {availablePeriods.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {closedPeriodsWithPayroll.length > 0
                    ? 'Tất cả kỳ công đã chốt đều đã có bảng lương. Hãy đóng cửa sổ và thao tác trên bảng lương hiện có.'
                    : 'Chưa có kỳ công đã chốt. Hãy hoàn tất chốt kỳ công trước.'}
                </p>
              )}
          </div>
            <div className="mx-6 mb-6 mt-4 flex justify-end gap-3 border-t border-border pt-5">
              <Button className="min-h-11" variant="outline" disabled={loading} onClick={() => setCreateModalOpen(false)}>
                Hủy
              </Button>
              <Button className="min-h-11" onClick={handleCreate} disabled={!selectedPeriodId || loading}>
                {loading ? 'Đang tạo…' : 'Tạo bảng lương'}
              </Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* Payroll Runs List */}
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle>Danh sách bảng lương</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Kỳ lương</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Tổng gross</TableHead>
                <TableHead className="text-right">Tổng net</TableHead>
                <TableHead className="text-center">Đã xử lý</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="sticky right-0 z-10 min-w-52 bg-card pr-6 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                    Chưa có bảng lương nào. Nhấn "Tạo Bảng Lương" để bắt đầu.
                  </TableCell>
                </TableRow>
              ) : (
                payrollRuns.map((run) => (
                  <TableRow key={run._id}>
                    <TableCell className="pl-6 font-medium">{run.periodLabel}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(run.totalGross || 0)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatCurrency(run.totalNet || 0)}</TableCell>
                    <TableCell className="text-center">{run.processedEmployeeCount}/{run.totalEmployeeCount}</TableCell>
                    <TableCell>{new Date(run.runDate).toLocaleDateString('vi-VN')}</TableCell>
                    <TableCell className="sticky right-0 z-10 bg-card pr-6 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleViewPayslips(run._id)} disabled={loading}>
                          <Eye aria-hidden="true" />Xem chi tiết
                        </Button>
                        {run.status === 'DRAFT' && (
                          <Button size="sm" onClick={() => handleCalculate(run._id)} disabled={loading}>
                            <Calculator aria-hidden="true" />{loading ? 'Đang tính…' : 'Tính toán'}
                          </Button>
                        )}
                        {run.status === 'CALCULATED' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleRecalculate(run)} disabled={loading}>
                              {loading ? 'Đang xử lý...' : 'Tính lại'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleLock(run._id)} disabled={loading}>
                              <LockKeyhole aria-hidden="true" />Khóa
                            </Button>
                          </>
                        )}
                        {run.status === 'LOCKED' && (
                          <Button size="sm" variant="default" onClick={() => handleRelease(run._id)} disabled={loading}>
                            <Send aria-hidden="true" />Phát hành
                          </Button>
                        )}
                        {(run.status === 'CALCULATED' || run.status === 'LOCKED' || run.status === 'RELEASED') && (
                          <Button size="sm" variant="ghost" onClick={() => handleExportExcel(run._id)} disabled={loading}>
                            <Download aria-hidden="true" />Xuất Excel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payslips Detail */}
      {selectedRun && (
        <Dialog open onOpenChange={(open) => !open && setSelectedRun(null)}>
          <DialogContent className="max-w-6xl">
            <DialogHeader className="border-b border-border pr-16">
              <DialogTitle>Chi tiết bảng lương · {selectedRun.periodLabel}</DialogTitle>
              <DialogDescription>Tổng quan kỳ lương và danh sách phiếu lương của nhân viên.</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Card className="shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Tổng nhân viên</p>
                    <p className="text-2xl font-bold">{summary.total || 0}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Đã tạo</p>
                    <p className="text-2xl font-bold">{summary.generated || 0}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Đã phát hành</p>
                    <p className="text-2xl font-bold">{summary.released || 0}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Nhân viên đã xem</p>
                    <p className="text-2xl font-bold">{summary.viewed || 0}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Payslips Table */}
            <div className="overflow-hidden rounded-xl border border-border"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân Viên</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PIT</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Trạng Thái</TableHead>
                  <TableHead>Xem Chi Tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Chưa có payslip nào cho kỳ lương này.
                    </TableCell>
                  </TableRow>
                ) : (
                  payslips.map((slip) => (
                    <TableRow key={slip._id}>
                      <TableCell>{slip.employeeName}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(slip.grossEarnings)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(slip.pitAmount)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatCurrency(slip.netSalary)}</TableCell>
                      <TableCell>
                        <StatusBadge status={slip.status} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setPreviewSlip(slip)}>
                          <Eye aria-hidden="true" />Xem
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table></div>
            </div>
            {previewSlip && (
              <PayslipPreviewDialog
                open
                onClose={() => setPreviewSlip(null)}
                payslip={previewSlip}
                periodLabel={selectedRun.periodLabel}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
