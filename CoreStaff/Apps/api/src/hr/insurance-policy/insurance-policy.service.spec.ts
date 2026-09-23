import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InsurancePolicyService } from './insurance-policy.service';

interface Row {
	_id: string;
	organizationId: string;
	effectiveFrom: Date;
	effectiveTo?: Date;
	legalReference: string;
	socialInsuranceEmployeeRate: number;
	healthInsuranceEmployeeRate: number;
	unemploymentInsuranceEmployeeRate: number;
	salaryBaseRules: Array<{ type: string; floorAmount: number | null }>;
	capRules: Array<{ type: string; capAmount: number | null }>;
	employerContributionRates: Array<{ type: string; rate: number }>;
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

const ALL_TYPE_ROWS = ['SOCIAL_INSURANCE', 'HEALTH_INSURANCE', 'UNEMPLOYMENT_INSURANCE'];

function fullDto(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		effectiveFrom: '2026-09-25',
		legalReference: 'Luật BHXH 41/2024/QH15',
		socialInsuranceEmployeeRate: 0.08,
		healthInsuranceEmployeeRate: 0.015,
		unemploymentInsuranceEmployeeRate: 0.01,
		salaryBaseRules: ALL_TYPE_ROWS.map((type) => ({ type, floorAmount: null })),
		capRules: ALL_TYPE_ROWS.map((type) => ({ type, capAmount: null })),
		employerContributionRates: ALL_TYPE_ROWS.map((type) => ({ type, rate: 0.1 })),
		...overrides,
	};
}

describe('InsurancePolicyService (TASK-039)', () => {
	it('creates a policy version with the seed reference rates (§30D.3)', async () => {
		const svc = new InsurancePolicyService(buildModel([]) as never);
		const doc = await svc.create('org1', 'hr1', fullDto() as never);
		expect(doc).toMatchObject({ socialInsuranceEmployeeRate: 0.08, healthInsuranceEmployeeRate: 0.015, unemploymentInsuranceEmployeeRate: 0.01, version: 1 });
	});

	it('rejects a policy missing one contribution type in salaryBaseRules', async () => {
		const svc = new InsurancePolicyService(buildModel([]) as never);
		const dto = fullDto({ salaryBaseRules: [{ type: 'SOCIAL_INSURANCE', floorAmount: null }, { type: 'HEALTH_INSURANCE', floorAmount: null }] });
		await expect(svc.create('org1', 'hr1', dto as never)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects a duplicated contribution type in employerContributionRates', async () => {
		const svc = new InsurancePolicyService(buildModel([]) as never);
		const dto = fullDto({ employerContributionRates: [{ type: 'SOCIAL_INSURANCE', rate: 0.1 }, { type: 'SOCIAL_INSURANCE', rate: 0.2 }, { type: 'HEALTH_INSURANCE', rate: 0.1 }] });
		await expect(svc.create('org1', 'hr1', dto as never)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects a floor set above the cap for the same contribution type', async () => {
		const svc = new InsurancePolicyService(buildModel([]) as never);
		const dto = fullDto({
			salaryBaseRules: [{ type: 'SOCIAL_INSURANCE', floorAmount: 20000000 }, ...ALL_TYPE_ROWS.slice(1).map((type) => ({ type, floorAmount: null }))],
			capRules: [{ type: 'SOCIAL_INSURANCE', capAmount: 15000000 }, ...ALL_TYPE_ROWS.slice(1).map((type) => ({ type, capAmount: null }))],
		});
		await expect(svc.create('org1', 'hr1', dto as never)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('allows a floor exactly equal to the cap for the same type', async () => {
		const svc = new InsurancePolicyService(buildModel([]) as never);
		const dto = fullDto({
			salaryBaseRules: [{ type: 'SOCIAL_INSURANCE', floorAmount: 15000000 }, ...ALL_TYPE_ROWS.slice(1).map((type) => ({ type, floorAmount: null }))],
			capRules: [{ type: 'SOCIAL_INSURANCE', capAmount: 15000000 }, ...ALL_TYPE_ROWS.slice(1).map((type) => ({ type, capAmount: null }))],
		});
		const doc = await svc.create('org1', 'hr1', dto as never);
		expect(doc.version).toBe(1);
	});

	it('rejects an overlapping effective period within the same organization', async () => {
		const rows: Row[] = [{ _id: '1', organizationId: 'org1', ...fullDto(), effectiveFrom: new Date('2026-01-01') } as unknown as Row];
		const svc = new InsurancePolicyService(buildModel(rows) as never);
		await expect(svc.create('org1', 'hr1', fullDto() as never)).rejects.toBeInstanceOf(ConflictException);
	});

	it('404s INSURANCE_POLICY_NOT_CONFIGURED when no policy is effective', async () => {
		const svc = new InsurancePolicyService(buildModel([]) as never);
		await expect(svc.findEffective('org1', new Date())).rejects.toBeInstanceOf(NotFoundException);
	});
});
