import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContractService } from './contract.service';

interface ContractRow {
	_id: string;
	organizationId: string;
	employeeId: string;
	contractType: string;
	startDate: Date;
	endDate?: Date;
}

function buildContractModel(rows: ContractRow[]) {
	let nextId = rows.length + 1;
	return {
		async create(doc: Partial<ContractRow>) {
			const row: ContractRow = { _id: String(nextId++), ...doc } as ContractRow;
			rows.push(row);
			return { toObject: () => row };
		},
		find(filter: Record<string, unknown>) {
			const apply = (rs: ContractRow[]) => rs.filter((r) => Object.entries(filter).every(([k, v]) => (r as never)[k] === v));
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

describe('ContractService (TASK-028)', () => {
	const profiles = [{ _id: 'emp1', organizationId: 'org1' }];

	it('creates a contract scoped to the tenant', async () => {
		const rows: ContractRow[] = [];
		const svc = new ContractService(buildContractModel(rows) as never, buildProfileModel(profiles) as never);
		const doc = await svc.create('org1', 'hr1', {
			employeeId: 'emp1',
			contractType: 'FIXED_TERM',
			startDate: '2026-09-25',
			endDate: '2027-09-24',
		});
		expect(doc).toMatchObject({ organizationId: 'org1', employeeId: 'emp1', contractType: 'FIXED_TERM' });
	});

	it('404s when the employee is outside the tenant', async () => {
		const svc = new ContractService(buildContractModel([]) as never, buildProfileModel(profiles) as never);
		await expect(
			svc.create('org2', 'hr1', { employeeId: 'emp1', contractType: 'FIXED_TERM', startDate: '2026-09-25', endDate: '2027-09-24' }),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('rejects endDate at or before startDate', async () => {
		const svc = new ContractService(buildContractModel([]) as never, buildProfileModel(profiles) as never);
		await expect(
			svc.create('org1', 'hr1', { employeeId: 'emp1', contractType: 'FIXED_TERM', startDate: '2026-09-25', endDate: '2026-09-25' }),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('rejects an overlapping contract period for the same employee', async () => {
		const rows: ContractRow[] = [
			{ _id: '1', organizationId: 'org1', employeeId: 'emp1', contractType: 'FIXED_TERM', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
		];
		const svc = new ContractService(buildContractModel(rows) as never, buildProfileModel(profiles) as never);
		await expect(
			svc.create('org1', 'hr1', { employeeId: 'emp1', contractType: 'FIXED_TERM', startDate: '2026-06-01', endDate: '2027-06-01' }),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('allows a renewal contract that starts right after the previous one ends', async () => {
		const rows: ContractRow[] = [
			{ _id: '1', organizationId: 'org1', employeeId: 'emp1', contractType: 'FIXED_TERM', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
		];
		const svc = new ContractService(buildContractModel(rows) as never, buildProfileModel(profiles) as never);
		const doc = await svc.create('org1', 'hr1', { employeeId: 'emp1', contractType: 'INDEFINITE_TERM', startDate: '2027-01-01' });
		expect(doc).toMatchObject({ contractType: 'INDEFINITE_TERM' });
	});

	it('resolves the contract effective on a given date and 404s outside any period', async () => {
		const rows: ContractRow[] = [
			{ _id: '1', organizationId: 'org1', employeeId: 'emp1', contractType: 'FIXED_TERM', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
		];
		const svc = new ContractService(buildContractModel(rows) as never, buildProfileModel(profiles) as never);
		const effective = await svc.findEffectiveForEmployee('org1', 'emp1', new Date('2026-06-01'));
		expect(effective).toMatchObject({ _id: '1' });
		await expect(svc.findEffectiveForEmployee('org1', 'emp1', new Date('2027-06-01'))).rejects.toBeInstanceOf(NotFoundException);
	});

	it('does not leak a contract across tenants', async () => {
		const rows: ContractRow[] = [
			{ _id: '1', organizationId: 'org1', employeeId: 'emp1', contractType: 'FIXED_TERM', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
		];
		const svc = new ContractService(buildContractModel(rows) as never, buildProfileModel(profiles) as never);
		await expect(svc.findOne('org2', '1')).rejects.toBeInstanceOf(NotFoundException);
	});
});
