import { ConflictException, NotFoundException } from '@nestjs/common';
import { InsuranceProfileService } from './insurance-profile.service';

interface Row {
	_id: string;
	organizationId: string;
	employeeId: string;
	effectiveFrom: Date;
	effectiveTo?: Date;
	participatesSocialInsurance: boolean;
	participatesHealthInsurance: boolean;
	participatesUnemploymentInsurance: boolean;
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
		findOneAndUpdate(filter: Record<string, unknown>, update: { $set: Partial<Row> }) {
			const row = rows.find((r) => Object.entries(filter).every(([k, v]) => (r as never)[k] === v));
			if (row) Object.assign(row, update.$set);
			return { lean: async () => row ?? null };
		},
	};
}

function buildProfileModel(ids: Array<{ _id: string; organizationId: string }>) {
	return { exists: async (filter: { _id: string; organizationId: string }) => ids.some((p) => p._id === filter._id && p.organizationId === filter.organizationId) };
}

describe('InsuranceProfileService (TASK-038)', () => {
	const profiles = [{ _id: 'emp1', organizationId: 'org1' }];
	const dto = {
		employeeId: 'emp1',
		effectiveFrom: '2026-09-25',
		participatesSocialInsurance: true,
		participatesHealthInsurance: true,
		participatesUnemploymentInsurance: true,
	};

	it('creates a participation record', async () => {
		const svc = new InsuranceProfileService(buildModel([]) as never, buildProfileModel(profiles) as never);
		const doc = await svc.create('org1', 'hr1', dto);
		expect(doc).toMatchObject({ participatesSocialInsurance: true, version: 1 });
	});

	it('D40: defaults all three participation flags to true when omitted — mandatory by law, not an HR choice', async () => {
		const svc = new InsuranceProfileService(buildModel([]) as never, buildProfileModel(profiles) as never);
		const { participatesSocialInsurance, participatesHealthInsurance, participatesUnemploymentInsurance, ...rest } = dto;
		const doc = await svc.create('org1', 'hr1', rest as never);
		expect(doc).toMatchObject({
			participatesSocialInsurance: true,
			participatesHealthInsurance: true,
			participatesUnemploymentInsurance: true,
		});
	});

	it('allows a false participation flag with a note, without inventing an exemption taxonomy', async () => {
		const svc = new InsuranceProfileService(buildModel([]) as never, buildProfileModel(profiles) as never);
		const doc = await svc.create('org1', 'hr1', { ...dto, participatesUnemploymentInsurance: false, note: 'Foreign employee, bilateral agreement' });
		expect(doc.participatesUnemploymentInsurance).toBe(false);
		expect(doc.note).toContain('bilateral');
	});

	it('rejects an overlapping effective period for the same employee', async () => {
		const rows: Row[] = [
			{ _id: '1', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-01-01'), participatesSocialInsurance: true, participatesHealthInsurance: true, participatesUnemploymentInsurance: true, version: 1 },
		];
		const svc = new InsuranceProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
		await expect(svc.create('org1', 'hr1', dto)).rejects.toBeInstanceOf(ConflictException);
	});

	it('404s when the employee is outside the tenant', async () => {
		const svc = new InsuranceProfileService(buildModel([]) as never, buildProfileModel(profiles) as never);
		await expect(svc.create('org2', 'hr1', dto)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('resolves the effective participation for a given date', async () => {
		const rows: Row[] = [
			{ _id: '1', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-06-30'), participatesSocialInsurance: false, participatesHealthInsurance: false, participatesUnemploymentInsurance: false, version: 1 },
			{ _id: '2', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-07-01'), participatesSocialInsurance: true, participatesHealthInsurance: true, participatesUnemploymentInsurance: true, version: 2 },
		];
		const svc = new InsuranceProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
		const effective = await svc.findEffectiveForEmployee('org1', 'emp1', new Date('2026-08-01'));
		expect(effective).toMatchObject({ _id: '2', participatesSocialInsurance: true });
	});

	describe('close (D42)', () => {
		it('sets effectiveTo on an open-ended record, unblocking a next version', async () => {
			const rows: Row[] = [
				{ _id: '1', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-01-01'), participatesSocialInsurance: true, participatesHealthInsurance: true, participatesUnemploymentInsurance: true, version: 1 },
			];
			const svc = new InsuranceProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
			const closed = await svc.close('org1', '1', '2026-06-30');
			expect(closed).toMatchObject({ effectiveTo: new Date('2026-06-30') });

			// The next version is now unblocked because the sibling no longer stretches to Infinity.
			const next = await svc.create('org1', 'hr1', { ...dto, effectiveFrom: '2026-07-01' });
			expect(next.version).toBe(2);
		});

		it('rejects closing a record that is already closed', async () => {
			const rows: Row[] = [
				{ _id: '1', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-06-30'), participatesSocialInsurance: true, participatesHealthInsurance: true, participatesUnemploymentInsurance: true, version: 1 },
			];
			const svc = new InsuranceProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
			await expect(svc.close('org1', '1', '2026-08-01')).rejects.toBeInstanceOf(ConflictException);
		});

		it('rejects a close date on/before effectiveFrom', async () => {
			const rows: Row[] = [
				{ _id: '1', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-01-01'), participatesSocialInsurance: true, participatesHealthInsurance: true, participatesUnemploymentInsurance: true, version: 1 },
			];
			const svc = new InsuranceProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
			await expect(svc.close('org1', '1', '2025-12-31')).rejects.toBeInstanceOf(ConflictException);
		});

		it('404s when the record is outside the tenant', async () => {
			const rows: Row[] = [
				{ _id: '1', organizationId: 'org1', employeeId: 'emp1', effectiveFrom: new Date('2026-01-01'), participatesSocialInsurance: true, participatesHealthInsurance: true, participatesUnemploymentInsurance: true, version: 1 },
			];
			const svc = new InsuranceProfileService(buildModel(rows) as never, buildProfileModel(profiles) as never);
			await expect(svc.close('org2', '1', '2026-06-30')).rejects.toBeInstanceOf(NotFoundException);
		});
	});
});
