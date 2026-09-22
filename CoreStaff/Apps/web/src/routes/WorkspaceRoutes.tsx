import { EmployeeDataState } from '../components/EmployeeDataState';
import { EmployeeDirectoryScreen } from '../screens/EmployeeDirectory/EmployeeDirectoryScreen';
import { ContractsScreen } from '../screens/Contracts/ContractsScreen';
import { EmployeeProfileScreen } from '../screens/EmployeeProfile/EmployeeProfileScreen';
import { AttendanceScreen } from '../screens/Attendance/AttendanceScreen';
import { AttendanceHistoryScreen, LeaveOvertimeScreen } from '../screens/Employee/EmployeeWorkScreens';
import { DepartmentScreen } from '../screens/Departments/DepartmentScreen';
import { PositionScreen } from '../screens/Positions/PositionScreen';
import { AssignmentScreen } from '../screens/Assignments/AssignmentScreen';
import { WorkplaceScreen } from '../screens/Workplaces/WorkplaceScreen';
import { ShiftTemplateScreen } from '../screens/ShiftTemplates/ShiftTemplateScreen';
import { HrOverviewScreen } from '../screens/HrOverview/HrOverviewScreen';
import { CompensationScreen } from '../screens/Compensation/CompensationScreen';
import { SalaryProfilesScreen } from '../screens/SalaryProfiles/SalaryProfilesScreen';
import { LaborCompliancePolicyScreen } from '../screens/LaborCompliancePolicy/LaborCompliancePolicyScreen';
import { OvertimePayPolicyScreen } from '../screens/OvertimePayPolicy/OvertimePayPolicyScreen';
import { PlatformOrganizationsScreen } from '../screens/PlatformOrganizations/PlatformOrganizationsScreen';
import { ManagerDepartmentScreen } from '../screens/ManagerDepartment/ManagerDepartmentScreen';
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
  // Every HR directory/contract/assignment read requires an HR with a tenant; the
  // route never renders for anyone else. The SYSTEM_ADMIN branch below must be
  // skipped for these paths, so it also sits behind the role check.
  const hrScoped =
    route === '/hr/employees' || route.startsWith('/hr/employees/') ||
    route === '/hr/contracts' || route.startsWith('/hr/contracts/') ||
    route === '/hr/assignments' || route === '/hr/salary-profiles' ||
    route === '/hr/organization-allowances' || route === '/hr/attendance-bonus-policies' ||
    route === '/hr/policies/labor-compliance' || route === '/hr/policies/overtime-pay';
  if ((user.role !== 'HR' || !user.organizationId) && hrScoped) {
    return <EmployeeDataState status="forbidden" />;
  }

  if (route === '/hr/kpi-inputs' && user.role !== 'HR' && user.role !== 'DEPARTMENT_MANAGER') {
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
  if (route === '/hr/workplaces' && user.role === 'HR') {
    if (!user.organizationId) return <EmployeeDataState status="forbidden" />;
    if (!apiBase) return <EmployeeDataState status="error" message="Chưa kết nối được API." />;
    return <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}><section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><WorkplaceScreen apiBase={apiBase} organizationId={user.organizationId} /></section></WorkspaceShell>;
  }
  if (route === '/hr/shift-templates' && user.role === 'HR') {
    if (!user.organizationId) return <EmployeeDataState status="forbidden" />;
    if (!apiBase) return <EmployeeDataState status="error" message="Chưa kết nối được API." />;
    return <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}><section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><ShiftTemplateScreen apiBase={apiBase} organizationId={user.organizationId} /></section></WorkspaceShell>;
  }

  // ── HR routes ────────────────────────────────────────────────────────
  if (route === '/app/attendance' && user.role === 'HR') {
    return (
      <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
        <AttendanceScreen user={user} />
      </WorkspaceShell>
    );
  }

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
          ) : route === '/hr/contracts' || route.startsWith('/hr/contracts/') ? (
            <ContractsScreen
              user={user}
              apiBase={apiBase}
              contractId={route.startsWith('/hr/contracts/') ? route.split('/').pop() : undefined}
            />
          ) : route === '/hr/assignments' ? (
            <AssignmentScreen user={user} apiBase={apiBase} />
          ) : route === '/hr/salary-profiles' ? (
            <SalaryProfilesScreen apiBase={apiBase} />
          ) : route === '/hr/organization-allowances' ? (
            <CompensationScreen apiBase={apiBase} kind="organization-allowances" />
          ) : route === '/hr/attendance-bonus-policies' ? (
            <CompensationScreen apiBase={apiBase} kind="attendance-bonus-policies" />
          ) : route === '/hr/kpi-inputs' ? (
            <CompensationScreen apiBase={apiBase} kind="kpi-inputs" userRole={user.role} />
          ) : route === '/hr/policies/labor-compliance' ? (
            <LaborCompliancePolicyScreen apiBase={apiBase} />
          ) : route === '/hr/policies/overtime-pay' ? (
            <OvertimePayPolicyScreen apiBase={apiBase} />
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
        <AttendanceScreen user={user} />
      </WorkspaceShell>
    );
  }

  if (user.role === 'DEPARTMENT_MANAGER' && (route === '/manager/department' || route === '/manager/approvals' || route === '/hr/kpi-inputs')) {
    const initialTab = route === '/hr/kpi-inputs' ? 'evaluations' : 'approvals';
    return (
      <WorkspaceShell user={user} currentPath="/manager/department" onLogout={onLogout}>
        <section className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
          <ManagerDepartmentScreen apiBase={apiBase} initialTab={initialTab} />
        </section>
      </WorkspaceShell>
    );
  }

  if ((user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER') && route === '/app/attendance/history') {
    return (
      <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
        <div className="mx-auto w-full max-w-md md:max-w-2xl px-3 py-2 sm:px-6 sm:py-6">
          <AttendanceHistoryScreen />
        </div>
      </WorkspaceShell>
    );
  }

  if ((user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER') && route === '/app/leave') {
    return <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}><section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><LeaveOvertimeScreen /></section></WorkspaceShell>;
  }

  // ── Fallback: show dashboard ─────────────────────────────────────────
  return (
    <WorkspaceShell user={user} currentPath={route} onLogout={onLogout}>
      <StaffOverview user={user} apiBase={apiBase} apiSource={apiSource} health={health} />
    </WorkspaceShell>
  );
}
