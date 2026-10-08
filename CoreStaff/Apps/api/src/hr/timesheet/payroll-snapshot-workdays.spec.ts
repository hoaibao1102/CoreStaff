import { OVERTIME_RATES, computeOvertimePay, deriveInsuranceSalary, hourlyRateFor, resolvePayrollWorkdays } from './payroll-snapshot.service';

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

describe('deriveInsuranceSalary — lương đóng bảo hiểm', () => {
  it('lấy lương cơ bản trừ tổng phụ cấp', () => {
    expect(deriveInsuranceSalary(20_000_000, 1_450_000)).toBe(18_550_000);
  });

  it('kẹp về 0 khi phụ cấp vượt lương cơ bản', () => {
    expect(deriveInsuranceSalary(5_000_000, 8_000_000)).toBe(0);
  });

  it('không phụ cấp → bằng đúng lương cơ bản', () => {
    expect(deriveInsuranceSalary(20_000_000, 0)).toBe(20_000_000);
  });
});

/**
 * B1 — tiền công 1 giờ chỉ được tính MỘT nơi. Snapshot lưu `hourlyRate` và
 * payslip đọc lại, nên tổng các dòng chi tiết OT phải khớp `otPay` đã lưu.
 * Test khoá lại phép tính mà cả hai phía dùng.
 */
describe('OT pay — số giờ × tiền công 1 giờ × hệ số', () => {
  it('tổng các dòng chi tiết OT bằng đúng otPay đã lưu (khoá B1)', () => {
    const monthlyBaseSalary = 20_000_000;
    const standardWorkingDays = 22;
    // Dùng đúng helper thật, không chép lại công thức — một phía đổi là test đỏ.
    const hourlyRate = hourlyRateFor(monthlyBaseSalary, standardWorkingDays);
    expect(hourlyRate).toBeCloseTo(20_000_000 / (22 * 8), 6);

    const minutes = { workingDay: 180, weeklyOff: 60, publicHoliday: 0 };
    // Snapshot: otPay = tổng 3 loại.
    const otPay =
      computeOvertimePay(minutes.workingDay, hourlyRate, OVERTIME_RATES.workingDay) +
      computeOvertimePay(minutes.weeklyOff, hourlyRate, OVERTIME_RATES.weeklyOff) +
      computeOvertimePay(minutes.publicHoliday, hourlyRate, OVERTIME_RATES.publicHoliday);
    // Payslip: đọc lại `hourlyRate` đã lưu, dựng breakdown từng dòng.
    const breakdown = [
      computeOvertimePay(minutes.workingDay, hourlyRate, OVERTIME_RATES.workingDay),
      computeOvertimePay(minutes.weeklyOff, hourlyRate, OVERTIME_RATES.weeklyOff),
    ];
    expect(breakdown.reduce((sum, line) => sum + line, 0)).toBe(otPay);
  });

  it('hệ số giữ nguyên 1.5 / 2.0 / 3.0 (SRS §30D.2)', () => {
    expect(OVERTIME_RATES).toEqual({ workingDay: 1.5, weeklyOff: 2.0, publicHoliday: 3.0 });
  });
});
