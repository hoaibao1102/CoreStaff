import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users,
  FileText,
  Building2,
  CalendarDays,
  Clock3,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  WalletCards,
  RefreshCw,
  FileCheck2,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  ClipboardList,
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { AppLink } from '../../components/AppLink';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/card';
import { Button } from '../../components/button';
import { Skeleton } from '../../components/skeleton';
import {
  getEmployees,
  getDepartments,
  listContracts,
  getContractCompliance,
  getTimesheetPeriods,
  type EmployeeProfile,
  type Department,
  type EmploymentContract,
  type ContractCompliance,
  type TimesheetPeriod,
} from '../../services/hrService';
import { listHrLeaveRequests, type LeaveRequest } from '../../services/leave.service';
import {
  EMPLOYMENT_STATUS_BADGE,
  EMPLOYMENT_STATUS_LABELS,
  CONTRACT_STATUS_BADGE,
  CONTRACT_STATUS_LABELS,
  type EmploymentStatus,
} from '../../lib/types';
import { roleLabel } from '../../lib/labels';

/* ───────── Top Stat Metric Card ───────── */

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
              Chi tiết <ArrowUpRight className="ml-0.5 size-3.5" />
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

/* ───────── Main HrOverviewScreen ───────── */

export function HrOverviewScreen({ user, apiBase }: { user: AuthUser; apiBase?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Raw API datasets
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [compliance, setCompliance] = useState<ContractCompliance | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [timesheetPeriods, setTimesheetPeriods] = useState<TimesheetPeriod[]>([]);

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
      const [
        empRes,
        deptRes,
        contractRes,
        compRes,
        leaveRes,
        periodRes,
      ] = await Promise.allSettled([
        getEmployees(apiBase),
        getDepartments(apiBase),
        listContracts(apiBase),
        getContractCompliance(apiBase),
        listHrLeaveRequests(apiBase),
        getTimesheetPeriods(apiBase),
      ]);

      if (empRes.status === 'fulfilled' && empRes.value?.employees) {
        setEmployees(empRes.value.employees);
      }
      if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) {
        setDepartments(deptRes.value);
      }
      if (contractRes.status === 'fulfilled' && Array.isArray(contractRes.value)) {
        setContracts(contractRes.value);
      }
      if (compRes.status === 'fulfilled' && compRes.value) {
        setCompliance(compRes.value);
      }
      if (leaveRes.status === 'fulfilled' && Array.isArray(leaveRes.value)) {
        setLeaveRequests(leaveRes.value);
      }
      if (periodRes.status === 'fulfilled' && Array.isArray(periodRes.value)) {
        setTimesheetPeriods(periodRes.value);
      }
    } catch {
      // Graceful fallback for non-fatal errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Derived Statistics ──
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.employmentStatus === 'ACTIVE').length;
  const probationEmployees = employees.filter(e => e.employmentStatus === 'PROBATION').length;
  const otherEmployees = totalEmployees - (activeEmployees + probationEmployees);

  const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
  const expiringContracts = useMemo(() => {
    return contracts.filter(
      c => c.isExpiringSoon || (c.expiryWarningDays !== null && c.expiryWarningDays !== undefined && c.expiryWarningDays <= 30)
    );
  }, [contracts]);
  const expiredContracts = useMemo(() => {
    return contracts.filter(c => c.isExpired || c.status === 'EXPIRED');
  }, [contracts]);

  // Leave requests approved by managers but waiting for HR to apply into timesheet
  const pendingHrLeaveRequests = useMemo(() => {
    return leaveRequests.filter(l => l.status === 'APPROVED');
  }, [leaveRequests]);

  // Current active timesheet period
  const activePeriod = useMemo(() => {
    return (
      timesheetPeriods.find(p => p.status === 'OPEN' || p.status === 'REVIEWING' || p.status === 'READY_TO_CLOSE') ||
      timesheetPeriods[0] ||
      null
    );
  }, [timesheetPeriods]);

  // Compliance findings (e.g., no contract, active past expiry)
  const complianceFindings = compliance?.findings || [];

  // Department distribution
  const departmentStats = useMemo(() => {
    const deptMap: Record<string, { name: string; code: string; count: number }> = {};

    departments.forEach(d => {
      deptMap[d._id] = { name: d.name, code: d.code, count: 0 };
    });

    let unassignedCount = 0;
    employees.forEach(emp => {
      if (emp.departmentId && deptMap[emp.departmentId]) {
        deptMap[emp.departmentId].count += 1;
      } else {
        unassignedCount += 1;
      }
    });

    const list = Object.entries(deptMap).map(([id, data]) => ({
      id,
      name: data.name,
      code: data.code,
      count: data.count,
      percent: totalEmployees > 0 ? Math.round((data.count / totalEmployees) * 100) : 0,
    }));

    if (unassignedCount > 0) {
      list.push({
        id: 'unassigned',
        name: 'Chưa phân bổ',
        code: 'N/A',
        count: unassignedCount,
        percent: totalEmployees > 0 ? Math.round((unassignedCount / totalEmployees) * 100) : 0,
      });
    }

    return list.sort((a, b) => b.count - a.count);
  }, [departments, employees, totalEmployees]);

  // Recent 5 employees
  const recentEmployees = useMemo(() => {
    return [...employees]
      .sort((a, b) => {
        const tA = new Date(a.createdAt || a.joinDate || 0).getTime();
        const tB = new Date(b.createdAt || b.joinDate || 0).getTime();
        return tB - tA;
      })
      .slice(0, 5);
  }, [employees]);

  // Overall urgent action required items
  const actionItemsCount = pendingHrLeaveRequests.length + expiringContracts.length + complianceFindings.length;

  return (
    <div className="space-y-8 pb-12">
      {/* ───────── Top Welcome & Header Banner ───────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-xs sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck className="size-3.5" />
                Quản trị Nhân sự (HR Portal)
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {dateStr}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Tổng quan nhân sự
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Xin chào, <strong className="font-semibold text-foreground">{user.fullName}</strong>. Chúc bạn một ngày làm việc hiệu quả và tràn đầy năng lượng.
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
            <AppLink href="/hr/employees">
              <Button size="sm" className="gap-2 shadow-xs">
                <UserPlus className="size-4" />
                Thêm nhân viên
              </Button>
            </AppLink>
          </div>
        </div>

        {/* Decorative corner accent */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-primary/5 blur-2xl" />
      </div>

      {/* ───────── Key Metric KPI Cards ───────── */}
      <section aria-labelledby="kpis-title">
        <h2 id="kpis-title" className="sr-only">Chỉ số nhân sự chính</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Tổng nhân viên */}
          <MetricCard
            title="Tổng nhân sự"
            value={totalEmployees}
            subtitle={`Chính thức: ${activeEmployees} • Thử việc: ${probationEmployees}`}
            icon={Users}
            iconBg="bg-blue-500/10 dark:bg-blue-500/20"
            iconColor="text-blue-600 dark:text-blue-400"
            badge={totalEmployees > 0 ? { text: `${activeEmployees} Đang làm`, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' } : undefined}
            href="/hr/employees"
            ready={!loading}
          />

          {/* Card 2: Hợp đồng lao động */}
          <MetricCard
            title="Hợp đồng lao động"
            value={contracts.length}
            subtitle={`Đang hiệu lực: ${activeContracts} • Hết hạn: ${expiredContracts.length}`}
            icon={FileText}
            iconBg="bg-violet-500/10 dark:bg-violet-500/20"
            iconColor="text-violet-600 dark:text-violet-400"
            badge={
              expiringContracts.length > 0
                ? { text: `${expiringContracts.length} sắp hết hạn`, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' }
                : undefined
            }
            href="/hr/contracts"
            ready={!loading}
          />

          {/* Card 3: Đơn nghỉ phép chờ chốt */}
          <MetricCard
            title="Đơn nghỉ chờ áp dụng"
            value={pendingHrLeaveRequests.length}
            subtitle="Đã được duyệt, chờ HR áp dụng vào bảng công"
            icon={Clock3}
            iconBg="bg-amber-500/10 dark:bg-amber-500/20"
            iconColor="text-amber-600 dark:text-amber-400"
            badge={
              pendingHrLeaveRequests.length > 0
                ? { text: 'Cần xử lý', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' }
                : { text: 'Đã hoàn tất', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
            }
            href="/hr/leave-requests"
            ready={!loading}
          />

          {/* Card 4: Kỳ công hiện tại */}
          <MetricCard
            title="Kỳ công hiện tại"
            value={activePeriod ? activePeriod.period : 'Chưa tạo'}
            subtitle={activePeriod ? `${activePeriod.startDate} → ${activePeriod.endDate}` : 'Xem danh sách các kỳ công'}
            icon={CalendarDays}
            iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
            iconColor="text-emerald-600 dark:text-emerald-400"
            badge={activePeriod ? { text: activePeriod.status, color: 'bg-primary/10 text-primary' } : undefined}
            href="/hr/timesheet-periods"
            ready={!loading}
          />
        </div>
      </section>

      {/* ───────── Action Required / Alerts Section ───────── */}
      <section aria-labelledby="alerts-title" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 id="alerts-title" className="text-base font-semibold text-foreground">
              Việc cần xử lý ngay
            </h2>
            {actionItemsCount > 0 ? (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {actionItemsCount}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="size-3" /> Tất cả đã xong
              </span>
            )}
          </div>
        </div>

        {actionItemsCount > 0 ? (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Alert 1: Pending Leave Requests */}
            {pendingHrLeaveRequests.length > 0 && (
              <div className="flex flex-col justify-between rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 transition hover:shadow-xs dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <Clock3 className="size-4 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Đơn nghỉ phép chờ chốt</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Có <strong className="font-bold text-amber-700 dark:text-amber-400">{pendingHrLeaveRequests.length}</strong> đơn nghỉ đã duyệt bởi Quản lý, cần HR áp dụng vào bảng công tổ chức.
                  </p>
                </div>
                <div className="mt-4 pt-2">
                  <AppLink
                    href="/hr/leave-requests"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
                  >
                    Xem và áp dụng đơn nghỉ →
                  </AppLink>
                </div>
              </div>
            )}

            {/* Alert 2: Expiring Contracts */}
            {expiringContracts.length > 0 && (
              <div className="flex flex-col justify-between rounded-xl border border-orange-300/60 bg-orange-50/60 p-4 transition hover:shadow-xs dark:border-orange-900/50 dark:bg-orange-950/20">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Hợp đồng sắp hết hạn</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Có <strong className="font-bold text-orange-700 dark:text-orange-400">{expiringContracts.length}</strong> hợp đồng lao động sẽ hết hiệu lực trong vòng 30 ngày tới.
                  </p>
                </div>
                <div className="mt-4 pt-2">
                  <AppLink
                    href="/hr/contracts"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-200"
                  >
                    Xem hợp đồng cần gia hạn →
                  </AppLink>
                </div>
              </div>
            )}

            {/* Alert 3: Compliance Findings */}
            {complianceFindings.length > 0 && (
              <div className="flex flex-col justify-between rounded-xl border border-rose-300/60 bg-rose-50/60 p-4 transition hover:shadow-xs dark:border-rose-900/50 dark:bg-rose-950/20">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                    <ShieldAlert className="size-4 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Cảnh báo tuân thủ</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Phát hiện <strong className="font-bold text-rose-700 dark:text-rose-400">{complianceFindings.length}</strong> vấn đề về hợp đồng (chưa có HĐ, thử việc quá hạn...).
                  </p>
                </div>
                <div className="mt-4 pt-2">
                  <AppLink
                    href="/hr/contracts"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-200"
                  >
                    Kiểm tra và xử lý tuân thủ →
                  </AppLink>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="text-sm">
              <span className="font-semibold">Mọi việc đều đang được vận hành tối ưu!</span>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                Hiện không có hợp đồng quá hạn, đơn nghỉ tồn đọng hay cảnh báo vi phạm tuân thủ cần giải quyết.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ───────── Main Content 2-Column Grid ───────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols): Data Widgets (Departments & Recent Employees) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Widget 1: Phân bổ nhân sự theo phòng ban */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Phân bổ nhân sự theo phòng ban
                </CardTitle>
                <CardDescription>
                  Tổng cộng {departments.length} phòng ban đang hoạt động
                </CardDescription>
              </div>
              <AppLink href="/hr/departments" className="text-xs font-medium text-primary hover:underline">
                Quản lý phòng ban →
              </AppLink>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4 pt-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-32 rounded" />
                        <Skeleton className="h-4 w-12 rounded" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : departmentStats.length > 0 ? (
                <div className="space-y-4 pt-1">
                  {departmentStats.slice(0, 5).map(dept => (
                    <div key={dept.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {dept.name}{' '}
                          <span className="font-normal text-muted-foreground">({dept.code})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{dept.count} nhân sự</span>
                          <span className="text-muted-foreground">({dept.percent}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.max(dept.percent, dept.count > 0 ? 5 : 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có dữ liệu phòng ban.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Widget 2: Nhân viên mới gia nhập */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Nhân viên mới gia nhập
                </CardTitle>
                <CardDescription>Danh sách hồ sơ nhân sự mới nhất trong tổ chức</CardDescription>
              </div>
              <AppLink href="/hr/employees" className="text-xs font-medium text-primary hover:underline">
                Xem tất cả ({totalEmployees}) →
              </AppLink>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="divide-y divide-border/60 px-6 py-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28 rounded" />
                          <Skeleton className="h-3 w-20 rounded" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentEmployees.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {recentEmployees.map(emp => {
                    const initials = emp.fullName
                      ? emp.fullName
                          .split(' ')
                          .map(w => w[0])
                          .slice(-2)
                          .join('')
                          .toUpperCase()
                      : 'NV';

                    const statusKey = (emp.employmentStatus as EmploymentStatus) || 'ACTIVE';
                    const badgeClass =
                      EMPLOYMENT_STATUS_BADGE[statusKey] || 'bg-slate-100 text-slate-700';
                    const statusLabel =
                      EMPLOYMENT_STATUS_LABELS[statusKey] || emp.employmentStatus;

                    return (
                      <div
                        key={emp._id}
                        className="flex items-center justify-between px-6 py-3.5 transition hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <AppLink
                              href={`/hr/employees/${emp._id}`}
                              className="block truncate text-sm font-semibold text-foreground hover:text-primary"
                            >
                              {emp.fullName}
                            </AppLink>
                            <p className="truncate text-xs text-muted-foreground">
                              {emp.employeeCode ? `${emp.employeeCode} • ` : ''}
                              {emp.departmentName || 'Chưa gắn phòng ban'}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 pl-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có nhân viên nào trong danh bạ.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols): Quick Navigation Hub & Context */}
        <div className="space-y-6 lg:col-span-5">
          {/* Quick Hub Categories */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Lối tắt nghiệp vụ nhân sự
              </CardTitle>
              <CardDescription>Truy cập nhanh các phân hệ quản lý chính</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {/* Category 1: Hồ sơ & Hợp đồng */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Nhân sự & Hợp đồng
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <AppLink
                    href="/hr/employees"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Users className="size-4 text-blue-500" />
                    <span>Danh bạ nhân viên</span>
                  </AppLink>
                  <AppLink
                    href="/hr/contracts"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <FileText className="size-4 text-violet-500" />
                    <span>Hợp đồng lao động</span>
                  </AppLink>
                  <AppLink
                    href="/hr/assignments"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <ClipboardList className="size-4 text-emerald-500" />
                    <span>Phân công nhân sự</span>
                  </AppLink>
                  <AppLink
                    href="/hr/departments"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Building2 className="size-4 text-amber-500" />
                    <span>Phòng ban & Cơ cấu</span>
                  </AppLink>
                </div>
              </div>

              {/* Category 2: Thời gian & Công ca */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Thời gian & Công ca
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <AppLink
                    href="/hr/shift-templates"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Clock3 className="size-4 text-sky-500" />
                    <span>Ca làm việc</span>
                  </AppLink>
                  <AppLink
                    href="/hr/calendar"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <CalendarDays className="size-4 text-indigo-500" />
                    <span>Lịch tổ chức</span>
                  </AppLink>
                  <AppLink
                    href="/hr/leave-requests"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <FileCheck2 className="size-4 text-amber-500" />
                    <span>Áp dụng nghỉ phép</span>
                  </AppLink>
                  <AppLink
                    href="/hr/timesheet-periods"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <CalendarDays className="size-4 text-emerald-500" />
                    <span>Kỳ công</span>
                  </AppLink>
                </div>
              </div>

              {/* Category 3: Lương & Chính sách */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Lương & Đãi ngộ
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <AppLink
                    href="/hr/salary-profiles"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <WalletCards className="size-4 text-purple-500" />
                    <span>Hồ sơ lương</span>
                  </AppLink>
                  <AppLink
                    href="/hr/payroll-runs"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <WalletCards className="size-4 text-emerald-500" />
                    <span>Payroll & Payslip</span>
                  </AppLink>
                  <AppLink
                    href="/hr/organization-allowances"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <TrendingUp className="size-4 text-orange-500" />
                    <span>Chính sách phụ cấp</span>
                  </AppLink>
                  <AppLink
                    href="/hr/policies/labor-compliance"
                    className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <ShieldCheck className="size-4 text-blue-500" />
                    <span>Tuân thủ lao động</span>
                  </AppLink>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Account & System Context */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  Thông tin phiên quản trị
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
                  <dt className="text-muted-foreground">Mã nhân viên</dt>
                  <dd className="font-medium text-foreground">{user.employeeCode || 'Chưa thiết lập'}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Tổ chức</dt>
                  <dd className="font-mono text-[11px] text-muted-foreground truncate max-w-[180px]">
                    {user.organizationId || 'Mặc định'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
