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
import { Badge } from '@/components/badge';
import { Progress } from '@/components/progress';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  ChevronRight,
  Download,
} from 'lucide-react';
import { hrRequest } from '@/services/api';
import {
  hrErrorMessage,
  getPeriodBlockers,
  PeriodBlockerRow,
  PeriodBlockerType,
  TimesheetPeriod,
  confirmDepartmentTimesheet,
} from '@/services/hrService';
import { getManagerContext, ManagerContext } from '@/services/manager.service';
import { toast } from '@/components/toast';
import { getSocket } from '@/services/socket';
import { BlockerDayDetailDialog } from './components/BlockerDayDetailDialog';


type Period = TimesheetPeriod;

type SummaryStats = {
  totalEmployees: number;
  /** Employees with no remaining blocker. Optional while an older API is still running. */
  resolvedEmployees?: number;
  summariesGenerated: number;
  missingSummaries: number;
  attendanceComplete: number;
  pendingApprovals: number;
  confirmedDepartments: number;
  requiredDepartments: number;
  departmentConfirmationProgress: Array<{
    departmentId: string;
    departmentName: string;
    confirmed: boolean;
  }>;
  blockers: Array<{ type: PeriodBlockerType; message: string; count: number }>;
};

function getResolvedEmployeeCount(stats: SummaryStats): number {
  if (Number.isFinite(stats.resolvedEmployees)) {
    return Math.max(0, Math.min(stats.totalEmployees, stats.resolvedEmployees!));
  }
  // Backward-compatible fallback during rolling deploys. attendanceComplete is
  // already based on unique employees, so 67% of 3 correctly restores 2/3.
  return Math.max(0, Math.min(
    stats.totalEmployees,
    Math.round((stats.attendanceComplete / 100) * stats.totalEmployees),
  ));
}

const BLOCKER_LABEL: Record<PeriodBlockerType, string> = {
  MISSING_CHECK_IN: 'Thiếu check-in',
  MISSING_CHECK_OUT: 'Thiếu check-out',
  PENDING_APPROVAL: 'Approval còn PENDING',
  PENDING_CLARIFICATION: 'Chờ giải trình',
  REJECTED: 'Ngày công bị REJECTED',
};

export function TimesheetReviewScreen({
  apiBase,
  organizationId,
  userRole,
  periodId,
  embedded = false,
}: {
  apiBase: string;
  organizationId: string;
  userRole: string;
  periodId?: string | null;
  embedded?: boolean;
}) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmingDepartmentId, setConfirmingDepartmentId] = useState<string | null>(null);
  const [departmentBlockers, setDepartmentBlockers] = useState<Record<string, { total: number; items: PeriodBlockerRow[] }>>({});
  const [closeSuccess, setCloseSuccess] = useState(false);
  const [managerContext, setManagerContext] = useState<ManagerContext | null>(null);
  const [previewData, setPreviewData] = useState<{ summaries: any[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDepartmentId, setPreviewDepartmentId] = useState<string | null>(null);
  // TASK-074 — blocker drill-down
  const [expandedBlocker, setExpandedBlocker] = useState<PeriodBlockerType | null>(null);
  const [blockerRows, setBlockerRows] = useState<PeriodBlockerRow[]>([]);
  const [blockerRowsLoading, setBlockerRowsLoading] = useState(false);
  const [blockerRowsError, setBlockerRowsError] = useState<string | null>(null);
  const [detailBlocker, setDetailBlocker] = useState<PeriodBlockerRow | null>(null);

  // Load periods list
  useEffect(() => {
    loadPeriods();
    if (userRole === 'DEPARTMENT_MANAGER') {
      loadManagerContext();
    }
  }, [organizationId, userRole]);

  async function loadManagerContext() {
    try {
      const ctx = await getManagerContext(apiBase);
      setManagerContext(ctx);
    } catch (err) {
      console.error('Failed to load manager context:', err);
    }
  }

  // Auto-select period when periodId is provided from parent dialog
  useEffect(() => {
    if (periodId && periods.length > 0) {
      const period = periods.find(p => p._id === periodId);
      if (period) {
        loadPeriodDetail(period._id);
      }
    }
  }, [periodId, periods]);

  // An approved attendance correction changes blockers and the live draft
  // summary. Refresh the open review automatically for HR/managers instead of
  // requiring them to close the dialog or press the reload button.
  useEffect(() => {
    if (!selectedPeriod) return;
    const socket = getSocket(apiBase);
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const onRequestDecided = (payload: { type?: string }) => {
      if (payload?.type !== 'ATTENDANCE') return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void loadPeriodDetail(selectedPeriod._id);
      }, 250);
    };
    socket.on('request:decided', onRequestDecided);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.off('request:decided', onRequestDecided);
    };
  }, [apiBase, selectedPeriod?._id]);

  async function loadPeriods() {
    setLoading(true);
    try {
      const res = await hrRequest<Period[]>(apiBase, `/api/hr/timesheet-periods?organizationId=${organizationId}`);
      setPeriods(res || []);
    } catch (err) {
      console.error('Failed to load periods:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPeriodDetail(periodId: string) {
    setLoading(true);
    setPreviewData(null);
    setPreviewDepartmentId(null);
    try {
      const period = await hrRequest<Period>(apiBase, `/api/hr/timesheet-periods/${periodId}`);
      setSelectedPeriod(period);

      // Load summary stats
      const statsData = await hrRequest<SummaryStats>(
        apiBase,
        `/api/hr/timesheet-periods/${periodId}/review-stats`,
      );
      setStats(statsData);
    } catch (err) {
      setStats(null);
      toast.error(hrErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  /** TASK-074 — expand a blocker type and lazily load its failing days. */
  async function toggleBlocker(type: PeriodBlockerType) {
    if (expandedBlocker === type) {
      setExpandedBlocker(null);
      return;
    }
    if (!selectedPeriod) return;
    setExpandedBlocker(type);
    setBlockerRowsLoading(true);
    setBlockerRowsError(null);
    try {
      const page = await getPeriodBlockers(apiBase, selectedPeriod._id, { type, limit: 50 });
      setBlockerRows(page.items);
    } catch (err) {
      setBlockerRows([]);
      setBlockerRowsError(hrErrorMessage(err));
    } finally {
      setBlockerRowsLoading(false);
    }
  }

  async function handlePreviewSnapshot(departmentId: string) {
    if (!selectedPeriod) return;
    setPreviewDepartmentId(departmentId);
    setPreviewLoading(true);
    try {
      const data = await hrRequest<{ summaries: any[] }>(
        apiBase,
        `/api/hr/timesheet-periods/${selectedPeriod._id}/snapshot-preview?departmentId=${encodeURIComponent(departmentId)}`,
        { method: 'GET' },
      );
      setPreviewData(data);
    } catch (err: any) {
      toast.error(hrErrorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleClosePeriod() {
    if (!selectedPeriod) return;

    setClosing(true);
    setCloseSuccess(false);
    try {
      await hrRequest<void>(
        apiBase,
        `/api/hr/timesheet-periods/${selectedPeriod._id}/close`,
        { method: 'POST' },
      );
      setCloseSuccess(true);
      // Reload period list
      setTimeout(() => {
        loadPeriods();
        setSelectedPeriod(null);
        setCloseSuccess(false);
      }, 2000);
    } catch (err: any) {
      toast.error(hrErrorMessage(err));
    } finally {
      setClosing(false);
    }
  }

  async function handleManagerCloseSnapshot(departmentId: string) {
    if (!selectedPeriod || confirmingDepartmentId) return;

    setConfirmingDepartmentId(departmentId);
    try {
      const blockers = await getPeriodBlockers(apiBase, selectedPeriod._id, { departmentId, limit: 50 });
      setDepartmentBlockers(current => ({ ...current, [departmentId]: blockers }));
      if (blockers.total > 0) return;
      const result = await confirmDepartmentTimesheet(
        apiBase, selectedPeriod._id, departmentId, selectedPeriod.version,
      );
      toast.success(
        `Đã xác nhận bảng công phiên bản ${result.confirmation.periodVersion}.`
      );
      setPreviewData(null);
      setPreviewDepartmentId(null);
      await loadPeriodDetail(selectedPeriod._id);
    } catch (err: any) {
      toast.error(hrErrorMessage(err));
      if (err?.code === 'PERIOD_VERSION_CONFLICT' || err?.code === 'DEPARTMENT_NOT_READY') {
        await loadPeriodDetail(selectedPeriod._id);
        const blockers = await getPeriodBlockers(apiBase, selectedPeriod._id, { departmentId, limit: 50 }).catch(() => null);
        if (blockers) setDepartmentBlockers(current => ({ ...current, [departmentId]: blockers }));
      }
    } finally {
      setConfirmingDepartmentId(null);
    }
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      OPEN: 'Đang mở',
      REVIEWING: 'Đang rà soát',
      READY_TO_CLOSE: 'Sẵn sàng chốt',
      CLOSED: 'Đã chốt',
    };
    return labels[status] || status;
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      OPEN: 'bg-blue-100 text-blue-800 border-blue-200',
      REVIEWING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      READY_TO_CLOSE: 'bg-green-100 text-green-800 border-green-200',
      CLOSED: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  const confirmationsReady = Boolean(
    selectedPeriod && (
      selectedPeriod.status === 'READY_TO_CLOSE'
      || ((stats?.requiredDepartments ?? 0) > 0
        && stats?.confirmedDepartments === stats?.requiredDepartments)
      || ((selectedPeriod.requiredDepartmentConfirmations?.length ?? 0) > 0
        && selectedPeriod.requiredDepartmentConfirmations?.every((department) => department.confirmed))
    ),
  );
  const effectivePeriodStatus = selectedPeriod?.status !== 'CLOSED' && confirmationsReady
    ? 'READY_TO_CLOSE'
    : selectedPeriod?.status;

  // ───────── RENDER ─────────

  if (closeSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="rounded-full bg-green-100 p-4">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Chốt kỳ công thành công!</h2>
          <p className="text-gray-600">
            Kỳ công {selectedPeriod?.period} đã được đóng. {stats?.summariesGenerated} tổng hợp công đã được tạo.
          </p>
        </div>
        <Button onClick={() => { setSelectedPeriod(null); setCloseSuccess(false); }}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {!embedded && <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Kỳ Công</h1>
          <p className="text-gray-600 mt-1">
            Theo dõi trạng thái các kỳ công và thực hiện chốt kỳ
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Xuất báo cáo
        </Button>
      </div>}

      {/* Loading State */}
      {loading && !selectedPeriod && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Period List View */}
      {!embedded && !selectedPeriod && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Danh sách Kỳ Công</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kỳ công</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày bắt đầu</TableHead>
                  <TableHead>Ngày kết thúc</TableHead>
                  <TableHead>Phiên bản</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period._id}>
                    <TableCell className="font-medium">{period.period}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(period.status)}>
                        {getStatusLabel(period.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(period.startDate).toLocaleDateString('vi-VN')}</TableCell>
                    <TableCell>{new Date(period.endDate).toLocaleDateString('vi-VN')}</TableCell>
                    <TableCell>v{period.version}</TableCell>
                    <TableCell>
                      {period.status === 'READY_TO_CLOSE' && (
                        <Button
                          size="sm"
                          onClick={() => loadPeriodDetail(period._id)}
                        >
                          Chốt kỳ
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                      {period.status === 'CLOSED' && (
                        <span className="text-sm text-gray-500">Đã chốt</span>
                      )}
                      {(period.status === 'OPEN' || period.status === 'REVIEWING') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadPeriodDetail(period._id)}
                        >
                          Xem chi tiết
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {periods.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Chưa có kỳ công nào. Hãy tạo kỳ công mới từ màn hình HR Overview.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Period Detail / Review View */}
      {selectedPeriod && !loading && (
        <div className="space-y-6">
          {/* Back button */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {!embedded && <Button variant="ghost" onClick={() => setSelectedPeriod(null)}>
              ← Quay lại danh sách
            </Button>}
            <Button variant="outline" disabled={closing} onClick={() => loadPeriodDetail(selectedPeriod._id)}>
              Tải lại bảng công
            </Button>
          </div>

          {/* Period Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Kỳ công {selectedPeriod.period}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Phiên bản {selectedPeriod.version} • 
                    {new Date(selectedPeriod.startDate).toLocaleDateString('vi-VN')} →{' '}
                    {new Date(selectedPeriod.endDate).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <Badge className={getStatusColor(effectivePeriodStatus ?? selectedPeriod.status)}>
                  {getStatusLabel(effectivePeriodStatus ?? selectedPeriod.status)}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Review Stats */}
          {stats && (
            <>
              {/* Progress Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {selectedPeriod.status === 'CLOSED' ? 'Tổng hợp công' : 'Tổng hợp tạm tính'}
                      </span>
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold">
                      {selectedPeriod.status === 'CLOSED' ? stats.summariesGenerated : getResolvedEmployeeCount(stats)}/{stats.totalEmployees}
                    </div>
                    <Progress
                      value={stats.totalEmployees > 0
                        ? ((selectedPeriod.status === 'CLOSED' ? stats.summariesGenerated : getResolvedEmployeeCount(stats)) / stats.totalEmployees) * 100
                        : 0}
                      className="mt-2"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Chấm công hoàn tất</span>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold">{stats.attendanceComplete}%</div>
                    <p className="text-xs text-gray-500 mt-1">Nhân viên đã check-in/out đầy đủ</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Chờ phê duyệt</span>
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
                    <p className="text-xs text-gray-500 mt-1">Yêu cầu đang chờ duyệt</p>
                  </CardContent>
                </Card>
              </div>

              {/* Blockers Warning — TASK-074, expandable drill-down */}
              {stats.blockers.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent>
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-red-900">
                          Cần xử lý trước khi chốt
                        </h3>
                        <ul className="mt-3 space-y-2">
                          {stats.blockers.map((blocker) => (
                            <li key={blocker.type}>
                              <button
                                type="button"
                                onClick={() => toggleBlocker(blocker.type)}
                                className="flex w-full items-center justify-between rounded-lg border border-red-200 bg-white px-3 py-2 text-left text-sm text-red-900 hover:bg-red-100"
                              >
                                <span>
                                  {BLOCKER_LABEL[blocker.type] ?? blocker.message}{' '}
                                  <span className="text-red-600">({blocker.count})</span>
                                </span>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    expandedBlocker === blocker.type ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              {expandedBlocker === blocker.type && (
                                <div className="mt-2 overflow-hidden rounded-lg border border-red-200 bg-white">
                                  {blockerRowsLoading && (
                                    <div className="flex justify-center py-6">
                                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                  )}
                                  {!blockerRowsLoading && blockerRowsError && (
                                    <div className="p-3 text-sm text-red-800">{blockerRowsError}</div>
                                  )}
                                  {!blockerRowsLoading && !blockerRowsError && blockerRows.length === 0 && (
                                    <div className="p-3 text-sm text-muted-foreground">
                                      Không có ngày nào.
                                    </div>
                                  )}
                                  {!blockerRowsLoading && !blockerRowsError && blockerRows.length > 0 && (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Nhân viên</TableHead>
                                          <TableHead>Phòng ban</TableHead>
                                          <TableHead>Ngày</TableHead>
                                          <TableHead>Ghi chú</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {blockerRows.map((row) => (
                                          <TableRow
                                            key={row.id}
                                            className="cursor-pointer"
                                            onClick={() => setDetailBlocker(row)}
                                          >
                                            <TableCell className="font-medium">
                                              {row.employee.name ?? row.employeeId}
                                              {row.employee.code && (
                                                <span className="ml-1 text-xs text-muted-foreground">
                                                  ({row.employee.code})
                                                </span>
                                              )}
                                            </TableCell>
                                            <TableCell>{row.employee.department ?? '—'}</TableCell>
                                            <TableCell>{row.date}</TableCell>
                                            <TableCell>{row.note}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            </>
          )}

          {/* Manager Snapshot Action */}
          {(selectedPeriod.status === 'OPEN' || selectedPeriod.status === 'REVIEWING' || selectedPeriod.status === 'READY_TO_CLOSE') && userRole === 'DEPARTMENT_MANAGER' && managerContext && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">
                      Xác nhận bảng công phòng ban
                    </h3>
                    <p className="text-sm text-blue-800 mt-1">
                      Rà soát bảng công và xác nhận phòng ban ở phiên bản hiện tại. Khi dữ liệu thay đổi, phòng ban cần xác nhận lại.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {managerContext.managedDepartments.map((dept) => {
                      const confirmation = selectedPeriod.departmentConfirmations?.find(
                        (item) => String(item.departmentId) === dept.id && item.periodVersion === selectedPeriod.version,
                      );
                      return (
                        <div key={dept.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-sm">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-semibold text-foreground">{dept.name}</span>
                            {confirmation ? (
                              <div className="text-sm sm:text-right">
                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Đã xác nhận · v{confirmation.periodVersion}</Badge>
                                <p className="mt-1 text-xs text-muted-foreground">{new Date(confirmation.confirmedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePreviewSnapshot(dept.id)}
                                  disabled={previewLoading}
                                >
                                  {previewLoading && previewDepartmentId === dept.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Xem preview'
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleManagerCloseSnapshot(dept.id)}
                                  disabled={!!confirmingDepartmentId || loading || selectedPeriod.status === 'READY_TO_CLOSE'}
                                >
                                  {confirmingDepartmentId === dept.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    `Xác nhận ${dept.name}`
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                          {!confirmation && departmentBlockers[dept.id]?.total > 0 && (
                            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3" role="alert">
                              <p className="font-medium text-destructive">{dept.name} còn {departmentBlockers[dept.id].total} lỗi cần xử lý trước khi xác nhận.</p>
                              <div className="mt-2 space-y-2">
                                {departmentBlockers[dept.id].items.map(row => (
                                  <button key={row.id} type="button" onClick={() => setDetailBlocker(row)} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left hover:bg-muted">
                                    <span>{row.employee.name ?? row.employee.code ?? row.employeeId} · {row.date}</span>
                                    <span className="text-destructive">{BLOCKER_LABEL[row.type]}</span>
                                  </button>
                                ))}
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">Bấm vào bản ghi để xem chi tiết. Xử lý lỗi rồi xác nhận lại riêng phòng ban này.</p>
                            </div>
                          )}
                          {previewDepartmentId === dept.id && previewData && (
                            <ManagerSnapshotPreview
                              summaries={previewData.summaries}
                              departmentId={dept.id}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* HR Close Action: keep the action visible while reviewing so HR can
              see why it is not available yet. The API still enforces READY_TO_CLOSE. */}
          {selectedPeriod.status !== 'CLOSED' && userRole === 'HR' && (
            <Card className={confirmationsReady
              ? 'border-green-200 bg-green-50'
              : 'border-yellow-200 bg-yellow-50'}>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className={confirmationsReady
                      ? 'text-lg font-semibold text-green-900'
                      : 'text-lg font-semibold text-yellow-900'}>
                      Chốt kỳ công
                    </h3>
                    <p className={confirmationsReady
                      ? 'text-sm text-green-800 mt-1'
                      : 'text-sm text-yellow-800 mt-1'}>
                      {confirmationsReady
                        ? 'Tất cả phòng ban đã xác nhận phiên bản kỳ công hiện tại.'
                        : 'Nút chốt sẽ được mở sau khi tất cả phòng ban xác nhận và không còn lỗi chặn.'}
                    </p>
                  </div>
                  {stats && !confirmationsReady && (
                    <div className="space-y-2 rounded-lg border border-yellow-200 bg-white/70 p-3">
                      <p className="text-sm font-medium text-yellow-900">
                        Xác nhận phòng ban: {stats.confirmedDepartments}/{stats.requiredDepartments}
                      </p>
                      {stats.departmentConfirmationProgress.map((department) => (
                        <div key={department.departmentId} className="flex items-center justify-between gap-3 text-sm">
                          <span>{department.departmentName}</span>
                          <Badge
                            variant="outline"
                            className={department.confirmed
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-yellow-300 bg-yellow-50 text-yellow-800'}
                          >
                            {department.confirmed ? 'Đã xác nhận' : 'Chưa xác nhận'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <p className={confirmationsReady
                      ? 'text-sm text-green-800'
                      : 'text-sm text-yellow-800'}>
                      {!confirmationsReady
                        ? `Còn ${Math.max(0, (stats?.requiredDepartments ?? 0) - (stats?.confirmedDepartments ?? 0))} phòng ban phải xác nhận phiên bản ${selectedPeriod.version}.`
                        : stats && stats.blockers.length > 0
                          ? `Còn ${stats.blockers.reduce((sum, b) => sum + b.count, 0)} lỗi chặn cần xử lý trước khi chốt.`
                          : `Xác nhận chốt kỳ công ${selectedPeriod.period}?`}
                    </p>
                    <Button
                      onClick={handleClosePeriod}
                      disabled={closing || !stats || !confirmationsReady || (stats?.blockers.length ?? 0) > 0}
                      className="shrink-0 bg-green-600 hover:bg-green-700"
                    >
                      {closing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Đang chốt...
                        </>
                      ) : (
                        'Chốt kỳ công'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Closed Period Info */}
          {selectedPeriod.status === 'CLOSED' && (
            <Card className="border-gray-200">
              <CardContent>
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Kỳ công đã được chốt</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Chốt bởi {selectedPeriod.closedBy} vào{' '}
                      {selectedPeriod.closedAt
                        ? new Date(selectedPeriod.closedAt).toLocaleString('vi-VN')
                        : '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TASK-074 — blocked-day drill-down */}
      {selectedPeriod && (
        <BlockerDayDetailDialog
          open={detailBlocker !== null}
          onOpenChange={(open) => { if (!open) setDetailBlocker(null); }}
          apiBase={apiBase}
          periodId={selectedPeriod._id}
          blocker={detailBlocker}
          onResolved={async () => {
            setDetailBlocker(null);
            setExpandedBlocker(null);
            setBlockerRows([]);
            setDepartmentBlockers({});
            await loadPeriodDetail(selectedPeriod._id);
          }}
        />
      )}
    </div>
  );
}

export function ManagerSnapshotPreview({ summaries, departmentId }: { summaries: any[]; departmentId?: string | null }) {
  const filteredSummaries = departmentId
    ? summaries.filter((s) => String(s.departmentId) === String(departmentId))
    : summaries;

  const totals = filteredSummaries.reduce(
    (sum, summary) => ({
      standardWorkingDays: sum.standardWorkingDays + (summary.standardWorkingDays ?? 0),
      actualWorkingDays: sum.actualWorkingDays + (summary.actualWorkingDays ?? 0),
      absentDays: sum.absentDays + (summary.absentDays ?? 0),
      incompleteDays: sum.incompleteDays + (summary.incompleteDays ?? 0),
      paidLeaveDays: sum.paidLeaveDays + (summary.paidLeaveDays ?? 0),
      unpaidLeaveDays: sum.unpaidLeaveDays + (summary.unpaidLeaveDays ?? 0),
      totalWorkingMinutes: sum.totalWorkingMinutes + (summary.totalWorkingMinutes ?? 0),
      totalLateMinutes: sum.totalLateMinutes + (summary.totalLateMinutes ?? 0),
      totalEarlyMinutes: sum.totalEarlyMinutes + (summary.totalEarlyMinutes ?? 0),
      otWorkingDayMinutes: sum.otWorkingDayMinutes + (summary.otWorkingDayMinutes ?? 0),
      otWeeklyOffMinutes: sum.otWeeklyOffMinutes + (summary.otWeeklyOffMinutes ?? 0),
      otPublicHolidayMinutes: sum.otPublicHolidayMinutes + (summary.otPublicHolidayMinutes ?? 0),
      totalOvertimeMinutes: sum.totalOvertimeMinutes + (summary.totalOvertimeMinutes ?? 0),
    }),
    {
      standardWorkingDays: 0,
      actualWorkingDays: 0,
      absentDays: 0,
      incompleteDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      totalWorkingMinutes: 0,
      totalLateMinutes: 0,
      totalEarlyMinutes: 0,
      otWorkingDayMinutes: 0,
      otWeeklyOffMinutes: 0,
      otPublicHolidayMinutes: 0,
      totalOvertimeMinutes: 0,
    },
  );

  return (
    <div className="mt-2 space-y-3 rounded-md border border-blue-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-blue-900">Preview snapshot</h4>
        {filteredSummaries.length > 0 && (
          <Badge variant="outline">{filteredSummaries.length} nhân viên</Badge>
        )}
      </div>
      {filteredSummaries.length === 0 && <p className="text-sm text-gray-600">Chưa có dữ liệu snapshot cho phòng ban này.</p>}

      {filteredSummaries.length > 0 && (
        <div className="max-h-[60vh] overflow-auto rounded-md border border-gray-200">
          <Table aria-label="Preview snapshot nhân viên" className="min-w-[1580px] text-xs">
            <TableHeader className="sticky top-0 z-20 bg-white shadow-sm">
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead rowSpan={2} className="sticky left-0 z-30 min-w-52 border-r bg-gray-50 px-3">Nhân viên</TableHead>
                <TableHead rowSpan={2} className="min-w-28 border-r bg-gray-50">Mã NV</TableHead>
                <TableHead colSpan={4} className="border-r text-center">Ngày công</TableHead>
                <TableHead colSpan={2} className="border-r text-center">Nghỉ</TableHead>
                <TableHead colSpan={3} className="border-r text-center">Thời gian</TableHead>
                <TableHead colSpan={4} className="text-center">Tăng ca</TableHead>
              </TableRow>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-right">Ngày công chuẩn</TableHead>
                <TableHead className="text-right">Công thực tế</TableHead>
                <TableHead className="text-right">Vắng</TableHead>
                <TableHead className="border-r text-right">Thiếu dữ liệu</TableHead>
                <TableHead className="text-right">Có lương</TableHead>
                <TableHead className="border-r text-right">Không lương</TableHead>
                <TableHead className="text-right">Tổng giờ làm</TableHead>
                <TableHead className="text-right">Đi trễ</TableHead>
                <TableHead className="border-r text-right">Về sớm</TableHead>
                <TableHead className="text-right">OT ngày làm</TableHead>
                <TableHead className="text-right">OT cuối tuần</TableHead>
                <TableHead className="text-right">OT ngày lễ</TableHead>
                <TableHead className="text-right">Tổng OT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSummaries.map((summary) => {
                const needsReview = (summary.absentDays ?? 0) > 0 || (summary.incompleteDays ?? 0) > 0;
                return (
                  <TableRow key={summary.employeeProfileId} className={needsReview ? 'bg-amber-50/60' : undefined}>
                    <TableCell className="sticky left-0 z-10 border-r bg-white px-3 font-medium">
                      <span className="block max-w-48 truncate" title={summary.fullName || '—'}>{summary.fullName || '—'}</span>
                      <span className="block text-[11px] font-normal text-gray-500">{summary.departmentName || '—'}</span>
                    </TableCell>
                    <TableCell className="border-r font-mono text-[11px]">{summary.employeeCode || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{summary.standardWorkingDays ?? 0}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{summary.actualWorkingDays ?? 0}</TableCell>
                    <TableCell className={`text-right tabular-nums ${(summary.absentDays ?? 0) > 0 ? 'font-semibold text-red-700' : ''}`}>{summary.absentDays ?? 0}</TableCell>
                    <TableCell className={`border-r text-right tabular-nums ${(summary.incompleteDays ?? 0) > 0 ? 'font-semibold text-amber-700' : ''}`}>{summary.incompleteDays ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{summary.paidLeaveDays ?? 0}</TableCell>
                    <TableCell className="border-r text-right tabular-nums">{summary.unpaidLeaveDays ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatWorkDuration(summary.totalWorkingMinutes)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${(summary.totalLateMinutes ?? 0) > 0 ? 'font-semibold text-amber-700' : ''}`}>{formatWorkDuration(summary.totalLateMinutes)}</TableCell>
                    <TableCell className={`border-r text-right tabular-nums ${(summary.totalEarlyMinutes ?? 0) > 0 ? 'font-semibold text-amber-700' : ''}`}>{formatWorkDuration(summary.totalEarlyMinutes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatWorkDuration(summary.otWorkingDayMinutes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatWorkDuration(summary.otWeeklyOffMinutes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatWorkDuration(summary.otPublicHolidayMinutes)}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-900 tabular-nums">{formatWorkDuration(summary.totalOvertimeMinutes)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="sticky bottom-0 z-20 bg-blue-50 font-semibold hover:bg-blue-50">
                <TableCell className="sticky left-0 z-30 border-r bg-blue-50 px-3">Tổng cộng</TableCell>
                <TableCell className="border-r text-gray-600">{filteredSummaries.length} NV</TableCell>
                <TableCell className="text-right tabular-nums">{totals.standardWorkingDays}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.actualWorkingDays}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.absentDays}</TableCell>
                <TableCell className="border-r text-right tabular-nums">{totals.incompleteDays}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.paidLeaveDays}</TableCell>
                <TableCell className="border-r text-right tabular-nums">{totals.unpaidLeaveDays}</TableCell>
                <TableCell className="text-right tabular-nums">{formatWorkDuration(totals.totalWorkingMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatWorkDuration(totals.totalLateMinutes)}</TableCell>
                <TableCell className="border-r text-right tabular-nums">{formatWorkDuration(totals.totalEarlyMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatWorkDuration(totals.otWorkingDayMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatWorkDuration(totals.otWeeklyOffMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatWorkDuration(totals.otPublicHolidayMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums text-blue-900">{formatWorkDuration(totals.totalOvertimeMinutes)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function formatWorkDuration(value?: number): string {
  const totalMinutes = Math.max(0, Math.round(value ?? 0));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} giờ ${String(minutes).padStart(2, '0')} phút` : `${hours} giờ`;
}
