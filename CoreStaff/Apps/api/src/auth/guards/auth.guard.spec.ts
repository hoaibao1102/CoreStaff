import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { hashToken } from '../strategies/token-strategy';

const RAW = 'a'.repeat(64); // fake 32-byte hex token
const TH = hashToken(RAW);
const ORG = 'org-1';

function makeGuard(opts: {
	session?: Record<string, unknown> | null;
	user?: Record<string, unknown> | null;
}) {
	const sessionModel = {
		findOne(filter: Record<string, unknown>) {
			const ok = opts.session && filter.tokenHash === opts.session.tokenHash && filter.revokedAt === null;
			return { lean: async () => (ok ? opts.session : null) };
		},
	};
	const userModel = {
		findById(_id: unknown) {
			return { select: () => ({ lean: async () => opts.user ?? null }) };
		},
	};
	return new AuthGuard(userModel as never, sessionModel as never);
}

function reqWithCookie(cookie?: string) {
	return { headers: cookie ? { cookie } : {}, user: undefined, tenantContext: undefined };
}

function ctxFor(req: unknown): ExecutionContext {
	return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

const future = new Date(Date.now() + 60_000);

describe('AuthGuard — session + tenant derivation (TASK-016/017)', () => {
	it('rejects missing cookie → 401', async () => {
		const guard = makeGuard({ session: null });
		const req = reqWithCookie();
		await expect(guard.canActivate(ctxFor(req))).rejects.toMatchObject({ status: 401 });
	});

	it('rejects cookie with no sid → 401', async () => {
		const guard = makeGuard({});
		const req = reqWithCookie('other=1');
		await expect(guard.canActivate(ctxFor(req))).rejects.toMatchObject({ status: 401 });
	});

	it('rejects unknown/expired session (token HASH looked up) → 401', async () => {
		const guard = makeGuard({ session: null });
		const req = reqWithCookie(`sid=${RAW}`);
		await expect(guard.canActivate(ctxFor(req))).rejects.toMatchObject({ status: 401 });
	});

	it('attaches user + tenantContext derived from SESSION (BR-TENANT-01)', async () => {
		// Session org is authoritative; the user doc's own org must be ignored.
		const guard = makeGuard({
			session: { tokenHash: TH, userId: 'u1', organizationId: ORG, expiresAt: future, revokedAt: null },
			user: { _id: 'u1', role: 'HR', organizationId: 'DIFFERENT-ORG' },
		});
		const req = reqWithCookie(`sid=${RAW}`);
		const ok = await guard.canActivate(ctxFor(req));
		expect(ok).toBe(true);
		expect(req.tenantContext).toEqual({ organizationId: ORG });
		expect(req.user).toMatchObject({ _id: 'u1', organizationId: ORG });
		expect(req.user).not.toHaveProperty('passwordHash');
	});

	it('platform SYSTEM_ADMIN session (no org) → tenantContext.organizationId null', async () => {
		const guard = makeGuard({
			session: { tokenHash: TH, userId: 'admin', organizationId: null, expiresAt: future, revokedAt: null },
			user: { _id: 'admin', role: 'SYSTEM_ADMIN' },
		});
		const req = reqWithCookie(`sid=${RAW}`);
		await guard.canActivate(ctxFor(req));
		expect(req.tenantContext).toEqual({ organizationId: null });
	});

	it('rejects when session valid but user missing → 401', async () => {
		const guard = makeGuard({
			session: { tokenHash: TH, userId: 'u1', organizationId: ORG, expiresAt: future, revokedAt: null },
			user: null,
		});
		const req = reqWithCookie(`sid=${RAW}`);
		await expect(guard.canActivate(ctxFor(req))).rejects.toMatchObject({ status: 401 });
	});
});
