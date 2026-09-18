import { useState, useCallback } from 'react';
import { FileText, Plus, AlarmClock, ShieldAlert, SlidersHorizontal, X } from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { navigationEvent } from '../../components/AppLink';
import { Card, CardContent } from '../../components/card';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { Skeleton } from '../../components/skeleton';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { CONTRACT_STATUS_LABELS, CONTRACT_FINDING_LABELS } from '../../lib/types';
import { hrErrorMessage, type EmploymentContract, type ContractFinding } from '../../services/hrService';
import { useHrResource } from '../../lib/useHrResource';
import { ContractTable } from './components/ContractTable';
import { ContractCreateDialog, ContractDetailDialog, type ContractEmployee } from './components/ContractDialogs';

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
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${ready ? 'text-foreground' : 'text-muted-foreground/50'}`} aria-label={ready ? undefined : 'Chưa có dữ liệu'}>
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
              <Skeleton className="h-4 w-24 rounded hidden md:block" />
              <Skeleton className="h-4 w-24 rounded hidden lg:block" />
              <Skeleton className="h-4 w-24 rounded hidden lg:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_OPTIONS: [string, string][] = Object.entries(CONTRACT_STATUS_LABELS);

/* ───────── Main Screen ───────── */
export function ContractsScreen({
  user,
  apiBase,
  contractId,
}: {
  user: AuthUser;
  apiBase: string | null;
  contractId?: string;
}) {
  const allowed = user.role === 'HR' && !!user.organizationId;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const loader = useCallback(async () => {
    const [contracts, employees, compliance] = await Promise.all([
      import('../../services/hrService').then((m) => m.listContracts(apiBase!, { status })),
      import('../../services/hrService').then((m) => m.listEmployees(apiBase!, '', '')),
      import('../../services/hrService').then((m) => m.getContractCompliance(apiBase!).catch(() => ({ findings: [], counts: {} }))),
    ]);
    const tenantEmployees = employees.filter((row) => row.organizationId === user.organizationId);
    // Employee → {code, name} for the table and the create dialog picker.
    const profileById = new Map(tenantEmployees.map((e) => [e._id, e]));
    const enriched = contracts.map((c) => {
      const owner = c.employeeProfileId ? profileById.get(c.employeeProfileId) : undefined;
      return {
        ...c,
        employeeCode: c.employeeCode ?? owner?.employeeCode ?? null,
        employeeFullName: c.employeeFullName ?? (owner ? owner.fullName ?? owner.employeeCode : null),
      };
    });
    return { contracts: enriched, employees: tenantEmployees, compliance };
  }, [apiBase, status, user.organizationId]);

  const resource = useHrResource(allowed && apiBase ? loader : null);
  const loading = resource.loading;
  const error = resource.error ? hrErrorMessage(resource.error) : null;
  const contracts: EmploymentContract[] = resource.data?.contracts ?? [];
  const employees: ContractEmployee[] = resource.data?.employees ?? [];
  const findings: ContractFinding[] = resource.data?.compliance?.findings ?? [];

  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = contracts.filter((c) => !term || `${c.employeeCode ?? ''} ${c.employeeFullName ?? ''}`.toLocaleLowerCase('vi').includes(term));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const current = Math.max(1, Math.min(page, totalPages));
  const rows = filtered.slice((current - 1) * 10, current * 10);

  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
  const expiringSoon = contracts.filter((c) => c.isExpiringSoon).length;

  if (!allowed) return <EmployeeDataState status="forbidden" />;
  if (!apiBase) return <EmployeeDataState status="unavailable" />;

  const clearFilters = () => { setQuery(''); setStatus(''); setPage(1); };
  const handleViewDetail = (id: string) => {
    window.history.pushState(null, '', `/hr/contracts/${id}`);
    window.dispatchEvent(new Event(navigationEvent));
  };
  const handleCloseDetail = () => {
    window.history.replaceState(null, '', '/hr/contracts');
    window.dispatchEvent(new Event(navigationEvent));
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Hợp đồng lao động</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Quản lý hợp đồng, hiệu lực và ngày hết hạn của hợp đồng trong tổ chức.
          </p>
        </div>
        <EmployeeDataState status="error" message={error} onRetry={resource.retry} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Hợp đồng lao động</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Quản lý hợp đồng, hiệu lực và ngày hết hạn của hợp đồng trong tổ chức.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Tạo hợp đồng
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Kết quả" value={total} icon={FileText} ready={!loading} />
        <StatCard label="Đang hiệu lực" value={activeCount} icon={FileText} ready={!loading} />
        <StatCard label="Sắp hết hạn" value={expiringSoon} icon={AlarmClock} ready={!loading} />
        <StatCard label="Cần xử lý" value={findings.length} icon={ShieldAlert} ready={!loading} />
      </div>

      {findings.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">Cần HR xử lý</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Hệ thống chỉ cảnh báo, không tự đổi trạng thái nhân viên hay hợp đồng — hợp đồng hết hạn mà người lao động vẫn làm việc là trạng thái hợp pháp cần HR chủ động xử lý.
            </p>
            <ul className="divide-y">
              {findings.map((f) => (
                <li key={`${f.code}:${f.employeeProfileId}:${f.contractId ?? ''}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium text-foreground">
                    {f.employeeFullName || f.employeeCode || f.employeeProfileId}
                    {f.employeeCode && f.employeeFullName ? ` · ${f.employeeCode}` : ''}
                  </span>
                  <span className="text-muted-foreground">
                    {CONTRACT_FINDING_LABELS[f.code] ?? f.code}
                    {f.daysPastExpiry ? ` (${f.daysPastExpiry} ngày)` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">Bộ lọc</h2>
            </div>
            {(query || status) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Xóa bộ lọc
              </Button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
            <div className="space-y-1.5">
              <label htmlFor="contract-search" className="text-xs font-medium text-muted-foreground">Tìm hợp đồng</label>
              <div className="relative">
                <Input id="contract-search" className="pl-9 h-10" value={query} disabled={!loading && !contracts.length} placeholder="Mã NV hoặc họ tên" onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="contract-status-filter" className="text-xs font-medium text-muted-foreground">Trạng thái</label>
              <select
                id="contract-status-filter"
                className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                value={status}
                disabled={loading}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              >
                <option value="">Tất cả trạng thái</option>
                {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? <div role="status" aria-label="Đang tải hợp đồng"><LoadingRows /></div> : <ContractTable rows={rows} total={total} current={current} pages={totalPages} onNavigate={setPage} onViewDetail={handleViewDetail} />}

      {apiBase && (
        <>
          <ContractCreateDialog
            apiBase={apiBase}
            open={createOpen}
            employees={employees}
            onOpenChange={setCreateOpen}
            onCreated={resource.retry}
          />
          {contractId && (
            <ContractDetailDialog
              apiBase={apiBase}
              contractId={contractId}
              onClose={handleCloseDetail}
              onChanged={resource.retry}
            />
          )}
        </>
      )}
    </div>
  );
}