import { ConflictException, NotFoundException } from '@nestjs/common';
import { PositionService } from './position.service';

interface Row {
	_id: string;
	organizationId: string;
	departmentId?: string;
	code: string;
	name: string;
	active: boolean;
}

const DUPLICATE_KEY_ERROR = 11000;

function matches(row: Row, filter: Record<string, unknown>): boolean {
	return Object.entries(filter).every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v);
}

/** Minimal fake standing in for the Mongoose model (no real Mongo dependency). */
function buildModel(rows: Row[]) {
	let nextId = rows.length + 1;
	return {
		async create(doc: Partial<Row>) {
			if (rows.some((r) => r.organizationId === doc.organizationId && r.departmentId === doc.departmentId && r.code === doc.code)) {
				const err = Object.assign(new Error('duplicate'), { code: DUPLICATE_KEY_ERROR });
				throw err;
			}
			const row: Row = { _id: String(nextId++), active: true, ...doc } as Row;
			rows.push(row);
			return { toObject: () => row };
		},
		find(filter: Record<string, unknown>) {
			return { sort: () => ({ lean: async () => rows.filter((r) => matches(r, filter)) }) };
		},
		findOne(filter: Record<string, unknown>) {
			return { lean: async () => rows.find((r) => matches(r, filter)) ?? null };
		},
		findOneAndUpdate(filter: Record<string, unknown>, update: { $set: Partial<Row> }) {
			return {
				lean: async () => {
					const row = rows.find((r) => matches(r, filter));
					if (!row) return null;
					if (
						update.$set.code &&
						rows.some((r) => r !== row && r.organizationId === row.organizationId && r.departmentId === row.departmentId && r.code === update.$set.code)
					) {
						const err = Object.assign(new Error('duplicate'), { code: DUPLICATE_KEY_ERROR });
						throw err;
					}
					Object.assign(row, update.$set);
					return row;
				},
			};
		},
	};
}

/** Department model fake: only `exists` is exercised by the service. */
function buildDepartments(ids: string[]) {
	return { exists: async (filter: { _id: string }) => (ids.includes(String(filter._id)) ? { _id: filter._id } : null) };
}

function buildService(rows: Row[], departmentIds: string[] = ['dep1']) {
	return new PositionService(buildModel(rows) as never, buildDepartments(departmentIds) as never);
}

describe('PositionService (TASK-022)', () => {
	it('creates a position scoped to the tenant and its department', async () => {
		const rows: Row[] = [];
		const svc = buildService(rows);
		const pos = await svc.create('org1', { departmentId: 'dep1', code: 'SWE2', name: 'Software Engineer II' });
		expect(pos).toMatchObject({ organizationId: 'org1', departmentId: 'dep1', code: 'SWE2', active: true });
	});

	it('404s when the department is not in the tenant', async () => {
		const svc = buildService([], ['dep1']);
		await expect(svc.create('org1', { departmentId: 'dep-missing', code: 'SWE2', name: 'SWE II' })).rejects.toBeInstanceOf(NotFoundException);
	});

	it('rejects a duplicate code within the same department', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', departmentId: 'dep1', code: 'SWE2', name: 'SWE II', active: true }];
		const svc = buildService(rows);
		await expect(svc.create('org1', { departmentId: 'dep1', code: 'SWE2', name: 'Dup' })).rejects.toBeInstanceOf(ConflictException);
	});

	it('allows the same code in a different department', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', departmentId: 'dep1', code: 'SWE2', name: 'SWE II', active: true }];
		const svc = buildService(rows, ['dep1', 'dep2']);
		const pos = await svc.create('org1', { departmentId: 'dep2', code: 'SWE2', name: 'SWE II' });
		expect(pos).toMatchObject({ departmentId: 'dep2', code: 'SWE2' });
	});

	it('filters the list by department', async () => {
		const rows: Row[] = [
			{ _id: '1', organizationId: 'org1', departmentId: 'dep1', code: 'A', name: 'A', active: true },
			{ _id: '2', organizationId: 'org1', departmentId: 'dep2', code: 'B', name: 'B', active: true },
		];
		const svc = buildService(rows, ['dep1', 'dep2']);
		const found = await svc.findAll('org1', { departmentId: 'dep2' });
		expect(found).toHaveLength(1);
		expect(found[0]).toMatchObject({ _id: '2' });
	});

	it('404s when reading an id outside the tenant', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', departmentId: 'dep1', code: 'SWE2', name: 'SWE II', active: true }];
		const svc = buildService(rows);
		await expect(svc.findOne('org2', '1')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('deactivate/activate toggles the soft-CRUD flag without deleting the row', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', departmentId: 'dep1', code: 'SWE2', name: 'SWE II', active: true }];
		const svc = buildService(rows);

		const deactivated = await svc.setActive('org1', '1', false);
		expect(deactivated.active).toBe(false);

		const reactivated = await svc.setActive('org1', '1', true);
		expect(reactivated.active).toBe(true);
		expect(rows).toHaveLength(1);
	});
});
