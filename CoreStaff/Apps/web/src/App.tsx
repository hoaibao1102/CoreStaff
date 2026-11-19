import { useEffect, useRef, useState } from 'react';
import { AuthScreen } from './screens/Auth/AuthScreen';
import { WorkspaceRoutes } from './routes/WorkspaceRoutes';
import { CoreStaffLogo } from './components/CoreStaffLogo';
import { navigationEvent } from './components/AppLink';
import { resolveApiBase, type ApiSource, type HealthResponse } from './config/api';
import { type AuthUser, me, signedOutEvent } from './services/auth';
import { forgetSession, hasRememberedSession, subscribeToSessionChanges } from './lib/session';
import { ToastViewport } from './components/toast';

function BootScreen() {
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

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [apiSource, setApiSource] = useState<ApiSource | null>(null);
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const sessionVersion = useRef(0);

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

  // Resolve the API base once, then restore a session that a previous visit remembered.
  useEffect(() => {
    let cancelled = false;
    const version = sessionVersion.current;
    setBooting(true);
    setBootError(null);

    void (async () => {
      try {
        const resolved = await resolveApiBase();
        if (cancelled) return;
        setApiSource(resolved.source);
        setApiBase(resolved.base);

        setHealth(resolved.health);

        if (hasRememberedSession()) {
          try {
            const currentUser = await me(resolved.base);
            if (!cancelled && version === sessionVersion.current && hasRememberedSession()) {
              setUser(currentUser);
              setMustChangePassword(!!currentUser.mustChangePassword);
            }
          } catch (err) {
            // Confirmed refresh rejection emits signedOutEvent. Other failures
            // keep the remembered marker and show a retryable bootstrap error.
            if (hasRememberedSession()) throw err;
            if (!cancelled) setUser(null);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) setBootError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  // The API session cookie is short-lived; services/auth.ts renews it silently
  // (SRS §4.4). This is what's left when renewal itself fails — the refresh
  // token expired too, so the only honest move is the login screen.
  useEffect(() => {
    const onSignedOut = () => {
      sessionVersion.current++;
      forgetSession();
      setUser(null);
      setMustChangePassword(false);
      if (window.location.pathname !== '/login') {
        window.history.pushState(null, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };
    window.addEventListener(signedOutEvent, onSignedOut);
    // AUD-M08: a sign-out in another tab must clear this tab's data at once, and
    // a sign-in there must not leave this tab showing the previous account.
    const unsubscribe = subscribeToSessionChanges({
      onSignedOut,
      onSignedIn: () => window.location.reload(),
    });
    return () => {
      window.removeEventListener(signedOutEvent, onSignedOut);
      unsubscribe();
    };
  }, []);

  const signOut = () => {
    sessionVersion.current++;
    setUser(null);
    setMustChangePassword(false);
  };

  if (booting) return <BootScreen />;
  if (bootError && hasRememberedSession()) return (
    <main className="grid min-h-screen place-content-center gap-4 p-6">
      <p role="alert">{bootError}</p>
      <button type="button" onClick={() => setBootAttempt(attempt => attempt + 1)}>Thử lại</button>
    </main>
  );

  return <>
    <AuthScreen
      apiBase={apiBase}
      bootError={bootError}
      user={user}
      mustChangePassword={mustChangePassword}
      onSession={(nextUser, nextMustChange) => {
        sessionVersion.current++;
        setUser(nextUser);
        setMustChangePassword(nextMustChange);
      }}
      onSignOut={signOut}
    >
      {signOutWithApi =>
        user && (
          <WorkspaceRoutes
            path={path}
            user={user}
            apiBase={apiBase}
            apiSource={apiSource}
            health={health}
            onLogout={signOutWithApi}
          />
        )
      }
    </AuthScreen>
    <ToastViewport />
  </>;
}
