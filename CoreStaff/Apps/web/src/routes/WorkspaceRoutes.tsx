import { EmployeeDataState } from '../components/EmployeeDataState';
import { EmployeeDirectoryScreen } from '../screens/EmployeeDirectory/EmployeeDirectoryScreen';
import { EmployeeProfileScreen } from '../screens/EmployeeProfile/EmployeeProfileScreen';
import { EmployeeDetailScreen } from '../screens/EmployeeDetail/EmployeeDetailScreen';
import { AttendanceScreen } from '../screens/Attendance/AttendanceScreen';
import { HrOverviewScreen } from '../screens/HrOverview/HrOverviewScreen';
import { AppLink } from '../components/AppLink';
import { AppFooter } from '../components/AppFooter';
import { AppHeader } from '../components/AppHeader';
import { WorkspaceModules } from '../components/WorkspaceModules';
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

/** Default route: session summary cards plus the workspace modules. */
function StaffOverview({ user, apiBase, apiSource, health, onLogout }: Omit<WorkspaceRoutesProps, 'path'>) {
  const cards: { label: string; value: string; hint?: string | null }[] = [
    { label: 'Vai trò', value: roleLabel(user.role) },
    { label: 'Mã nhân viên', value: user.employeeCode || 'Không áp dụng' },
    { label: 'API', value: statusPill(apiSource), hint: apiBase },
    {
      label: 'MongoDB',
      value: health?.mongo === 'configured' ? 'Đã cấu hình' : 'Chưa rõ',
      hint: health?.timezone,
    },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f7fb] text-[#172033]">
      <AppHeader roleLabel={roleLabel(user.role)} user={user} onLogout={onLogout} />

      <section id="overview" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-lg border border-[#d9dee8] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.16em] text-green-700">
                Phiên làm việc đang hoạt động
              </p>
              <h1 className="m-0 text-2xl font-bold tracking-[-0.01em] text-[#111827] sm:text-3xl">
                Xin chào, {user.fullName}
              </h1>
              <span className="mt-2 block text-sm text-[#5c6170]">{user.email}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-bold text-[#174ea6]">
                {roleLabel(user.role)}
              </span>
              <span className="rounded-full bg-[#f3f6fb] px-3 py-1 text-xs font-bold text-[#5c6170]">
                {statusPill(apiSource)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, hint }) => (
            <article className="min-h-32 rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm" key={label}>
              <small className="block text-xs font-bold uppercase tracking-wide text-[#6b7280]">{label}</small>
              <strong className="mt-3 block break-words text-lg text-[#111827]">{value}</strong>
              {hint && <span className="mt-2 block break-words text-xs leading-5 text-[#6b7280]">{hint}</span>}
            </article>
          ))}
        </div>

        <WorkspaceModules user={user} />
      </section>

      <AppFooter
        apiBase={apiBase}
        apiStatus={statusPill(apiSource)}
        mongoStatus={health?.mongo === 'configured' ? 'Configured' : 'Unknown'}
        timezone={health?.timezone}
      />
    </main>
  );
}

/** Path switch for the authenticated app. Header/footer chrome is per route. */
export function WorkspaceRoutes({ path, user, apiBase, apiSource, health, onLogout }: WorkspaceRoutesProps) {
  const route = path.replace(/\/$/, '') || '/';

  // ── Dashboard / Tổng quan (staff overview with module cards) ─────────
  if (route === '/' || route === '/dashboard' || route === '/overview') {
    return (
      <StaffOverview user={user} apiBase={apiBase} apiSource={apiSource} health={health} onLogout={onLogout} />
    );
  }

  // ── Employee routes ──────────────────────────────────────────────────
  if (route === '/app/profile') {
    const header = <AppHeader roleLabel={roleLabel(user.role)} user={user} onLogout={onLogout} />;
    return (
      <main className="flex min-h-screen flex-col bg-[#f5f7fb] text-[#172033]">
        {header}
        <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <AppLink href="/overview" className="mb-6 inline-block text-sm text-[#174ea6]">← Tổng quan</AppLink>
          <EmployeeProfileScreen user={user} apiBase={apiBase} />
        </section>
      </main>
    );
  }

  if (route.startsWith('/hr/employees/') && (user.role !== 'HR' || !user.organizationId)) return <EmployeeDataState status="forbidden" />;

  // ── HR routes ────────────────────────────────────────────────────────
  if (user.role === 'HR') {
    const header = <AppHeader roleLabel={roleLabel(user.role)} user={user} onLogout={onLogout} />;
    return (
      <div className="flex min-h-dvh flex-col bg-[#f7f8fa] text-slate-900">
        {header}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {route === '/hr/employees' ? (
            <EmployeeDirectoryScreen user={user} apiBase={apiBase} />
          ) : route.startsWith('/hr/employees/') ? (
            <EmployeeDetailScreen user={user} apiBase={apiBase} employeeId={route.split('/').pop() ?? ''} />
          ) : (
            <HrOverviewScreen user={user} />
          )}
        </main>
        <footer className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-slate-400 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} CoreStaff · Quản lý nhân sự
        </footer>
      </div>
    );
  }

  // ── Employee Directory (shared access) ───────────────────────────────
  if (route === '/hr/employees') {
    const header = <AppHeader roleLabel={roleLabel(user.role)} user={user} onLogout={onLogout} />;
    return (
      <main className="flex min-h-screen flex-col bg-[#f5f7fb] text-[#172033]">
        {header}
        <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <AppLink href="/overview" className="mb-6 inline-block text-sm text-[#174ea6]">← Tổng quan</AppLink>
          <EmployeeDirectoryScreen user={user} apiBase={apiBase} />
        </section>
      </main>
    );
  }

  // ── Attendance (EMPLOYEE / DEPARTMENT_MANAGER) ───────────────────────
  if (route === '/app/attendance' && (user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER')) {
    const header = <AppHeader roleLabel={roleLabel(user.role)} user={user} onLogout={onLogout} />;
    return (
      <main className="flex min-h-screen flex-col bg-[#f5f7fb] text-[#172033]">
        {header}
        <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <AppLink href="/overview" className="mb-6 inline-block text-sm text-[#174ea6]">← Tổng quan</AppLink>
          <AttendanceScreen user={user} />
        </section>
      </main>
    );
  }

  // ── Fallback: show dashboard ─────────────────────────────────────────
  return <StaffOverview user={user} apiBase={apiBase} apiSource={apiSource} health={health} onLogout={onLogout} />;
}
