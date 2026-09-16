import { AuthService } from './auth.service';
import { UserStatus } from '../database/schemas/enums';
import { hashPassword } from './strategies/bcrypt.strategy';
import { hashToken } from './strategies/token-strategy';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetMailer } from './strategies/reset-mailer';

/**
 * Model fakes: AuthService only touches the methods below. Real bcryptjs +
 * node:crypto run for genuine hashing; no in-memory Mongo dependency.
 */
interface UserRow {
	_id: string;
	email: string;
	emailN: string;
	passwordHash: string;
	organizationId?: string;
	role: string;
	status: string;
	mustChangePassword: boolean;
	failedLoginCount: number;
	lockedUntil?: Date;
	toObject(): Record<string, unknown>;
	save(): Promise<unknown>;
}

/** EmployeeProfile carries the code; User no longer does (TASK-120). */
interface ProfileRow {
	_id: string;
	organizationId?: string;
	userId: string;
	employeeCode: string;
}

function makeUser(partial: Partial<UserRow> & { _id: string; passwordHash: string }): UserRow {
	const row: UserRow = {
		email: '',
		emailN: '',
		role: 'HR',
		status: UserStatus.ACTIVE,
		mustChangePassword: false,
		failedLoginCount: 0,
		toObject() {
			const { toObject: _t, save: _s, ...rest } = this as unknown as Record<string, unknown>;
			return rest as Record<string, unknown>;
		},
		async save() {
			return this;
		},
		...partial,
	};
	return row;
}

function build(userOrUsers: UserRow | UserRow[] | null, profiles: ProfileRow[] = [], orgs: Array<{ _id: string; status: string }> = []) {
	const users = (Array.isArray(userOrUsers) ? userOrUsers : userOrUsers ? [userOrUsers] : []) as UserRow[];
	const one = users[0] ?? null;
	const sessions: Record<string, unknown>[] = [];
	const resetTokens: Record<string, unknown>[] = [];
	// Minimal query evaluator for the shapes AuthService actually issues:
	// login's { emailN } lookup and forgotPassword's { emailN, status }.
	// Unknown keys are ignored (fake, not Mongo).
	const matches = (u: UserRow, q: Record<string, unknown>): boolean => {
		if (q._id !== undefined && String(u._id) !== String(q._id)) return false;
		if (q.organizationId !== undefined && String(u.organizationId ?? '') !== String(q.organizationId ?? '')) return false;
		if (q.emailN !== undefined && u.emailN !== q.emailN) return false;
		if (typeof q.status === 'string' && u.status !== q.status) return false;
		return true;
	};
	const findUser = (q: Record<string, unknown>): UserRow | null => users.find((u) => matches(u, q)) ?? null;

	const userModel = {
		findOne(q: unknown) {
			return { exec: async () => findUser(q as Record<string, unknown>) };
		},
		find(q: unknown) {
			// `find` backs login's multi-tenant probe and forgotPassword's fan-out.
			const query = q as Record<string, unknown>;
			return {
				exec: async () =>
					users.filter((u) => matches(u, query)),
			};
		},
		findById(id: string) {
			const u = users.find((x) => x._id === id) ?? null;
			const chain = {
				exec: async () => u,
				orFail: async () => {
					if (!u) throw new Error('NotFound');
					return u;
				},
			};
			return chain;
		},
		findOneAndUpdate: async () => one,
		findByIdAndUpdate: (_id: string, _u: unknown) => ({ exec: async () => one }),
	};
	// EmployeeProfile owns employeeCode (TASK-120): login resolves codes here.
	const profileModel = {
		findOne(q: Record<string, unknown>) {
			const run = async () =>
				profiles.find(
					(p) =>
						(q.employeeCode === undefined || p.employeeCode === q.employeeCode) &&
						(q.userId === undefined || String(p.userId) === String(q.userId)) &&
						(q.organizationId === undefined || String(p.organizationId ?? '') === String(q.organizationId ?? '')),
				) ?? null;
			return { lean: () => ({ exec: run }), exec: run };
		},
	};
	const sessionModel = {
		create: async (doc: Record<string, unknown>) => {
			sessions.push({ revokedAt: null, ...doc });
			return doc;
		},
		updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
			const s = sessions.find((x) => x.tokenHash === filter.tokenHash);
			if (s) Object.assign(s, update);
			return Promise.resolve({ modifiedCount: s ? 1 : 0 });
		},
		updateMany(filter: Record<string, unknown>, update: Record<string, unknown>) {
			const run = async () => {
				let n = 0;
				for (const s of sessions) {
					const th = filter.tokenHash;
					const matchNe =
						th && typeof th === 'object' && '$ne' in (th as object)
							? s.tokenHash !== (th as { $ne: unknown }).$ne
							: s.tokenHash === th;
					if (
						(filter.userId === undefined || s.userId === filter.userId) &&
						(filter.revokedAt === undefined || s.revokedAt === filter.revokedAt) &&
						(th === undefined || matchNe)
					) {
						Object.assign(s, update);
						n++;
					}
				}
				return { modifiedCount: n };
			};
			return { exec: run };
		},
	};
	// Reset-token store: honours the { usedAt: null, expiresAt: { $gt } } claim
	// filter and the usedAt tombstone the same way Mongo would.
	const resetTokenModel = {
		create: async (doc: Record<string, unknown>) => {
			resetTokens.push({ usedAt: null, ...doc });
			return doc;
		},
		findOneAndUpdate(
			filter: Record<string, unknown>,
			update: Record<string, unknown>,
			_opts?: Record<string, unknown>,
		) {
			const run = async () => {
				const expires = filter.expiresAt as { $gt?: Date } | undefined;
				const doc = resetTokens.find(
					(t) =>
						t.tokenHash === filter.tokenHash &&
						t.usedAt === filter.usedAt &&
						(!expires?.$gt || (t.expiresAt as Date) > expires.$gt),
				);
				if (doc) Object.assign(doc, update);
				return doc ?? null;
			};
			return { exec: run };
		},
		updateMany(filter: Record<string, unknown>, update: Record<string, unknown>) {
			const run = async () => {
				let n = 0;
				for (const t of resetTokens) {
					if (
						(filter.userId === undefined || t.userId === filter.userId) &&
						(filter.usedAt === undefined || t.usedAt === filter.usedAt)
					) {
						Object.assign(t, update);
						n++;
					}
				}
				return { modifiedCount: n };
			};
			return { exec: run };
		},
	};
	const sent: Array<{ email: string; rawToken: string }> = [];
	const mailer: ResetMailer = {
		async sendResetEmail(email, rawToken) {
			sent.push({ email, rawToken });
		},
	};
	const service = new AuthService(
		userModel as never,
		sessionModel as never,
		resetTokenModel as never,
		profileModel as never,
		// login's tenant-status gate; an unknown org resolves to null, which the
		// gate treats as unlocked, so tests that don't seed one are unaffected.
		{
			findOne(q: Record<string, unknown>) {
				const run = async () => {
					const org = orgs.find((o) => String(o._id) === String(q._id));
					return org ? { status: org.status } : null;
				};
				const chainable = { exec: run };
				return { select: () => ({ lean: () => chainable }), lean: () => chainable, exec: run };
			},
		} as never,
		mailer as never,
	);
	return { service, sessions, resetTokens, sent };
}

const PASSWORD = 'Passw0rd!';

const HR_PROFILE: ProfileRow = { _id: 'p1', userId: 'u1', employeeCode: 'HR-A' };

async function activeUser() {
	return makeUser({
		_id: 'u1',
		email: 'hr@tvs.local',
		emailN: 'hr@tvs.local',
		passwordHash: await hashPassword(PASSWORD),
	});
}

describe('AuthService.login (TASK-016)', () => {
	it('returns safe user + sessionId, creates a session with token HASH (not raw)', async () => {
		const user = await activeUser();
		const { service, sessions } = build(user, [HR_PROFILE]);
		const res = await service.login({ identifier: 'HR@TVS.local', password: PASSWORD });

		expect(res.user).not.toHaveProperty('passwordHash');
		expect(res.user).toMatchObject({ _id: 'u1', employeeCode: 'HR-A' });
		expect(res.sessionId).toHaveLength(64); // 32 bytes hex
		expect(sessions[0]).toMatchObject({ userId: 'u1', tokenHash: hashToken(res.sessionId) });
	});

	it('matches by case-folded employeeCode resolved through EmployeeProfile', async () => {
		const user = await activeUser();
		const { service } = build(user, [HR_PROFILE]);
		const res = await service.login({ identifier: ' hr-a ', password: PASSWORD });
		expect(res.user).toMatchObject({ _id: 'u1', employeeCode: 'HR-A' });
	});

	it('logs in an account that has no EmployeeProfile by email only, employeeCode null', async () => {
		const user = await activeUser();
		const { service } = build(user, []);
		const res = await service.login({ identifier: 'hr@tvs.local', password: PASSWORD });
		expect(res.user).toMatchObject({ _id: 'u1', employeeCode: undefined });
	});

	it('rejects unknown identifier → 401 AUTH_INVALID_CREDENTIALS', async () => {
		const { service } = build(null);
		await expect(service.login({ identifier: 'nope', password: 'x' })).rejects.toMatchObject({
			response: { message: 'AUTH_INVALID_CREDENTIALS' },
			status: 401,
		});
	});

	it('fails closed when one email exists in two tenants → AUTH_AMBIGUOUS_IDENTIFIER', async () => {
		const shared = 'shared@x.local';
		const a = makeUser({ _id: 'uA', email: shared, emailN: shared, organizationId: 'orgA', passwordHash: await hashPassword(PASSWORD) });
		const b = makeUser({ _id: 'uB', email: shared, emailN: shared, organizationId: 'orgB', passwordHash: await hashPassword(PASSWORD) });
		const { service } = build([a, b]);
		await expect(service.login({ identifier: shared, password: PASSWORD })).rejects.toMatchObject({
			status: 401,
			response: { message: 'AUTH_AMBIGUOUS_IDENTIFIER' },
		});
	});

	it('wrong password increments failedLoginCount', async () => {
		const user = await activeUser();
		const { service } = build(user);
		await expect(service.login({ identifier: 'hr@tvs.local', password: 'WRONG' })).rejects.toBeTruthy();
		expect(user.failedLoginCount).toBe(1);
	});

	it('disables → 403 AUTH_ACCOUNT_DISABLED', async () => {
		const user = await activeUser();
		user.status = UserStatus.DISABLED;
		const { service } = build(user);
		await expect(service.login({ identifier: 'hr@tvs.local', password: PASSWORD })).rejects.toMatchObject({ status: 403 });
	});

	it('locked (lockedUntil ahead) → 423 AUTH_ACCOUNT_LOCKED', async () => {
		const user = await activeUser();
		user.status = UserStatus.LOCKED;
		user.lockedUntil = new Date(Date.now() + 60_000);
		const { service } = build(user);
		await expect(service.login({ identifier: 'hr@tvs.local', password: PASSWORD })).rejects.toMatchObject({ status: 423 });
	});

	// AC-SYS-02 — the other half of the suspend switch: live sessions were
	// revoked by the route, new ones die here.
	describe('tenant status gate (AC-SYS-02)', () => {
		const tenantUser = async () =>
			makeUser({
				_id: 'u1',
				email: 'hr@tvs.local',
				emailN: 'hr@tvs.local',
				organizationId: 'orgA',
				passwordHash: await hashPassword(PASSWORD),
			});

		it('SUSPENDED organization → 423 TENANT_SUSPENDED', async () => {
			const user = await tenantUser();
			const { service, sessions } = build(user, [], [{ _id: 'orgA', status: 'SUSPENDED' }]);
			await expect(service.login({ identifier: 'hr@tvs.local', password: PASSWORD })).rejects.toMatchObject({
				status: 423,
				message: 'TENANT_SUSPENDED',
			});
			// Refused before the session was ever written.
			expect(sessions).toHaveLength(0);
		});

		it('DISABLED organization is refused too (one code, no second enum to leak)', async () => {
			const user = await tenantUser();
			const { service } = build(user, [], [{ _id: 'orgA', status: 'DISABLED' }]);
			await expect(service.login({ identifier: 'hr@tvs.local', password: PASSWORD })).rejects.toMatchObject({
				status: 423,
			});
		});

		it('ACTIVE organization logs in normally', async () => {
			const user = await tenantUser();
			const { service } = build(user, [], [{ _id: 'orgA', status: 'ACTIVE' }]);
			await expect(service.login({ identifier: 'hr@tvs.local', password: PASSWORD })).resolves.toMatchObject({
				mustChangePassword: false,
			});
		});

		it('platform-local session (organizationId null) is not tenant-gated', async () => {
			const admin = makeUser({
				_id: 'u9',
				email: 'admin@platform.local',
				emailN: 'admin@platform.local',
				role: 'SYSTEM_ADMIN',
				passwordHash: await hashPassword(PASSWORD),
			});
			const { service } = build(admin);
			await expect(service.login({ identifier: 'admin@platform.local', password: PASSWORD })).resolves.toBeTruthy();
		});
	});

	it('locks after 5th failure (sets lockedUntil)', async () => {
		const user = await activeUser();
		const { service } = build(user);
		for (let i = 0; i < 5; i++) {
			await service.login({ identifier: 'hr@tvs.local', password: 'WRONG' }).catch(() => undefined);
		}
		expect(user.failedLoginCount).toBe(5);
		expect(user.lockedUntil).toBeInstanceOf(Date);
	});

	it('resets counters on success after prior failures', async () => {
		const user = await activeUser();
		user.failedLoginCount = 3;
		user.lockedUntil = new Date(Date.now() - 1000); // expired lock
		const { service } = build(user);
		await service.login({ identifier: 'hr@tvs.local', password: PASSWORD });
		expect(user.failedLoginCount).toBe(0);
		expect(user.lockedUntil).toBeUndefined();
	});
});

describe('AuthService.getMe / changePassword (TASK-016)', () => {
	it('getMe strips passwordHash', async () => {
		const user = await activeUser();
		const { service } = build(user, [HR_PROFILE]);
		const me = await service.getMe('u1');
		expect(me).not.toHaveProperty('passwordHash');
		expect(me).toMatchObject({ employeeCode: 'HR-A' });
	});

	it('getMe rejects non-ACTIVE → 401', async () => {
		const user = await activeUser();
		user.status = UserStatus.DISABLED;
		const { service } = build(user);
		await expect(service.getMe('u1')).rejects.toMatchObject({ status: 401 });
	});

	it('changePassword: mismatch confirm → 400', async () => {
		const user = await activeUser();
		const { service } = build(user);
		const dto = { currentPassword: PASSWORD, newPassword: 'NewPass1!', confirmPassword: 'different' } as ChangePasswordDto;
		await expect(service.changePassword('u1', dto)).rejects.toBeTruthy();
	});

	it('changePassword: wrong current → AUTH_CURRENT_PASSWORD_INVALID', async () => {
		const user = await activeUser();
		const { service } = build(user);
		const dto = { currentPassword: 'WRONG', newPassword: 'NewPass1!', confirmPassword: 'NewPass1!' } as ChangePasswordDto;
		await expect(service.changePassword('u1', dto)).rejects.toMatchObject({
			response: { message: 'AUTH_CURRENT_PASSWORD_INVALID' },
		});
	});

	it('changePassword: reuse current as new → AUTH_PASSWORD_POLICY_FAILED', async () => {
		const user = await activeUser();
		const { service } = build(user);
		const dto = { currentPassword: PASSWORD, newPassword: PASSWORD, confirmPassword: PASSWORD } as ChangePasswordDto;
		await expect(service.changePassword('u1', dto)).rejects.toMatchObject({
			response: { message: 'AUTH_PASSWORD_POLICY_FAILED' },
		});
	});

	it('changePassword: valid → new hash, clears mustChangePassword, revokes other sessions', async () => {
		const user = await activeUser();
		user.mustChangePassword = true;
		const { service, sessions } = build(user);
		const keep = await service.login({ identifier: 'hr@tvs.local', password: PASSWORD });
		sessions.push({ userId: 'u1', tokenHash: 'other-hash', revokedAt: null, expiresAt: new Date() });

		const dto = { currentPassword: PASSWORD, newPassword: 'NewPass1!', confirmPassword: 'NewPass1!' } as ChangePasswordDto;
		await service.changePassword('u1', dto, keep.sessionId);

		expect(user.mustChangePassword).toBe(false);
		expect(await (await import('./strategies/bcrypt.strategy')).comparePassword('NewPass1!', user.passwordHash)).toBe(true);
		// current session survives; the other is revoked
		expect(sessions.find((s) => s.tokenHash === hashToken(keep.sessionId))?.revokedAt).toBeNull();
		expect(sessions.find((s) => s.tokenHash === 'other-hash')?.revokedAt).toBeInstanceOf(Date);
	});
});

describe('AuthService forgot/reset password (TASK-016, FR-AUTH-05)', () => {
	it('forgotPassword stores the token HASH, never the raw token, with a 15-min TTL', async () => {
		const user = await activeUser();
		const { service, resetTokens, sent } = build(user);

		const res = await service.forgotPassword('HR@TVS.local');
		expect(res).toEqual({ success: true });
		expect(resetTokens).toHaveLength(1);
		expect(sent).toHaveLength(1);

		const raw = sent[0].rawToken;
		expect(raw).toHaveLength(64); // 32 bytes hex
		expect(resetTokens[0].tokenHash).toBe(hashToken(raw));
		expect(JSON.stringify(resetTokens[0])).not.toContain(raw); // not stored anywhere
		const ttl = (resetTokens[0].expiresAt as Date).getTime() - Date.now();
		expect(ttl).toBeGreaterThan(14 * 60_000);
		expect(ttl).toBeLessThanOrEqual(15 * 60_000);
	});

	it('forgotPassword is enumeration-proof: unknown and DISABLED emails look identical and store nothing', async () => {
		const user = await activeUser();
		user.status = UserStatus.DISABLED;
		const { service, resetTokens, sent } = build(user);

		await expect(service.forgotPassword('nobody@tvs.local')).resolves.toEqual({ success: true });
		await expect(service.forgotPassword('hr@tvs.local')).resolves.toEqual({ success: true });
		expect(resetTokens).toHaveLength(0);
		expect(sent).toHaveLength(0);
	});

	it('resetPassword: happy path sets the new password and clears mustChangePassword + locks', async () => {
		const user = await activeUser();
		user.mustChangePassword = true;
		user.failedLoginCount = 4;
		user.lockedUntil = new Date(Date.now() + 60_000);
		const { service, sent } = build(user);
		await service.forgotPassword('hr@tvs.local');

		await expect(service.resetPassword(sent[0].rawToken, 'NewPass1!')).resolves.toEqual({ success: true });
		const { comparePassword } = await import('./strategies/bcrypt.strategy');
		expect(await comparePassword('NewPass1!', user.passwordHash)).toBe(true);
		expect(user.mustChangePassword).toBe(false);
		expect(user.failedLoginCount).toBe(0);
		expect(user.lockedUntil).toBeUndefined();
	});

	it('resetPassword consumes the token AND revokes every session for the account (SRS §4.8)', async () => {
		const user = await activeUser();
		const { service, sessions, resetTokens, sent } = build(user);
		const login = await service.login({ identifier: 'hr@tvs.local', password: PASSWORD });
		sessions.push({ userId: 'u1', tokenHash: 'another-session', revokedAt: null, expiresAt: new Date() });
		await service.forgotPassword('hr@tvs.local');

		await service.resetPassword(sent[0].rawToken, 'NewPass1!');

		expect(sessions.every((s) => s.revokedAt instanceof Date)).toBe(true);
		// the used token is tombstoned, so a replay cannot find an unused doc
		expect(resetTokens[0].usedAt).toBeInstanceOf(Date);
		await expect(service.resetPassword(sent[0].rawToken, 'NewPass2!')).rejects.toMatchObject({
			status: 401,
			response: { message: 'AUTH_RESET_TOKEN_INVALID' },
		});
	});

	it('resetPassword: expired token → 401, same generic code as unknown/reused', async () => {
		const user = await activeUser();
		const { service, resetTokens, sent } = build(user);
		await service.forgotPassword('hr@tvs.local');
		resetTokens[0].expiresAt = new Date(Date.now() - 1000); // simulate >15 min

		await expect(service.resetPassword(sent[0].rawToken, 'NewPass1!')).rejects.toMatchObject({ status: 401 });
		await expect(service.resetPassword('bogus'.repeat(20), 'NewPass1!')).rejects.toMatchObject({
			response: { message: 'AUTH_RESET_TOKEN_INVALID' },
		});
	});

	it('resetPassword: weak new password and reuse of the current one → 400 POLICY_FAILED, password untouched', async () => {
		const user = await activeUser();
		const { service, sent } = build(user);
		await service.forgotPassword('hr@tvs.local');
		const before = user.passwordHash;

		await expect(service.resetPassword(sent[0].rawToken, 'short')).rejects.toMatchObject({
			status: 400,
			response: { message: 'AUTH_PASSWORD_POLICY_FAILED' },
		});
		expect(user.passwordHash).toBe(before);
		// The claim is consumed even by a failed attempt — a reset token is
		// one-time no matter how it ends, so it can't be probed for passwords.
		await expect(service.resetPassword(sent[0].rawToken, 'NewPass1!')).rejects.toMatchObject({ status: 401 });
	});

	it('resetPassword: token whose account was disabled afterwards → 401, password untouched', async () => {
		const user = await activeUser();
		const { service, sent } = build(user);
		await service.forgotPassword('hr@tvs.local');
		user.status = UserStatus.DISABLED;

		const before = user.passwordHash;
		await expect(service.resetPassword(sent[0].rawToken, 'NewPass1!')).rejects.toMatchObject({ status: 401 });
		expect(user.passwordHash).toBe(before);
	});

	it('forgotPassword fans out to every ACTIVE tenant sharing the address; tokens stay user-bound', async () => {
		const shared = 'shared@x.local';
		const a = makeUser({ _id: 'uA', email: shared, emailN: shared, organizationId: 'orgA', passwordHash: await hashPassword(PASSWORD) });
		const b = makeUser({ _id: 'uB', email: shared, emailN: shared, organizationId: 'orgB', passwordHash: await hashPassword(PASSWORD) });
		const { service, resetTokens, sent } = build([a, b]);

		await service.forgotPassword(shared);
		expect(sent).toHaveLength(2);
		expect(resetTokens.map((t) => t.userId)).toEqual(['uA', 'uB']);

		await expect(service.resetPassword(sent[0].rawToken, 'NewPass1!')).resolves.toBeTruthy();
		// uA got the new password; uB is untouched (its own token is still unused).
		const { comparePassword } = await import('./strategies/bcrypt.strategy');
		expect(await comparePassword('NewPass1!', a.passwordHash)).toBe(true);
		expect(await comparePassword(PASSWORD, b.passwordHash)).toBe(true);
	});
});
