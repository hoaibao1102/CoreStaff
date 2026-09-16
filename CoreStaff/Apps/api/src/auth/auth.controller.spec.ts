import { AuthController, sessionCookieOptions } from './auth.controller';

describe('AuthController session cookie', () => {
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
			})),
		};
		const res = { cookie: jest.fn() };
		const controller = new AuthController(authService as never);

		await controller.login(res as never, { identifier: 'hr@example.test', password: 'Passw0rd!' });

		expect(sessionCookieOptions()).toMatchObject({ sameSite: 'none', secure: true, httpOnly: true, path: '/' });
		expect(res.cookie).toHaveBeenCalledWith('sid', 'sid-value', expect.objectContaining({
			sameSite: 'none',
			secure: true,
			httpOnly: true,
			path: '/',
			maxAge: 30 * 60 * 1000,
		}));
	});

	it('keeps Lax cookies for local development', () => {
		process.env.NODE_ENV = 'development';

		expect(sessionCookieOptions()).toMatchObject({ sameSite: 'lax', secure: false, httpOnly: true, path: '/' });
	});
});
