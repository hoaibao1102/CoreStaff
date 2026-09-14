import { ConflictException, NotFoundException } from '@nestjs/common';
import { DepartmentService } from './department.service';

interface Row {
	_id: string;
	organizationId: string;
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
			if (rows.some((r) => r.organizationId === doc.organizationId && r.code === doc.code)) {
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
						rows.some((r) => r !== row && r.organizationId === row.organizationId && r.code === update.$set.code)
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

describe('DepartmentService (TASK-021)', () => {
	it('creates a department scoped to the tenant', async () => {
		const rows: Row[] = [];
		const svc = new DepartmentService(buildModel(rows) as never);
		const dept = await svc.create('org1', { code: 'ENG', name: 'Engineering' });
		expect(dept).toMatchObject({ organizationId: 'org1', code: 'ENG', name: 'Engineering', active: true });
	});

	it('rejects a duplicate code within the same tenant (FR-HRCFG-01)', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', code: 'ENG', name: 'Engineering', active: true }];
		const svc = new DepartmentService(buildModel(rows) as never);
		await expect(svc.create('org1', { code: 'ENG', name: 'Eng 2' })).rejects.toBeInstanceOf(ConflictException);
	});

	it('allows the same code to be reused across different tenants', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', code: 'ENG', name: 'Engineering', active: true }];
		const svc = new DepartmentService(buildModel(rows) as never);
		const dept = await svc.create('org2', { code: 'ENG', name: 'Engineering' });
		expect(dept.organizationId).toBe('org2');
	});

	it('404s when reading an id outside the tenant', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', code: 'ENG', name: 'Engineering', active: true }];
		const svc = new DepartmentService(buildModel(rows) as never);
		await expect(svc.findOne('org2', '1')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('deactivate/activate toggles the soft-CRUD flag without deleting the row', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', code: 'ENG', name: 'Engineering', active: true }];
		const svc = new DepartmentService(buildModel(rows) as never);

		const deactivated = await svc.setActive('org1', '1', false);
		expect(deactivated.active).toBe(false);

		const reactivated = await svc.setActive('org1', '1', true);
		expect(reactivated.active).toBe(true);
		expect(rows).toHaveLength(1);
	});

	it('rejects renaming a department to a code already used in the tenant', async () => {
		const rows: Row[] = [
			{ _id: '1', organizationId: 'org1', code: 'ENG', name: 'Engineering', active: true },
			{ _id: '2', organizationId: 'org1', code: 'HR', name: 'Human Resources', active: true },
		];
		const svc = new DepartmentService(buildModel(rows) as never);
		await expect(svc.update('org1', '2', { code: 'ENG' })).rejects.toBeInstanceOf(ConflictException);
	});
});
