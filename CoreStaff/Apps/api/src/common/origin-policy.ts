/**
 * Browser origin policy shared by HTTP CORS, the unsafe-method origin gate and
 * Socket.IO (AUD-C09).
 *
 * - No `Origin` header: not a browser cross-site request (native mobile apps,
 *   curl, server-to-server) -> allowed; cookies are not ambient there.
 * - `Origin` present: must exactly match `CORS_ORIGINS` (comma separated).
 * - Outside production, loopback origins are also allowed for local dev.
 * - Production with an empty list denies every browser origin (fail closed).
 */
type Env = Record<string, string | undefined>;

const normalize = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase();

export function parseAllowedOrigins(env: Env = process.env): string[] {
  return (env.CORS_ORIGINS ?? '')
    .split(',')
    .map(normalize)
    .filter(Boolean);
}

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const VERCEL_DOMAIN = /^https:\/\/[a-z0-9-_.]+\.vercel\.app$/i;

export function isOriginAllowed(origin: string | undefined | null, env: Env = process.env): boolean {
  if (!origin) return true;
  const candidate = normalize(origin);
  if (parseAllowedOrigins(env).includes(candidate)) return true;
  if (VERCEL_DOMAIN.test(candidate)) return true;
  if (env.NODE_ENV !== 'production' && LOOPBACK.test(candidate)) return true;
  return false;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Express middleware: reject state-changing requests whose Origin is not
 * allowed. CORS alone does not stop "simple" cross-site requests (for example a
 * multipart form POST) from being processed with the ambient session cookie.
 * A request whose Origin equals its own Host (Swagger UI, same-origin SPA) is
 * allowed.
 */
export function originGate(env: Env = process.env) {
  return (req: any, res: any, next: () => void) => {
    const origin = req.headers?.origin as string | undefined;
    if (!origin || SAFE_METHODS.has(String(req.method).toUpperCase())) return next();
    const host = req.headers?.host as string | undefined;
    let sameOrigin = false;
    try {
      sameOrigin = !!host && new URL(origin).host.toLowerCase() === host.toLowerCase();
    } catch {
      sameOrigin = false;
    }
    if (sameOrigin || isOriginAllowed(origin, env)) return next();
    res.status(403).json({
      success: false,
      error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed.' },
    });
  };
}
