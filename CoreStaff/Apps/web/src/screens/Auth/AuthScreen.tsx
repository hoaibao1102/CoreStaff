import { type ReactNode, useState } from 'react';
import { ChangePasswordScreen } from '@/screens/ChangePassword/ChangePasswordScreen';
import { ForgotPasswordScreen } from '@/screens/ForgotPassword/ForgotPasswordScreen';
import { LoginScreen } from '@/screens/Login/LoginScreen';
import { ResetPasswordScreen } from '@/screens/ResetPassword/ResetPasswordScreen';
import { forgetSession, rememberSession } from '@/lib/session';
import {
  AuthApiError,
  type AuthUser,
  changePassword,
  forgotPassword,
  friendlyAuthError,
  friendlyPasswordError,
  login,
  logout,
  me,
  resetPassword,
} from '@/services/auth';

type AuthView = 'login' | 'forgot';

/** Reset link arrives as `/?token=...` or `/reset-password`. */
function readResetToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) return token;
  return window.location.pathname.includes('reset-password') ? '' : null;
}

const NO_API_ERROR = 'Chưa kết nối được API.';

interface AuthScreenProps {
  apiBase: string | null;
  /** Boot-time failure (API unreachable), shown on the login screen. */
  bootError?: string | null;
  user: AuthUser | null;
  mustChangePassword: boolean;
  /** A credential flow succeeded: store the signed-in user. */
  onSession: (user: AuthUser, mustChangePassword: boolean) => void;
  /** Session dropped (logout, or 401 during password change). */
  onSignOut: () => void;
  /** Gets the header logout handler, which also calls the auth API. */
  children: (signOut: () => void) => ReactNode;
}

/**
 * Renders the credential screens (login / forgot / reset / forced password
 * change) while there is no usable session, and `children` once there is.
 */
export function AuthScreen({
  apiBase,
  bootError,
  user,
  mustChangePassword,
  onSession,
  onSignOut,
  children,
}: AuthScreenProps) {
  const [authView, setAuthView] = useState<AuthView>('login');
  const [resetToken, setResetToken] = useState<string | null>(() => readResetToken());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = submitting || !apiBase;
  const shownError = error ?? bootError;

  const handleLogin = async (identifier: string, password: string) => {
    if (!apiBase) {
      setError(NO_API_ERROR);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await login(apiBase, identifier, password);
      rememberSession();
      setAuthView('login');
      onSession(result.user, result.mustChangePassword);

      // Navigate to the appropriate route after successful login
      const route = getRouteForRole(result.user.role);
      window.history.pushState({}, '', route);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err: unknown) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  function getRouteForRole(role: string): string {
    if (role === 'EMPLOYEE' || role === 'DEPARTMENT_MANAGER') {
      return '/app/attendance';
    }
    if (role === 'SYSTEM_ADMIN') {
      return '/platform/organizations';
    }
    return '/overview';
  }

  const handleLogout = async () => {
    if (apiBase) await logout(apiBase);
    forgetSession();
    onSignOut();
  };

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    if (!apiBase) {
      setError(NO_API_ERROR);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await changePassword(apiBase, currentPassword, newPassword, confirmPassword);
      onSession(await me(apiBase), false);
    } catch (err: unknown) {
      if (err instanceof AuthApiError && err.status === 401) {
        forgetSession();
        onSignOut();
      }
      setError(friendlyPasswordError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (email: string): Promise<boolean> => {
    if (!apiBase) {
      setError(NO_API_ERROR);
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
      setError(NO_API_ERROR);
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
      backToLogin();
      return true;
    } catch (err: unknown) {
      setError(friendlyPasswordError(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  function backToLogin() {
    setError(null);
    setAuthView('login');
    if (resetToken !== null) {
      window.history.replaceState(null, '', '/');
      setResetToken(null);
    }
  }

  if (resetToken !== null) {
    return (
      <ResetPasswordScreen
        disabled={disabled}
        error={shownError}
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
          disabled={disabled}
          error={shownError}
          onBack={backToLogin}
          onSubmit={handleForgotPassword}
        />
      );
    }

    return (
      <LoginScreen
        disabled={disabled}
        error={shownError}
        onForgotPassword={() => {
          setError(null);
          setAuthView('forgot');
        }}
        onLogin={handleLogin}
      />
    );
  }

  if (mustChangePassword) {
    return (
      <ChangePasswordScreen
        disabled={disabled}
        error={shownError}
        user={user}
        onLogout={handleLogout}
        onSubmit={handleChangePassword}
      />
    );
  }

  return <>{children(handleLogout)}</>;
}
