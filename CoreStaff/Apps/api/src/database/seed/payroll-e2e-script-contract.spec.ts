import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const script = (name: string) => readFileSync(resolve(process.cwd(), 'scripts', name), 'utf8');

describe('payroll E2E script lifecycle contract', () => {
  const seed = script('seed-payroll-e2e.ts');
  const verifier = script('verify-payroll-e2e-seed.ts');

  it('seeds an explicit effective work-credit policy without seeding review transitions', () => {
    expect(seed).toContain("const WorkCreditPolicy = db.model('WorkCreditPolicy')");
    expect(seed).toContain('halfDayMinimumRatio: 0.5');
    expect(seed).toContain('fullDayMinimumRatio: 1');
    expect(seed).toContain('paidLeaveCreditEnabled: true');
    expect(seed).toContain("incompleteDayRule: 'BLOCK'");
    expect(seed).toContain("const CalendarException = db.model('CalendarException')");
    expect(seed).toContain("type: 'WEEKLY_OFF'");
    expect(seed).not.toContain("db.model('EmployeeTimesheetAcknowledgement')");
    expect(seed).not.toContain("db.model('DepartmentTimesheetConfirmation')");
  });

  it('verifies the policy and absence of employee/manager/final payroll lifecycle state', () => {
    expect(verifier).toContain("const WorkCreditPolicy = db.model('WorkCreditPolicy')");
    expect(verifier).toContain("const EmployeeTimesheetAcknowledgement = db.model('EmployeeTimesheetAcknowledgement')");
    expect(verifier).toContain("const DepartmentTimesheetConfirmation = db.model('DepartmentTimesheetConfirmation')");
    expect(verifier).toContain("'work-credit-policy-effective'");
    expect(verifier).toContain("'no-pre-generated-review-or-payroll-state'");
  });

  it('queries attendance, overtime, payroll runs and payslips with current schema fields', () => {
    expect(verifier).toContain('employeeId: empUserId');
    expect(verifier).toContain('periodKey: PERIOD');
    expect(verifier).toContain('timesheetPeriodId: period?._id');
    expect(verifier).toContain('periodLabel: `${pad(PERIOD_MONTH)}/${PERIOD_YEAR}`');
    expect(verifier).not.toContain('employeeProfileId,\n    workDate:');
    expect(verifier).not.toContain('periodId: period?._id }),\n    PayrollRun.countDocuments');
  });

  it('scopes every seeded position to the fixture department', () => {
    for (const code of ['DEV', 'DLEAD', 'HRBP']) {
      expect(seed).toContain(`{ organizationId, departmentId, code: '${code}'`);
    }
  });

  it('provides the required date-only birth date for the seeded dependent', () => {
    expect(seed).toContain("dateOfBirth: '2020-01-15'");
  });

  it('uses the modern required tax standard deduction and preserves the legacy alias', () => {
    expect(seed).toContain('standardDeduction: VN_PERSONAL_DEDUCTION');
    expect(seed).toContain('personalDeduction: VN_PERSONAL_DEDUCTION');
  });

  it('uses the canonical KPI payroll input fields', () => {
    expect(seed).toContain('period: PERIOD');
    expect(seed).toContain('amount: FIXTURE_AMOUNTS.kpiBonus');
    expect(seed).toContain("source: 'MANUAL'");
    expect(seed).toContain("status: 'CONFIRMED'");
    expect(verifier).toContain('period: PERIOD');
    expect(verifier).toContain('(kpi as any)?.amount');
  });

  it('does not filter insurance policy by a field absent from its schema', () => {
    const insuranceQuery = verifier.slice(
      verifier.indexOf('const insurance = await InsurancePolicy.findOne'),
      verifier.indexOf("record('insurance-policy-effective'"),
    );
    expect(insuranceQuery).not.toContain('active: true');
  });

  it('uses the same derived insurance contribution base in the exported oracle', () => {
    const exportedOracle = seed.slice(seed.indexOf('export const __seedLedger'));
    expect(exportedOracle).toMatch(/baseSalary: FIXTURE_AMOUNTS\.baseSalary\s+- FIXTURE_AMOUNTS\.mealAllowance\s+- FIXTURE_AMOUNTS\.responsibilityAllowance/);
  });
});
