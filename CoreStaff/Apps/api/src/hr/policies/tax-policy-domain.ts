/**
 * TASK-041 — Pure functions for Vietnam PIT (Personal Income Tax) calculation.
 * 
 * These functions are side-effect free and can be used by:
 * - TaxPolicy service (preview, validation)
 * - Payroll service (actual calculation)
 * - Frontend (real-time preview)
 * 
 * Business Logic (Vietnam 5-tier progressive brackets):
 * - TaxableIncome = TaxableEarnings - Insurance - PersonalDeduction(11tr) - DependentDeductions(4.4tr × n)
 * - PIT = Σ(tier_income × tier_rate) using progressive brackets
 */

/**
 * Tax bracket definition for progressive calculation.
 */
export interface TaxBracket {
	upperLimit: number | null; // Ngưỡng trên của bậc (null = vô cùng)
	rate: number; // Thuế suất (%)
}

/**
 * Rounding rule options.
 */
export type RoundingRule = 'ROUND_HALF_UP_TO_VND' | 'ROUND_DOWN_TO_VND' | 'ROUND_UP_TO_VND';

// ─── Progressive Bracket Calculation ───────────────────────────────────────

/**
 * Calculate PIT using progressive tax brackets.
 * 
 * Example (2026 rates - 5 tiers per Vietnam Law):
 * - Bậc 1: 0 → 10 triệu → 5%
 * - Bậc 2: trên 10 → 30 triệu → 10%
 * - Bậc 3: trên 30 → 60 triệu → 20%
 * - Bậc 4: trên 60 → 100 triệu → 30%
 * - Bậc 5: trên 100 triệu → 35%
 * 
 * If taxableIncome = 29,119,000:
 * - 10M × 5% = 500,000
 * - 19,119,000 × 10% = 1,911,900
 * - Total = 2,411,900
 */
export function calculateProgressivePIT(taxableIncome: number, brackets: TaxBracket[]): number {
	if (taxableIncome <= 0) return 0;

	let totalTax = 0;
	let previousLimit = 0;

	for (const bracket of brackets) {
		const upperLimit = bracket.upperLimit ?? Number.POSITIVE_INFINITY;
		const tierIncome = Math.min(taxableIncome, upperLimit) - previousLimit;

		if (tierIncome > 0) {
			totalTax += tierIncome * (bracket.rate / 100);
		}

		if (taxableIncome <= upperLimit) {
			break;
		}

		previousLimit = upperLimit;
	}

	return totalTax;
}

// ─── Deduction Calculations ────────────────────────────────────────────────

/**
 * Calculate insurance deduction (employee contribution).
 * Employee insurance = 10.5% of insuranceBaseSalary.
 */
export function calculateInsuranceDeduction(insuranceBaseSalary: number): number {
	return insuranceBaseSalary * 0.105;
}

/**
 * Calculate dependent deductions.
 * Each dependent = 4,400,000 VND/month (2026 rate).
 */
export function calculateDependentDeduction(dependentCount: number, dependentDeductionRate: number): number {
	return dependentCount * dependentDeductionRate;
}

// ─── Main PIT Calculation ──────────────────────────────────────────────────

export interface PitCalculationParams {
	grossEarnings: number; // Tổng thu nhập trước khi khấu trừ
	insuranceBaseSalary: number; // Tiền bảo hiểm cơ sở
	personalDeduction: number; // Giảm trừ bản thân (15,500,000)
	dependentDeduction: number; // Giảm trừ/người phụ thuộc (6,200,000)
	dependentCount: number; // Số người phụ thuộc
	brackets: TaxBracket[]; // Biểu thuế lũy tiến
	roundingRule?: RoundingRule; // Quy tắc làm tròn
	earningBreakdown?: Record<string, number>; // Chi tiết từng loại thu nhập
}

/**
 * Calculate full PIT (Personal Income Tax) for an employee.
 * 
 * Formula:
 * 1. TaxableIncome = GrossEarnings - Insurance - PersonalDeduction - DependentDeductions
 * 2. TaxableEarnings = max(TaxableIncome, 0)
 * 3. PIT = applyProgressiveBrackets(TaxableEarnings)
 * 
 * Returns object with breakdown for reporting.
 */
export function calculatePIT(params: PitCalculationParams): {
	taxableIncome: number;
	insuranceDeduction: number;
	personalDeduction: number;
	dependentDeduction: number;
	totalDeductions: number;
	taxableEarnings: number;
	pit: number;
	roundingRule: RoundingRule;
} {
	const {
		grossEarnings,
		insuranceBaseSalary,
		personalDeduction,
		dependentDeduction,
		dependentCount,
		brackets,
		roundingRule = 'ROUND_HALF_UP_TO_VND',
		earningBreakdown,
	} = params;

	// Step 1: Calculate deductions
	const insuranceDeduction = calculateInsuranceDeduction(insuranceBaseSalary);
	const dependentDeductionTotal = calculateDependentDeduction(dependentCount, dependentDeduction);

	// Step 2: Calculate taxable income
	const totalDeductions = insuranceDeduction + personalDeduction + dependentDeductionTotal;
	const taxableIncome = Math.max(grossEarnings - totalDeductions, 0);

	// Step 4: Calculate PIT using progressive brackets
	let pit = calculateProgressivePIT(taxableIncome, brackets);

	// Step 5: Apply rounding
	switch (roundingRule) {
		case 'ROUND_HALF_UP_TO_VND':
			pit = Math.round(pit);
			break;
		case 'ROUND_DOWN_TO_VND':
			pit = Math.floor(pit);
			break;
		case 'ROUND_UP_TO_VND':
			pit = Math.ceil(pit);
			break;
		default:
			pit = Math.round(pit);
	}

	return {
		taxableIncome,
		insuranceDeduction,
		personalDeduction,
		dependentDeduction: dependentDeductionTotal,
		totalDeductions,
		taxableEarnings: taxableIncome,
		pit,
		roundingRule,
	};
}
