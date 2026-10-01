/**
 * Pure payroll calculators used by the E2E seed (Task 13A) and shared by tests.
 *
 * Inputs are sourced from policy + frozen inputs only — no DB calls, no globals.
 * Output matches the canonical contract:
 *
 *   grossEarnings    = proratedBase + taxableAllow + nonTaxableAllow
 *                      + totalOtPay + attendanceBonus + kpiBonus
 *   employeeInsurance = contributionBase × (BHXH+BHYT+BHTN rates)
 *   taxableIncome    = gross − nonTaxableAllow − exemptOtPremium
 *                      − employeeInsurance − personalDed − dependentDed
 *   pitAmount        = progressive(taxableIncome)
 *   netSalary        = gross − employeeInsurance − pitAmount − otherDeductions
 *
 * All amounts are integer VND.
 */
export const VN_PERSONAL_DEDUCTION = 11_000_000;
export const VN_DEPENDENT_DEDUCTION = 4_400_000;
export const VN_INSURANCE_CAP = 52_200_000;
export const STANDARD_WORKING_DAYS = 22;
export const STANDARD_WORKING_MINUTES = 22 * 8 * 60;

export const PROGRESSIVE_BRACKETS: ReadonlyArray<{ upperLimit: number; rate: number }> = [
  { upperLimit: 10_000_000, rate: 5 },
  { upperLimit: 30_000_000, rate: 10 },
  { upperLimit: 60_000_000, rate: 20 },
  { upperLimit: 100_000_000, rate: 30 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 35 },
];

export interface OtBreakdownInput {
  workingDayMinutes: number;
  weeklyOffMinutes: number;
  baseSalary: number;
  workingDays?: number;
  hoursPerDay?: number;
}

export interface OtBreakdown {
  hourlyRate: number;
  workingDayPay: number;
  weeklyOffPay: number;
  totalOtPay: number;
  workingDayBase: number;
  workingDayPremium: number;
  weeklyOffBase: number;
  weeklyOffPremium: number;
}

export function computeOtBreakdown(input: OtBreakdownInput): OtBreakdown {
  const workingDays = input.workingDays ?? STANDARD_WORKING_DAYS;
  const hoursPerDay = input.hoursPerDay ?? 8;
  const totalHours = workingDays * hoursPerDay;
  const hourlyRate = input.baseSalary / totalHours;
  const wdPay = (input.workingDayMinutes / 60) * 1.5 * hourlyRate;
  const wePay = (input.weeklyOffMinutes / 60) * 2.0 * hourlyRate;
  const wdBase = (input.workingDayMinutes / 60) * 1.0 * hourlyRate;
  const wdPremium = (input.workingDayMinutes / 60) * 0.5 * hourlyRate;
  const weBase = (input.weeklyOffMinutes / 60) * 1.0 * hourlyRate;
  const wePremium = (input.weeklyOffMinutes / 60) * 1.0 * hourlyRate;
  return {
    hourlyRate: Math.round(hourlyRate),
    workingDayPay: Math.round(wdPay),
    weeklyOffPay: Math.round(wePay),
    totalOtPay: Math.round(wdPay + wePay),
    workingDayBase: Math.round(wdBase),
    workingDayPremium: Math.round(wdPremium),
    weeklyOffBase: Math.round(weBase),
    weeklyOffPremium: Math.round(wePremium),
  };
}

export interface InsuranceInput {
  baseSalary: number;
  socialRate: number;
  healthRate: number;
  unemploymentRate: number;
  cap?: number;
}

export interface InsuranceBreakdown {
  contributionBase: number;
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  totalInsurance: number;
}

export function computeEmployeeInsurance(input: InsuranceInput): InsuranceBreakdown {
  const cap = input.cap ?? VN_INSURANCE_CAP;
  const contributionBase = Math.min(input.baseSalary, cap);
  const socialInsurance = Math.round(contributionBase * input.socialRate);
  const healthInsurance = Math.round(contributionBase * input.healthRate);
  const unemploymentInsurance = Math.round(contributionBase * input.unemploymentRate);
  return {
    contributionBase,
    socialInsurance,
    healthInsurance,
    unemploymentInsurance,
    totalInsurance: socialInsurance + healthInsurance + unemploymentInsurance,
  };
}

export interface PitInput {
  taxableIncome: number;
  personalDeduction?: number;
  dependentDeduction?: number;
  dependentCount?: number;
  brackets?: ReadonlyArray<{ upperLimit: number; rate: number }>;
}

export interface PitBreakdown {
  taxableIncome: number;
  personalDeduction: number;
  dependentDeduction: number;
  pitAmount: number;
}

export function computePit(input: PitInput): PitBreakdown {
  const personalDeduction = input.personalDeduction ?? VN_PERSONAL_DEDUCTION;
  const dependentDeduction = input.dependentDeduction ?? VN_DEPENDENT_DEDUCTION;
  const dependentCount = input.dependentCount ?? 0;
  const brackets = input.brackets ?? PROGRESSIVE_BRACKETS;
  const totalDependentDeduction = dependentCount * dependentDeduction;
  const reduced = Math.max(
    0,
    input.taxableIncome - personalDeduction - totalDependentDeduction,
  );
  let remaining = reduced;
  let previousLimit = 0;
  let totalTax = 0;
  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const width = bracket.upperLimit - previousLimit;
    const taxableInBracket = Math.min(remaining, width);
    totalTax += taxableInBracket * (bracket.rate / 100);
    remaining -= taxableInBracket;
    previousLimit = bracket.upperLimit;
  }
  return {
    taxableIncome: reduced,
    personalDeduction,
    dependentDeduction: totalDependentDeduction,
    pitAmount: Math.round(totalTax),
  };
}

export interface PayrollLedgerInput {
  baseSalary: number;
  attendanceDays: number;
  standardDays?: number;
  taxableAllowances: number;
  nonTaxableAllowances: number;
  attendanceBonus: number;
  kpiBonus: number;
  otWorkingDayMinutes: number;
  otWeeklyOffMinutes: number;
  dependentCount: number;
  personalDeduction?: number;
  dependentDeduction?: number;
  insurance: InsuranceBreakdown;
}

export interface PayrollLedger {
  proratedBaseSalary: number;
  taxableAllowances: number;
  nonTaxableAllowances: number;
  attendanceBonus: number;
  kpiBonus: number;
  otWorkingDayMinutes: number;
  otWeeklyOffMinutes: number;
  otBaseTaxable: number;
  otPremiumExempt: number;
  totalOtPay: number;
  grossEarnings: number;
  contributionBase: number;
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  personalDeduction: number;
  dependentDeduction: number;
  taxableIncome: number;
  pitAmount: number;
  netSalary: number;
}

export function computePayrollLedger(input: PayrollLedgerInput): PayrollLedger {
  const standardDays = input.standardDays ?? STANDARD_WORKING_DAYS;
  const proratedBaseSalary = Math.round((input.baseSalary / standardDays) * input.attendanceDays);
  const ot = computeOtBreakdown({
    baseSalary: input.baseSalary,
    workingDays: standardDays,
    workingDayMinutes: input.otWorkingDayMinutes,
    weeklyOffMinutes: input.otWeeklyOffMinutes,
  });
  const otBaseTaxable = ot.workingDayBase + ot.weeklyOffBase;
  const otPremiumExempt = ot.workingDayPremium + ot.weeklyOffPremium;
  const totalOtPay = ot.totalOtPay;
  const grossEarnings =
    proratedBaseSalary +
    input.taxableAllowances +
    input.nonTaxableAllowances +
    totalOtPay +
    input.attendanceBonus +
    input.kpiBonus;
  const taxableGrossForPit =
    proratedBaseSalary +
    input.taxableAllowances +
    otBaseTaxable +
    input.attendanceBonus +
    input.kpiBonus;
  const personalDeduction = input.personalDeduction ?? VN_PERSONAL_DEDUCTION;
  const dependentDeduction = input.dependentDeduction ?? VN_DEPENDENT_DEDUCTION;
  const pit = computePit({
    taxableIncome: Math.max(0, taxableGrossForPit - input.insurance.totalInsurance),
    personalDeduction,
    dependentDeduction,
    dependentCount: input.dependentCount,
  });
  const totalDependentDeduction = input.dependentCount * dependentDeduction;
  const netSalary =
    grossEarnings - input.insurance.totalInsurance - pit.pitAmount;
  return {
    proratedBaseSalary,
    taxableAllowances: input.taxableAllowances,
    nonTaxableAllowances: input.nonTaxableAllowances,
    attendanceBonus: input.attendanceBonus,
    kpiBonus: input.kpiBonus,
    otWorkingDayMinutes: input.otWorkingDayMinutes,
    otWeeklyOffMinutes: input.otWeeklyOffMinutes,
    otBaseTaxable,
    otPremiumExempt,
    totalOtPay,
    grossEarnings,
    contributionBase: input.insurance.contributionBase,
    socialInsurance: input.insurance.socialInsurance,
    healthInsurance: input.insurance.healthInsurance,
    unemploymentInsurance: input.insurance.unemploymentInsurance,
    personalDeduction,
    dependentDeduction: totalDependentDeduction,
    taxableIncome: pit.taxableIncome,
    pitAmount: pit.pitAmount,
    netSalary,
  };
}
