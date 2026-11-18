import { deriveInsuranceSalary } from '../timesheet/payroll-snapshot.service';

/**
 * QC 4.11 — only allowances flagged `insuranceBased` are subtracted from the
 * insurance base; unflagged allowances leave the base untouched.
 */
describe('deriveInsuranceSalary — flagged allowances only', () => {
  it('subtracts just the insurance-bearing amount', () => {
    // base 20M, flagged 1.45M, unflagged 2M → 18.55M (the 2M is not deducted)
    expect(deriveInsuranceSalary(20_000_000, 1_450_000)).toBe(18_550_000);
  });

  it('leaves the base whole when no allowance is flagged', () => {
    expect(deriveInsuranceSalary(20_000_000, 0)).toBe(20_000_000);
  });

  it('never returns a negative base', () => {
    expect(deriveInsuranceSalary(10_000_000, 25_000_000)).toBe(0);
  });
});
