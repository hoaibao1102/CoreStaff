import { useHrResource } from '../../lib/useHrResource';
import { listEmployees, paginateEmployees, hrErrorMessage } from '../../services/hrService';
import { useState, useCallback } from 'react';
import {
  Search,
  Users,
  UserCheck,
  UserRound,
  Building2,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { navigationEvent } from '../../components/AppLink';
import { Card, CardContent } from '../../components/card';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { Skeleton } from '../../components/skeleton';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { AppLink } from '../../components/AppLink';
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUS_BADGE,
} from '../../lib/types';
import {
  getDepartments,
  type EmployeeProfile,
  type Department,
} from '../../services/hrService';

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
  departments: Department[];
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
              {departments.map((dept) => (
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

/* ───────── Table ───────── */
interface TableProps {
  rows: EmployeeProfile[];
  total: number;
  current: number;
  pages: number;
  onNavigate: (page: number) => void;
  onViewDetail: (id: string) => void;
}

function EmployeeTable({ rows, total, current, pages, onNavigate, onViewDetail }: TableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <p className="text-sm text-muted-foreground">{total} nhân viên</p>
          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={current <= 1}
                aria-label="Trang trước"
                onClick={() => onNavigate(current - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[3rem] text-center text-sm text-muted-foreground">
                {current} / {pages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={current >= pages}
                aria-label="Trang sau"
                onClick={() => onNavigate(current + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table aria-label="Danh bạ nhân viên" className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b bg-muted/30">
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-4">
                  Mã NV
                </th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">
                  Họ tên
                </th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden md:table-cell">
                  Email
                </th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">
                  Phòng ban
                </th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">
                  Chức danh
                </th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">
                  Trạng thái
                </th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Không tìm thấy nhân viên phù hợp.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row._id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.employeeCode}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.fullName || 'Chưa có thông tin'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {row.email || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {row.departmentName || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {row.positionName || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${(EMPLOYMENT_STATUS_BADGE as Record<string, string>)[row.employmentStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                        {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[row.employmentStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetail(row._id)}
                        aria-label={`Xem hồ sơ ${row.fullName || row.employeeCode}`}
                        title="Xem chi tiết"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
}: {
  user: AuthUser;
  apiBase: string | null;
}) {
  const allowed = user.role === 'HR' && !!user.organizationId;
  const [query, setQuery] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const loader = useCallback(async () => {
    const [rows, departments] = await Promise.all([
      listEmployees(apiBase!, status, departmentId), getDepartments(apiBase!)
    ]);
    return { rows: rows.filter(row => row.organizationId === user.organizationId), departments };
  }, [apiBase, status, departmentId, user.organizationId, user._id, user.id]);
  const resource = useHrResource(allowed && apiBase ? loader : null);
  const loading = resource.loading;
  const error = resource.error ? hrErrorMessage(resource.error) : null;
  const loadEmployees = resource.retry;
  const employees = resource.data?.rows ?? [];
  const departments = resource.data?.departments ?? [];
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

  /* Error state */
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
              Quản lý nhân sự
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Danh bạ nhân viên
            </h1>
          </div>
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
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
            Quản lý nhân sự
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Danh bạ nhân viên
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tra cứu hồ sơ và thông tin công việc của nhân viên trong tổ chức.
          </p>
        </div>
        <AppLink href="/" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline sm:mt-0">
          <ChevronLeft className="h-4 w-4" />
          Tổng quan
        </AppLink>
      </div>

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
    </div>
  );
}
