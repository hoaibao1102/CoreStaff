import { validate } from 'class-validator';
import { CreateTaxPolicyDto } from './create-tax-policy.dto';

const basePolicy = () => Object.assign(new CreateTaxPolicyDto(), {
	effectiveFrom: '2026-01-01T00:00:00.000Z',
	dependentDeduction: 6_200_000,
	progressiveBrackets: [{ upperLimit: 10_000_000, rate: 5 }],
	roundingRule: 'ROUND_HALF_UP_TO_VND' as const,
	legalReference: 'Luật Thuế TNCN',
});

describe('CreateTaxPolicyDto personal deduction compatibility', () => {
	it('accepts the legacy personalDeduction field when standardDeduction is absent', async () => {
		const dto = Object.assign(basePolicy(), { personalDeduction: 15_500_000 });

		const errors = await validate(dto);

		expect(errors.find(error => error.property === 'standardDeduction')).toBeUndefined();
	});

	it('rejects a policy when both personal deduction fields are absent', async () => {
		const errors = await validate(basePolicy());

		expect(errors.map(error => error.property)).toContain('standardDeduction');
	});
});
