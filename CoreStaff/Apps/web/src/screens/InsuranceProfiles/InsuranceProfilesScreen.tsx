import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Plus, ShieldCheck, SlidersHorizontal, Users, X } from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { Badge } from '../../components/badge';
import { Button } from '../../components/button';
import { Card, CardContent } from '../../components/card';
import { Input } from '../../components/input';
import { Skeleton } from '../../components/skeleton';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { useHrResource } from '../../lib/useHrResource';
import { hrErrorMessage, listEmployees, listInsuranceProfiles, type InsuranceProfile } from '../../services/hrService';
import { InsuranceProfileCreateDialog, InsuranceProfileDetailDialog, type InsuranceEmployeeOption } from './components/InsuranceProfileDialogs';

const PAGE_SIZE = 10;

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
}

function isEffective(row: InsuranceProfile, now: Date): boolean {
  const from = new Date(row.effectiveFrom);
  const to = row.effectiveTo ? new Date(row.effectiveTo) : null;
  return from <= now && (!to || to > now);
}

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
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${ready ? 'text-foreground' : 'text-muted-foreground/50'}`}>
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

function LoadingRows() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-5 w-14 rounded-full hidden md:block" />
              <Skeleton className="h-5 w-14 rounded-full hidden md:block" />
              <Skeleton className="h-5 w-14 rounded-full hidden md:block" />
              <Skeleton className="h-4 w-24 rounded hidden lg:block" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── Main Screen ───────── */

export function InsuranceProfilesScreen({ user, apiBase }: { user: AuthUser; apiBase: string | null }) {
  const allowed = user.role === 'HR' && !!user.organizationId;
  const [query, setQuery] = useState('');
  const [participation, setParticipation] = useState<'all' | 'social' | 'health' | 'unemployment'>('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<InsuranceProfile | null>(null);

  const loader = useCallback(async () => {
    const [profiles, employees] = await Promise.all([
      listInsuranceProfiles(apiBase!),
      listEmployees(apiBase!, '', ''),
    ]);
    const tenantEmployees = employees.filter((row) => row.organizationId === user.organizationId);
    const byId = new Map(tenantEmployees.map((e) => [e._id, e]));
    return { profiles, employees: tenantEmployees, byId };
  }, [apiBase, user.organizationId]);

  const resource = useHrResource(allowed && apiBase ? loader : null);
  const loading = resource.loading;
  const error = resource.error ? hrErrorMessage(resource.error) : null;
  const profiles: InsuranceProfile[] = resource.data?.profiles ?? [];
  const employees: InsuranceEmployeeOption[] = resource.data?.employees ?? [];
  const byId = resource.data?.byId ?? new Map();

  const employeeLabel = (employeeId: string) => {
    const emp = byId.get(employeeId);
    return emp ? `${emp.employeeCode} — ${emp.fullName ?? 'Không rõ'}` : employeeId;
  };

  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = profiles.filter((p) => {
    if (participation === 'social' && !p.participatesSocialInsurance) return false;
    if (participation === 'health' && !p.participatesHealthInsurance) return false;
    if (participation === 'unemployment' && !p.participatesUnemploymentInsurance) return false;
    if (!term) return true;
    return employeeLabel(p.employeeId).toLocaleLowerCase('vi').includes(term);
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.max(1, Math.min(page, totalPages));
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const now = useMemo(() => new Date(), []);
  const effectiveCount = profiles.filter((p) => isEffective(p, now)).length;
  const coveredEmployees = new Set(profiles.map((p) => p.employeeId)).size;
  const fullyParticipating = profiles.filter((p) => p.participatesSocialInsurance && p.participatesHealthInsurance && p.participatesUnemploymentInsurance).length;

  if (!allowed) return <EmployeeDataState status="forbidden" />;
  if (!apiBase) return <EmployeeDataState status="unavailable" />;

  const clearFilters = () => { setQuery(''); setParticipation('all'); setPage(1); };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Hồ sơ tham gia bảo hiểm</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Cấu hình BHXH/BHYT/BHTN mà từng nhân viên tham gia theo từng giai đoạn hiệu lực.
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Hồ sơ tham gia bảo hiểm</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Cấu hình BHXH/BHYT/BHTN mà từng nhân viên tham gia theo từng giai đoạn hiệu lực. Trạng thái thử việc/loại hợp đồng không tự suy ra tham gia — HR cấu hình tường minh từng khoản.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Tạo hồ sơ
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng hồ sơ" value={total} icon={ShieldCheck} ready={!loading} />
        <StatCard label="Đang hiệu lực" value={effectiveCount} icon={ShieldCheck} ready={!loading} />
        <StatCard label="Nhân viên có hồ sơ" value={coveredEmployees} icon={Users} ready={!loading} />
        <StatCard label="Tham gia đủ 3 khoản" value={fullyParticipating} icon={ShieldCheck} ready={!loading} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">Bộ lọc</h2>
            </div>
            {(query || participation !== 'all') && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Xóa bộ lọc
              </Button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
            <div className="space-y-1.5">
              <label htmlFor="insprofile-search" className="text-xs font-medium text-muted-foreground">Tìm nhân viên</label>
              <Input id="insprofile-search" className="h-10" value={query} disabled={!loading && !profiles.length} placeholder="Mã NV hoặc họ tên" onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="insprofile-participation" className="text-xs font-medium text-muted-foreground">Tham gia</label>
              <select
                id="insprofile-participation"
                className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                value={participation}
                disabled={loading}
                onChange={(e) => { setParticipation(e.target.value as typeof participation); setPage(1); }}
              >
                <option value="all">Tất cả</option>
                <option value="social">Có tham gia BHXH</option>
                <option value="health">Có tham gia BHYT</option>
                <option value="unemployment">Có tham gia BHTN</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div role="status" aria-label="Đang tải hồ sơ bảo hiểm"><LoadingRows /></div>
      ) : total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{profiles.length === 0 ? 'Chưa có hồ sơ bảo hiểm nào.' : 'Không tìm thấy hồ sơ nào khớp với bộ lọc.'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden gap-0 py-0">
          <div className="overflow-x-auto">
            <table aria-label="Hồ sơ tham gia bảo hiểm" className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nhân viên</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">BHXH</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">BHYT</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">BHTN</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden md:table-cell">Hiệu lực</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden lg:table-cell">Phiên bản</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row._id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{employeeLabel(row.employeeId)}</td>
                    <td className="px-4 py-3 text-center">
                      <ParticipationDot on={row.participatesSocialInsurance} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ParticipationDot on={row.participatesHealthInsurance} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ParticipationDot on={row.participatesUnemploymentInsurance} />
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.effectiveFrom)} → {row.effectiveTo ? formatDate(row.effectiveTo) : 'Hiện tại'}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <Badge variant="outline" className="font-mono text-xs">v{row.version}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedProfile(row)}
                        aria-label={`Xem hồ sơ bảo hiểm ${employeeLabel(row.employeeId)}`}
                        title="Xem chi tiết"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-4 sm:px-6">
            <p className="text-sm text-muted-foreground" role="status">{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, total)} / {total} hồ sơ</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="min-h-11 min-w-11" aria-label="Trang trước" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden="true" /></Button>
              <span className="text-sm">{current} / {totalPages}</span>
              <Button variant="outline" className="min-h-11 min-w-11" aria-label="Trang sau" disabled={current === totalPages} onClick={() => setPage(current + 1)}><ChevronRight aria-hidden="true" /></Button>
            </div>
          </div>
        </Card>
      )}

      {apiBase && (
        <>
          <InsuranceProfileCreateDialog
            apiBase={apiBase}
            open={createOpen}
            employees={employees}
            onOpenChange={setCreateOpen}
            onCreated={resource.retry}
          />
          <InsuranceProfileDetailDialog
            profile={selectedProfile}
            employeeLabel={selectedProfile ? employeeLabel(selectedProfile.employeeId) : undefined}
            open={selectedProfile !== null}
            onClose={() => setSelectedProfile(null)}
          />
        </>
      )}
    </div>
  );
}

function ParticipationDot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex h-2.5 w-2.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
      aria-label={on ? 'Có tham gia' : 'Không tham gia'}
      title={on ? 'Có tham gia' : 'Không tham gia'}
    />
  );
}
