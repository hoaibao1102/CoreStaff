import { CookieOptions, Response } from 'express';
import { REFRESH_TTL_MS, SESSION_TTL_MS } from './session-ttl';

/** Access cookie — SRS §4.4 short-lived (30 min idle), HttpOnly, never read by the frontend. */
export const COOKIE_NAME = 'sid';
/** Refresh cookie — 14 days, only ever exchanged by POST /api/auth/refresh. */
export const REFRESH_COOKIE_NAME = 'rt';

/**
 * SameSite=None + Secure in production: the deployed web app and the API are
 * different origins and rely on credentialed cross-site fetches. Locally the
 * Vite proxy makes the cookies first-party, so Lax works.
 *
 * `path: '/'` is load-bearing, not shorthand: the dev proxies rewrite the cookie
 * path and their rewrite corrupts any deeper one (`/api/auth/refresh` comes out
 * as `/apiauth/refresh`), which would silently stop the browser from sending
 * `rt`. The refresh token is scoped by being the only credential that
 * POST /api/auth/refresh accepts, not by its path.
 */
export function sessionCookieOptions(): CookieOptions {
	const production = process.env.NODE_ENV === 'production';
	return {
		httpOnly: true,
		secure: production,
		sameSite: production ? 'none' : 'lax',
		path: '/',
	};
}

/** Issue the cookies for a new session. `refreshToken` is present only on login. */
export function setSessionCookies(res: Response, sessionId: string, refreshToken?: string): void {
	res.cookie(COOKIE_NAME, sessionId, { ...sessionCookieOptions(), maxAge: SESSION_TTL_MS });
	if (refreshToken) {
		res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...sessionCookieOptions(), maxAge: REFRESH_TTL_MS });
	}
}

/** Clearing mirrors the set options exactly — a mismatch leaves the cookie live. */
export function clearSessionCookies(res: Response): void {
	res.clearCookie(COOKIE_NAME, sessionCookieOptions());
	res.clearCookie(REFRESH_COOKIE_NAME, sessionCookieOptions());
}
