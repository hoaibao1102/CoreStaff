import { useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import type { AuthUser } from '@/services/auth';
import { getTimesheetPeriods, hrErrorMessage, type TimesheetPeriod, type TimesheetPeriodStatus } from '@/services/hrService';
import { TimesheetReviewScreen } from '../timesheet/TimesheetReviewScreen';
import { CreatePeriodDialog } from './CreatePeriodDialog';
import { ReopenPeriodDialog } from './ReopenPeriodDialog';
import { toast } from '@/components/toast';

const STATUS_FILTERS: { value: TimesheetPeriodStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'OPEN', label: 'Đang mở' },
  { value: 'REVIEWING', label: 'Đang rà soát' },
  { value: 'READY_TO_CLOSE', label: 'Sẵn sàng chốt' },
  { value: 'CLOSED', label: 'Đã chốt' },
];

const STATUS_COLORS: Record<TimesheetPeriodStatus, string> = {
  OPEN: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  REVIEWING: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  READY_TO_CLOSE: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  CLOSED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export function TimesheetPeriodScreen({ user, apiBase }: { user: AuthUser; apiBase: string | null }) {
  if (!user.organizationId) return <Alert><AlertDescription>Bạn cần thuộc một tổ chức để xem kỳ công.</AlertDescription></Alert>;
  if (!apiBase) return <Alert><AlertDescription>Chưa kết nối được API. Vui lòng tải lại trang.</AlertDescription></Alert>;
  const canManage = user.role === 'HR' || user.role === 'SYSTEM_ADMIN' || user.role === 'DEPARTMENT_MANAGER';
  return <TimesheetPeriodList key={`${apiBase}:${user.organizationId}:${user.role}`} apiBase={apiBase} organizationId={user.organizationId} canManage={canManage} user={user} />;
}

function TimesheetPeriodList({ apiBase, organizationId, canManage, user }: { apiBase: string; organizationId: string; canManage: boolean; user: AuthUser }) {
  const [rows, setRows] = useState<TimesheetPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [createPanel, setCreatePanel] = useState(false);
  const [reopenPanel, setReopenPanel] = useState<{ id: string } | null>(null);
  const [reviewPeriodId, setReviewPeriodId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTimesheetPeriods(apiBase, filter === 'all' ? undefined : filter as TimesheetPeriodStatus)
      .then(data => {
        if (!cancelled) setRows(data.filter(row => row.organizationId === organizationId));
      })
      .catch(err => { if (!cancelled) setError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, organizationId, filter, revision]);

  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = rows.filter(row => row.period.toLocaleLowerCase('vi').includes(term));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * 10, current * 10);
  const resetFilters = () => { setQuery(''); setFilter('all'); setPage(1); };

  const handleCreated = () => {
    setCreatePanel(false);
    setRevision(r => r + 1);
    toast.success('Tạo kỳ công thành công!');
  };

  const handleReopened = () => {
    setReopenPanel(null);
    setRevision(r => r + 1);
    toast.success('Mở lại kỳ công thành công!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Kỳ công</h1>
          <p className="mt-2 text-sm text-muted-foreground">{canManage ? 'Quản lý kỳ công và trạng thái chốt tháng của tổ chức.' : 'Tra cứu kỳ công trong tổ chức của bạn.'}</p>
        </div>
        {canManage && <Button className="min-h-11" onClick={() => setCreatePanel(true)}><Plus aria-hidden="true" />Tạo kỳ công</Button>}
      </div>

      <div className="min-w-0 rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:p-6">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="period-search" className="text-sm font-medium">Tìm kỳ công</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input id="period-search" className="min-h-11 pl-9" placeholder="Tìm theo tháng/năm…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="space-y-2 sm:w-52">
            <label htmlFor="period-status" className="text-sm font-medium">Trạng thái</label>
            <select id="period-status" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" className="min-h-11" onClick={resetFilters}><RefreshCw className="size-4" /></Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tháng/Năm</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Ngày bắt đầu</TableHead>
              <TableHead>Ngày kết thúc</TableHead>
              {canManage && <TableHead>Hành động</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex justify-center py-8"><RefreshCw className="size-6 animate-spin text-muted-foreground" /></div>
                </TableCell>
              </TableRow>
            )}
            {!loading && error && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                </TableCell>
              </TableRow>
            )}
            {!loading && !error && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Không tìm thấy kỳ công nào.</TableCell>
              </TableRow>
            )}
            {!loading && visible.map(row => (
              <TableRow key={row._id}>
                <TableCell className="font-medium">{row.period}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status]}`}>
                    {row.status === 'OPEN' && 'Đang mở'}
                    {row.status === 'REVIEWING' && 'Đang rà soát'}
                    {row.status === 'READY_TO_CLOSE' && 'Sẵn sàng chốt'}
                    {row.status === 'CLOSED' && 'Đã chốt'}
                  </span>
                </TableCell>
                <TableCell>v{row.version}</TableCell>
                <TableCell>{new Date(row.startDate).toLocaleDateString('vi-VN')}</TableCell>
                <TableCell>{new Date(row.endDate).toLocaleDateString('vi-VN')}</TableCell>
                {canManage && (
                  <TableCell>
                    {(row.status === 'OPEN' || row.status === 'REVIEWING') && (user.role === 'HR' || user.role === 'DEPARTMENT_MANAGER') && (
                      <Button variant="outline" size="sm" onClick={() => setReviewPeriodId(row._id)}>
                        {user.role === 'DEPARTMENT_MANAGER' ? 'Đóng snapshot' : 'Rà soát'}
                      </Button>
                    )}
                    {row.status === 'READY_TO_CLOSE' && (user.role === 'HR' || user.role === 'DEPARTMENT_MANAGER') && (
                      <Button variant="outline" size="sm" onClick={() => setReviewPeriodId(row._id)}>
                        {user.role === 'DEPARTMENT_MANAGER' ? 'Xem snapshot' : 'Rà soát'}
                      </Button>
                    )}
                    {row.status === 'CLOSED' && user.role === 'HR' && (
                      <Button variant="ghost" size="sm" onClick={() => setReopenPanel({ id: row._id })}>
                        Mở lại
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Trước</Button>
              <span className="text-sm text-muted-foreground">Trang {page}/{pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>Sau</Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Hiển thị {(current - 1) * 10 + 1} đến {Math.min(current * 10, filtered.length)} của {filtered.length} kết quả
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-muted-foreground">Trang {page}/{pages}</span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {createPanel && (
        <CreatePeriodDialog
          open={createPanel}
          onClose={() => setCreatePanel(false)}
          onCreated={handleCreated}
          apiBase={apiBase}
          organizationId={organizationId}
        />
      )}

      {reopenPanel && (
        <ReopenPeriodDialog
          open={!!reopenPanel}
          periodId={reopenPanel.id}
          onClose={() => setReopenPanel(null)}
          onReopened={handleReopened}
          apiBase={apiBase}
        />
      )}

      {reviewPeriodId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 p-4">
          <div className="mx-auto max-w-5xl rounded-xl border bg-card p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Rà soát kỳ công</h2>
              <Button variant="outline" size="sm" onClick={() => { setReviewPeriodId(null); setRevision(r => r + 1); }}>
                Đóng
              </Button>
            </div>
            <TimesheetReviewScreen organizationId={organizationId} userRole={user.role} periodId={reviewPeriodId} />
          </div>
        </div>
      )}
    </div>
  );
}
