import { useState, useEffect } from 'react';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table';
import { PayslipPreviewDialog } from './PayslipPreviewDialog';
import { hrRequest } from '@/services/hrService';

/** Format currency to VND */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

/** Status badge colors for payroll/payslip statuses */
const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CALCULATED: 'bg-blue-100 text-blue-700',
  LOCKED: 'bg-yellow-100 text-yellow-700',
  RELEASED: 'bg-green-100 text-green-700',
  GENERATED: 'bg-purple-100 text-purple-700',
  VIEWED: 'bg-teal-100 text-teal-700',
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
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
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

  const selectedPeriod = periods.find(p => p._id === selectedPeriodId);

  const handleCreate = async () => {
    if (!selectedPeriodId) {
      alert('Vui lòng chọn kỳ công để tạo bảng lương!');
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
    } catch (error: any) {
      console.error('Failed to create payroll run:', error);
      alert(error?.response?.data?.message || error?.message || 'Tạo bảng lương thất bại!');
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
    }
  };

  const handleExportCSV = async (runId: string) => {
    try {
      const response = await fetch(`${apiBase}/api/payroll-runs/${runId}/export/csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslips-${runId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý Bảng Lương</h1>
        <Button onClick={() => setCreateModalOpen(true)} disabled={loading}>
          Tạo Bảng Lương
        </Button>
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold">Tạo Bảng Lương Mới</h2>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium">Chọn Kỳ Công</label>
              <select
                className="w-full rounded border p-2"
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
              >
                <option value="">-- Chọn kỳ công --</option>
                {periods.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.period} ({new Date(p.startDate).toLocaleDateString('vi-VN')} → {new Date(p.endDate).toLocaleDateString('vi-VN')}) - {p.status === 'CLOSED' ? 'Đã chốt' : 'Sẵn sàng'}
                  </option>
                ))}
              </select>
              {periods.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Chưa có kỳ công nào ở trạng thái sẵn sàng hoặc đã chốt. Hãy chốt kỳ công trước tại menu "Kỳ công".</p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleCreate} disabled={!selectedPeriodId || loading}>
                Tạo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Runs List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh Sách Bảng Lương</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kỳ Lương</TableHead>
                <TableHead>Trạng Thái</TableHead>
                <TableHead>Tổng Gross</TableHead>
                <TableHead>Tổng Net</TableHead>
                <TableHead>NV Đã Xử Lý</TableHead>
                <TableHead>Ngày Tạo</TableHead>
                <TableHead>Hành Động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Chưa có bảng lương nào. Nhấn "Tạo Bảng Lương" để bắt đầu.
                  </TableCell>
                </TableRow>
              ) : (
                payrollRuns.map((run) => (
                  <TableRow key={run._id}>
                    <TableCell>{run.periodLabel}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>{new Intl.NumberFormat('vi-VN').format(run.totalGross || 0)} ₫</TableCell>
                    <TableCell>{new Intl.NumberFormat('vi-VN').format(run.totalNet || 0)} ₫</TableCell>
                    <TableCell>{run.processedEmployeeCount}/{run.totalEmployeeCount}</TableCell>
                    <TableCell>{new Date(run.runDate).toLocaleDateString('vi-VN')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {run.status === 'DRAFT' && (
                          <Button size="sm" onClick={() => handleCalculate(run._id)} disabled={loading}>
                            {loading ? 'Đang tính...' : 'Tính Toán'}
                          </Button>
                        )}
                        {run.status === 'CALCULATED' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleRecalculate(run)} disabled={loading}>
                              {loading ? 'Đang xử lý...' : 'Tính lại'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleLock(run._id)} disabled={loading}>
                              Khóa
                            </Button>
                          </>
                        )}
                        {run.status === 'LOCKED' && (
                          <Button size="sm" variant="default" onClick={() => handleRelease(run._id)} disabled={loading}>
                            Phát Hành
                          </Button>
                        )}
                        {(run.status === 'CALCULATED' || run.status === 'LOCKED' || run.status === 'RELEASED') && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleViewPayslips(run._id)} disabled={loading}>
                              Xem Chi Tiết
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleExportCSV(run._id)} disabled={loading}>
                              Export CSV
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payslips Detail */}
      {selectedRun && (
        <Card>
          <CardHeader>
            <CardTitle>Bảng Chi Tiết - {selectedRun.periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-4 gap-4 mb-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Tổng Nhân Viên</p>
                    <p className="text-2xl font-bold">{summary.total || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Đã Tạo</p>
                    <p className="text-2xl font-bold text-blue-600">{summary.generated || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Đã Phát Hành</p>
                    <p className="text-2xl font-bold text-green-600">{summary.released || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Nhân Viên Đã Xem</p>
                    <p className="text-2xl font-bold text-purple-600">{summary.viewed || 0}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Payslips Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân Viên</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>PIT</TableHead>
                  <TableHead>Net</TableHead>
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
                      <TableCell>{new Intl.NumberFormat('vi-VN').format(slip.grossEarnings)} ₫</TableCell>
                      <TableCell>{new Intl.NumberFormat('vi-VN').format(slip.pitAmount)} ₫</TableCell>
                      <TableCell className="font-semibold">{new Intl.NumberFormat('vi-VN').format(slip.netSalary)} ₫</TableCell>
                      <TableCell>
                        <StatusBadge status={slip.status} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setPreviewSlip(slip)}>
                          Xem
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payslip Preview Dialog */}
      {previewSlip && (
        <PayslipPreviewDialog
          open={!!previewSlip}
          onClose={() => setPreviewSlip(null)}
          payslip={previewSlip}
          periodLabel={selectedRun?.periodLabel || ''}
        />
      )}
    </div>
  );
}
