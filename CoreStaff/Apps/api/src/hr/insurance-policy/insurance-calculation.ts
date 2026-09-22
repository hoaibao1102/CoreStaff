import { InsuranceContributionType } from '../../database/schemas/enums';

/**
 * TASK-039 calculation engine. Implements AC-INS-01 literally:
 * "BHXH/BHYT/BHTN dùng insuranceSalary/cap/rate riêng; tổng không mặc định
 * lấy Gross Income" and SRS §30D.3: "Không tính grossSalary × 10,5%; mỗi
 * khoản dùng insuranceSalary, đối tượng áp dụng và trần riêng."
 *
 * Deliberately pure / no DB access: callers (a future PayrollInputSnapshot
 * step) resolve the effective InsurancePolicy/InsuranceProfile/insuranceSalary
 * first. Rounding uses ROUND_HALF_UP_TO_VND (§30D.1), applied per contribution
 * line — not on the summed total — so employee/employer figures reconcile
 * line-by-line.
 */

export interface InsurancePolicyLike {
	socialInsuranceEmployeeRate: number;
	healthInsuranceEmployeeRate: number;
	unemploymentInsuranceEmployeeRate: number;
	salaryBaseRules: Array<{ type: InsuranceContributionType; floorAmount: number | null }>;
	capRules: Array<{ type: InsuranceContributionType; capAmount: number | null }>;
	employerContributionRates: Array<{ type: InsuranceContributionType; rate: number }>;
}

export interface InsuranceParticipation {
	participatesSocialInsurance: boolean;
	participatesHealthInsurance: boolean;
	participatesUnemploymentInsurance: boolean;
}

export interface ContributionLine {
	type: InsuranceContributionType;
	base: number;
	employeeContribution: number;
	employerContribution: number;
}

export interface InsuranceCalculationResult {
	lines: ContributionLine[];
	mandatoryEmployeeInsurance: number;
	employerInsuranceCost: number;
}

const EMPLOYEE_RATE_BY_TYPE: Record<InsuranceContributionType, keyof InsurancePolicyLike> = {
	[InsuranceContributionType.SOCIAL_INSURANCE]: 'socialInsuranceEmployeeRate',
	[InsuranceContributionType.HEALTH_INSURANCE]: 'healthInsuranceEmployeeRate',
	[InsuranceContributionType.UNEMPLOYMENT_INSURANCE]: 'unemploymentInsuranceEmployeeRate',
};

const PARTICIPATION_FLAG_BY_TYPE: Record<InsuranceContributionType, keyof InsuranceParticipation> = {
	[InsuranceContributionType.SOCIAL_INSURANCE]: 'participatesSocialInsurance',
	[InsuranceContributionType.HEALTH_INSURANCE]: 'participatesHealthInsurance',
	[InsuranceContributionType.UNEMPLOYMENT_INSURANCE]: 'participatesUnemploymentInsurance',
};

/** ROUND_HALF_UP_TO_VND (§30D.1) — VND has no subunit, so this rounds to the nearest integer. */
export function roundHalfUpToVnd(amount: number): number {
	return Math.floor(amount + 0.5);
}

function clampToBase(insuranceSalary: number, floorAmount: number | null | undefined, capAmount: number | null | undefined): number {
	let base = insuranceSalary;
	if (floorAmount != null) base = Math.max(base, floorAmount);
	if (capAmount != null) base = Math.min(base, capAmount);
	return base;
}

/**
 * Only contribution types with `participates* = true` (AC-INS-02) produce a
 * line — the caller must not assume all three are always present.
 */
export function calculateInsuranceContributions(
	policy: InsurancePolicyLike,
	participation: InsuranceParticipation,
	insuranceSalary: number,
): InsuranceCalculationResult {
	const lines: ContributionLine[] = [];

	for (const type of Object.values(InsuranceContributionType)) {
		if (!participation[PARTICIPATION_FLAG_BY_TYPE[type]]) continue;

		const floorAmount = policy.salaryBaseRules.find((r) => r.type === type)?.floorAmount;
		const capAmount = policy.capRules.find((r) => r.type === type)?.capAmount;
		const base = clampToBase(insuranceSalary, floorAmount, capAmount);

		const employeeRate = policy[EMPLOYEE_RATE_BY_TYPE[type]] as number;
		const employerRate = policy.employerContributionRates.find((r) => r.type === type)?.rate ?? 0;

		lines.push({
			type,
			base,
			employeeContribution: roundHalfUpToVnd(base * employeeRate),
			employerContribution: roundHalfUpToVnd(base * employerRate),
		});
	}

	return {
		lines,
		mandatoryEmployeeInsurance: lines.reduce((sum, l) => sum + l.employeeContribution, 0),
		// AC-PAYROLL-02: reported for employer cost, never subtracted from Net Salary by this function or its caller.
		employerInsuranceCost: lines.reduce((sum, l) => sum + l.employerContribution, 0),
	};
}
