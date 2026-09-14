import { useEffect, useState } from 'react';
import { apiUrl, resolveApiBase } from './config/api';

interface HealthResponse {
  status: string;
  service: string;
  mongo: 'configured' | 'missing';
  timezone: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiSource, setApiSource] = useState<'remote' | 'local' | null>(null);
  const [apiBase, setApiBase] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resolved = await resolveApiBase();
        if (cancelled) return;
        setApiSource(resolved.source);
        setApiBase(resolved.base);
        const res = await fetch(apiUrl(resolved.base, '/api/healthz'));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as HealthResponse;
        if (!cancelled) setHealth(body);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      <header className="brand">
        <h1>CoreStaff</h1>
        <small>Human Resource, Attendance &amp; Payroll Management System</small>
      </header>

      <section className="card">
        <h2>API health</h2>
        {error && <p className="bad">Không kết nối được: {error}</p>}
        {!error && !health && <p>Đang kiểm tra…</p>}
        {health && (
          <dl>
            <dt>Service</dt>
            <dd>{health.service}</dd>
            <dt>Status</dt>
            <dd>{health.status}</dd>
            <dt>MongoDB</dt>
            <dd>{health.mongo}</dd>
            <dt>Timezone</dt>
            <dd>{health.timezone}</dd>
            <dt>API</dt>
            <dd>
              {apiSource === 'local' ? 'local fallback' : 'remote'}{' '}
              <span className="muted">({apiBase})</span>
            </dd>
          </dl>
        )}
      </section>

      <footer className="foot">
        ReactJS Web MVP — Sprint 2 shell. Login/attendance flows land in later tasks.
      </footer>
    </main>
  );
}
