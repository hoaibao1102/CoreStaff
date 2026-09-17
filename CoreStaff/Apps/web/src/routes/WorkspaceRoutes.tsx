import { EmployeeDataState } from '../components/EmployeeDataState';
import { EmployeeDirectoryScreen } from '../screens/EmployeeDirectory/EmployeeDirectoryScreen';
import { EmployeeProfileScreen } from '../screens/EmployeeProfile/EmployeeProfileScreen';
import { AttendanceScreen } from '../screens/Attendance/AttendanceScreen';
import { DepartmentScreen } from '../screens/Departments/DepartmentScreen';
import { PositionScreen } from '../screens/Positions/PositionScreen';
import { HrOverviewScreen } from '../screens/HrOverview/HrOverviewScreen';
import { PlatformOrganizationsScreen } from '../screens/PlatformOrganizations/PlatformOrganizationsScreen';
import { WorkspaceModules } from '../components/WorkspaceModules';
import { WorkspaceShell } from '../components/WorkspaceShell';
import type { ApiSource, HealthResponse } from '../config/api';
import type { AuthUser } from '../services/auth';
import { roleLabel, statusPill } from '../lib/labels';

interface WorkspaceRoutesProps {
  path: string;
  user: AuthUser;
  apiBase: string | null;
  apiSource: ApiSource | null;
  health: HealthResponse | null;
  onLogout: () => void;
}

interface StaffOverviewProps {
  user: AuthUser;
  apiBase: string | null;
  apiSource: ApiSource | null;
  health: HealthResponse | null;
}

/** Default route: session summary cards plus the workspace modules. */
function StaffOverview({ user, apiBase, apiSource, health }: StaffOverviewProps) {
  const cards: { label: string; value: string; hint?: string | null }[] = [
    { label: 'Vai trò', value: roleLabel(user.role) },
    { label: 'Mã nhân viên', value: user.employeeCode || 'Không áp dụng' },
    { label: 'API', value: statusPill(apiSource), hint: apiBase ?? undefined },
    {
      label: 'MongoDB',
      value: health?.mongo === 'configured' ? 'Đã cấu hình' : 'Chưa rõ',
      hint: health?.timezone,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Xin chào, {user.fullName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {roleLabel(user.role)}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {statusPill(apiSource)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, hint }) => (
          <article className="min-h-32 rounded-xl border border-border bg-card p-5 shadow-sm" key={label}>
            <small className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</small>
            <strong className="mt-3 block break-words text-lg text-foreground">{value}</strong>
            {hint && <span className="mt-2 block break-words text-xs leading-5 text-muted-foreground">{hint}</span>}
          </article>
        ))}
      </div>

      <WorkspaceModules user={user} />
    </section>
  );
}

/** Path switch for the authenticated app with sidebar layout. */
export function WorkspaceRoutes({ path, user, apiBase, apiSource, health, onLogout }: WorkspaceRoutesProps) {
  const route = path.replace(/\/$/, '') || '/';

  // ── Forbidden guard ──────────────────────────────────────────────────
  // Every HR directory read requires an HR with a tenant; the route never
  // renders for anyone else. The SYSTEM_ADMIN branch below must be skipped for
  // these paths, so it also sits behind the role check.
  if ((user.role !== 'HR' || !user.organizationId) && (route.startsWith('/hr/employees/') || route === '/hr/employees')) {
    return <EmployeeDataState status="forbidden" />;
  }

  // ── Dashboard / Tổng quan ────────────────────────────────────────────
  if (route === '/' || route === '/dashboard' || route === '/overview') {
    return (
      <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
        <StaffOverview user={user} apiBase={apiBase} apiSource={apiSource} health={health} />
      </WorkspaceShell>
    );
  }

  // ── Employee Profile ─────────────────────────────────────────────────
  if (route === '/app/profile') {
    return (
      <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <EmployeeProfileScreen user={user} apiBase={apiBase} />
        </section>
      </WorkspaceShell>
    );
  }

  // Department reads are available to every authenticated tenant member.
  if (route === '/hr/departments') {
    return (
      <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <DepartmentScreen user={user} apiBase={apiBase} />
        </section>
      </WorkspaceShell>
    );
  }
  if (route === '/hr/positions') {
    return <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}><section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><PositionScreen user={user} apiBase={apiBase} /></section></WorkspaceShell>;
  }

  // ── HR routes ────────────────────────────────────────────────────────
  if (user.role === 'HR') {
    return (
      <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {route === '/hr/employees' || route.startsWith('/hr/employees/') ? (
            <EmployeeDirectoryScreen
              user={user}
              apiBase={apiBase}
              employeeId={route.startsWith('/hr/employees/') ? route.split('/').pop() : undefined}
            />
          ) : route === '/hr/periods' || route === '/hr/payroll-runs' ? (
            // Sprint 3+ — built in later phases; pronounced instead of landing
            // silently on the dashboard.
            <EmployeeDataState status="unavailable" description="Tính năng đang được phát triển." />
          ) : (
            <HrOverviewScreen user={user} />
          )}
        </section>
      </WorkspaceShell>
    );
  }

  // ── Platform (SYSTEM_ADMIN) ─────────────────────────────────────────
  if (route === '/platform/organizations' && user.role === 'SYSTEM_ADMIN') {
    return (
      <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PlatformOrganizationsScreen user={user} apiBase={apiBase} />
        </section>
      </WorkspaceShell>
    );
  }

  // ── Attendance (EMPLOYEE / DEPARTMENT_MANAGER) ───────────────────────
  if (route === '/app/attendance' && (user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER')) {
    return (
      <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <AttendanceScreen user={user} />
        </section>
      </WorkspaceShell>
    );
  }

  // ── Fallback: show dashboard ─────────────────────────────────────────
  return (
    <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
      <StaffOverview user={user} apiBase={apiBase} apiSource={apiSource} health={health} />
    </WorkspaceShell>
  );
}
