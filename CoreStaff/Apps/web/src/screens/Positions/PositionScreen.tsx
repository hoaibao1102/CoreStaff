import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Eye, MoreHorizontal, Pencil, Plus, Power, PowerOff, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/dropdown-menu';
import type { AuthUser } from '@/services/auth';
import { getPositions, hrErrorMessage, type Position } from '@/services/hrService';
import { PositionCreateDialog } from './PositionCreateDialog';
import { PositionDetailSheet } from './PositionDetailSheet';
import { PositionEditDialog } from './PositionEditDialog';
import { PositionDeactivateDialog } from './PositionDeactivateDialog';
import { PositionActivateDialog } from './PositionActivateDialog';

type PositionStatusFilter = 'active' | 'inactive';

function PositionStatus({ active }: { active: boolean }) {
  return <Badge variant="secondary" className={active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}>
    {active ? 'Đang hoạt động' : 'Ngưng hoạt động'}
  </Badge>;
}

function formatUpdatedAt(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

interface PositionActionsProps {
  position: Position;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
}

function PositionActions({ position, canManage, onView, onEdit, onDeactivate, onActivate }: PositionActionsProps) {
  return <DropdownMenu>
    <DropdownMenuTrigger
      render={<Button variant="ghost" size="icon" className="min-h-11 min-w-11" />}
      aria-label={`Mở thao tác cho chức vụ ${position.name}`}
    >
      <MoreHorizontal aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem className="min-h-10 px-3" onClick={onView}><Eye aria-hidden="true" />Xem chi tiết</DropdownMenuItem>
      {canManage && <DropdownMenuItem className="min-h-10 px-3" onClick={onEdit}><Pencil aria-hidden="true" />Chỉnh sửa</DropdownMenuItem>}
      {canManage && position.active && <DropdownMenuItem variant="destructive" className="min-h-10 px-3" onClick={onDeactivate}><PowerOff aria-hidden="true" />Ngưng hoạt động</DropdownMenuItem>}
      {canManage && !position.active && <DropdownMenuItem className="min-h-10 px-3 text-primary" onClick={onActivate}><Power aria-hidden="true" />Kích hoạt lại</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function PositionScreen({ user, apiBase }: { user: AuthUser; apiBase: string | null }) {
  if (!user.organizationId) return <Alert><AlertDescription>Bạn cần thuộc một tổ chức để xem danh sách chức vụ.</AlertDescription></Alert>;
  if (!apiBase) return <Alert><AlertDescription>Chưa kết nối được API. Vui lòng tải lại trang.</AlertDescription></Alert>;
  return <PositionList key={`${apiBase}:${user.organizationId}`} apiBase={apiBase} canCreate={user.role === 'HR'} />;
}

function PositionList({ apiBase, canCreate }: { apiBase: string; canCreate: boolean }) {
  const [rows, setRows] = useState<Position[]>([]);
  const [status, setStatus] = useState<PositionStatusFilter>('active');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [activateId, setActivateId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getPositions(apiBase, status === 'active')
      .then(data => { if (!cancelled) setRows(data); })
      .catch(err => { if (!cancelled) setError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, status, revision]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('vi');
    return term ? rows.filter(row => `${row.code} ${row.name}`.toLocaleLowerCase('vi').includes(term)) : rows;
  }, [query, rows]);

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div><h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Quản lý chức vụ</h1><p className="mt-2 text-sm text-muted-foreground">Tra cứu chức vụ và trạng thái hoạt động trong tổ chức.</p></div>
      {canCreate && <Button className="min-h-11" onClick={() => setCreateOpen(true)}><Plus aria-hidden="true" />Thêm chức vụ</Button>}
    </div>

    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:p-6">
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="position-search" className="text-sm font-medium">Tìm kiếm chức vụ</label>
          <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input id="position-search" className="min-h-11 pl-9" placeholder="Tìm theo mã hoặc tên chức vụ…" value={query} onChange={event => setQuery(event.target.value)} /></div>
        </div>
        <div className="space-y-2 sm:w-52">
          <label htmlFor="position-status" className="text-sm font-medium">Trạng thái</label>
          <select id="position-status" value={status} onChange={event => setStatus(event.target.value as PositionStatusFilter)} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <option value="active">Đang hoạt động</option><option value="inactive">Ngưng hoạt động</option>
          </select>
        </div>
        <Button variant="outline" className="min-h-11" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw aria-hidden="true" />Làm mới</Button>
      </div>

      {error ? <div className="p-4 sm:p-6"><Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-4"><span>{error}</span><Button variant="outline" className="min-h-11" onClick={() => setRevision(value => value + 1)}>Thử lại</Button></AlertDescription></Alert></div>
        : loading ? <div className="space-y-4 p-4 sm:p-6" role="status" aria-label="Đang tải danh sách chức vụ"><span className="sr-only">Đang tải danh sách chức vụ…</span>{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
        : filteredRows.length === 0 ? <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="status"><BriefcaseBusiness className="size-10 text-muted-foreground" aria-hidden="true" /><h2 className="text-lg font-semibold">Chưa có chức vụ nào.</h2>{query && <p className="max-w-md text-sm text-muted-foreground">Không tìm thấy chức vụ phù hợp với từ khóa đang nhập.</p>}</div>
        : <Table aria-label="Danh sách chức vụ" className="min-w-[720px]"><TableHeader><TableRow><TableHead className="pl-6">Mã chức vụ</TableHead><TableHead>Tên chức vụ</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ngày cập nhật</TableHead><TableHead className="pr-6 text-right">Thao tác</TableHead></TableRow></TableHeader><TableBody>{filteredRows.map(row => <TableRow key={row._id}><TableCell className="pl-6 font-medium">{row.code}</TableCell><TableCell className="min-w-48 max-w-sm whitespace-normal break-words">{row.name}</TableCell><TableCell><PositionStatus active={row.active} /></TableCell><TableCell className="text-muted-foreground">{formatUpdatedAt(row.updatedAt)}</TableCell><TableCell className="pr-6 text-right"><div className="flex justify-end"><PositionActions position={row} canManage={canCreate} onView={() => setDetailId(row._id)} onEdit={() => setEditId(row._id)} onDeactivate={() => setDeactivateId(row._id)} onActivate={() => setActivateId(row._id)} /></div></TableCell></TableRow>)}</TableBody></Table>}
    </div>
    <PositionCreateDialog apiBase={apiBase} open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => setRevision(value => value + 1)} />
    {detailId && <PositionDetailSheet apiBase={apiBase} positionId={detailId} onClose={() => setDetailId(null)} />}
    {editId && <PositionEditDialog apiBase={apiBase} positionId={editId} onClose={() => setEditId(null)} onUpdated={() => setRevision(value => value + 1)} />}
    {deactivateId && <PositionDeactivateDialog apiBase={apiBase} positionId={deactivateId} onClose={() => setDeactivateId(null)} onDeactivated={() => setRevision(value => value + 1)} />}
    {activateId && <PositionActivateDialog apiBase={apiBase} positionId={activateId} onClose={() => setActivateId(null)} onActivated={() => setRevision(value => value + 1)} />}
  </div>;
}
