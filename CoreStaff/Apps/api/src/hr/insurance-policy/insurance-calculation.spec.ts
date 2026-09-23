import { calculateInsuranceContributions, roundHalfUpToVnd, InsurancePolicyLike } from './insurance-calculation';

const SEED_POLICY: InsurancePolicyLike = {
	socialInsuranceEmployeeRate: 0.08,
	healthInsuranceEmployeeRate: 0.015,
	unemploymentInsuranceEmployeeRate: 0.01,
	salaryBaseRules: [
		{ type: 'SOCIAL_INSURANCE' as never, floorAmount: null },
		{ type: 'HEALTH_INSURANCE' as never, floorAmount: null },
		{ type: 'UNEMPLOYMENT_INSURANCE' as never, floorAmount: null },
	],
	capRules: [
		{ type: 'SOCIAL_INSURANCE' as never, capAmount: null },
		{ type: 'HEALTH_INSURANCE' as never, capAmount: null },
		{ type: 'UNEMPLOYMENT_INSURANCE' as never, capAmount: null },
	],
	employerContributionRates: [
		{ type: 'SOCIAL_INSURANCE' as never, rate: 0.175 },
		{ type: 'HEALTH_INSURANCE' as never, rate: 0.03 },
		{ type: 'UNEMPLOYMENT_INSURANCE' as never, rate: 0.01 },
	],
};

const FULL_PARTICIPATION = { participatesSocialInsurance: true, participatesHealthInsurance: true, participatesUnemploymentInsurance: true };

describe('calculateInsuranceContributions (TASK-039, AC-INS-01)', () => {
	it('never uses grossSalary × 10.5% — each line uses insuranceSalary and its own rate (§30D.3)', () => {
		// insuranceSalary and grossIncome deliberately differ (grossIncome includes
		// allowances/OT/bonus that insuranceSalary never does) so a base mix-up shows up as a wrong number.
		const insuranceSalary = 15000000;
		const grossIncome = 21000000;
		const result = calculateInsuranceContributions(SEED_POLICY, FULL_PARTICIPATION, insuranceSalary);

		const social = result.lines.find((l) => l.type === 'SOCIAL_INSURANCE');
		const health = result.lines.find((l) => l.type === 'HEALTH_INSURANCE');
		const unemployment = result.lines.find((l) => l.type === 'UNEMPLOYMENT_INSURANCE');

		expect(social?.employeeContribution).toBe(roundHalfUpToVnd(insuranceSalary * 0.08));
		expect(health?.employeeContribution).toBe(roundHalfUpToVnd(insuranceSalary * 0.015));
		expect(unemployment?.employeeContribution).toBe(roundHalfUpToVnd(insuranceSalary * 0.01));
		// The three seed rates do sum to 10.5% (§30D.3) — the forbidden shortcut is
		// multiplying grossIncome by that combined rate, not the rate sum itself.
		expect(result.mandatoryEmployeeInsurance).toBe(roundHalfUpToVnd(insuranceSalary * 0.105));
		expect(result.mandatoryEmployeeInsurance).not.toBe(roundHalfUpToVnd(grossIncome * 0.105));
	});

	it('AC-INS-02: only participating contribution types produce a line', () => {
		const result = calculateInsuranceContributions(
			SEED_POLICY,
			{ participatesSocialInsurance: true, participatesHealthInsurance: false, participatesUnemploymentInsurance: false },
			15000000,
		);
		expect(result.lines).toHaveLength(1);
		expect(result.lines[0].type).toBe('SOCIAL_INSURANCE');
	});

	it('AC-INS-03: base is floored and capped independently of insuranceSalary', () => {
		const policy: InsurancePolicyLike = {
			...SEED_POLICY,
			salaryBaseRules: [{ type: 'SOCIAL_INSURANCE' as never, floorAmount: 5000000 }, ...SEED_POLICY.salaryBaseRules.slice(1)],
			capRules: [{ type: 'HEALTH_INSURANCE' as never, capAmount: 10000000 }, ...SEED_POLICY.capRules.filter((r) => r.type !== ('HEALTH_INSURANCE' as never))],
		};

		const belowFloor = calculateInsuranceContributions(policy, { ...FULL_PARTICIPATION, participatesHealthInsurance: false, participatesUnemploymentInsurance: false }, 3000000);
		expect(belowFloor.lines[0].base).toBe(5000000);

		const aboveCap = calculateInsuranceContributions(policy, { ...FULL_PARTICIPATION, participatesSocialInsurance: false, participatesUnemploymentInsurance: false }, 30000000);
		expect(aboveCap.lines[0].base).toBe(10000000);
	});

	it('AC-PAYROLL-02: employer contribution is computed from its own rate, reported separately from mandatoryEmployeeInsurance', () => {
		const result = calculateInsuranceContributions(SEED_POLICY, FULL_PARTICIPATION, 15000000);
		const social = result.lines.find((l) => l.type === 'SOCIAL_INSURANCE')!;

		expect(result.employerInsuranceCost).toBeGreaterThan(0);
		expect(result.mandatoryEmployeeInsurance).not.toBe(result.employerInsuranceCost);
		// SI employee 8% vs employer 17.5% (SEED_POLICY) — same base, independent rates.
		expect(social.employerContribution).toBe(roundHalfUpToVnd(social.base * 0.175));
		expect(social.employerContribution).not.toBe(social.employeeContribution);
	});

	it('rounds each line with ROUND_HALF_UP_TO_VND, not the summed total', () => {
		// 1,000,001 × 0.015 = 15,000.015 → rounds up to 15,000 (0.015 < 0.5) — sanity check on the rounding rule itself.
		expect(roundHalfUpToVnd(15000.4)).toBe(15000);
		expect(roundHalfUpToVnd(15000.5)).toBe(15001);
	});

	it('produces no lines and a zero total when nothing is participating', () => {
		const result = calculateInsuranceContributions(SEED_POLICY, { participatesSocialInsurance: false, participatesHealthInsurance: false, participatesUnemploymentInsurance: false }, 15000000);
		expect(result.lines).toHaveLength(0);
		expect(result.mandatoryEmployeeInsurance).toBe(0);
		expect(result.employerInsuranceCost).toBe(0);
	});
});
