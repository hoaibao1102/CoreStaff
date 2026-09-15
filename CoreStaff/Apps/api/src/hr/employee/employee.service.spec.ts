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

/** `Department`/`Position`/`User` are only used for `.exists()` referential checks here. */
function buildRefModel(ids: Record<string, string[]>) {
	return {
        find({ organizationId, _id }: { organizationId: string; _id: { $in: string[] } }) {
            return { select: () => ({ lean: async () => (ids[organizationId] ?? []).filter(id => _id.$in.includes(id)).map(id => ({ _id: id, name: `Name ${id}`, fullName: `User ${id}` })) }) };
        },
		async exists({ _id, organizationId }: { _id: string; organizationId: string }) {
			return ids[organizationId]?.includes(_id) ? { _id } : null;
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

function buildService(
	profiles: ProfileRow[],
	histories: HistoryRow[],
	refs: { departments?: Record<string, string[]>; positions?: Record<string, string[]>; users?: Record<string, string[]> } = {},
) {
	return new EmployeeService(
		buildProfileModel(profiles) as never,
		buildHistoryModel(histories) as never,
		buildRefModel(refs.departments ?? {}) as never,
		buildRefModel(refs.positions ?? {}) as never,
		buildRefModel(refs.users ?? { org1: ['user1', 'user2'] }) as never,
		fakeConnection() as never,
	);
}

describe('EmployeeService.create (TASK-020)', () => {
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
