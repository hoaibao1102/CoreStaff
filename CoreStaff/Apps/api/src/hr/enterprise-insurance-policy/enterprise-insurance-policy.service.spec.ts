import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EnterpriseInsurancePolicyService } from './enterprise-insurance-policy.service';

interface Row {
	_id: string;
	organizationId: string;
	effectiveFrom: Date;
	effectiveTo?: Date;
	provider: string;
	coverageDescription: string;
	costBearer: string;
	employeeContributionAmount?: number | null;
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

function fullDto(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		effectiveFrom: '2026-09-25',
		provider: 'Bảo Việt',
		coverageDescription: 'Bảo hiểm tai nạn con người 24/24',
		costBearer: 'EMPLOYER',
		...overrides,
	};
}

describe('EnterpriseInsurancePolicyService (D40)', () => {
	it('creates a policy version', async () => {
		const svc = new EnterpriseInsurancePolicyService(buildModel([]) as never);
		const doc = await svc.create('org1', 'hr1', fullDto() as never);
		expect(doc).toMatchObject({ provider: 'Bảo Việt', costBearer: 'EMPLOYER', version: 1, premiumPerEmployee: null });
	});

	it('rejects an employee contribution when the employer bears the full cost', async () => {
		const svc = new EnterpriseInsurancePolicyService(buildModel([]) as never);
		const dto = fullDto({ costBearer: 'EMPLOYER', employeeContributionAmount: 50000 });
		await expect(svc.create('org1', 'hr1', dto as never)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('allows an employee contribution when cost is shared', async () => {
		const svc = new EnterpriseInsurancePolicyService(buildModel([]) as never);
		const dto = fullDto({ costBearer: 'SHARED', employeeContributionAmount: 50000 });
		const doc = await svc.create('org1', 'hr1', dto as never);
		expect(doc.employeeContributionAmount).toBe(50000);
	});

	it('rejects an overlapping effective period within the same organization', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', ...fullDto(), effectiveFrom: new Date('2026-01-01') } as unknown as Row];
		const svc = new EnterpriseInsurancePolicyService(buildModel(rows) as never);
		await expect(svc.create('org1', 'hr1', fullDto() as never)).rejects.toBeInstanceOf(ConflictException);
	});

	it('404s ENTERPRISE_INSURANCE_POLICY_NOT_CONFIGURED when no policy is effective', async () => {
		const svc = new EnterpriseInsurancePolicyService(buildModel([]) as never);
		await expect(svc.findEffective('org1', new Date())).rejects.toBeInstanceOf(NotFoundException);
	});

	describe('close (D42)', () => {
		it('sets effectiveTo on an open-ended policy, unblocking a next version', async () => {
			const rows: Row[] = [{ _id: '1', organizationId: 'org1', ...fullDto(), effectiveFrom: new Date('2026-01-01'), version: 1 } as unknown as Row];
			const svc = new EnterpriseInsurancePolicyService(buildModel(rows) as never);
			const closed = await svc.close('org1', '1', '2026-06-30');
			expect(closed).toMatchObject({ effectiveTo: new Date('2026-06-30') });

			const next = await svc.create('org1', 'hr1', fullDto({ effectiveFrom: '2026-07-01' }) as never);
			expect(next.version).toBe(2);
		});

		it('rejects closing an already-closed policy', async () => {
			const rows: Row[] = [{ _id: '1', organizationId: 'org1', ...fullDto(), effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-06-30') } as unknown as Row];
			const svc = new EnterpriseInsurancePolicyService(buildModel(rows) as never);
			await expect(svc.close('org1', '1', '2026-08-01')).rejects.toBeInstanceOf(ConflictException);
		});

		it('rejects a close date on/before effectiveFrom', async () => {
			const rows: Row[] = [{ _id: '1', organizationId: 'org1', ...fullDto(), effectiveFrom: new Date('2026-01-01') } as unknown as Row];
			const svc = new EnterpriseInsurancePolicyService(buildModel(rows) as never);
			await expect(svc.close('org1', '1', '2025-12-31')).rejects.toBeInstanceOf(ConflictException);
		});

		it('404s when the policy is outside the tenant', async () => {
			const rows: Row[] = [{ _id: '1', organizationId: 'org1', ...fullDto(), effectiveFrom: new Date('2026-01-01') } as unknown as Row];
			const svc = new EnterpriseInsurancePolicyService(buildModel(rows) as never);
			await expect(svc.close('org2', '1', '2026-06-30')).rejects.toBeInstanceOf(NotFoundException);
		});
	});
});
