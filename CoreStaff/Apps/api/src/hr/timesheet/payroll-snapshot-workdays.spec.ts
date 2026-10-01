import { resolvePayrollWorkdays } from './payroll-snapshot.service';

describe('payroll snapshot workday basis', () => {
  it('uses the organization calendar standard and does not reduce salary for paid holidays', () => {
    expect(resolvePayrollWorkdays({
      workingDays: 20,
      presentDays: 22,
      absentDays: 0,
      unpaidLeaveDays: 0,
    })).toEqual({ standardWorkingDays: 20, payableWorkingDays: 20 });
  });

  it('reduces payable workdays for absence and unpaid leave only', () => {
    expect(resolvePayrollWorkdays({
      workingDays: 20,
      presentDays: 18,
      absentDays: 1,
      unpaidLeaveDays: 1,
    })).toEqual({ standardWorkingDays: 20, payableWorkingDays: 18 });
  });
});
