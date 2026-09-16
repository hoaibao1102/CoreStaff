import { useState, useCallback } from 'react';
import {
  Search,
  Users,
  UserCheck,
  UserRound,
  Building2,
  SlidersHorizontal,
  X,
  Plus,
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { navigationEvent } from '../../components/AppLink';
import { Card, CardContent } from '../../components/card';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { Skeleton } from '../../components/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../../components/alert';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { EMPLOYMENT_STATUS_LABELS } from '../../lib/types';
import { hrErrorMessage, paginateEmployees } from '../../services/hrService';
import { useHrResource } from '../../lib/useHrResource';
import { EmployeeTable } from './components/EmployeeTable';
import { EmployeeCreateDialog } from './components/EmployeeCreateDialog';
import { EmployeeDetailDialog } from '@/screens/EmployeeDetail/EmployeeDetailDialog';

/* ───────── Stat Card ───────── */
interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean;
}

function StatCard({ label, value, icon: Icon, ready }: StatCardProps) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${ready ? 'text-foreground' : 'text-muted-foreground/50'}`}
            aria-label={ready ? undefined : 'Chưa có dữ liệu'}
          >
            {ready ? value : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── Filter Bar ───────── */
interface FilterBarProps {
  query: string;
  departmentId: string;
  status: string;
  departments: any[];
  ready: boolean;
  filtered: boolean;
  onQueryChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onClearFilters: () => void;
}

function FilterBar({
  query,
  departmentId,
  status,
  departments,
  ready,
  filtered,
  onQueryChange,
  onDepartmentChange,
  onStatusChange,
  onClearFilters,
}: FilterBarProps) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">Bộ lọc</h2>
          </div>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Xóa bộ lọc
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
          {/* Search */}
          <div className="space-y-1.5">
            <label htmlFor="emp-search" className="text-xs font-medium text-muted-foreground">
              Tìm nhân viên
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="emp-search"
                className="pl-9 h-10"
                value={query}
                disabled={!ready}
                placeholder="Họ tên hoặc mã nhân viên"
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </div>
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <label htmlFor="emp-dept" className="text-xs font-medium text-muted-foreground">
              Phòng ban
            </label>
            <select
              id="emp-dept"
              className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              disabled={!ready}
              value={departmentId}
              onChange={(e) => onDepartmentChange(e.target.value)}
            >
              <option value="">Tất cả phòng ban</option>
              {departments.map((dept: any) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label htmlFor="emp-status" className="text-xs font-medium text-muted-foreground">
              Trạng thái
            </label>
            <select
              id="emp-status"
              className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              disabled={!ready}
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── Loading Rows ───────── */
function LoadingRows() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-48 rounded hidden md:block" />
              <Skeleton className="h-4 w-24 rounded hidden lg:block" />
              <Skeleton className="h-4 w-20 rounded hidden lg:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── Main Screen ───────── */
export function EmployeeDirectoryScreen({
  user,
  apiBase,
  employeeId,
}: {
  user: AuthUser;
  apiBase: string | null;
  employeeId?: string;
}) {
  const allowed = user.role === 'HR' && !!user.organizationId;
  const [query, setQuery] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const loader = useCallback(async () => {
    const [employees, departments, positions] = await Promise.all([
      import('../../services/hrService').then(m => m.listEmployees(apiBase!, status, departmentId)),
      import('../../services/hrService').then(m => m.getDepartments(apiBase!, true)),
      import('../../services/hrService').then(m => m.getPositions(apiBase!, true)),
    ]);
    // Build lookup maps for client-side name resolution
    const deptMap = new Map(departments.map(d => [d._id, d.name]));
    const posMap = new Map(positions.map(p => [p._id, p.name]));
    // Enrich employees with resolved names
    const enriched = employees
      .filter(row => row.organizationId === user.organizationId)
      .map(row => ({
        ...row,
        departmentName: row.departmentId ? (deptMap.get(row.departmentId) ?? row.departmentName) : undefined,
        positionName: row.positionId ? (posMap.get(row.positionId) ?? row.positionName) : undefined,
      }));
    return { rows: enriched, departments, positions };
  }, [apiBase, status, departmentId, user.organizationId]);

  const resource = useHrResource(allowed && apiBase ? loader : null);
  const loading = resource.loading;
  const error = resource.error ? hrErrorMessage(resource.error) : null;
  const loadEmployees = resource.retry;
  const employees = resource.data?.rows ?? [];
  const departments = resource.data?.departments ?? [];
  const positions = resource.data?.positions ?? [];
  const result = paginateEmployees(employees, query, page);
  const total = result.total;
  const totalPages = result.totalPages;
  const filtered = !!(query || departmentId || status);

  if (!allowed) return <EmployeeDataState status="forbidden" />;
  if (!apiBase) return <EmployeeDataState status="unavailable" />;

  const clearFilters = () => {
    setQuery('');
    setDepartmentId('');
    setStatus('');
    setPage(1);
  };

  const handleViewDetail = (id: string) => {
    window.history.pushState(null, '', `/hr/employees/${id}`);
    window.dispatchEvent(new Event(navigationEvent));
  };

  const handleCloseDetail = () => {
    window.history.replaceState(null, '', '/hr/employees');
    window.dispatchEvent(new Event(navigationEvent));
  };

  /* Error state */
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Danh bạ nhân viên
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tra cứu hồ sơ và thông tin công việc của nhân viên trong tổ chức.
          </p>
        </div>
        <EmployeeDataState
          status="error"
          message={error}
          onRetry={loadEmployees}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Danh bạ nhân viên
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tra cứu hồ sơ và thông tin công việc của nhân viên trong tổ chức.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="min-h-11" onClick={() => { setNotice(''); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" />
            Tạo hồ sơ
          </Button>
        </div>
      </div>

      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Kết quả tìm kiếm" value={total} icon={Users} ready={!loading} />
        <StatCard
          label="Đang làm việc"
          value={employees.filter((e) => e.employmentStatus === 'ACTIVE').length}
          icon={UserCheck}
          ready={!loading}
        />
        <StatCard
          label="Thử việc"
          value={employees.filter((e) => e.employmentStatus === 'PROBATION').length}
          icon={UserRound}
          ready={!loading}
        />
        <StatCard label="Phòng ban" value={departments.length} icon={Building2} ready={!loading} />
      </div>

      {/* Filters */}
      <FilterBar
        query={query}
        departmentId={departmentId}
        status={status}
        departments={departments}
        ready={!loading}
        filtered={filtered}
        onQueryChange={(v) => { setQuery(v); setPage(1); }}
        onDepartmentChange={(v) => { setDepartmentId(v); setPage(1); }}
        onStatusChange={(v) => { setStatus(v); setPage(1); }}
        onClearFilters={clearFilters}
      />

      {/* Table or loading */}
      {loading ? <div role="status" aria-label="Đang tải danh bạ"><LoadingRows /></div> : <EmployeeTable rows={result.employees} total={total} current={result.page} pages={totalPages} onNavigate={setPage} onViewDetail={handleViewDetail} />}

      {apiBase && (
        <>
          <EmployeeCreateDialog
            apiBase={apiBase}
            open={createOpen}
            departments={departments}
            positions={positions}
            onOpenChange={setCreateOpen}
            onCreated={() => {
              setCreateOpen(false);
              setNotice('Đã tạo hồ sơ nhân sự. API đặt trạng thái ban đầu là thử việc.');
              loadEmployees();
            }}
          />
          {employeeId && (
            <EmployeeDetailDialog
              user={user}
              apiBase={apiBase}
              employeeId={employeeId}
              onClose={handleCloseDetail}
              onChanged={loadEmployees}
            />
          )}
        </>
      )}
    </div>
  );
}
