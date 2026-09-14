import { AuthService } from './auth.service';
import { UserStatus } from '../database/schemas/enums';
import { hashPassword } from './strategies/bcrypt.strategy';
import { hashToken } from './strategies/token-strategy';
import { ChangePasswordDto } from './dto/change-password.dto';

/**
 * Model fakes: AuthService only touches the methods below. Real bcryptjs +
 * node:crypto run for genuine hashing; no in-memory Mongo dependency.
 */
interface UserRow {
	_id: string;
	emailN: string;
	employeeCode?: string;
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

function makeUser(partial: Partial<UserRow> & { _id: string; passwordHash: string }): UserRow {
	const row: UserRow = {
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

function build(user: UserRow | null) {
	const sessions: Record<string, unknown>[] = [];
	const userModel = {
		findOne(_q: unknown) {
			return { exec: async () => user };
		},
		findById(id: string) {
			const chain = {
				exec: async () => (user && user._id === id ? user : null),
				orFail: async () => {
					if (!(user && user._id === id)) throw new Error('NotFound');
					return user;
				},
			};
			return chain;
		},
		findOneAndUpdate: async () => user,
		findByIdAndUpdate: (_id: string, _u: unknown) => ({ exec: async () => user }),
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
	return { service: new AuthService(userModel as never, sessionModel as never), sessions };
}

const PASSWORD = 'Passw0rd!';

async function activeUser() {
	return makeUser({ _id: 'u1', emailN: 'hr@tvs.local', employeeCode: 'HR-A', passwordHash: await hashPassword(PASSWORD) });
}

describe('AuthService.login (TASK-016)', () => {
	it('returns safe user + sessionId, creates a session with token HASH (not raw)', async () => {
		const user = await activeUser();
		const { service, sessions } = build(user);
		const res = await service.login({ identifier: 'HR@TVS.local', password: PASSWORD });

		expect(res.user).not.toHaveProperty('passwordHash');
		expect(res.user).toMatchObject({ _id: 'u1' });
		expect(res.sessionId).toHaveLength(64); // 32 bytes hex
		expect(sessions[0]).toMatchObject({ userId: 'u1', tokenHash: hashToken(res.sessionId) });
	});

	it('matches by case-insensitive employeeCode', async () => {
		const user = await activeUser();
		const { service } = build(user);
		await expect(service.login({ identifier: ' hr-a ', password: PASSWORD })).resolves.toBeTruthy();
	});

	it('rejects unknown identifier → 401 AUTH_INVALID_CREDENTIALS', async () => {
		const { service } = build(null);
		await expect(service.login({ identifier: 'nope', password: 'x' })).rejects.toMatchObject({
			response: { message: 'AUTH_INVALID_CREDENTIALS' },
			status: 401,
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
		const { service } = build(user);
		const me = await service.getMe('u1');
		expect(me).not.toHaveProperty('passwordHash');
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
