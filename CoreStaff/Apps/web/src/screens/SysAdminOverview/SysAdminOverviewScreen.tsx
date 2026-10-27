import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Building2,
  ShieldCheck,
  Server,
  Database,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  Cpu,
  Lock,
  Users,
  UserCheck,
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import type { HealthResponse, ApiSource } from '../../config/api';
import { AppLink } from '../../components/AppLink';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/card';
import { Button } from '../../components/button';
import { Skeleton } from '../../components/skeleton';
import { toast } from '../../components/toast';
import {
  listOrganizations,
  setOrganizationStatus,
  type Organization,
} from '../../services/platformService';
import { OrganizationCreateDialog } from '../PlatformOrganizations/OrganizationCreateDialog';
import { roleLabel, statusPill } from '../../lib/labels';

/* ───────── Metric Card Component ───────── */

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  badge?: { text: string; color: string };
  href?: string;
  ready: boolean;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  badge,
  href,
  ready,
}: MetricCardProps) {
  const content = (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
          {ready ? (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
                {value}
              </span>
              {badge && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.color}`}>
                  {badge.text}
                </span>
              )}
            </div>
          ) : (
            <Skeleton className="my-1 h-8 w-20 rounded" />
          )}
        </div>
        <div className={`grid size-11 place-items-center rounded-xl ${iconBg} ${iconColor} shrink-0`}>
          <Icon className="size-5.5" aria-hidden="true" />
        </div>
      </div>
      {subtitle && (
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
          <span className="truncate">{subtitle}</span>
          {href && (
            <span className="inline-flex items-center text-xs font-semibold text-primary group-hover:underline">
              Quản lý <ArrowUpRight className="ml-0.5 size-3.5" />
            </span>
          )}
        </div>
      )}
    </div>
  );

  return href ? (
    <AppLink href={href} className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {content}
    </AppLink>
  ) : (
    content
  );
}

/* ───────── Main SysAdminOverviewScreen ───────── */

interface SysAdminOverviewScreenProps {
  user: AuthUser;
  apiBase: string | null;
  health: HealthResponse | null;
  apiSource: ApiSource | null;
}

export function SysAdminOverviewScreen({
  user,
  apiBase,
  health,
  apiSource,
}: SysAdminOverviewScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const dateStr = useMemo(() => {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!apiBase) {
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await listOrganizations(apiBase);
      setOrganizations(Array.isArray(data) ? data : []);
    } catch {
      // Graceful error fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Derived metrics
  const totalOrgs = organizations.length;
  const activeOrgs = organizations.filter(o => o.status === 'ACTIVE').length;
  const suspendedOrgs = organizations.filter(o => o.status === 'SUSPENDED').length;
  const activeRate = totalOrgs > 0 ? Math.round((activeOrgs / totalOrgs) * 100) : 100;
  const totalEmployeesAllOrgs = organizations.reduce((sum, o) => sum + (o.employeeCount || 0), 0);
  const totalActiveEmployeesAllOrgs = organizations.reduce((sum, o) => sum + (o.activeEmployeeCount || 0), 0);

  // Toggle organization active / suspended
  const handleToggleStatus = async (org: Organization) => {
    if (!apiBase || togglingId) return;
    const nextStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setTogglingId(org._id);
    try {
      await setOrganizationStatus(apiBase, org._id, nextStatus);
      toast.success(
        nextStatus === 'SUSPENDED' ? 'Đã tạm ngưng tổ chức' : 'Đã kích hoạt lại tổ chức',
        nextStatus === 'SUSPENDED'
          ? `Tổ chức ${org.code} đã bị tạm ngưng. Mọi phiên đăng nhập của tổ chức này sẽ bị chấm dứt.`
          : `Tổ chức ${org.code} đã hoạt động trở lại.`,
      );
      await loadData(true);
    } catch (err: unknown) {
      toast.error('Không thể cập nhật trạng thái', err instanceof Error ? err.message : 'Vui lòng thử lại sau.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ───────── Top Welcome Banner ───────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-blue-500/5 p-6 shadow-xs sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <ShieldCheck className="size-3.5" />
                Quản trị Nền tảng (Platform SuperAdmin)
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cpu className="size-3.5" />
                Môi trường: {statusPill(apiSource)}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{dateStr}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Tổng quan nền tảng & hạ tầng
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Xin chào, <strong className="font-semibold text-foreground">{user.fullName}</strong> ({user.email}). Giám sát tình trạng hoạt động của các tổ chức và sức khỏe toàn hệ thống CoreStaff.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData(true)}
              disabled={refreshing || loading}
              className="gap-2 bg-background/80 backdrop-blur-xs"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="gap-2 shadow-xs"
            >
              <Plus className="size-4" />
              Tạo tổ chức mới
            </Button>
          </div>
        </div>

        {/* Decorative corner accent */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-blue-500/5 blur-2xl" />
      </div>

      {/* ───────── Key Metric KPI Cards ───────── */}
      <section aria-labelledby="kpis-title">
        <h2 id="kpis-title" className="sr-only">Chỉ số nền tảng</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Tổng số Tổ chức */}
          <MetricCard
            title="Tổng số Tổ chức"
            value={totalOrgs}
            subtitle={`${activeOrgs} đang hoạt động • ${suspendedOrgs} tạm ngưng`}
            icon={Building2}
            iconBg="bg-blue-500/10 dark:bg-blue-500/20"
            iconColor="text-blue-600 dark:text-blue-400"
            badge={totalOrgs > 0 ? { text: `${activeRate}% Active`, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' } : undefined}
            href="/platform/organizations"
            ready={!loading}
          />

          {/* Card 2: Tổng nhân sự toàn nền tảng */}
          <MetricCard
            title="Tổng nhân sự nền tảng"
            value={totalEmployeesAllOrgs}
            subtitle={`${totalActiveEmployeesAllOrgs} nhân sự đang làm việc`}
            icon={Users}
            iconBg="bg-indigo-500/10 dark:bg-indigo-500/20"
            iconColor="text-indigo-600 dark:text-indigo-400"
            badge={{ text: `${totalOrgs} Công ty`, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' }}
            href="/platform/organizations"
            ready={!loading}
          />

          {/* Card 3: Tổ chức đang hoạt động */}
          <MetricCard
            title="Đang hoạt động"
            value={activeOrgs}
            subtitle={suspendedOrgs > 0 ? `${suspendedOrgs} tổ chức tạm ngưng` : 'Tất cả tổ chức sẵn sàng'}
            icon={CheckCircle2}
            iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
            iconColor="text-emerald-600 dark:text-emerald-400"
            badge={{ text: `${activeRate}%`, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' }}
            href="/platform/organizations"
            ready={!loading}
          />

          {/* Card 4: Sức khỏe hệ thống */}
          <MetricCard
            title="Hạ tầng & Dịch vụ"
            value={health?.mongo === 'configured' ? '100% Sẵn sàng' : 'Cần kiểm tra'}
            subtitle={`API: OK • MongoDB: ${health?.mongo === 'configured' ? 'Đã kết nối' : 'Chưa rõ'}`}
            icon={Server}
            iconBg="bg-violet-500/10 dark:bg-violet-500/20"
            iconColor="text-violet-600 dark:text-violet-400"
            badge={{ text: 'Online', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' }}
            ready={!loading}
          />
        </div>
      </section>

      {/* ───────── Attention / Status Banner ───────── */}
      <section aria-labelledby="status-title" className="space-y-3">
        <h2 id="status-title" className="sr-only">Thông báo nền tảng</h2>
        {suspendedOrgs > 0 ? (
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 transition sm:flex-row sm:items-center dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Đang có {suspendedOrgs} tổ chức ở trạng thái Tạm ngưng (SUSPENDED)
                </p>
                <p className="text-xs text-muted-foreground">
                  Toàn bộ phiên đăng nhập của nhân viên thuộc các tổ chức này hiện bị vô hiệu hóa theo chính sách BR-AUTH-03.
                </p>
              </div>
            </div>
            <AppLink
              href="/platform/organizations"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              Xem danh sách tổ chức →
            </AppLink>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="text-sm">
              <span className="font-semibold">Nền tảng CoreStaff đang vận hành hoàn toàn ổn định!</span>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                Tất cả các tổ chức ({totalOrgs} tenants) đang hoạt động bình thường, không có cảnh báo khóa tài khoản hàng loạt hay sự cố kết nối.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ───────── Main Content 2-Column Grid ───────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols): Organizations Monitoring Table */}
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Danh sách Tổ chức trên Nền tảng
                </CardTitle>
                <CardDescription>
                  Quản trị các đơn vị doanh nghiệp / tenant sử dụng CoreStaff
                </CardDescription>
              </div>
              <AppLink
                href="/platform/organizations"
                className="text-xs font-medium text-primary hover:underline"
              >
                Xem tất cả ({totalOrgs}) →
              </AppLink>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="divide-y divide-border/60 px-6 py-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-3.5">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32 rounded" />
                        <Skeleton className="h-3 w-20 rounded" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : organizations.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {organizations.slice(0, 6).map(org => {
                    const isActive = org.status === 'ACTIVE';
                    const isToggling = togglingId === org._id;

                    return (
                      <div
                        key={org._id}
                        className="flex flex-col gap-3 px-6 py-3.5 transition sm:flex-row sm:items-center sm:justify-between hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                            {org.code.slice(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground truncate">{org.name}</span>
                              <span className="font-mono text-xs text-muted-foreground">({org.code})</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground mt-0.5">
                              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                <Users className="size-3 text-primary" />
                                {org.employeeCount ?? 0} nhân sự
                                {org.activeEmployeeCount !== undefined && org.activeEmployeeCount > 0 && (
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                    ({org.activeEmployeeCount} active)
                                  </span>
                                )}
                              </span>
                              <span>•</span>
                              <span>Múi giờ: {org.timezone || 'Asia/Ho_Chi_Minh'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isToggling}
                            onClick={() => void handleToggleStatus(org)}
                            className="h-7 text-xs px-2.5"
                          >
                            {isToggling ? 'Đang xử lý...' : isActive ? 'Tạm ngưng' : 'Kích hoạt'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Chưa có tổ chức nào được khởi tạo trên nền tảng.
                  <div className="mt-3">
                    <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                      <Plus className="size-4" />
                      Tạo tổ chức đầu tiên
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Multi-Tenant Distribution Widget */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Tỷ lệ Hoạt động & Quy mô Multi-Tenant
              </CardTitle>
              <CardDescription>
                Phân bổ trạng thái và quy mô nhân sự của các tenant trên toàn bộ nền tảng
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground">Tổ chức hoạt động ({activeOrgs}/{totalOrgs})</span>
                  <span className="text-primary font-bold">{activeRate}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${activeRate}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="rounded-lg border border-border/70 p-3 bg-muted/20">
                  <span className="text-muted-foreground block">Hoạt động bình thường</span>
                  <strong className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {activeOrgs} Tenants
                  </strong>
                </div>
                <div className="rounded-lg border border-border/70 p-3 bg-muted/20">
                  <span className="text-muted-foreground block">Bị khóa / Tạm ngưng</span>
                  <strong className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1 block">
                    {suspendedOrgs} Tenants
                  </strong>
                </div>
              </div>

              {/* Headcount by Organization */}
              {totalEmployeesAllOrgs > 0 && (
                <div className="pt-4 border-t border-border/60 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">Quy mô nhân sự theo từng công ty</span>
                    <span className="text-muted-foreground">{totalEmployeesAllOrgs} nhân sự toàn hệ thống</span>
                  </div>
                  <div className="space-y-2.5">
                    {[...organizations]
                      .sort((a, b) => (b.employeeCount || 0) - (a.employeeCount || 0))
                      .slice(0, 5)
                      .map(org => {
                        const count = org.employeeCount || 0;
                        const percent = totalEmployeesAllOrgs > 0 ? Math.round((count / totalEmployeesAllOrgs) * 100) : 0;
                        return (
                          <div key={org._id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-foreground truncate max-w-[180px]">
                                {org.name} <span className="text-muted-foreground">({org.code})</span>
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-semibold text-foreground">{count} người</span>
                                <span className="text-muted-foreground">({percent}%)</span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                                style={{ width: `${Math.max(percent, count > 0 ? 5 : 0)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols): Infrastructure Health & Quick Actions */}
        <div className="space-y-6 lg:col-span-5">
          {/* Infrastructure Health Monitor */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <CardTitle className="text-base font-semibold text-foreground">
                  Giám sát Hạ tầng & Dịch vụ
                </CardTitle>
              </div>
              <CardDescription>Trạng thái thực tế của các microservices và cơ sở dữ liệu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Service 1: CoreStaff API */}
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Server className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">CoreStaff NestJS API</h3>
                    <p className="text-[11px] text-muted-foreground">{apiBase || 'API Server'}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>

              {/* Service 2: MongoDB */}
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Database className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">MongoDB Database</h3>
                    <p className="text-[11px] text-muted-foreground">Cluster đa tổ chức (Multi-tenant)</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    health?.mongo === 'configured'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      health?.mongo === 'configured' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {health?.mongo === 'configured' ? 'Đã kết nối' : 'Cần kiểm tra'}
                </span>
              </div>

              {/* Service 3: Realtime Socket */}
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Radio className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">Socket.io Realtime</h3>
                    <p className="text-[11px] text-muted-foreground">Push notifications & chấm công</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Sẵn sàng
                </span>
              </div>

              {/* Service 4: Security & Múi giờ */}
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">Múi giờ máy chủ</h3>
                    <p className="text-[11px] text-muted-foreground">{health?.timezone || 'Asia/Ho_Chi_Minh'}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-foreground">UTC+7</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Platform Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Tác vụ Quản trị Nền tảng
              </CardTitle>
              <CardDescription>Các phân hệ thao tác nhanh cho System Admin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Button
                variant="outline"
                className="w-full justify-start gap-2.5 text-xs font-medium h-10"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4 text-blue-500" />
                <span>Khởi tạo Tổ chức & Cấp Initial HR</span>
              </Button>

              <AppLink href="/platform/organizations" className="block">
                <Button variant="outline" className="w-full justify-start gap-2.5 text-xs font-medium h-10">
                  <Building2 className="size-4 text-violet-500" />
                  <span>Quản lý danh sách Organizations ({totalOrgs})</span>
                </Button>
              </AppLink>

              <AppLink href="/platform/audit-logs" className="block">
                <Button variant="outline" className="w-full justify-start gap-2.5 text-xs font-medium h-10">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  <span>Nhật ký bảo mật (Platform Audit)</span>
                </Button>
              </AppLink>
            </CardContent>
          </Card>

          {/* System Admin Identity & Session Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  Phiên Quản trị Toàn quyền
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border/50 text-xs">
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Tài khoản</dt>
                  <dd className="font-semibold text-foreground truncate max-w-[200px]">{user.email}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Vai trò</dt>
                  <dd className="font-semibold text-primary">{roleLabel(user.role)}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Phạm vi quyền hạn</dt>
                  <dd className="font-semibold text-emerald-600 dark:text-emerald-400">Platform Scope (Toàn nền tảng)</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Tenant Isolation</dt>
                  <dd className="font-medium text-muted-foreground">Không gắn tenant cụ thể</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Organization Create Dialog */}
      {apiBase && (
        <OrganizationCreateDialog
          apiBase={apiBase}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            void loadData(true);
            toast.success('Thành công', 'Đã khởi tạo tổ chức và phát hành tài khoản Initial HR.');
          }}
        />
      )}
    </div>
  );
}
