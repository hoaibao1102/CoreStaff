import { ConflictException, NotFoundException } from '@nestjs/common';
import { SalaryProfileService } from './salary-profile.service';

interface Row {
	_id: string;
	organizationId: string;
	employeeId: string;
	effectiveFrom: Date;
	effectiveTo?: Date;
	baseSalary: number;
	insuranceSalary: number;
	version: number;
}

function buildModel(rows: Row[]) {
	let nextId = rows.length + 1;
	return {
		async create(doc: Partial<Row>) {
			const row: Row = { _id: String(nextId++), ...doc } as Row;
			rows.push(row);
			return { toObject: () => row };
		},
		find(filter: Record<string, unknown>) {
			const apply = (rs: Row[]) => rs.filter((r) => Object.entries(filter).every(([k, v]) => (r as never)[k] === v));
			return { lean: async () => apply(rows), sort: () => ({ lean: async () => apply(rows) }) };
		},
		findOne(filter: Record<string, unknown>) {
			return { lean: async () => rows.find((r) => Object.entries(filter).every(([k, v]) => (r as never)[k] === v)) ?? null };
		},
	};
}

function buildProfileModel(ids: Array<{ _id: string; organizationId: string }>) {
	return { exists: async (filter: { _id: string; organizationId: string }) => ids.some((p) => p._id === filter._id && p.organizationId === filter.organizationId) };
}

describe('SalaryProfileService (TASK-032)', () => {
	const profiles = [{ _id: 'emp1', organizationId: 'org1' }];
	const dto = { employeeId: 'emp1', effectiveFrom: '2026-09-25', baseSalary: 15000000, insuranceSalary: 15000000 };

	it('creates a salary profile with version 1', async () => {
		const rows: Row[] = [];
		const svc = new SalaryProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
		const doc = await svc.create('org1', 'hr1', dto);
		expect(doc).toMatchObject({ organizationId: 'org1', insuranceSalary: 15000000, version: 1 });
	});

	it('increments version for a later non-overlapping period', async () => {
		const rows: Row[] = [
			{ _id: '1', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-09-24'), baseSalary: 10000000, insuranceSalary: 10000000, version: 1 },
		];
		const svc = new SalaryProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
		const doc = await svc.create('org1', 'hr1', dto);
		expect(doc.version).toBe(2);
	});

	it('rejects an overlapping effective period for the same employee', async () => {
		const rows: Row[] = [
			{ _id: '1', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-01-01'), baseSalary: 10000000, insuranceSalary: 10000000, version: 1 },
		];
		const svc = new SalaryProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
		await expect(svc.create('org1', 'hr1', dto)).rejects.toBeInstanceOf(ConflictException);
	});

	it('404s when the employee is outside the tenant', async () => {
		const svc = new SalaryProfileService(buildModel([]) as never, buildProfileModel(profiles) as never);
		await expect(svc.create('org2', 'hr1', dto)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('resolves the effective row for a given date', async () => {
		const rows: Row[] = [
			{ _id: '1', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-06-30'), baseSalary: 10000000, insuranceSalary: 10000000, version: 1 },
			{ _id: '2', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-07-01'), baseSalary: 12000000, insuranceSalary: 12000000, version: 2 },
		];
		const svc = new SalaryProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
		const effective = await svc.findEffectiveForEmployee('org1', 'emp1', new Date('2026-08-01'));
		expect(effective).toMatchObject({ _id: '2', insuranceSalary: 12000000 });
	});
});
