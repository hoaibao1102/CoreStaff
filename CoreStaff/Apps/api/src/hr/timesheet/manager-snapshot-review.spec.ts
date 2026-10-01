import { buildManagerSnapshotReview } from './timesheet-period.service';

describe('manager snapshot review projection', () => {
  it('returns only department work data and excludes payroll, insurance, tax, and integrity fields', () => {
    const summaries = [{
      _id: 'summary-1',
      employeeProfileId: 'employee-1',
      departmentId: 'department-1',
      departmentName: 'Engineering',
      employeeCode: 'TVS-0112',
      fullName: 'Hoài Bảo',
      workingDays: 22,
      presentDays: 20,
      absentDays: 1,
      incompleteDays: 1,
      paidLeaveDays: 1,
      unpaidLeaveDays: 0,
      totalWorkingMinutes: 9_600,
      totalLateMinutes: 10,
      totalEarlyMinutes: 5,
      otWorkingDayMinutes: 60,
      otWeeklyOffMinutes: 120,
      otPublicHolidayMinutes: 0,
      totalOvertimeMinutes: 180,
      sourceHash: 'must-not-leak',
    }];
    const payrollSnapshots = [{
      employeeProfileId: 'employee-1',
      monthlyBaseSalary: 20_000_000,
      proratedBaseSalary: 18_000_000,
      totalAllowances: 1_000_000,
      otPay: 500_000,
      socialInsurance: 1_600_000,
      healthInsurance: 300_000,
      unemploymentInsurance: 200_000,
      taxableEarnings: 16_000_000,
      dependentCount: 2,
      allowanceBreakdown: [{ label: 'Ăn trưa', amount: 730_000 }],
    }];

    const result = buildManagerSnapshotReview(summaries, payrollSnapshots);

    expect(result).toEqual({ summaries: [{
      employeeProfileId: 'employee-1',
      departmentId: 'department-1',
      departmentName: 'Engineering',
      employeeCode: 'TVS-0112',
      fullName: 'Hoài Bảo',
      standardWorkingDays: 22,
      actualWorkingDays: 20,
      absentDays: 1,
      incompleteDays: 1,
      paidLeaveDays: 1,
      unpaidLeaveDays: 0,
      totalWorkingMinutes: 9_600,
      totalLateMinutes: 10,
      totalEarlyMinutes: 5,
      otWorkingDayMinutes: 60,
      otWeeklyOffMinutes: 120,
      otPublicHolidayMinutes: 0,
      totalOvertimeMinutes: 180,
    }] });
    expect(JSON.stringify(result)).not.toMatch(/salary|allowance|insurance|taxable|dependent|sourceHash|otPay/i);
  });
});
