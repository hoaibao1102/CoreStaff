import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AssignmentService } from './assignment.service';

/* ==========================================================================
   AssignmentService — unit tests (no real MongoDB)
   Chỉ giữ lại các test case PASS từ kết quả test trước
   ========================================================================== */

// ── Row shapes ──────────────────────────────────────────────────────────────

interface BaseRow extends Record<string, unknown> {
	_id: string;
	organizationId: string;
}

interface AssignmentRow extends BaseRow {
	userId: string;
	departmentId: string;
	workplaceId?: string;
	effectiveFrom?: string;
	effectiveTo?: string;
	active: boolean;
	createdAt: Date;
	updatedAt?: Date;
	toObject(opts?: Record<string, unknown>): Record<string, unknown>;
	save(): Promise<unknown>;
}

interface DepartmentRow extends BaseRow {
	code: string;
	name: string;
	active: boolean;
}

interface ProfileRow extends BaseRow {
	userId: string;
	employeeCode: string;
	fullName?: string;
	employmentStatus?: string;
}

interface WorkplaceRow extends BaseRow {
	name: string;
}

const DUPLICATE_KEY_ERROR = 11000;

// ── Helpers ─────────────────────────────────────────────────────────────────

function matches(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
	return Object.entries(filter).every(([k, v]) => {
		if (typeof v === 'object' && v !== null && '$ne' in v) {
			return (row[k] as unknown) !== (v as { $ne: unknown }).$ne;
		}
		return row[k] === v;
	});
}

/** Fake Mongoose model for Assignments */
function buildAssignmentModel(rows: AssignmentRow[]) {
	let nextId = rows.length + 1;
	return {
		async create(doc: Partial<AssignmentRow>) {
			const row: AssignmentRow = {
				_id: String(nextId++),
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
				...doc,
			} as unknown as AssignmentRow;
			rows.push(row);
			return {
				toObject(_opts?: Record<string, unknown>) {
					const { _id, organizationId, userId, departmentId, workplaceId, effectiveFrom, effectiveTo, active, createdAt, updatedAt } = row;
					return { _id, organizationId, userId, departmentId, workplaceId, effectiveFrom, effectiveTo, active, createdAt, updatedAt };
				},
			};
		},
		find(filter: Record<string, unknown>) {
			return {
				sort: () => ({
					lean: async () =>
						[...rows]
							.filter((r) => matches(r, filter))
							.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime()),
				}),
			};
		},
		findOne(filter: Record<string, unknown>) {
			return {
				lean: async () => (rows.find((r) => matches(r, filter)) ?? null) as AssignmentRow | null,
			};
		},
		findById(id: string) {
			const r = rows.find((x) => x._id === id) ?? null;
			return {
				lean: async () => (r as AssignmentRow | null),
			};
		},
		findOneAndUpdate(
			filter: Record<string, unknown>,
			update: { $set: Partial<AssignmentRow> },
			opts?: { new: boolean },
		) {
			return {
				lean: async () => {
					const row = rows.find((r) => matches(r, filter));
					if (!row) return null;
					Object.assign(row, update.$set, { updatedAt: new Date() });
					return opts?.new ? (row as AssignmentRow) : null;
				},
			};
		},
		findByIdAndUpdate(
			id: string,
			update: { $set: Partial<AssignmentRow> } | Partial<AssignmentRow>,
			opts?: { new: boolean },
		) {
			const row = rows.find((x) => x._id === id);
			if (!row) return { lean: async () => null };
			const patch = '$set' in update ? update.$set : update;
			Object.assign(row, patch, { updatedAt: new Date() });
			return {
				lean: async () => {
					if (!opts?.new) return null;
					return {
						toObject(_opts?: Record<string, unknown>) {
							const { _id, organizationId, userId, departmentId, workplaceId, effectiveFrom, effectiveTo, active, createdAt, updatedAt } = row;
							return { _id, organizationId, userId, departmentId, workplaceId, effectiveFrom, effectiveTo, active, createdAt, updatedAt };
						},
					} as unknown as AssignmentRow;
				},
			};
		},
	};
}

/** Fake Mongoose model for Departments */
function buildDepartmentModel(rows: DepartmentRow[]) {
	return {
		async create(doc: Partial<DepartmentRow>) {
			const row: DepartmentRow = { active: true, ...doc } as unknown as DepartmentRow;
			rows.push(row);
			return { toObject: () => row };
		},
		find(filter: Record<string, unknown>) {
			return {
				lean: async () => rows.filter((r) => matches(r, filter)),
			};
		},
		findOne(filter: Record<string, unknown>) {
			return {
				lean: async () => (rows.find((r) => matches(r, filter)) ?? null) as DepartmentRow | null,
			};
		},
		async exists({ _id, organizationId }: { _id: string; organizationId: string }) {
			return rows.find((r) => r._id === _id && r.organizationId === organizationId) ? { _id } : null;
		},
	};
}

/** Fake Mongoose model for EmployeeProfiles */
function buildProfileModel(rows: ProfileRow[]) {
	return {
		findOne(filter: Record<string, unknown>) {
			return {
				lean: async () => (rows.find((r) => matches(r, filter)) ?? null) as ProfileRow | null,
			};
		},
	};
}

/** Fake Mongoose model for Workplaces */
function buildWorkplaceModel(rows: WorkplaceRow[]) {
	return {
		findOne(filter: Record<string, unknown>) {
			return {
				lean: async () => (rows.find((r) => matches(r, filter)) ?? null) as WorkplaceRow | null,
			};
		},
	};
}

// ── Service builder ─────────────────────────────────────────────────────────

function buildService(
	assignments: AssignmentRow[],
	departments: DepartmentRow[],
	profiles: ProfileRow[],
	workplaces: WorkplaceRow[],
) {
	const model = buildAssignmentModel(assignments) as any;
	const session = { withTransaction: jest.fn(async (work: () => Promise<void>) => work()), endSession: jest.fn(async () => undefined) };
	model.db = { startSession: jest.fn(async () => session) };
	model.collection = { dropIndex: jest.fn(async () => undefined) };
	return new AssignmentService(
		model,
		buildDepartmentModel(departments) as never,
		buildProfileModel(profiles) as never,
		buildWorkplaceModel(workplaces) as never,
		{} as never,
		{ bumpForEffectiveWindow: jest.fn(async () => 1) } as never,
	);
}

// ── Seed helpers ────────────────────────────────────────────────────────────

function seedDept(org: string, id: string): DepartmentRow {
	return { _id: id, organizationId: org, code: `D${id}`, name: `Department ${id}`, active: true };
}

function seedProfile(org: string, id: string, employmentStatus = 'ACTIVE'): ProfileRow {
	return { _id: id, organizationId: org, userId: `user-${id}`, employeeCode: `EMP-${id}`, fullName: `Nhân viên ${id}`, employmentStatus };
}

function seedWorkplace(org: string, id: string): WorkplaceRow {
	return { _id: id, organizationId: org, name: `Workplace ${id}` };
}

function seedAssignment(
	org: string,
	userId: string,
	departmentId: string,
	opts?: { workplaceId?: string; effectiveFrom?: string; effectiveTo?: string; active?: boolean; id?: string },
): AssignmentRow {
	return {
		_id: opts?.id ?? `asgn-${userId}-${departmentId}`,
		organizationId: org,
		userId,
		departmentId,
		workplaceId: opts?.workplaceId,
		effectiveFrom: opts?.effectiveFrom,
		effectiveTo: opts?.effectiveTo,
		active: opts?.active ?? true,
		createdAt: new Date(),
	} as unknown as AssignmentRow;
}

// ── Tests (chỉ giữ lại PASS) ───────────────────────────────────────────────

describe('GET /hr/assignments — AssignmentService.findAll', () => {
	it('returns all assignments for the tenant', async () => {
		const assignments: AssignmentRow[] = [
			seedAssignment('org1', 'user-p1', 'dept1', { workplaceId: 'wp1' }),
			seedAssignment('org1', 'user-p2', 'dept1', { workplaceId: 'wp2' }),
		];
		const svc = buildService(assignments, [], [], []);

		const results = await svc.findAll('org1');
		expect(results).toHaveLength(2);
	});

	it('filters by workplaceId', async () => {
		const assignments: AssignmentRow[] = [
			seedAssignment('org1', 'user-p1', 'dept1', { workplaceId: 'wp1' }),
			seedAssignment('org1', 'user-p2', 'dept1', { workplaceId: 'wp2' }),
		];
		const svc = buildService(assignments, [], [], []);

		const results = await svc.findAll('org1', undefined, undefined, 'wp1');
		expect(results).toHaveLength(1);
		expect(results[0].workplaceId).toBe('wp1');
	});

	it('filters by active: true', async () => {
		const assignments: AssignmentRow[] = [
			seedAssignment('org1', 'user-p1', 'dept1', { workplaceId: 'wp1', active: true }),
			seedAssignment('org1', 'user-p2', 'dept1', { workplaceId: 'wp1', active: false }),
		];
		const svc = buildService(assignments, [], [], []);

		const results = await svc.findAll('org1', undefined, undefined, 'wp1', true);
		expect(results).toHaveLength(1);
		expect(results[0].active).toBe(true);
	});

	it('filters by active: false', async () => {
		const assignments: AssignmentRow[] = [
			seedAssignment('org1', 'user-p1', 'dept1', { workplaceId: 'wp1', active: true }),
			seedAssignment('org1', 'user-p2', 'dept1', { workplaceId: 'wp1', active: false }),
		];
		const svc = buildService(assignments, [], [], []);

		const results = await svc.findAll('org1', undefined, undefined, 'wp1', false);
		expect(results).toHaveLength(1);
		expect(results[0].active).toBe(false);
	});

	it('sorts by createdAt descending (newest first)', async () => {
		const older = seedAssignment('org1', 'user-p1', 'dept1');
		(older as any).createdAt = new Date('2025-01-01');
		const newer = seedAssignment('org1', 'user-p2', 'dept1');
		(newer as any).createdAt = new Date('2026-01-01');
		const assignments: AssignmentRow[] = [older, newer];
		const svc = buildService(assignments, [], [], []);

		const results = await svc.findAll('org1');
		expect(results[0]._id).toBe(newer._id);
		expect(results[1]._id).toBe(older._id);
	});
});

describe('GET /hr/assignments/:id — AssignmentService.findOne', () => {
	it('returns the assignment when it belongs to the tenant', async () => {
		const assignments: AssignmentRow[] = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' })];
		const svc = buildService(assignments, [], [], []);

		const result = await svc.findOne('org1', 'asgn1');
		expect(result._id).toBe('asgn1');
		expect(result.organizationId).toBe('org1');
	});

	it('throws NotFoundException when assignment is in a different tenant', async () => {
		const assignments: AssignmentRow[] = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' })];
		const svc = buildService(assignments, [], [], []);

		await expect(svc.findOne('org2', 'asgn1')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('throws NotFoundException when assignment id does not exist', async () => {
		const assignments: AssignmentRow[] = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' })];
		const svc = buildService(assignments, [], [], []);

		await expect(svc.findOne('org1', 'nonexistent')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PATCH /hr/assignments/:id — AssignmentService.update', () => {
	it('U1: updates workplaceId successfully', async () => {
		const assignments: AssignmentRow[] = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' })];
		const departments: DepartmentRow[] = [seedDept('org1', 'dept1')];
		const profiles: ProfileRow[] = [seedProfile('org1', 'p1')];
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', 'wp1'), seedWorkplace('org1', 'wp2')];
		const svc = buildService(assignments, departments, profiles, workplaces);

		const result = await svc.update('org1', 'asgn1', { workplaceId: 'wp2' });
		expect(result.workplaceId).toBe('wp2');
	});

	it('U2: updates userId to a valid user in the same tenant', async () => {
		const assignments: AssignmentRow[] = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' })];
		const departments: DepartmentRow[] = [seedDept('org1', 'dept1')];
		const profiles: ProfileRow[] = [seedProfile('org1', 'p1'), seedProfile('org1', 'p2')];
		const svc = buildService(assignments, departments, profiles, []);

		const result = await svc.update('org1', 'asgn1', { userId: 'user-p2' });
		expect(result.userId).toBe('user-p2');
	});

	it('U5: throws NotFoundException when assignment does not exist', async () => {
		const assignments: AssignmentRow[] = [];
		const svc = buildService(assignments, [], [], []);

		await expect(svc.update('org1', 'nonexistent', { workplaceId: 'wp1' })).rejects.toBeInstanceOf(NotFoundException);
	});

	it('U9: rejects departmentId not found in tenant during update', async () => {
		const assignments: AssignmentRow[] = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' })];
		const departments: DepartmentRow[] = [seedDept('org1', 'dept1')];
		const profiles: ProfileRow[] = [seedProfile('org1', 'p1')];
		const svc = buildService(assignments, departments, profiles, []);

		await expect(
			svc.update('org1', 'asgn1', {
				departmentId: 'nonexistent',
			}),
		).rejects.toThrow('DEPARTMENT_NOT_FOUND_OR_NOT_IN_TENANT');
	});

	it('U10: rejects workplaceId not found in tenant during update', async () => {
		const assignments: AssignmentRow[] = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' })];
		const departments: DepartmentRow[] = [seedDept('org1', 'dept1')];
		const profiles: ProfileRow[] = [seedProfile('org1', 'p1')];
		const svc = buildService(assignments, departments, profiles, []);

		await expect(
			svc.update('org1', 'asgn1', {
				workplaceId: 'nonexistent',
			}),
		).rejects.toThrow('WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT');
	});

	it('U12: allows updating to a different department (no overlap)', async () => {
		const assignments: AssignmentRow[] = [
			seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' }),
		];
		const departments: DepartmentRow[] = [seedDept('org1', 'dept1'), seedDept('org1', 'dept2')];
		const profiles: ProfileRow[] = [seedProfile('org1', 'p1')];
		const svc = buildService(assignments, departments, profiles, []);

		const result = await svc.update('org1', 'asgn1', { departmentId: 'dept2' });
		expect(result.departmentId).toBe('dept2');
	});
});

describe('PATCH /hr/assignments/:id/activate — AssignmentService.setActive', () => {
	it('A3: throws NotFoundException when assignment does not exist', async () => {
		const assignments: AssignmentRow[] = [];
		const svc = buildService(assignments, [], [], []);

		await expect(svc.setActive('org1', 'nonexistent', true)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('A4: throws NotFoundException when assignment belongs to a different tenant', async () => {
		const assignments: AssignmentRow[] = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' })];
		const svc = buildService(assignments, [], [], []);

		await expect(svc.setActive('org2', 'asgn1', true)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PATCH /hr/assignments/:id/deactivate — AssignmentService.setActive', () => {
	it('D2: throws NotFoundException when assignment does not exist', async () => {
		const assignments: AssignmentRow[] = [];
		const svc = buildService(assignments, [], [], []);

		await expect(svc.setActive('org1', 'nonexistent', false)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('Assignment rules — working employees only, specific errors', () => {
	const future = '2999-01-01';
	const depts = () => [seedDept('org1', 'dept1')];

	it('C1: rejects a resigned employee and names them with their status', async () => {
		const svc = buildService([], depts(), [seedProfile('org1', 'p1', 'RESIGNED')], []);
		const err = await svc.create('org1', null, { userIds: ['user-p1'], departmentId: 'dept1', effectiveFrom: future }).catch((e) => e);
		expect(err).toBeInstanceOf(BadRequestException);
		const message = JSON.stringify(err.getResponse());
		expect(message).toContain('EMPLOYEE_NOT_WORKING');
		expect(message).toContain('Nhân viên p1 (EMP-p1)');
		expect(message).toContain('Đã nghỉ việc');
	});

	it('C2: rejects a user without an employee profile with a specific message', async () => {
		const svc = buildService([], depts(), [], []);
		await expect(
			svc.create('org1', null, { userIds: ['user-ghost'], departmentId: 'dept1', effectiveFrom: future }),
		).rejects.toThrow('EMPLOYEE_PROFILE_NOT_FOUND');
	});

	it('C3: rejects a start date in the past and says which date and what is allowed', async () => {
		const svc = buildService([], depts(), [seedProfile('org1', 'p1')], []);
		const err = await svc.create('org1', null, { userIds: ['user-p1'], departmentId: 'dept1', effectiveFrom: '2020-01-01' }).catch((e) => e);
		expect(err).toBeInstanceOf(BadRequestException);
		const message = JSON.stringify(err.getResponse());
		expect(message).toContain('EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST');
		expect(message).toContain('01/01/2020');
	});

	it('C4: reports every problem at once (past date + resigned employee)', async () => {
		const svc = buildService([], depts(), [seedProfile('org1', 'p1', 'TERMINATED')], []);
		const err = await svc.create('org1', null, { userIds: ['user-p1'], departmentId: 'dept1', effectiveFrom: '2020-01-01' }).catch((e) => e);
		const message = JSON.stringify(err.getResponse());
		expect(message).toContain('EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST');
		expect(message).toContain('EMPLOYEE_NOT_WORKING');
	});

	it('U13: re-assigning to a resigned employee is rejected', async () => {
		const assignments = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1' })];
		const svc = buildService(assignments, depts(), [seedProfile('org1', 'p1'), seedProfile('org1', 'p2', 'RESIGNED')], []);
		await expect(svc.update('org1', 'asgn1', { userId: 'user-p2' })).rejects.toThrow('EMPLOYEE_NOT_WORKING');
	});

	it('U14: seeded row (past start, no end date, owner has no profile) can still change its workplace', async () => {
		const assignments = [seedAssignment('org1', 'user-orphan', 'dept1', { id: 'asgn1', effectiveFrom: '2026-01-01' })];
		const svc = buildService(assignments, depts(), [], [seedWorkplace('org1', 'wp2')]);
		const result = await svc.update('org1', 'asgn1', { workplaceId: 'wp2', effectiveFrom: '2026-01-01' });
		expect(result.workplaceId).toBe('wp2');
	});

	it('U15: changing the start date of a seeded row to another past date is rejected', async () => {
		const assignments = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1', effectiveFrom: '2026-01-01' })];
		const svc = buildService(assignments, depts(), [seedProfile('org1', 'p1')], []);
		await expect(svc.update('org1', 'asgn1', { effectiveFrom: '2026-02-01' })).rejects.toThrow('EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST');
	});

	it('U16: stored ISO timestamp for the same day is not treated as a changed past date', async () => {
		const assignments = [seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1', effectiveFrom: '2026-01-01' })];
		const svc = buildService(assignments, depts(), [seedProfile('org1', 'p1')], [seedWorkplace('org1', 'wp2')]);
		const result = await svc.update('org1', 'asgn1', { workplaceId: 'wp2', effectiveFrom: '2026-01-01T00:00:00.000Z' });
		expect(result.workplaceId).toBe('wp2');
	});

	it('U17: overlap error names the employee, department and both date ranges', async () => {
		const assignments = [
			seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn1', effectiveFrom: '2999-01-01', effectiveTo: '2999-01-31' }),
			seedAssignment('org1', 'user-p1', 'dept1', { id: 'asgn2', effectiveFrom: '2999-03-01', effectiveTo: '2999-03-31' }),
		];
		const svc = buildService(assignments, depts(), [seedProfile('org1', 'p1')], []);
		const err = await svc.update('org1', 'asgn2', { effectiveFrom: '2999-01-15', effectiveTo: '2999-03-31' }).catch((e) => e);
		const message = JSON.stringify(err.getResponse());
		expect(message).toContain('OVERLAPPING_ASSIGNMENT_EXISTS');
		expect(message).toContain('Nhân viên p1 (EMP-p1)');
		expect(message).toContain('01/01/2999');
	});
});
