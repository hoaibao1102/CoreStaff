import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, Eye, MoreHorizontal, Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/dropdown-menu';
import type { AuthUser } from '@/services/auth';
import { getAssignments, type Assignment } from '@/services/assignment.service';
import { getDepartments, getWorkplaces, listEmployees, type Department, type EmployeeProfile, type Workplace } from '@/services/hrService';
import { AssignmentCreateDialog } from './AssignmentCreateDialog';
import { AssignmentDetailDialog } from './AssignmentDetailDialog';
import { AssignmentEditDialog } from './AssignmentEditDialog';
import { AssignmentActivateDialog } from './AssignmentActivateDialog';
import { AssignmentDeactivateDialog } from './AssignmentDeactivateDialog';

type StatusFilter = 'active' | 'inactive';
const PAGE_SIZE = 10;

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Chưa cập nhật'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
}

function AssignmentStatus({ active }: { active: boolean }) {
  return <Badge variant="secondary" className={active
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}>
    {active ? 'Đang hoạt động' : 'Ngưng hoạt động'}
  </Badge>;
}

export function AssignmentScreen({ user, apiBase }: { user: AuthUser; apiBase: string | null }) {
  if (!user.organizationId) return <Alert><AlertDescription>Bạn cần thuộc một tổ chức để xem danh sách phân công.</AlertDescription></Alert>;
  if (!apiBase) return <Alert><AlertDescription>Chưa kết nối được API. Vui lòng tải lại trang.</AlertDescription></Alert>;
  return <AssignmentList key={`${apiBase}:${user.organizationId}`} apiBase={apiBase} />;
}

function AssignmentList({ apiBase }: { apiBase: string }) {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [status, setStatus] = useState<StatusFilter>('active');
  const [workplaceId, setWorkplaceId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailRevision, setDetailRevision] = useState(0);
  const [activateId, setActivateId] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void Promise.all([
      getAssignments(apiBase, { active: status === 'active', ...(workplaceId ? { workplaceId } : {}) }),
      listEmployees(apiBase, '', ''),
      getDepartments(apiBase),
      getWorkplaces(apiBase),
    ]).then(([assignmentRows, employeeRows, departmentRows, workplaceRows]) => {
      if (cancelled) return;
      setRows(assignmentRows);
      setEmployees(employeeRows);
      setDepartments(departmentRows);
      setWorkplaces(workplaceRows);
    }).catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, revision, status, workplaceId]);

  const employeeNames = useMemo(() => new Map(employees.map(item => [item.userId, item.fullName || item.employeeCode])), [employees]);
  const departmentNames = useMemo(() => new Map(departments.map(item => [item._id, item.name])), [departments]);
  const workplaceNames = useMemo(() => new Map(workplaces.map(item => [item._id, item.name])), [workplaces]);

  // Lấy danh sách userIds đã có phân công nơi làm việc (active + có workplaceId)
  const assignedUserIds = useMemo(
    () => rows.filter(row => row.active && row.workplaceId).map(row => row.userId),
    [rows],
  );

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const resetFilters = () => { setStatus('active'); setWorkplaceId(''); setPage(1); };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Quản lý phân công</h1>
        <p className="mt-2 text-sm text-muted-foreground">Quản lý phòng ban, nơi làm việc và thời gian phân công của nhân viên</p>
      </div>
      <Button className="min-h-11" onClick={() => setCreateOpen(true)}><Plus aria-hidden="true" />Tạo phân công</Button>
    </div>

    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:p-6">
        <div className="space-y-2 sm:w-56">
          <label htmlFor="assignment-status" className="text-sm font-medium">Trạng thái</label>
          <select id="assignment-status" value={status} onChange={event => { setStatus(event.target.value as StatusFilter); setPage(1); }} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <option value="active">Đang hoạt động</option><option value="inactive">Ngưng hoạt động</option>
          </select>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="assignment-workplace" className="text-sm font-medium">Nơi làm việc</label>
          <select id="assignment-workplace" value={workplaceId} onChange={event => { setWorkplaceId(event.target.value); setPage(1); }} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <option value="">Tất cả nơi làm việc</option>
            {workplaces.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
        </div>
        {(status !== 'active' || workplaceId) && <Button variant="outline" className="min-h-11" onClick={resetFilters}>Xóa bộ lọc</Button>}
      </div>

      {error ? <div className="p-4 sm:p-6"><Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-4"><span>Không thể tải danh sách phân công. Vui lòng thử lại.</span><Button variant="outline" className="min-h-11" onClick={() => setRevision(value => value + 1)}>Thử lại</Button></AlertDescription></Alert></div>
        : loading ? <div className="space-y-4 p-4 sm:p-6" role="status" aria-label="Đang tải danh sách phân công"><span className="sr-only">Đang tải danh sách phân công…</span>{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
          : rows.length === 0 ? <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="status"><ClipboardList className="size-10 text-muted-foreground" aria-hidden="true" /><h2 className="text-lg font-semibold">Chưa có phân công phù hợp.</h2></div>
            : <>
              <Table aria-label="Danh sách phân công" className="min-w-[980px]"><TableHeader><TableRow>
                <TableHead className="pl-6">Nhân viên</TableHead><TableHead>Phòng ban</TableHead><TableHead>Nơi làm việc</TableHead><TableHead>Ngày bắt đầu</TableHead><TableHead>Ngày kết thúc</TableHead><TableHead>Trạng thái</TableHead><TableHead className="w-20 pr-6 text-right">Thao tác</TableHead>
              </TableRow></TableHeader><TableBody>{visibleRows.map(row => <TableRow key={row._id}>
                <TableCell className="pl-6 font-medium">{employeeNames.get(row.userId) || 'Chưa có thông tin'}</TableCell>
                <TableCell>{departmentNames.get(row.departmentId) || 'Chưa có thông tin'}</TableCell>
                <TableCell>{row.workplaceId ? workplaceNames.get(row.workplaceId) || 'Chưa có thông tin' : 'Không áp dụng'}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(row.effectiveFrom)}</TableCell><TableCell className="text-muted-foreground">{formatDate(row.effectiveTo)}</TableCell>
                <TableCell><AssignmentStatus active={row.active} /></TableCell>
                <TableCell className="w-20 pr-6 text-right"><DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="min-h-11 min-w-11" />} aria-label={`Mở thao tác phân công của ${employeeNames.get(row.userId) || 'nhân viên'}`}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="min-h-10 px-3" onClick={() => setDetailId(row._id)}><Eye aria-hidden="true" />Xem chi tiết</DropdownMenuItem>
                    <DropdownMenuItem className="min-h-10 px-3" onClick={() => setEditId(row._id)}><Pencil aria-hidden="true" />Chỉnh sửa</DropdownMenuItem>
                    {!row.active && <DropdownMenuItem className="min-h-10 px-3 text-primary" onClick={() => setActivateId(row._id)}><Power aria-hidden="true" />Kích hoạt lại</DropdownMenuItem>}
                    {row.active && <DropdownMenuItem variant="destructive" className="min-h-10 px-3" onClick={() => setDeactivateId(row._id)}><PowerOff aria-hidden="true" />Ngưng hoạt động</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu></TableCell>
              </TableRow>)}</TableBody></Table>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-4 sm:px-6">
                <p className="text-sm text-muted-foreground" role="status">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, rows.length)} / {rows.length} phân công</p>
                <div className="flex items-center gap-2"><Button variant="outline" className="min-h-11 min-w-11" aria-label="Trang trước" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></Button><span className="text-sm">{currentPage} / {pages}</span><Button variant="outline" className="min-h-11 min-w-11" aria-label="Trang sau" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></Button></div>
              </div>
            </>}
    </div>
    <AssignmentCreateDialog
      apiBase={apiBase}
      open={createOpen}
      employees={employees}
      departments={departments}
      workplaces={workplaces}
      assignedUserIds={assignedUserIds}
      onClose={() => setCreateOpen(false)}
      onCreated={() => { setPage(1); setRevision(value => value + 1); }}
    />
    {detailId && <AssignmentDetailDialog
      apiBase={apiBase}
      assignmentId={detailId}
      employees={employees}
      departments={departments}
      workplaces={workplaces}
      refreshKey={detailRevision}
      onClose={() => setDetailId(null)}
    />}
    {editId && <AssignmentEditDialog
      apiBase={apiBase}
      assignmentId={editId}
      employees={employees}
      departments={departments}
      workplaces={workplaces}
      onClose={() => setEditId(null)}
      onUpdated={() => { setPage(1); setRevision(value => value + 1); setDetailRevision(value => value + 1); }}
    />}
    {activateId && <AssignmentActivateDialog
      apiBase={apiBase}
      assignmentId={activateId}
      onClose={() => setActivateId(null)}
      onActivated={() => {
        setRows(current => current.map(row => row._id === activateId ? { ...row, active: true } : row));
        setRevision(value => value + 1);
        setDetailRevision(value => value + 1);
      }}
    />}
    {deactivateId && <AssignmentDeactivateDialog
      apiBase={apiBase}
      assignmentId={deactivateId}
      onClose={() => setDeactivateId(null)}
      onDeactivated={() => {
        setRows(current => current.map(row => row._id === deactivateId ? { ...row, active: false } : row));
        setRevision(value => value + 1);
        setDetailRevision(value => value + 1);
      }}
    />}
  </div>;
}
