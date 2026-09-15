import { useEffect, useState } from 'react';

/** Ignore responses from a previous filter, account, API source or unmounted screen. */
export function useHrResource<T>(load: (() => Promise<T>) | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ source: typeof load; data?: T; error?: unknown }>({ source: null });
  useEffect(() => {
    if (!load) return;
    let current = true;
    setResult({ source: load });
    load().then(data => { if (current) setResult({ source: load, data }); },
      error => { if (current) setResult({ source: load, error }); });
    return () => { current = false; };
  }, [load, attempt]);
  const active: { data?: T; error?: unknown } = result.source === load ? result : {};
  return { data: active.data, error: active.error, loading: !!load && !active.data && !active.error,
    retry: () => setAttempt(value => value + 1) };
}
