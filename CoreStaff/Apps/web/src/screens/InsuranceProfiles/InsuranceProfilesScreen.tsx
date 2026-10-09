import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Plus, Search, ShieldCheck, Users, X } from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { Button } from '../../components/button';
import { Card, CardContent } from '../../components/card';
import { Input } from '../../components/input';
import { Skeleton } from '../../components/skeleton';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { useHrResource } from '../../lib/useHrResource';
import { hrErrorMessage, listEmployees, listInsuranceProfiles, listInsurancePolicies, type InsuranceProfile, type InsurancePolicy } from '../../services/hrService';
import { deriveInsuranceSalary, listSalaryProfiles, type SalaryProfile } from '../../services/compensation.service';
import { InsuranceProfileCreateDialog, InsuranceProfileDetailDialog, type InsuranceEmployeeOption } from './components/InsuranceProfileDialogs';

const PAGE_SIZE = 10;

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

const CONTRIBUTION_TYPES = ['SOCIAL_INSURANCE', 'HEALTH_INSURANCE', 'UNEMPLOYMENT_INSURANCE'] as const;
type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

const CONTRIBUTION_LABELS: Record<ContributionType, string> = {
  SOCIAL_INSURANCE: 'BHXH',
  HEALTH_INSURANCE: 'BHYT',
  UNEMPLOYMENT_INSURANCE: 'BHTN',
};

const PARTICIPATES_KEY: Record<ContributionType, keyof InsuranceProfile> = {
  SOCIAL_INSURANCE: 'participatesSocialInsurance',
  HEALTH_INSURANCE: 'participatesHealthInsurance',
  UNEMPLOYMENT_INSURANCE: 'participatesUnemploymentInsurance',
};

const EMPLOYEE_RATE_KEY: Record<ContributionType, keyof InsurancePolicy> = {
  SOCIAL_INSURANCE: 'socialInsuranceEmployeeRate',
  HEALTH_INSURANCE: 'healthInsuranceEmployeeRate',
  UNEMPLOYMENT_INSURANCE: 'unemploymentInsuranceEmployeeRate',
};

function formatPercent(rate: number): string {
  return `${(rate * 100).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
}

function isEffective(row: { effectiveFrom: string; effectiveTo?: string | null }, now: Date): boolean {
  const from = new Date(row.effectiveFrom);
  const to = row.effectiveTo ? new Date(row.effectiveTo) : null;
  return from <= now && (!to || to > now);
}

/** ROUND_HALF_UP_TO_VND (SRS §30D.1) — mirrors insurance-calculation.ts on the API side. */
function roundHalfUpToVnd(amount: number): number {
  return Math.floor(amount + 0.5);
}

function clampToBase(insuranceSalary: number, floorAmount?: number | null, capAmount?: number | null): number {
  let base = insuranceSalary;
  if (floorAmount != null) base = Math.max(base, floorAmount);
  if (capAmount != null) base = Math.min(base, capAmount);
  return base;
}

/**
 * Ước tính số tiền BHXH/BHYT/BHTN nhân viên đó phải đóng/tháng, theo đúng
 * participation của hồ sơ này + mức lương đóng bảo hiểm và chính sách ĐANG
 * hiệu lực hiện tại (không phải mức tại thời điểm effectiveFrom của hồ sơ) —
 * chỉ để HR xem nhanh, không phải số dùng để chốt lương (payroll tự tính lại
 * theo policy/salary hiệu lực tại kỳ lương thật). null khi chưa đủ dữ liệu
 * (chưa có SalaryProfile hoặc InsurancePolicy hiệu lực).
 */
function estimateMonthlyEmployeeContribution(
  profile: InsuranceProfile,
  salaryProfile: SalaryProfile | undefined,
  policy: InsurancePolicy | undefined,
): number | null {
  if (!salaryProfile || !policy) return null;
  const participates: Record<string, boolean> = {
    SOCIAL_INSURANCE: profile.participatesSocialInsurance,
    HEALTH_INSURANCE: profile.participatesHealthInsurance,
    UNEMPLOYMENT_INSURANCE: profile.participatesUnemploymentInsurance,
  };
  const employeeRate: Record<string, number> = {
    SOCIAL_INSURANCE: policy.socialInsuranceEmployeeRate,
    HEALTH_INSURANCE: policy.healthInsuranceEmployeeRate,
    UNEMPLOYMENT_INSURANCE: policy.unemploymentInsuranceEmployeeRate,
  };
  let total = 0;
  for (const type of CONTRIBUTION_TYPES) {
    if (!participates[type]) continue;
    const floorAmount = policy.salaryBaseRules.find((r) => r.type === type)?.floorAmount;
    const capAmount = policy.capRules.find((r) => r.type === type)?.capAmount;
    const base = clampToBase(deriveInsuranceSalary(salaryProfile.baseSalary, salaryProfile.allowances), floorAmount, capAmount);
    total += roundHalfUpToVnd(base * employeeRate[type]);
  }
  return total;
}

type TypeContribution = { kind: 'amount'; amount: number } | { kind: 'exempt' } | { kind: 'unknown' };

/** Same estimate as above, broken out per contribution type for the table (BHXH/BHYT/BHTN riêng cột). */
function estimateContributionForType(
  type: ContributionType,
  profile: InsuranceProfile,
  salaryProfile: SalaryProfile | undefined,
  policy: InsurancePolicy | undefined,
): TypeContribution {
  if (!profile[PARTICIPATES_KEY[type]]) return { kind: 'exempt' };
  if (!salaryProfile || !policy) return { kind: 'unknown' };
  const floorAmount = policy.salaryBaseRules.find((r) => r.type === type)?.floorAmount;
  const capAmount = policy.capRules.find((r) => r.type === type)?.capAmount;
  const base = clampToBase(deriveInsuranceSalary(salaryProfile.baseSalary, salaryProfile.allowances), floorAmount, capAmount);
  const rate = policy[EMPLOYEE_RATE_KEY[type]] as number;
  return { kind: 'amount', amount: roundHalfUpToVnd(base * rate) };
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
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
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
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<InsuranceProfile | null>(null);

  const loader = useCallback(async () => {
    const [profiles, employees, salaryProfiles, policies] = await Promise.all([
      listInsuranceProfiles(apiBase!),
      listEmployees(apiBase!, '', ''),
      listSalaryProfiles(apiBase!),
      listInsurancePolicies(apiBase!),
    ]);
    const tenantEmployees = employees.filter((row) => row.organizationId === user.organizationId);
    const byId = new Map(tenantEmployees.map((e) => [e._id, e]));
    return { profiles, employees: tenantEmployees, byId, salaryProfiles, policies };
  }, [apiBase, user.organizationId]);

  const resource = useHrResource(allowed && apiBase ? loader : null);
  const loading = resource.loading;
  const error = resource.error ? hrErrorMessage(resource.error) : null;
  const profiles: InsuranceProfile[] = resource.data?.profiles ?? [];
  const employees: InsuranceEmployeeOption[] = resource.data?.employees ?? [];
  const byId = resource.data?.byId ?? new Map();
  const salaryProfiles: SalaryProfile[] = resource.data?.salaryProfiles ?? [];
  const policies: InsurancePolicy[] = resource.data?.policies ?? [];

  const employeeLabel = (employeeId: string) => {
    const emp = byId.get(employeeId);
    return emp ? `${emp.employeeCode} — ${emp.fullName ?? 'Không rõ'}` : employeeId;
  };

  const now = useMemo(() => new Date(), []);
  const effectivePolicy = useMemo(() => policies.find((p) => isEffective(p, now)), [policies, now]);
  const effectiveSalaryByEmployee = useMemo(() => {
    const map = new Map<string, SalaryProfile>();
    for (const sp of salaryProfiles) {
      if (isEffective(sp, now)) map.set(sp.employeeProfileId, sp);
    }
    return map;
  }, [salaryProfiles, now]);

  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = profiles.filter((p) => {
    if (!term) return true;
    return employeeLabel(p.employeeId).toLocaleLowerCase('vi').includes(term);
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.max(1, Math.min(page, totalPages));
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const effectiveCount = profiles.filter((p) => isEffective(p, now)).length;
  const coveredEmployees = new Set(profiles.map((p) => p.employeeId)).size;
  const estimatedMonthlyTotal = profiles
    .filter((p) => isEffective(p, now))
    .reduce((sum, p) => sum + (estimateMonthlyEmployeeContribution(p, effectiveSalaryByEmployee.get(p.employeeId), effectivePolicy) ?? 0), 0);

  if (!allowed) return <EmployeeDataState status="forbidden" />;
  if (!apiBase) return <EmployeeDataState status="unavailable" />;

  const clearFilters = () => { setQuery(''); setPage(1); };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Hồ sơ tham gia bảo hiểm</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            BHXH/BHYT/BHTN là bắt buộc theo luật đối với nhân viên có hợp đồng lao động — hồ sơ ghi nhận giai đoạn hiệu lực tham gia.
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
            BHXH/BHYT/BHTN là bắt buộc theo luật đối với nhân viên có hợp đồng lao động, không phải lựa chọn của HR — hồ sơ dưới đây chỉ ghi nhận giai đoạn hiệu lực tham gia.
            Số tiền mỗi cột là ước tính theo lương đóng bảo hiểm và chính sách đang hiệu lực hiện tại, không phải số dùng để chốt lương thật.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Tạo hồ sơ
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Đang hiệu lực" value={effectiveCount} icon={ShieldCheck} ready={!loading} />
        <StatCard label="Nhân viên có hồ sơ" value={coveredEmployees} icon={Users} ready={!loading} />
        <StatCard label="Ước tính tổng đóng/tháng" value={VND.format(estimatedMonthlyTotal)} icon={ShieldCheck} ready={!loading} />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="insprofile-search"
            className="h-10 pl-9"
            value={query}
            disabled={!loading && !profiles.length}
            placeholder="Tìm mã NV hoặc họ tên…"
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
        </div>
        {query && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Xóa
          </Button>
        )}
      </div>

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
                  {CONTRIBUTION_TYPES.map((type) => (
                    <th key={type} className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {CONTRIBUTION_LABELS[type]}
                      <span className="ml-1 font-normal text-muted-foreground/70">
                        ({effectivePolicy ? formatPercent(effectivePolicy[EMPLOYEE_RATE_KEY[type]] as number) : '—'})
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden md:table-cell">Hiệu lực</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Tổng/tháng</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const salaryProfile = effectiveSalaryByEmployee.get(row.employeeId);
                  const totalAmount = estimateMonthlyEmployeeContribution(row, salaryProfile, effectivePolicy);
                  return (
                  <tr key={row._id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{employeeLabel(row.employeeId)}</td>
                    {CONTRIBUTION_TYPES.map((type) => {
                      const cell = estimateContributionForType(type, row, salaryProfile, effectivePolicy);
                      return (
                        <td key={type} className="px-4 py-3 text-right tabular-nums">
                          {cell.kind === 'amount' ? VND.format(cell.amount)
                            : cell.kind === 'exempt' ? <span className="text-xs text-amber-600 dark:text-amber-400">Miễn trừ</span>
                            : <span className="text-xs text-muted-foreground">Chưa xác định</span>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.effectiveFrom)} → {row.effectiveTo ? formatDate(row.effectiveTo) : 'Hiện tại'}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground hidden lg:table-cell">
                      {totalAmount != null ? VND.format(totalAmount) : <span className="text-xs text-muted-foreground">Chưa xác định</span>}
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
                  );
                })}
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
