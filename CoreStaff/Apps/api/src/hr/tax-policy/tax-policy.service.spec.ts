import { Types } from 'mongoose';
import { TaxPolicyService } from './tax-policy.service';

describe('TaxPolicyService.update', () => {
	it('accepts a policy whose Mongo ObjectId organization matches the session organization string', async () => {
		const organizationId = new Types.ObjectId();
		const policyId = new Types.ObjectId().toString();
		const existing = {
			_id: policyId,
			organizationId,
			effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
			standardDeduction: 15_500_000,
			personalDeduction: 15_500_000,
			dependentDeduction: 6_200_000,
			progressiveBrackets: [{ upperLimit: 10_000_000, rate: 5 }],
			roundingRule: 'ROUND_HALF_UP_TO_VND',
			legalReference: 'Dữ liệu demo',
			version: 1,
			active: true,
		};
		const taxPolicies = {
			findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(existing) }),
			findByIdAndUpdate: jest.fn().mockResolvedValue(existing),
			findOne: jest.fn()
				.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) })
				.mockReturnValueOnce({
					sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(existing) }),
				}),
			create: jest.fn().mockResolvedValue({
				toObject: () => ({ ...existing, _id: new Types.ObjectId(), version: 2 }),
			}),
		};
		const service = new TaxPolicyService(taxPolicies as any);

		const result = await service.update(organizationId.toString(), policyId, {
			personalDeduction: 15_500_000,
			dependentDeduction: 6_200_000,
		} as any);

		expect(result.version).toBe(2);
		expect(taxPolicies.findByIdAndUpdate).toHaveBeenCalledWith(policyId, { active: false });
	});
});
