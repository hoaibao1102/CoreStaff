import { ConflictException, NotFoundException } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { OrganizationStatus, normalizeEmail } from '../database/schemas/enums';

/**
 * Fakes for the three models PlatformService touches. The User fake computes
 * `emailN` the way the schema's pre-validate hook does, since the service's
 * duplicate pre-flight queries that field. No Mongo dependency.
 */
interface OrgRow {
	_id: string;
	code: string;
	name: string;
	status: string;
	createdBy?: string;
}

interface UserRow {
	_id: string;
	organizationId?: string;
	email: string;
	emailN: string;
	passwordHash: string;
	role: string;
	status: string;
	mustChangePassword: boolean;
	[k: string]: unknown;
}

const DUPLICATE_KEY_ERROR = 11000;

function buildOrgModel(rows: OrgRow[] = []) {
	let nextId = 1;
	return {
		rows,
		async create(doc: Record<string, unknown>) {
			const code = doc.code as string;
			if (rows.some((r) => r.code === code)) throw dup();
			const row = { _id: `org${nextId++}`, ...doc } as OrgRow;
			rows.push(row);
			return { toObject: () => row };
		},
		find() {
			return { sort: () => ({ lean: async () => [...rows] }) };
		},
		async exists(filter: Record<string, unknown>) {
			return rows.find((r) => String(r._id) === String(filter._id) && (filter.code === undefined || r.code === filter.code))
				? { _id: filter._id }
				: null;
		},
		findOneAndUpdate(filter: Record<string, unknown>, update: Record<string, unknown>) {
			const row = rows.find((r) => String(r._id) === String(filter._id));
			return {
				lean: async () => {
					if (!row) return null;
					Object.assign(row, update);
					return row;
				},
			};
		},
	};
}

function buildUserModel(rows: UserRow[] = []) {
	let nextId = 1;
	return {
		rows,
		async create(doc: Record<string, unknown>) {
			const emailN = normalizeEmail(doc.email as string);
			if (rows.some((r) => String(r.organizationId) === String(doc.organizationId) && r.emailN === emailN)) {
				throw dup();
			}
			const row = { _id: `u${nextId++}`, ...doc, emailN } as unknown as UserRow;
			rows.push(row);
			return { toObject: () => row };
		},
		async exists(filter: Record<string, unknown>) {
			return rows.find(
				(r) =>
					String(r.organizationId) === String(filter.organizationId) &&
					(filter.emailN === undefined || r.emailN === filter.emailN),
			)
				? { _id: 'x' }
				: null;
		},
	};
}

function buildSessionModel(rows: Array<Record<string, unknown>> = []) {
	return {
		rows,
		updateMany(filter: Record<string, unknown>, update: Record<string, unknown>) {
			const run = async () => {
				let n = 0;
				for (const s of rows) {
					// Strict equality on every filter key, including `revokedAt: null`
					// — that null is the "still live" half of AC-SYS-02.
					if (!Object.entries(filter).every(([k, v]) => String(s[k] ?? null) === String(v ?? null))) continue;
					Object.assign(s, update);
					n++;
				}
				return { modifiedCount: n };
			};
			return { exec: run };
		},
	};
}

function dup(): Error {
	return Object.assign(new Error('E11000 duplicate key'), { code: DUPLICATE_KEY_ERROR });
}

function build(orgRows: OrgRow[] = [], userRows: UserRow[] = [], sessionRows: Array<Record<string, unknown>> = []) {
	const orgModel = buildOrgModel(orgRows);
	const userModel = buildUserModel(userRows);
	const sessionModel = buildSessionModel(sessionRows);
	const service = new PlatformService(orgModel as never, userModel as never, sessionModel as never);
	return { service, orgModel, userModel, sessionModel };
}

describe('PlatformService.createOrganization (FR-SYS-01)', () => {
	it('upper-cases the code, defaults to ACTIVE and records the acting admin', async () => {
		const { service, orgModel } = build();
		const org = await service.createOrganization({ code: ' tvs ', name: ' TVS Corporation ' }, 'admin1');

		expect(org).toMatchObject({ code: 'TVS', name: 'TVS Corporation', status: 'ACTIVE', createdBy: 'admin1' });
		expect(orgModel.rows).toHaveLength(1);
	});

	it('duplicate code → 409 ORGANIZATION_CODE_TAKEN', async () => {
		const { service, orgModel } = build([{ _id: 'org1', code: 'TVS', name: 'TVS', status: 'ACTIVE' }]);
		await expect(service.createOrganization({ code: 'TVS', name: 'Other' }, 'admin1')).rejects.toBeInstanceOf(
			ConflictException,
		);
		await expect(service.createOrganization({ code: 'TVS', name: 'Other' }, 'admin1')).rejects.toThrow(
			/ORGANIZATION_CODE_TAKEN/,
		);
		expect(orgModel.rows).toHaveLength(1);
	});
});

describe('PlatformService.createInitialHr (FR-SYS-02)', () => {
	const HR = { email: 'hr-a@tvs.local', fullName: 'Nguyễn Thị HR' };

	it('stores an HR login with a forced password change, and returns the temp password once', async () => {
		const { service, userModel } = build([{ _id: 'org1', code: 'TVS', name: 'TVS', status: 'ACTIVE' }]);
		const res = await service.createInitialHr('org1', HR);

		expect(userModel.rows[0]).toMatchObject({
			organizationId: 'org1',
			role: 'HR',
			status: 'ACTIVE',
			mustChangePassword: true,
			failedLoginCount: 0,
		});
		// TASK-120: the code belongs to an EmployeeProfile, which is HR's own to make.
		expect(userModel.rows[0]).not.toHaveProperty('employeeCode');
		// BR-AUTH-02: only the hash is stored...
		expect(String(userModel.rows[0].passwordHash)).not.toBe(String(res.tempPassword));
		expect(userModel.rows[0].passwordHash).toMatch(/^\$2[aby]\$/);
		// ...and the plaintext appears exactly once, in this response.
		expect(res.tempPassword).toBeTruthy();
		expect(res).not.toHaveProperty('passwordHash');
	});

	it('same email in a different tenant succeeds (AC-TENANT-03)', async () => {
		const orgs: OrgRow[] = [
			{ _id: 'org1', code: 'A', name: 'A', status: 'ACTIVE' },
			{ _id: 'org2', code: 'B', name: 'B', status: 'ACTIVE' },
		];
		const { service, userModel } = build(orgs);
		await service.createInitialHr('org1', HR);
		await service.createInitialHr('org2', HR);

		expect(userModel.rows).toHaveLength(2);
		expect(new Set(userModel.rows.map((r) => r.organizationId))).toEqual(new Set(['org1', 'org2']));
	});

	it('same email twice in one tenant → 409 EMAIL_TAKEN', async () => {
		const orgs: OrgRow[] = [{ _id: 'org1', code: 'A', name: 'A', status: 'ACTIVE' }];
		const { service, userModel } = build(orgs);
		await service.createInitialHr('org1', HR);
		await expect(service.createInitialHr('org1', { ...HR, fullName: 'Duplicate' })).rejects.toThrow(/EMAIL_TAKEN/);
		// Case-folded, because emailN is what the unique index is built on.
		await expect(service.createInitialHr('org1', { ...HR, email: 'HR-A@TVS.LOCAL' })).rejects.toThrow(/EMAIL_TAKEN/);
		expect(userModel.rows).toHaveLength(1);
	});

	it('unknown organization → 404 before any user is written', async () => {
		const { service, userModel } = build();
		await expect(service.createInitialHr('nope', HR)).rejects.toBeInstanceOf(NotFoundException);
		expect(userModel.rows).toHaveLength(0);
	});
});

describe('PlatformService.setOrganizationStatus (AC-SYS-02)', () => {
	const org = (): OrgRow => ({ _id: 'org1', code: 'TVS', name: 'TVS', status: OrganizationStatus.ACTIVE });

	it('suspend flips the status and revokes the tenant’s live sessions', async () => {
		const rows = [org()];
		const sessions = [
			{ organizationId: 'org1', revokedAt: null },
			{ organizationId: 'org1', revokedAt: null },
			{ organizationId: 'org1', revokedAt: new Date('2026-01-01') },
			{ organizationId: 'org2', revokedAt: null },
		];
		const { service } = build(rows, [], sessions);

		const updated = await service.setOrganizationStatus('org1', OrganizationStatus.SUSPENDED);

		expect(updated).toMatchObject({ status: 'SUSPENDED' });
		expect(rows[0].status).toBe('SUSPENDED');
		expect(sessions.filter((s) => s.organizationId === 'org1' && s.revokedAt === null)).toHaveLength(0);
		// Already-revoked and other tenants' sessions untouched.
		expect(sessions[2].revokedAt).toEqual(new Date('2026-01-01'));
		expect(sessions[3].revokedAt).toBeNull();
	});

	it('activate revokes nothing', async () => {
		const rows: OrgRow[] = [{ _id: 'org1', code: 'TVS', name: 'TVS', status: OrganizationStatus.SUSPENDED }];
		const sessions = [{ organizationId: 'org1', revokedAt: null }];
		const { service } = build(rows, [], sessions);

		await service.setOrganizationStatus('org1', OrganizationStatus.ACTIVE);

		expect(rows[0].status).toBe('ACTIVE');
		expect(sessions[0].revokedAt).toBeNull();
	});

	it('unknown organization → 404', async () => {
		const { service } = build();
		await expect(service.setOrganizationStatus('nope', OrganizationStatus.SUSPENDED)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});
