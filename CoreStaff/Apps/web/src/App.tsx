import { EmployeeDirectoryScreen } from './screens/EmployeeDirectory/EmployeeDirectoryScreen';
import { HrOverviewScreen } from './screens/HrOverview/HrOverviewScreen';
import { EmployeeProfileScreen } from './screens/EmployeeProfile/EmployeeProfileScreen';
import { AppLink, navigationEvent } from './components/AppLink';
import { useEffect, useState } from 'react';
import { ChangePasswordScreen } from './screens/ChangePassword/ChangePasswordScreen';
import { ForgotPasswordScreen } from './screens/ForgotPassword/ForgotPasswordScreen';
import { LoginScreen } from './screens/Login/LoginScreen';
import { ResetPasswordScreen } from './screens/ResetPassword/ResetPasswordScreen';
import { CoreStaffLogo } from './components/CoreStaffLogo';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { WorkspaceModules } from './components/WorkspaceModules';
import { apiUrl, resolveApiBase } from './config/api';
import {
  AuthApiError,
  AuthUser,
  changePassword,
  forgotPassword,
  friendlyAuthError,
  friendlyPasswordError,
  gmailLoginUrl,
  login,
  logout,
  me,
  resetPassword,
} from './services/auth';

interface HealthResponse {
  status: string;
  service: string;
  mongo: 'configured' | 'missing';
  timezone: string;
}

type ApiSource = 'remote' | 'local';
type AuthView = 'login' | 'forgot';
const SESSION_MARKER_KEY = 'corestaff:has-session';

function readResetToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) return token;
  return window.location.pathname.includes('reset-password') ? '' : null;
}

function statusPill(source: ApiSource | null): string {
  if (source === 'local') return 'Local fallback';
  if (source === 'remote') return 'Remote API';
  return 'Đang kiểm tra';
}

function rememberSession(): void {
  window.localStorage.setItem(SESSION_MARKER_KEY, '1');
}

function forgetSession(): void {
  window.localStorage.removeItem(SESSION_MARKER_KEY);
}

function hasRememberedSession(): boolean {
  return window.localStorage.getItem(SESSION_MARKER_KEY) === '1';
}

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [apiSource, setApiSource] = useState<ApiSource | null>(null);
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [resetToken, setResetToken] = useState<string | null>(() => readResetToken());
  const [booting, setBooting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateLocation = () => setPath(window.location.pathname);
    window.addEventListener('popstate', updateLocation);
    window.addEventListener(navigationEvent, updateLocation);
    return () => {
      window.removeEventListener('popstate', updateLocation);
      window.removeEventListener(navigationEvent, updateLocation);
    };
  }, []);

  useEffect(() => {
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (target) target.scrollIntoView?.();
  }, [path]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const resolved = await resolveApiBase();
        if (cancelled) return;
        setApiSource(resolved.source);
        setApiBase(resolved.base);

        const healthRes = await fetch(apiUrl(resolved.base, '/api/healthz'));
        if (healthRes.ok) {
          const body = (await healthRes.json()) as HealthResponse;
          if (!cancelled) setHealth(body);
        }

        if (hasRememberedSession()) {
          try {
            const currentUser = await me(resolved.base);
            if (!cancelled) {
              setUser(currentUser);
              setMustChangePassword(!!currentUser.mustChangePassword);
            }
          } catch {
            forgetSession();
            if (!cancelled) {
              setUser(null);
              setMustChangePassword(false);
            }
          }
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (identifier: string, password: string) => {
    if (!apiBase) {
      setError('Chưa kết nối được API.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await login(apiBase, identifier, password);
      rememberSession();
      setUser(result.user);
      setMustChangePassword(result.mustChangePassword);
      setAuthView('login');
    } catch (err: unknown) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGmailLogin = () => {
    if (!apiBase) {
      setError('ChÆ°a káº¿t ná»‘i Ä‘Æ°á»£c API.');
      return;
    }

    window.location.assign(gmailLoginUrl(apiBase));
  };

  const handleLogout = async () => {
    if (apiBase) await logout(apiBase);
    forgetSession();
    setUser(null);
    setMustChangePassword(false);
  };

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    if (!apiBase) {
      setError('Chưa kết nối được API.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await changePassword(apiBase, currentPassword, newPassword, confirmPassword);
      const currentUser = await me(apiBase);
      setUser(currentUser);
      setMustChangePassword(false);
    } catch (err: unknown) {
      if (err instanceof AuthApiError && err.status === 401) {
        forgetSession();
        setUser(null);
        setMustChangePassword(false);
      }
      setError(friendlyPasswordError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (email: string): Promise<boolean> => {
    if (!apiBase) {
      setError('Chưa kết nối được API.');
      return false;
    }

    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(apiBase, email);
      return true;
    } catch (err: unknown) {
      setError(friendlyPasswordError(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (token: string, newPassword: string): Promise<boolean> => {
    if (!apiBase) {
      setError('Chưa kết nối được API.');
      return false;
    }
    if (!token) {
      setError('Liên kết đặt lại mật khẩu thiếu token.');
      return false;
    }

    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(apiBase, token, newPassword);
      window.history.replaceState(null, '', '/');
      setResetToken(null);
      return true;
    } catch (err: unknown) {
      setError(friendlyPasswordError(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const backToLogin = () => {
    setError(null);
    setAuthView('login');
    if (resetToken !== null) {
      window.history.replaceState(null, '', '/');
      setResetToken(null);
    }
  };

  if (booting) {
    return (
      <main className="grid min-h-screen place-content-center justify-items-center gap-5 bg-[#f5f7fb]">
        <CoreStaffLogo />
        <div className="h-1.5 w-44 overflow-hidden rounded-full bg-[#e5eaf3]">
          <div className="h-full w-1/2 rounded-full bg-[#174ea6]" />
        </div>
        <p className="m-0 text-sm font-medium text-[#5c6170]">Đang kết nối CoreStaff...</p>
      </main>
    );
  }

  if (resetToken !== null) {
    return (
      <ResetPasswordScreen
        disabled={submitting || !apiBase}
        error={error}
        token={resetToken}
        onBack={backToLogin}
        onSubmit={handleResetPassword}
      />
    );
  }

  if (!user) {
    if (authView === 'forgot') {
      return (
        <ForgotPasswordScreen
          disabled={submitting || !apiBase}
          error={error}
          onBack={backToLogin}
          onSubmit={handleForgotPassword}
        />
      );
    }

    return (
      <LoginScreen
        disabled={submitting || !apiBase}
        error={error}
        onForgotPassword={() => {
          setError(null);
          setAuthView('forgot');
        }}
        onGmailLogin={handleGmailLogin}
        onLogin={handleLogin}
      />
    );
  }

  if (mustChangePassword) {
    return (
      <ChangePasswordScreen
        disabled={submitting || !apiBase}
        error={error}
        user={user}
        onLogout={handleLogout}
        onSubmit={handleChangePassword}
      />
    );
  }

  const employeeRoute = path.replace(/\/$/, '');
  if (employeeRoute === '/hr/employees' || employeeRoute === '/app/profile') {
    return <main className="flex min-h-screen flex-col bg-[#f5f7fb] text-[#172033]">
      <AppHeader roleLabel={roleLabel(user.role)} user={user} onLogout={handleLogout} />
      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <AppLink href="/" className="mb-6 inline-block text-sm text-[#174ea6]">← Tổng quan</AppLink>
        {employeeRoute === '/hr/employees' ? <EmployeeDirectoryScreen user={user} /> : <EmployeeProfileScreen user={user} />}
      </section>
    </main>;
  }

  if (user.role === 'HR') {
    return <div className="flex min-h-dvh flex-col bg-[#f7f8fa] text-slate-900">
      <AppHeader roleLabel={roleLabel(user.role)} user={user} onLogout={handleLogout} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><HrOverviewScreen user={user} /></main>
      <footer className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-slate-400 sm:px-6 lg:px-8">© {new Date().getFullYear()} CoreStaff · Quản lý nhân sự</footer>
    </div>;
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f7fb] text-[#172033]">
      <AppHeader roleLabel={roleLabel(user.role)} user={user} onLogout={handleLogout} />

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
          <article className="min-h-32 rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
            <small className="block text-xs font-bold uppercase tracking-wide text-[#6b7280]">Vai trò</small>
            <strong className="mt-3 block text-lg text-[#111827]">{roleLabel(user.role)}</strong>
          </article>
          <article className="min-h-32 rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
            <small className="block text-xs font-bold uppercase tracking-wide text-[#6b7280]">Mã nhân viên</small>
            <strong className="mt-3 block break-words text-lg text-[#111827]">
              {user.employeeCode || 'Không áp dụng'}
            </strong>
          </article>
          <article className="min-h-32 rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
            <small className="block text-xs font-bold uppercase tracking-wide text-[#6b7280]">API</small>
            <strong className="mt-3 block break-words text-lg text-[#111827]">
              {statusPill(apiSource)}
            </strong>
            <span className="mt-2 block break-words text-xs leading-5 text-[#6b7280]">{apiBase}</span>
          </article>
          <article className="min-h-32 rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
            <small className="block text-xs font-bold uppercase tracking-wide text-[#6b7280]">MongoDB</small>
            <strong className="mt-3 block text-lg text-[#111827]">
              {health?.mongo === 'configured' ? 'Đã cấu hình' : 'Chưa rõ'}
            </strong>
            <span className="mt-2 block text-xs text-[#6b7280]">{health?.timezone}</span>
          </article>
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

function roleLabel(role: AuthUser['role']): string {
  const labels: Record<AuthUser['role'], string> = {
    SYSTEM_ADMIN: 'System Admin',
    HR: 'Nhân sự',
    DEPARTMENT_MANAGER: 'Quản lý phòng ban',
    EMPLOYEE: 'Nhân viên',
  };
  return labels[role] ?? role;
}
