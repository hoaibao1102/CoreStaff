import { isOriginAllowed, originGate, parseAllowedOrigins } from './origin-policy';

const prod = { NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.com, https://hr.example.com/' };

describe('origin policy (AUD-C09)', () => {
	it('parses and normalizes the allowlist', () => {
		expect(parseAllowedOrigins(prod)).toEqual(['https://app.example.com', 'https://hr.example.com']);
		expect(parseAllowedOrigins({})).toEqual([]);
	});

	it('allows listed origins exactly and rejects hostile or look-alike ones', () => {
		expect(isOriginAllowed('https://app.example.com', prod)).toBe(true);
		expect(isOriginAllowed('https://hr.example.com', prod)).toBe(true);
		expect(isOriginAllowed('https://evil.example', prod)).toBe(false);
		expect(isOriginAllowed('https://app.example.com.evil.example', prod)).toBe(false);
		expect(isOriginAllowed('http://app.example.com', prod)).toBe(false);
	});

	it('treats a missing Origin as a native client', () => {
		expect(isOriginAllowed(undefined, prod)).toBe(true);
		expect(isOriginAllowed('', prod)).toBe(true);
	});

	it('fails closed in production when no allowlist is configured', () => {
		expect(isOriginAllowed('https://anything.example', { NODE_ENV: 'production' })).toBe(false);
		expect(isOriginAllowed('http://localhost:5173', { NODE_ENV: 'production' })).toBe(false);
	});

	it('allows loopback only outside production', () => {
		expect(isOriginAllowed('http://localhost:5173', { NODE_ENV: 'development' })).toBe(true);
		expect(isOriginAllowed('http://127.0.0.1:4173', {})).toBe(true);
		expect(isOriginAllowed('https://evil.example', { NODE_ENV: 'development' })).toBe(false);
	});
});

describe('originGate (unsafe-method gate)', () => {
	function run(method: string, headers: Record<string, string>, env = prod) {
		const next = jest.fn();
		const json = jest.fn();
		const res: any = { status: jest.fn().mockReturnValue({ json }) };
		originGate(env)({ method, headers }, res, next);
		return { next, res, json };
	}

	it('blocks an unsafe request from a hostile origin with 403', () => {
		for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
			const { next, res, json } = run(method, { origin: 'https://evil.example', host: 'api.example.com' });
			expect(next).not.toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(403);
			expect(json.mock.calls[0][0].error.code).toBe('ORIGIN_NOT_ALLOWED');
		}
	});

	it('lets allowlisted, same-origin, origin-less and safe-method requests through', () => {
		expect(run('POST', { origin: 'https://app.example.com', host: 'api.example.com' }).next).toHaveBeenCalled();
		expect(run('POST', { origin: 'https://api.example.com', host: 'api.example.com' }).next).toHaveBeenCalled();
		expect(run('POST', { host: 'api.example.com' }).next).toHaveBeenCalled();
		expect(run('GET', { origin: 'https://evil.example', host: 'api.example.com' }).next).toHaveBeenCalled();
		expect(run('OPTIONS', { origin: 'https://evil.example', host: 'api.example.com' }).next).toHaveBeenCalled();
	});

	it('does not treat an unparsable Origin as same-origin', () => {
		const { next, res } = run('POST', { origin: 'null', host: 'api.example.com' });
		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(403);
	});
});
