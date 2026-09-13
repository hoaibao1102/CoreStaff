import { useEffect, useState } from 'react';

interface HealthResponse {
  status: string;
  service: string;
  mongo: 'configured' | 'missing';
  timezone: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/healthz')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
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
          </dl>
        )}
      </section>

      <footer className="foot">
        ReactJS Web MVP — Sprint 2 shell. Login/attendance flows land in later tasks.
      </footer>
    </main>
  );
}