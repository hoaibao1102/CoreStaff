import { useEffect, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import type { AuthUser } from '@/services/auth';
import { getDepartments, hrErrorMessage, type Department } from '@/services/hrService';
import { DepartmentPanel } from './DepartmentPanel';
import { toast } from '@/components/toast';

export function DepartmentStatus({ active }: { active: boolean }) {
  return <Badge variant="secondary" className={active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'text-muted-foreground'}>
    {active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
  </Badge>;
}

export function DepartmentScreen({ user, apiBase }: { user: AuthUser; apiBase: string | null }) {
  if (!user.organizationId) return <Alert><AlertDescription>Bạn cần thuộc một tổ chức để xem phòng ban.</AlertDescription></Alert>;
  if (!apiBase) return <Alert><AlertDescription>Chưa kết nối được API. Vui lòng tải lại trang.</AlertDescription></Alert>;
  const canManage = user.role === 'HR' || user.role === 'SYSTEM_ADMIN';
  return <DepartmentList key={`${apiBase}:${user.organizationId}:${user.role}`} apiBase={apiBase} organizationId={user.organizationId} canManage={canManage} />;
}

function DepartmentList({ apiBase, organizationId, canManage }: { apiBase: string; organizationId: string; canManage: boolean }) {
  const [rows, setRows] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [panel, setPanel] = useState<{ id?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getDepartments(apiBase, filter === 'all' ? undefined : filter === 'active')
      .then(data => {
        if (!cancelled) setRows(data.filter(row => row.organizationId === organizationId));
      })
      .catch(err => { if (!cancelled) setError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, organizationId, filter, revision]);

  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = rows.filter(row => `${row.code} ${row.name}`.toLocaleLowerCase('vi').includes(term));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * 10, current * 10);
  const resetFilters = () => { setQuery(''); setFilter('all'); setPage(1); };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Phòng ban</h1>
        <p className="mt-2 text-sm text-muted-foreground">{canManage ? 'Quản lý phòng ban và trạng thái hoạt động trong tổ chức.' : 'Tra cứu phòng ban trong tổ chức của bạn.'}</p>
      </div>
      {canManage && <Button className="min-h-11" onClick={() => setPanel({})}><Plus aria-hidden="true" />Tạo phòng ban</Button>}
    </div>

    <div className="min-w-0 rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:p-6">
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="department-search" className="text-sm font-medium">Tìm phòng ban</label>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input id="department-search" className="min-h-11 pl-9" placeholder="Tìm theo mã hoặc tên phòng ban…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="space-y-2 sm:w-52">
          <label htmlFor="department-status" className="text-sm font-medium">Trạng thái</label>
          <select id="department-status" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã vô hiệu hóa</option>
          </select>
        </div>
        <Button variant="outline" className="min-h-11" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw aria-hidden="true" />Làm mới</Button>
      </div>

      {error ? <div className="p-6"><Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-4"><span>{error}</span><Button variant="outline" className="min-h-11" onClick={() => setRevision(value => value + 1)}>Thử lại</Button></AlertDescription></Alert></div>
        : loading ? <div className="space-y-4 p-6" role="status" aria-label="Đang tải phòng ban"><span className="sr-only">Đang tải phòng ban…</span>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        : filtered.length === 0 ? <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="status">
          <Building2 className="size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">{query || filter !== 'all' ? 'Không tìm thấy phòng ban' : 'Chưa có phòng ban'}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{query || filter !== 'all' ? 'Thử tìm kiếm khác hoặc xóa bộ lọc để xem thêm kết quả.' : canManage ? 'Tạo phòng ban đầu tiên để tổ chức danh sách nhân sự.' : 'Phòng ban sẽ xuất hiện khi bộ phận nhân sự tạo mới.'}</p>
          {(query || filter !== 'all') && <Button variant="outline" className="min-h-11" onClick={resetFilters}>Xóa bộ lọc</Button>}
        </div>
        : <>
          <Table aria-label="Danh sách phòng ban">
            <TableHeader><TableRow><TableHead className="pl-6">Mã phòng ban</TableHead><TableHead>Tên phòng ban</TableHead><TableHead>Trạng thái</TableHead><TableHead className="pr-6 text-right">Thao tác</TableHead></TableRow></TableHeader>
            <TableBody>{visible.map(row => <TableRow key={row._id}>
              <TableCell className="pl-6 font-medium">{row.code}</TableCell>
              <TableCell className="min-w-48 max-w-sm whitespace-normal break-words">{row.name}</TableCell>
              <TableCell><DepartmentStatus active={row.active} /></TableCell>
              <TableCell className="pr-6 text-right"><Button variant="ghost" className="min-h-11 text-primary" aria-label={`Xem phòng ban ${row.name}`} onClick={() => setPanel({ id: row._id })}>Xem chi tiết<ChevronRight aria-hidden="true" /></Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-4 sm:px-6">
            <p className="text-sm text-muted-foreground" role="status">{(current - 1) * 10 + 1}–{Math.min(current * 10, filtered.length)} / {filtered.length} phòng ban</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="min-h-11 min-w-11" aria-label="Trang trước" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden="true" /></Button>
              <span className="text-sm">{current} / {pages}</span>
              <Button variant="outline" className="min-h-11 min-w-11" aria-label="Trang sau" disabled={current === pages} onClick={() => setPage(current + 1)}><ChevronRight aria-hidden="true" /></Button>
            </div>
          </div>
        </>}
    </div>
    {panel && <DepartmentPanel apiBase={apiBase} organizationId={organizationId} canManage={canManage} departmentId={panel.id} onClose={() => setPanel(null)} onSaved={message => {
      setPanel(null); toast.success(message); setRevision(value => value + 1);
    }} />}
  </div>;
}
