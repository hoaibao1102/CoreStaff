import { AuthController } from './auth.controller';
import { REFRESH_COOKIE_NAME, COOKIE_NAME, sessionCookieOptions } from './session-cookies';
import { REFRESH_TTL_MS, SESSION_TTL_MS } from './session-ttl';

describe('AuthController session cookies', () => {
	const originalNodeEnv = process.env.NODE_ENV;

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv;
	});

	it('uses SameSite=None and Secure in production so cross-site web calls keep the session', async () => {
		process.env.NODE_ENV = 'production';
		const authService = {
			login: jest.fn(async () => ({
				user: { id: 'u1' },
				mustChangePassword: true,
				sessionId: 'sid-value',
				refreshToken: 'rt-value',
			})),
		};
		const res = { cookie: jest.fn() };
		const controller = new AuthController(authService as never);

		await controller.login(res as never, { identifier: 'hr@example.test', password: 'Passw0rd!' });

		expect(sessionCookieOptions()).toMatchObject({ sameSite: 'none', secure: true, httpOnly: true, path: '/' });
		expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, 'sid-value', expect.objectContaining({
			sameSite: 'none',
			secure: true,
			httpOnly: true,
			path: '/',
			maxAge: SESSION_TTL_MS,
		}));
		// SRS §4.4: the refresh token is a cookie too — never in the body, and
		// it outlives the session cookie by far.
		expect(res.cookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, 'rt-value', expect.objectContaining({
			httpOnly: true,
			maxAge: REFRESH_TTL_MS,
		}));
	});

	it('keeps Lax cookies for local development', () => {
		process.env.NODE_ENV = 'development';

		expect(sessionCookieOptions()).toMatchObject({ sameSite: 'lax', secure: false, httpOnly: true, path: '/' });
	});

	it('logout clears both cookies with the options they were set with', async () => {
		const authService = { logout: jest.fn(async () => undefined) };
		const res = { cookie: jest.fn(), clearCookie: jest.fn() };
		const controller = new AuthController(authService as never);

		await controller.logout({ headers: { cookie: `${COOKIE_NAME}=sid-value` } } as never, res as never);

		expect(authService.logout).toHaveBeenCalledWith('sid-value');
		// Both cookies are cleared with the exact options they were set with.
		expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_NAME, sessionCookieOptions());
		expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, sessionCookieOptions());
	});
});

describe('AuthController.refresh', () => {
	it('renews `sid` from `rt` and returns the same envelope shape as login', async () => {
		const authService = {
			refreshSession: jest.fn(async () => ({ sessionId: 'new-sid', user: { _id: 'u1' } })),
		};
		const res = { cookie: jest.fn(), clearCookie: jest.fn() };
		const controller = new AuthController(authService as never);

		const body = await controller.refresh(
			{ headers: { cookie: `${REFRESH_COOKIE_NAME}=rt-value` } } as never,
			res as never,
		);

		expect(authService.refreshSession).toHaveBeenCalledWith('rt-value');
		expect(body).toEqual({ success: true, data: { user: { _id: 'u1' } } });
		// Only the access cookie is re-issued: an absent refreshToken argument
		// must leave the existing `rt` untouched, or every refresh would reset
		// the 14-day ceiling.
		expect(res.cookie).toHaveBeenCalledTimes(1);
		expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, 'new-sid', expect.objectContaining({ maxAge: SESSION_TTL_MS }));
	});

	it('missing refresh cookie → 401 without touching the service', async () => {
		const authService = { refreshSession: jest.fn() };
		const controller = new AuthController(authService as never);

		await expect(
			controller.refresh({ headers: { cookie: `${COOKIE_NAME}=sid-only` } } as never, { cookie: jest.fn() } as never),
		).rejects.toMatchObject({ status: 401 });
		expect(authService.refreshSession).not.toHaveBeenCalled();
	});
});
