import { useEffect, useState } from 'react';
import {
  FileText,
  Search,
  ShieldCheck,
  Filter,
  RefreshCw,
  AlertCircle,
  Calendar,
  User,
  CheckCircle2,
} from 'lucide-react';
import { getHrAuditLogs, HrAuditLogItem, hrErrorMessage } from '@/services/hrService';
import { formatInstantDateTimeVN } from '@/lib/datetime';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';

export function HrAuditLogScreen({ apiBase }: { apiBase: string }) {
  const [logs, setLogs] = useState<HrAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterAction, setFilterAction] = useState<string>('');
  const [onlySelfApproved, setOnlySelfApproved] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHrAuditLogs(apiBase, {
        action: filterAction || undefined,
        isSelfApproved: onlySelfApproved ? true : undefined,
        page,
        limit,
      });
      setLogs(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [apiBase, filterAction, onlySelfApproved, page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const getActionBadge = (action: string, isSelfApproved?: boolean) => {
    if (isSelfApproved) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
          <AlertCircle className="size-3 text-amber-700" /> [TỰ DUYỆT] Quản lý tự duyệt
        </span>
      );
    }
    switch (action) {
      case 'CLOSE_PERIOD':
        return <Badge className="bg-blue-600 text-white">Chốt kỳ công</Badge>;
      case 'REOPEN_PERIOD':
        return <Badge className="bg-purple-600 text-white">Mở lại kỳ công</Badge>;
      case 'PAYROLL_CALCULATE':
        return <Badge className="bg-emerald-600 text-white">Tính bảng lương</Badge>;
      case 'PAYROLL_RELEASE':
        return <Badge className="bg-green-700 text-white">Phát hành phiếu lương</Badge>;
      case 'ATTENDANCE_RESOLUTION':
        return <Badge className="bg-rose-600 text-white">Xử lý vắng / Mất công</Badge>;
      case 'REQUEST_EXPLANATION':
        return <Badge className="bg-indigo-600 text-white">Yêu cầu giải trình</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="size-7 text-blue-600" />
            Nhật ký Kiểm toán Hệ thống (Audit Log)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ghi vết toàn bộ hành vi nhạy cảm của người dùng và quản lý: tự duyệt đơn, chốt kỳ công, tính lương và sửa đổi chính sách.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Filter className="size-3.5" /> Bộ lọc:
          </div>
          <select
            className="h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả hành động</option>
            <option value="SELF_APPROVED">Quản lý tự duyệt (Self-approved)</option>
            <option value="CLOSE_PERIOD">Chốt kỳ công</option>
            <option value="REOPEN_PERIOD">Mở lại kỳ công</option>
            <option value="PAYROLL_CALCULATE">Tính bảng lương</option>
            <option value="PAYROLL_RELEASE">Phát hành phiếu lương</option>
            <option value="REQUEST_EXPLANATION">Yêu cầu giải trình</option>
            <option value="ATTENDANCE_RESOLUTION">Xử lý vắng không phép</option>
          </select>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
            <input
              type="checkbox"
              className="rounded border-input text-blue-600 focus:ring-blue-500 size-4"
              checked={onlySelfApproved}
              onChange={(e) => {
                setOnlySelfApproved(e.target.checked);
                setPage(1);
              }}
            />
            Chỉ xem đơn Quản lý tự duyệt [TỰ DUYỆT]
          </label>
        </div>

        <div className="text-xs text-muted-foreground font-medium">
          Tổng cộng: <strong className="text-foreground">{total}</strong> sự kiện kiểm toán
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle className="size-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-[11px] uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Vai trò</th>
                <th className="py-3 px-4">Hành động kiểm toán</th>
                <th className="py-3 px-4">Đối tượng tác động</th>
                <th className="py-3 px-4">Ghi chú / Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Đang tải nhật ký kiểm toán…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <FileText className="size-8 text-slate-300 mx-auto mb-2" />
                    Chưa có nhật ký kiểm toán nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatInstantDateTimeVN(item.occurredAt)}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3.5 text-slate-400" />
                        {item.actorNameSnapshot || 'Hệ thống'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {item.actorRoleSnapshot || 'SYSTEM'}
                    </td>
                    <td className="py-3 px-4">
                      {getActionBadge(item.action, item.isSelfApproved)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                      {item.targetSummary || item.targetType || '—'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-muted-foreground" title={item.reason || ''}>
                      {item.reason || item.details?.note || (item.isSelfApproved ? 'Quản lý tự duyệt yêu cầu của mình' : '—')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <span className="text-xs text-muted-foreground">
              Trang {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

