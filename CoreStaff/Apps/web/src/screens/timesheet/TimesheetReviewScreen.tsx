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
  Clock,
  FileText,
  Loader2,
  XCircle,
  ChevronRight,
  Download,
} from 'lucide-react';
import { hrRequest } from '@/services/api';
import { getManagerContext, ManagerContext } from '@/services/manager.service';

const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

type DepartmentSnapshot = {
  departmentId: string;
  managerUserId: string;
  closedAt: string;
};

type Period = {
  _id: string;
  organizationId: string;
  period: string; // "2026-09"
  status: 'OPEN' | 'REVIEWING' | 'READY_TO_CLOSE' | 'CLOSED';
  version: number;
  startDate: string;
  endDate: string;
  managerSnapshotClosed?: boolean;
  managerSnapshotClosedBy?: string;
  managerSnapshotClosedAt?: string;
  departmentSnapshots?: DepartmentSnapshot[];
  closedBy?: string;
  closedAt?: string;
  reopenReason?: string;
};

type SummaryStats = {
  totalEmployees: number;
  summariesGenerated: number;
  missingSummaries: number;
  attendanceComplete: number;
  pendingApprovals: number;
  blockers: Array<{ type: string; message: string; count: number }>;
};

export function TimesheetReviewScreen({
  organizationId,
  userRole,
  periodId,
}: {
  organizationId: string;
  userRole: string;
  periodId?: string | null;
}) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeSuccess, setCloseSuccess] = useState(false);
  const [managerContext, setManagerContext] = useState<ManagerContext | null>(null);
  const [previewData, setPreviewData] = useState<{ summaries: any[]; snapshots: any[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDepartmentId, setPreviewDepartmentId] = useState<string | null>(null);

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
      console.error('Failed to load period detail:', err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewSnapshot(departmentId: string) {
    if (!selectedPeriod) return;
    setPreviewDepartmentId(departmentId);
    setPreviewLoading(true);
    try {
      const data = await hrRequest<{ summaries: any[]; snapshots: any[] }>(
        apiBase,
        `/api/hr/timesheet-periods/${selectedPeriod._id}/snapshot-preview?departmentId=${encodeURIComponent(departmentId)}`,
        { method: 'GET' },
      );
      setPreviewData(data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tải preview snapshot. Vui lòng thử lại.');
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
      alert(err.response?.data?.message || 'Không thể chốt kỳ công. Vui lòng thử lại.');
    } finally {
      setClosing(false);
    }
  }

  async function handleManagerCloseSnapshot(departmentId: string) {
    if (!selectedPeriod) return;

    setClosing(true);
    try {
      const result = await hrRequest<{
        departmentName: string;
        employeesInSnapshot: number;
        totalDepartmentEmployees: number;
        summariesCreated: number;
        snapshotsCreated: number;
      }>(
        apiBase,
        `/api/hr/timesheet-periods/${selectedPeriod._id}/close-snapshot`,
        {
          method: 'POST',
          body: JSON.stringify({ departmentId }),
        },
      );
      alert(
        `Đóng snapshot thành công!\n` +
          `${result.departmentName}: ${result.employeesInSnapshot}/${result.totalDepartmentEmployees} nhân viên đã được đóng snapshot.`
      );
      setPreviewData(null);
      setPreviewDepartmentId(null);
      loadPeriodDetail(selectedPeriod._id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể đóng snapshot. Vui lòng thử lại.');
    } finally {
      setClosing(false);
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
      <div className="flex items-center justify-between">
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
      </div>

      {/* Loading State */}
      {loading && !selectedPeriod && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Period List View */}
      {!selectedPeriod && !loading && (
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
          <Button variant="ghost" onClick={() => setSelectedPeriod(null)}>
            ← Quay lại danh sách
          </Button>

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
                <Badge className={getStatusColor(selectedPeriod.status)}>
                  {getStatusLabel(selectedPeriod.status)}
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
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Tổng hợp công</span>
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold">
                      {stats.summariesGenerated}/{stats.totalEmployees}
                    </div>
                    <Progress value={(stats.summariesGenerated / stats.totalEmployees) * 100} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Chấm công hoàn tất</span>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold">{stats.attendanceComplete}%</div>
                    <p className="text-xs text-gray-500 mt-1">Nhân viên đã check-in/out đầy đủ</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Chờ phê duyệt</span>
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
                    <p className="text-xs text-gray-500 mt-1">Yêu cầu đang chờ duyệt</p>
                  </CardContent>
                </Card>
              </div>

              {/* Blockers Warning */}
              {stats.blockers.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-red-900">
                          Cần xử lý trước khi chốt
                        </h3>
                        <ul className="mt-2 space-y-1">
                          {stats.blockers.map((blocker, idx) => (
                            <li key={idx} className="text-sm text-red-800">
                              • {blocker.message} ({blocker.count})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Missing Summaries Warning */}
              {stats.missingSummaries > 0 && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <XCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-yellow-900">
                          Thiếu tổng hợp công
                        </h3>
                        <p className="text-sm text-yellow-800 mt-1">
                          {stats.missingSummaries} nhân viên chưa có tổng hợp công. 
                          Hệ thống sẽ tự động tạo khi chốt kỳ.
                        </p>
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
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">
                      Đóng snapshot cho phòng ban
                    </h3>
                    <p className="text-sm text-blue-800 mt-1">
                      Chọn phòng ban bạn quản lý để xem preview và đóng snapshot.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {managerContext.managedDepartments.map((dept) => {
                      const closed = selectedPeriod.departmentSnapshots?.some(
                        (ds) => String(ds.departmentId) === dept.id,
                      );
                      return (
                        <div key={dept.id} className="flex flex-col gap-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span>{dept.name}</span>
                            {closed ? (
                              <span className="text-green-700 font-medium">Đã đóng snapshot</span>
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
                                  disabled={closing}
                                >
                                  {closing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Đóng snapshot'
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                          {previewDepartmentId === dept.id && previewData && (
                            <ManagerSnapshotPreview
                              summaries={previewData.summaries}
                              snapshots={previewData.snapshots}
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

          {/* HR Close Action */}
          {selectedPeriod.status === 'READY_TO_CLOSE' && userRole === 'HR' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-green-900">
                      Trạng thái đóng snapshot
                    </h3>
                    <p className="text-sm text-green-800 mt-1">
                      {selectedPeriod.managerSnapshotClosed
                        ? 'Tất cả phòng ban đã đóng snapshot.'
                        : 'Còn phòng ban chưa đóng snapshot. HR không thể chốt kỳ công.'}
                    </p>
                  </div>
                  {selectedPeriod.managerSnapshotClosed ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-green-800">
                        Xác nhận chốt kỳ công {selectedPeriod.period}?
                      </p>
                      <Button
                        onClick={handleClosePeriod}
                        disabled={closing}
                        className="bg-green-600 hover:bg-green-700"
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
                  ) : (
                    <div className="text-sm text-yellow-700">
                      Chưa đủ điều kiện chốt kỳ công.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Closed Period Info */}
          {selectedPeriod.status === 'CLOSED' && (
            <Card className="border-gray-200">
              <CardContent className="pt-6">
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
    </div>
  );
}

function formatMoney(value?: number) {
  return new Intl.NumberFormat('vi-VN').format(value ?? 0);
}

function ManagerSnapshotPreview({ summaries, snapshots, departmentId }: { summaries: any[]; snapshots: any[]; departmentId?: string | null }) {
  const filteredSummaries = departmentId
    ? summaries.filter((s) => String(s.departmentId) === String(departmentId))
    : summaries;

  const merged = filteredSummaries.map((summary) => {
    const snapshot = snapshots.find(
      (s) => String(s.employeeProfileId) === String(summary.employeeProfileId),
    );
    return { summary, snapshot };
  });

  return (
    <div className="mt-2 rounded-md border border-blue-200 bg-white p-3 space-y-3">
      <h4 className="text-sm font-semibold text-blue-900">Preview snapshot</h4>
      {merged.length === 0 && <p className="text-sm text-gray-600">Chưa có dữ liệu snapshot cho phòng ban này.</p>}

      {merged.length > 0 && (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {merged.map(({ summary, snapshot }) => (
            <div key={summary._id || summary.employeeProfileId} className="rounded-md border border-gray-200 p-3">
              {/* Employee identity */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {summary.fullName || snapshot?.fullName || '—'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {summary.employeeCode || snapshot?.employeeCode} • {summary.departmentName || snapshot?.departmentName}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {summary.totalOvertimeMinutes || 0} phút OT
                </Badge>
              </div>

              {/* Attendance */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                <div className="rounded bg-gray-50 p-2">
                  <p className="text-xs text-gray-500">Ngày công</p>
                  <p className="text-sm font-semibold">{summary.workingDays ?? 0}</p>
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <p className="text-xs text-gray-500">Vắng</p>
                  <p className="text-sm font-semibold">{summary.absentDays ?? 0}</p>
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <p className="text-xs text-gray-500">Thiếu dữ liệu</p>
                  <p className="text-sm font-semibold">{summary.incompleteDays ?? 0}</p>
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <p className="text-xs text-gray-500">Nghỉ phép có lương</p>
                  <p className="text-sm font-semibold">{summary.paidLeaveDays ?? 0}</p>
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <p className="text-xs text-gray-500">Nghỉ không lương</p>
                  <p className="text-sm font-semibold">{summary.unpaidLeaveDays ?? 0}</p>
                </div>
              </div>

              {/* OT breakdown */}
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-1">Chi tiết tăng ca (phút)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="rounded bg-blue-50 p-2">
                    <p className="text-xs text-blue-700">Ngày làm</p>
                    <p className="text-sm font-semibold text-blue-900">{summary.otWorkingDayMinutes ?? 0}</p>
                  </div>
                  <div className="rounded bg-blue-50 p-2">
                    <p className="text-xs text-blue-700">Cuối tuần</p>
                    <p className="text-sm font-semibold text-blue-900">{summary.otWeeklyOffMinutes ?? 0}</p>
                  </div>
                  <div className="rounded bg-blue-50 p-2">
                    <p className="text-xs text-blue-700">Ngày lễ</p>
                    <p className="text-sm font-semibold text-blue-900">{summary.otPublicHolidayMinutes ?? 0}</p>
                  </div>
                  <div className="rounded bg-blue-50 p-2">
                    <p className="text-xs text-blue-700">Tổng OT</p>
                    <p className="text-sm font-semibold text-blue-900">{summary.totalOvertimeMinutes ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* Payroll inputs */}
              {snapshot && (
                <div className="rounded bg-green-50 p-3 space-y-3">
                  <p className="text-xs font-medium text-green-900">Thông tin lương & đóng góp</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Lương cơ bản thực nhận</p>
                      <p className="font-semibold text-green-900">{formatMoney(snapshot.proratedBaseSalary)} ₫</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Tổng phụ cấp</p>
                      <p className="font-semibold">{formatMoney(snapshot.totalAllowances)} ₫</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Tiền tăng ca</p>
                      <p className="font-semibold">{formatMoney(snapshot.otPay)} ₫</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Thu nhập chịu thuế</p>
                      <p className="font-semibold">{formatMoney(snapshot.taxableEarnings)} ₫</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lương Gross</p>
                      <p className="font-semibold">{formatMoney(snapshot.grossEarnings ?? snapshot.monthlyBaseSalary)} ₫</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">BHXH</p>
                      <p className="font-semibold">{formatMoney(snapshot.socialInsurance)} ₫</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">BHYT</p>
                      <p className="font-semibold">{formatMoney(snapshot.healthInsurance)} ₫</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">BHTN</p>
                      <p className="font-semibold">{formatMoney(snapshot.unemploymentInsurance)} ₫</p>
                    </div>
                    {'pitAmount' in snapshot && (
                      <div>
                        <p className="text-xs text-gray-500">Thuế TNCN</p>
                        <p className="font-semibold">{formatMoney(snapshot.pitAmount)} ₫</p>
                      </div>
                    )}
                    {'netSalary' in snapshot && (
                      <div>
                        <p className="text-xs text-gray-500">Net</p>
                        <p className="font-semibold">{formatMoney(snapshot.netSalary)} ₫</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Số người phụ thuộc</p>
                      <p className="font-semibold">{snapshot.dependentCount ?? 0}</p>
                    </div>
                  </div>
                  {Array.isArray(snapshot.allowanceBreakdown) && snapshot.allowanceBreakdown.length > 0 && (
                    <div className="border-t border-green-200 pt-2">
                      <p className="text-xs font-medium text-green-900 mb-1">Chi tiết phụ cấp</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {snapshot.allowanceBreakdown.map((a: any, idx: number) => (
                          <span key={idx} className="rounded bg-white px-2 py-1 text-gray-700 border border-green-200">
                            {a.label || a.type}: {formatMoney(a.amount)} ₫
                            {a.taxable === false && <span className="ml-1 text-green-700">(miễn thuế)</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
