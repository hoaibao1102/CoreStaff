import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmploymentStatus } from '../../database/schemas/enums';

interface ProfileRow {
	_id: string;
	organizationId: string;
	userId: string;
	employeeCode: string;
	employmentType: string;
	employmentStatus: string;
	departmentId?: string;
	positionId?: string;
	directManagerId?: string;
	joinDate: string;
	endDate?: Date;
}

interface HistoryRow {
	organizationId: string;
	employeeProfileId: string;
	previousStatus?: string;
	newStatus: string;
	effectiveDate: Date;
	reason?: string;
	changedBy: string;
	createdAt: Date;
}

const DUPLICATE_KEY_ERROR = 11000;

function matches(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
	return Object.entries(filter).every(([k, v]) => row[k] === v);
}

/** Query-like fake: `.lean()` yields a plain object, `.session()` yields a mutable "document". */
function findOneQuery(getRow: () => ProfileRow | undefined) {
	let lean = false;
	const query = {
		lean() {
			lean = true;
			return query;
		},
		session() {
			return query;
		},
		then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
			const row = getRow();
			if (!row) return Promise.resolve(null).then(resolve, reject);
			if (lean) return Promise.resolve({ ...row }).then(resolve, reject);

			const doc: Record<string, unknown> = { ...row };
			doc.toObject = () => {
				const { toObject: _t, save: _s, ...rest } = doc;
				return rest;
			};
			doc.save = async () => {
				const { toObject: _t, save: _s, ...rest } = doc;
				Object.assign(row, rest);
				return doc;
			};
			return Promise.resolve(doc).then(resolve, reject);
		},
	};
	return query;
}

function buildProfileModel(rows: ProfileRow[]) {
	let nextId = rows.length + 1;
	return {
		async create(doc: Partial<ProfileRow>) {
			if (rows.some((r) => r.organizationId === doc.organizationId && r.employeeCode === doc.employeeCode)) {
				throw Object.assign(new Error('duplicate'), { code: DUPLICATE_KEY_ERROR });
			}
			const row = { _id: String(nextId++), ...doc } as ProfileRow;
			rows.push(row);
			return { toObject: () => row };
		},
		find(filter: Record<string, unknown>) {
			return { sort: () => ({ lean: async () => rows.filter((r) => matches(r as never, filter)) }) };
		},
		findOne(filter: Record<string, unknown>) {
			return findOneQuery(() => rows.find((r) => matches(r as never, filter)));
		},
		findOneAndUpdate(filter: Record<string, unknown>, update: { $set: Partial<ProfileRow> }) {
			return {
				lean: async () => {
					const row = rows.find((r) => matches(r as never, filter));
					if (!row) return null;
					Object.assign(row, update.$set);
					return row;
				},
			};
		},
		async exists(filter: Record<string, unknown>) {
			const row = rows.find((r) => matches(r as never, filter));
			return row ? { _id: row._id } : null;
		},
	};
}

function buildHistoryModel(rows: HistoryRow[]) {
	return {
		async create(docs: Partial<HistoryRow>[]) {
			for (const d of docs) rows.push(d as HistoryRow);
			return docs;
		},
		find(filter: Record<string, unknown>) {
			return {
				sort: () => ({
					lean: async () =>
						[...rows]
							.filter((r) => matches(r as never, filter))
							.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
				}),
			};
		},
	};
}

/**
 * `Department`/`Position`/`User` are used for `.exists()` referential checks, and
 * `createSelf` additionally reads the caller's own account through `.findOne()`
 * to copy `email`/`phone` from it (TASK-120/A3: the account owns those values).
 */
function buildRefModel(ids: Record<string, string[]>, docs: Array<Record<string, unknown>> = []) {
	return {
        find({ organizationId, _id }: { organizationId: string; _id: { $in: string[] } }) {
            return { select: () => ({ lean: async () => (ids[organizationId] ?? []).filter(id => _id.$in.includes(id)).map(id => ({ _id: id, name: `Name ${id}`, fullName: `User ${id}` })) }) };
        },
		async exists({ _id, organizationId }: { _id: string; organizationId: string }) {
			return ids[organizationId]?.includes(_id) ? { _id } : null;
		},
		findOne(filter: Record<string, unknown>) {
			const run = async () =>
				docs.find(
					(d) => String(d._id) === String(filter._id) && String(d.organizationId ?? '') === String(filter.organizationId ?? ''),
				) ?? null;
			return { lean: () => ({ exec: run }), exec: run };
		},
	};
}

function fakeConnection() {
	return {
		async startSession() {
			return {
				async withTransaction(fn: () => Promise<void>) {
					await fn();
				},
				async endSession() {},
			};
		},
	};
}

/**
 * Staging transaction for the provisioning path. `fakeConnection` above only
 * awaits the callback, so a rollback test written against it would assert
 * nothing: these models buffer writes made under a session and apply them only
 * when the callback returns, which is what Mongo's transactions do.
 *
 * The service's pre-flight checks query `emailN` / a normalized `employeeCode`,
 * which the real schema's pre-validate hook computes — so callers seed existing
 * rows with those fields already set, and the `fail*` toggles stand in for the
 * unique index rejecting a concurrent insert.
 */
function buildTransactionalFakes(
	accounts: Record<string, unknown>[] = [],
	profilesIn: Record<string, unknown>[] = [],
) {
	let nextId = 1;
	const staged: Array<() => void> = [];
	const write = (store: Record<string, unknown>[], docs: unknown, session?: unknown) => {
		// Mongoose only honours a session in the array form (`create([doc],
		// {session})`); the single-doc form silently runs OUTSIDE the transaction.
		// The live e2e caught provision.ts doing exactly that, so the fake refuses
		// to accept a session with a bare doc — a tripwire, not a convenience.
		if (session && !Array.isArray(docs)) {
			throw new Error('fake: Model.create(doc, {session}) ignores the session — use create([doc], {session})');
		}
		const doc = (Array.isArray(docs) ? docs[0] : docs) as Record<string, unknown>;
		const row = { _id: `id${nextId++}`, ...doc };
		const apply = () => store.push(row);
		if (session) staged.push(apply);
		else apply();
		// Mirrors Mongoose: the array form resolves to an array of docs.
		const created = { _id: row._id, toObject: () => row };
		return Array.isArray(docs) ? [created] : created;
	};
	const dup = (keyPattern: Record<string, number>) =>
		Object.assign(new Error('duplicate key'), { code: 11000, keyPattern });

	const fakes = {
		accounts,
		profiles: profilesIn,
		failUserCreate: false,
		failProfileCreate: false,
		session: {
			async withTransaction(fn: () => Promise<void>) {
				await fn();
				for (const apply of staged.splice(0)) apply();
			},
			async endSession() {},
		},
		userModel: {
			exists: async (q: Record<string, unknown>) => {
				const hit = accounts.find((u) => Object.entries(q).every(([k, v]) => u[k] === v));
				return hit ? { _id: hit._id } : null;
			},
			async create(docs: unknown, options?: { session?: unknown }) {
				if (fakes.failUserCreate) throw dup({ emailN: 1 });
				return write(accounts, docs, options?.session);
			},
		},
		profileModel: {
			exists: async (q: Record<string, unknown>) => {
				const hit = profilesIn.find((p) => Object.entries(q).every(([k, v]) => p[k] === v));
				return hit ? { _id: hit._id } : null;
			},
			async create(docs: unknown, options?: { session?: unknown }) {
				if (fakes.failProfileCreate) throw dup({ employeeCode: 1 });
				return write(profilesIn, docs, options?.session);
			},
		},
	};
	return fakes;
}

/** Service wired only with what the provisioning path touches. */
function buildProvisioningService(fakes: ReturnType<typeof buildTransactionalFakes>) {
	return new EmployeeService(
		fakes.profileModel as never,
		{} as never,
		{ exists: async () => ({ _id: 'dep' }) } as never,
		{ exists: async () => ({ _id: 'pos' }) } as never,
		fakes.userModel as never,
		{ async startSession() { return fakes.session; } } as never,
	);
}

const PROVISION_DTO = {
	employeeCode: 'NV-900',
	fullName: 'Nhân viên mới',
	email: 'new.tvs@tvs.local',
	joinDate: '2026-09-16',
	phone: '0901000900',
};

function buildService(
	profiles: ProfileRow[],
	histories: HistoryRow[],
	refs: {
		departments?: Record<string, string[]>;
		positions?: Record<string, string[]>;
		users?: Record<string, string[]>;
		userDocs?: Array<Record<string, unknown>>;
	} = {},
) {
	return new EmployeeService(
		buildProfileModel(profiles) as never,
		buildHistoryModel(histories) as never,
		buildRefModel(refs.departments ?? {}) as never,
		buildRefModel(refs.positions ?? {}) as never,
		buildRefModel(refs.users ?? { org1: ['user1', 'user2'] }, refs.userDocs ?? []) as never,
		fakeConnection() as never,
	);
}

describe('EmployeeService.create (TASK-020)', () => {
	it.each([
		[{ organizationId: 1, userId: 1 }, 'EMPLOYEE_PROFILE_ALREADY_EXISTS'],
		[{ organizationId: 1, employeeCode: 1 }, 'EMPLOYEE_CODE_TAKEN'],
	])('maps concurrent unique-key conflicts to the correct field: %s', async (keyPattern, message) => {
		const profiles = { exists: jest.fn().mockResolvedValue(null), create: jest.fn().mockRejectedValue({ code: 11000, keyPattern }) };
		const users = { exists: jest.fn().mockResolvedValue({ _id: 'user1' }) };
		const svc = new EmployeeService(profiles as never, {} as never, {} as never, {} as never, users as never, fakeConnection() as never);
		await expect(svc.create('org1', { userId: 'user1', employeeCode: 'NV-001', joinDate: '2026-01-01' }))
			.rejects.toThrow(message);
	});
	it('creates a profile defaulting to PROBATION (SRS §15.2A)', async () => {
		const profiles: ProfileRow[] = [];
		const svc = buildService(profiles, []);
		const profile = await svc.create('org1', {
			userId: 'user1',
			employeeCode: 'TVS-0001',
			joinDate: '2026-09-16',
		} as never);
		expect(profile).toMatchObject({ employmentStatus: EmploymentStatus.PROBATION, userId: 'user1' });
	});

	it('rejects a userId outside the tenant', async () => {
		const svc = buildService([], []);
		await expect(
			svc.create('org1', { userId: 'stranger', employeeCode: 'TVS-0001', joinDate: '2026-09-16' } as never),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('rejects a second profile for the same user (unique per SRS §15.2A)', async () => {
		const profiles: ProfileRow[] = [
			{
				_id: '1',
				organizationId: 'org1',
				userId: 'user1',
				employeeCode: 'TVS-0001',
				employmentType: 'FULL_TIME',
				employmentStatus: EmploymentStatus.PROBATION,
				joinDate: '2026-09-16',
			},
		];
		const svc = buildService(profiles, []);
		await expect(
			svc.create('org1', { userId: 'user1', employeeCode: 'TVS-0002', joinDate: '2026-09-16' } as never),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('rejects a departmentId that does not belong to the tenant', async () => {
		const svc = buildService([], [], { departments: { org1: ['dept-other-org'] } });
		await expect(
			svc.create('org1', {
				userId: 'user1',
				employeeCode: 'TVS-0001',
				joinDate: '2026-09-16',
				departmentId: 'missing',
			} as never),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('EmployeeService.create — provisioning mode (SRS §4.1, TASK-120)', () => {
	it('creates the EMPLOYEE account and the profile as a unit, password returned once', async () => {
		const fakes = buildTransactionalFakes();
		const svc = buildProvisioningService(fakes);

		const res = await svc.create('org1', { ...PROVISION_DTO } as never);

		expect(fakes.accounts).toHaveLength(1);
		expect(fakes.profiles).toHaveLength(1);
		const account = fakes.accounts[0];
		expect(account).toMatchObject({ role: 'EMPLOYEE', status: 'ACTIVE', mustChangePassword: true, organizationId: 'org1' });
		// One write path: the same submitted email/phone on both documents (A3).
		expect(fakes.profiles[0]).toMatchObject({ email: PROVISION_DTO.email, phone: PROVISION_DTO.phone, employmentStatus: 'PROBATION' });
		// The code is on the profile only — the User no longer carries one.
		expect(account).not.toHaveProperty('employeeCode');
		expect(fakes.profiles[0].employeeCode).toBe(PROVISION_DTO.employeeCode);
		// Returned once, and what is stored is only its hash.
		expect(res).toMatchObject({ tempPassword: expect.any(String), userId: account._id });
		expect((res.tempPassword as string).length).toBeGreaterThanOrEqual(8);
		expect(account.passwordHash).not.toBe(res.tempPassword);
		expect(JSON.stringify([fakes.accounts, fakes.profiles])).not.toContain(res.tempPassword as string);
		expect(fakes.profiles[0].passwordHash).toBeUndefined();
	});

	it('refuses to provision without an email', async () => {
		const fakes = buildTransactionalFakes();
		const svc = buildProvisioningService(fakes);
		const { email: _email, ...noEmail } = PROVISION_DTO;
		await expect(svc.create('org1', noEmail as never)).rejects.toThrow('EMAIL_REQUIRED');
		expect(fakes.accounts).toHaveLength(0);
	});

	it('maps a duplicate email in the tenant to EMAIL_TAKEN', async () => {
		const taken = { _id: 'existing', organizationId: 'org1', emailN: 'new.tvs@tvs.local' };
		const fakes = buildTransactionalFakes([taken]);
		const svc = buildProvisioningService(fakes);
		await expect(svc.create('org1', { ...PROVISION_DTO } as never)).rejects.toThrow('EMAIL_TAKEN');
	});

	it('maps a duplicate employeeCode in the tenant to EMPLOYEE_CODE_TAKEN', async () => {
		const fakes = buildTransactionalFakes([], [{ _id: 'p', organizationId: 'org1', employeeCode: 'NV-900' }]);
		const svc = buildProvisioningService(fakes);
		await expect(svc.create('org1', { ...PROVISION_DTO } as never)).rejects.toThrow('EMPLOYEE_CODE_TAKEN');
	});

	// AC-TENANT-03: the unique keys are (organizationId, …), so org2's data must
	// never block org1's provisioning.
	it('provisions the same email and code in a different tenant', async () => {
		const fakes = buildTransactionalFakes(
			[{ _id: 'x', organizationId: 'org2', emailN: 'new.tvs@tvs.local' }],
			[{ _id: 'p', organizationId: 'org2', employeeCode: 'NV-900' }],
		);
		const svc = buildProvisioningService(fakes);
		await expect(svc.create('org1', { ...PROVISION_DTO } as never)).resolves.toBeTruthy();
		expect(fakes.accounts.filter((a) => a.organizationId === 'org1')).toHaveLength(1);
	});

	// AC-SYS-01 half: HR creates EMPLOYEEs, never an admin. `role` isn't on the
	// DTO; the provision path can only ever write EMPLOYEE.
	it('hardcodes the provisioned role to EMPLOYEE whatever the payload claims', async () => {
		const fakes = buildTransactionalFakes();
		const svc = buildProvisioningService(fakes);
		await svc.create('org1', { ...PROVISION_DTO, role: 'SYSTEM_ADMIN' } as never);
		expect(fakes.accounts[0].role).toBe('EMPLOYEE');
	});

	it('rolls the whole unit back when the profile insert loses a race', async () => {
		const fakes = buildTransactionalFakes();
		fakes.failProfileCreate = true;
		const svc = buildProvisioningService(fakes);
		await expect(svc.create('org1', { ...PROVISION_DTO } as never)).rejects.toThrow('EMPLOYEE_CODE_TAKEN');
		// Nothing committed: the account write was staged, never applied.
		expect(fakes.accounts).toHaveLength(0);
		expect(fakes.profiles).toHaveLength(0);
	});
});

describe('EmployeeService.listEligibleUsers', () => {
	it('returns only safe account fields for active, unlinked users in the tenant', async () => {
		const profileLean = jest.fn().mockResolvedValue([{ userId: 'user1' }]);
		const profileSelect = jest.fn().mockReturnValue({ lean: profileLean });
		const profileModel = { find: jest.fn().mockReturnValue({ select: profileSelect }) };
		const userLean = jest.fn().mockResolvedValue([{ _id: 'user2', fullName: 'Nhân viên mới', email: 'new@example.com' }]);
		const userSort = jest.fn().mockReturnValue({ lean: userLean });
		const userSelect = jest.fn().mockReturnValue({ sort: userSort });
		const userModel = { find: jest.fn().mockReturnValue({ select: userSelect }) };
		const svc = new EmployeeService(profileModel as never, {} as never, {} as never, {} as never, userModel as never, fakeConnection() as never);

		const result = await svc.listEligibleUsers('org1');

		expect(profileModel.find).toHaveBeenCalledWith({ organizationId: 'org1' });
		expect(userModel.find).toHaveBeenCalledWith({ organizationId: 'org1', _id: { $nin: ['user1'] }, status: 'ACTIVE' });
		expect(userSelect).toHaveBeenCalledWith('_id fullName email phone');
		expect(result).toEqual([{ _id: 'user2', fullName: 'Nhân viên mới', email: 'new@example.com' }]);
		expect(result[0]).not.toHaveProperty('passwordHash');
	});
});

describe('EmployeeService.changeStatus (TASK-023)', () => {
	function seedProfile(status: string): ProfileRow {
		return {
			_id: '1',
			organizationId: 'org1',
			userId: 'user1',
			employeeCode: 'TVS-0001',
			employmentType: 'FULL_TIME',
			employmentStatus: status,
			joinDate: '2026-09-16',
		};
	}

	it('allows PROBATION -> ACTIVE and appends a history record', async () => {
		const profiles = [seedProfile(EmploymentStatus.PROBATION)];
		const histories: HistoryRow[] = [];
		const svc = buildService(profiles, histories);

		const updated = await svc.changeStatus('org1', '1', 'hr-user', {
			newStatus: EmploymentStatus.ACTIVE,
			effectiveDate: '2026-10-01',
		} as never);

		expect(updated.employmentStatus).toBe(EmploymentStatus.ACTIVE);
		expect(profiles[0].employmentStatus).toBe(EmploymentStatus.ACTIVE);
		expect(histories).toHaveLength(1);
		expect(histories[0]).toMatchObject({
			previousStatus: EmploymentStatus.PROBATION,
			newStatus: EmploymentStatus.ACTIVE,
			changedBy: 'hr-user',
		});
	});

	it('rejects PROBATION -> ON_LEAVE as an invalid transition', async () => {
		const profiles = [seedProfile(EmploymentStatus.PROBATION)];
		const svc = buildService(profiles, []);

		await expect(
			svc.changeStatus('org1', '1', 'hr-user', {
				newStatus: EmploymentStatus.ON_LEAVE,
				effectiveDate: '2026-10-01',
			} as never),
		).rejects.toBeInstanceOf(ConflictException);
		expect(profiles[0].employmentStatus).toBe(EmploymentStatus.PROBATION);
	});

	it('sets endDate when transitioning to RESIGNED', async () => {
		const profiles = [seedProfile(EmploymentStatus.ACTIVE)];
		const svc = buildService(profiles, []);

		const updated = await svc.changeStatus('org1', '1', 'hr-user', {
			newStatus: EmploymentStatus.RESIGNED,
			effectiveDate: '2026-11-01',
			reason: 'Resigned voluntarily',
		} as never);

		expect(updated.employmentStatus).toBe(EmploymentStatus.RESIGNED);
		expect(new Date(updated.endDate as Date).toISOString().slice(0, 10)).toBe('2026-11-01');
	});

	it('never transitions out of the terminal RESIGNED state (SRS §176)', async () => {
		const profiles = [seedProfile(EmploymentStatus.RESIGNED)];
		const svc = buildService(profiles, []);

		await expect(
			svc.changeStatus('org1', '1', 'hr-user', {
				newStatus: EmploymentStatus.ACTIVE,
				effectiveDate: '2026-11-02',
			} as never),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('404s when the profile is outside the tenant', async () => {
		const profiles = [seedProfile(EmploymentStatus.ACTIVE)];
		const svc = buildService(profiles, []);

		await expect(
			svc.changeStatus('org2', '1', 'hr-user', {
				newStatus: EmploymentStatus.ON_LEAVE,
				effectiveDate: '2026-11-02',
			} as never),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	// AC-SELF-APPROVAL-01 — only reachable now that a profile can be one's own
	// (Phase C createSelf). Refuses the violation; does not route it to a queue
	// that would resolve to the same person in a single-HR tenant.
	it('rejects an actor approving their own profile → 403 SELF_APPROVAL_FORBIDDEN', async () => {
		const profiles = [seedProfile(EmploymentStatus.PROBATION)];
		const histories: HistoryRow[] = [];
		const svc = buildService(profiles, histories);

		await expect(
			svc.changeStatus('org1', '1', 'user1', {
				newStatus: EmploymentStatus.ACTIVE,
				effectiveDate: '2026-10-01',
			} as never),
		).rejects.toMatchObject({ status: 403, response: { message: 'SELF_APPROVAL_FORBIDDEN' } });
		// Nothing written, history untouched.
		expect(profiles[0].employmentStatus).toBe(EmploymentStatus.PROBATION);
		expect(histories).toHaveLength(0);
	});
});

describe('EmployeeService.createSelf (Phase C)', () => {
	const HR_USER = { _id: 'hr-1', organizationId: 'org1', email: 'hr-a@tvs.local', phone: '0900000001', role: 'HR' };
	const ME_DTO = { employeeCode: 'hr-a', joinDate: '2026-09-01', departmentId: 'd1' };

	function self() {
		const profiles: ProfileRow[] = [];
		const svc = buildService(profiles, [], {
			users: { org1: ['hr-1'] },
			userDocs: [HR_USER],
			departments: { org1: ['d1'] },
		});
		return { svc, profiles };
	}

	it('writes only the profile, attached to the caller, PROBATION at the start', async () => {
		const { svc, profiles } = self();
		const profile = await svc.createSelf('org1', 'hr-1', ME_DTO);

		expect(profiles).toHaveLength(1);
		expect(profile).toMatchObject({
			userId: 'hr-1',
			organizationId: 'org1',
			employmentStatus: EmploymentStatus.PROBATION,
			departmentId: 'd1',
		});
	});

	it('takes email/phone from the account, not the payload (TASK-120 one write path)', async () => {
		const { svc, profiles } = self();
		await svc.createSelf('org1', 'hr-1', { ...ME_DTO, email: 'attacker@x.local' } as never);

		expect(profiles[0]).toMatchObject({ email: HR_USER.email, phone: HR_USER.phone });
	});

	it('refuses to attach someone else’s profile → 400 USER_ID_NOT_ALLOWED', async () => {
		const { svc, profiles } = self();
		await expect(svc.createSelf('org1', 'hr-1', { ...ME_DTO, userId: 'user2' } as never)).rejects.toMatchObject({
			status: 400,
			response: { message: 'USER_ID_NOT_ALLOWED' },
		});
		expect(profiles).toHaveLength(0);
	});

	it('second self-provision → 409 EMPLOYEE_PROFILE_ALREADY_EXISTS', async () => {
		const { svc, profiles } = self();
		await svc.createSelf('org1', 'hr-1', ME_DTO);
		await expect(svc.createSelf('org1', 'hr-1', { ...ME_DTO, employeeCode: 'other' } as never)).rejects.toThrow(
			/EMPLOYEE_PROFILE_ALREADY_EXISTS/,
		);
		expect(profiles).toHaveLength(1);
	});

	it('code already used by a colleague → 409 EMPLOYEE_CODE_TAKEN', async () => {
		const profiles: ProfileRow[] = [
			{ _id: 'p0', organizationId: 'org1', userId: 'user2', employeeCode: 'HR-A', employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE', joinDate: '2026-01-01' },
		];
		const svc = buildService(profiles, [], { users: { org1: ['hr-1'] }, userDocs: [HR_USER], departments: { org1: ['d1'] } });

		await expect(svc.createSelf('org1', 'hr-1', ME_DTO)).rejects.toThrow(/EMPLOYEE_CODE_TAKEN/);
		expect(profiles).toHaveLength(1);
	});

	it('rejects a caller with no account in the tenant', async () => {
		const { svc, profiles } = self();
		await expect(svc.createSelf('org1', 'ghost', ME_DTO)).rejects.toBeInstanceOf(NotFoundException);
		expect(profiles).toHaveLength(0);
	});
});

describe('EmployeeService.listHistory (TASK-023)', () => {
	it('returns history entries for the employee, newest first', async () => {
		const profiles = [
			{
				_id: '1',
				organizationId: 'org1',
				userId: 'user1',
				employeeCode: 'TVS-0001',
				employmentType: 'FULL_TIME',
				employmentStatus: EmploymentStatus.ACTIVE,
				joinDate: '2026-09-16',
			},
		];
		const histories: HistoryRow[] = [
			{
				organizationId: 'org1',
				employeeProfileId: '1',
				previousStatus: EmploymentStatus.PROBATION,
				newStatus: EmploymentStatus.ACTIVE,
				effectiveDate: new Date('2026-10-01'),
				changedBy: 'hr-user',
				createdAt: new Date('2026-10-01T00:00:00Z'),
			},
			{
				organizationId: 'org1',
				employeeProfileId: '1',
				previousStatus: EmploymentStatus.ACTIVE,
				newStatus: EmploymentStatus.ON_LEAVE,
				effectiveDate: new Date('2026-11-01'),
				changedBy: 'hr-user',
				createdAt: new Date('2026-11-01T00:00:00Z'),
			},
		];
		const svc = buildService(profiles, histories);

		const result = await svc.listHistory('org1', '1');
		expect(result.map((h) => h.newStatus)).toEqual([EmploymentStatus.ON_LEAVE, EmploymentStatus.ACTIVE]);
	});
});

 describe('TASK-025/026 read profiles', () => {
    const row = { _id: 'p1', organizationId: 'org1', userId: 'user1', employeeCode: 'E001', employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE', joinDate: '2026-09-16', departmentId: 'd1', positionId: 'pos1', directManagerId: 'user2' };
    it('resolves names on list and me without replacing reference IDs', async () => {
        const svc = buildService([row], [], { departments: { org1: ['d1'] }, positions: { org1: ['pos1'] } });
        const expected = { userId: 'user1', departmentId: 'd1', fullName: 'User user1', departmentName: 'Name d1', positionName: 'Name pos1', managerName: 'User user2' };
        expect(await svc.findByUserId('org1', 'user1')).toMatchObject(expected);
        expect(await svc.findAll('org1', { status: 'ACTIVE', departmentId: 'd1' })).toEqual([expect.objectContaining(expected)]);
        expect(await svc.findAll('org1', { status: 'PROBATION' })).toEqual([]);
        expect(await svc.findAll('org2')).toEqual([]);
        await expect(svc.findByUserId('org2', 'user1')).rejects.toBeInstanceOf(NotFoundException);
    });
    it('does not resolve foreign tenant references or expose user credentials', async () => {
        const svc = buildService([row], [], { users: { org2: ['user1', 'user2'] }, departments: { org2: ['d1'] }, positions: { org2: ['pos1'] } });
        const result = await svc.findOne('org1', 'p1');
        expect(result).toMatchObject({ fullName: null, departmentName: null, positionName: null, managerName: null });
        expect(result).not.toHaveProperty('passwordHash');
    });
 });
