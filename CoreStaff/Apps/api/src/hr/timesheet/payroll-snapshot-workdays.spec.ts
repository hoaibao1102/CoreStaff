import {
  OVERTIME_RATES,
  computeOvertimePay,
  deriveInsuranceSalary,
  hourlyRateFor,
  overtimeRatesOf,
  resolveOvertimeRatesForPeriod,
  resolvePayrollWorkdays,
} from './payroll-snapshot.service';

describe('payroll snapshot workday basis', () => {
  it('preserves decimal frozen work units for versioned summaries', () => {
    expect(resolvePayrollWorkdays({
      calculationContract: 'VERSIONED_WORK_CREDIT_V2',
      standardWorkUnits: 22,
      payableWorkUnits: 20.5,
    } as any)).toEqual({ standardWorkingDays: 22, payableWorkingDays: 20.5 });
  });

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
  it('uses frozen standard minutes for six and eight hour shifts', () => {
    expect(hourlyRateFor(12_000_000, 20, 7_200)).toBe(100_000);
    expect(hourlyRateFor(12_000_000, 20, 9_600)).toBe(75_000);
  });

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

/**
 * Q — payroll đọc `OvertimePayPolicy` thay vì hằng số. Ba điều phải giữ:
 * 1. Có policy hiệu lực → dùng hệ số của policy.
 * 2. Không có policy (tổ chức cũ) → rơi về hằng số, KHÔNG nổ.
 * 3. Payslip đọc hệ số đã đóng băng trong snapshot, không đọc policy hôm nay.
 */
describe('overtime rates — policy thay cho hằng số', () => {
  const model = (row: any) => ({ findOne: () => ({ sort: () => ({ session: () => ({ lean: async () => row }) }) }) }) as any;

  it('dùng hệ số của policy hiệu lực', async () => {
    const rates = await resolveOvertimeRatesForPeriod(
      model({ _id: 'p1', workingDayRate: 1.6, weeklyOffRate: 2.2, publicHolidayRate: 3.1, version: 4, legalReference: 'BLLĐ 45' }),
      '507f1f77bcf86cd799439012',
      '2026-11',
    );
    expect(rates).toMatchObject({
      workingDay: 1.6, weeklyOff: 2.2, publicHoliday: 3.1,
      policyId: 'p1', version: 4, contract: 'OVERTIME_PAY_POLICY',
    });
  });

  it('không có policy hoặc không có model → fallback hằng số, không nổ', async () => {
    for (const m of [model(null), undefined]) {
      const rates = await resolveOvertimeRatesForPeriod(m, '507f1f77bcf86cd799439012', '2026-11');
      expect(rates).toMatchObject({ workingDay: 1.5, weeklyOff: 2.0, publicHoliday: 3.0, policyId: null, contract: 'FROZEN_STATIC_RATES_V1' });
    }
  });

  it('payslip đọc hệ số đã đóng băng trong snapshot', () => {
    const frozen = { overtimeRateEvidence: [{ workingDay: 1.6, weeklyOff: 2.2, publicHoliday: 3.1 }] };
    expect(overtimeRatesOf(frozen)).toEqual({ workingDay: 1.6, weeklyOff: 2.2, publicHoliday: 3.1 });
    // Snapshot cũ không có evidence → đúng hằng số mà nó đã được tính bằng.
    expect(overtimeRatesOf({})).toEqual(OVERTIME_RATES);
    expect(overtimeRatesOf({ overtimeRateEvidence: [{ workingDay: -1 }] })).toEqual(OVERTIME_RATES);
  });

  it('đổi hệ số làm otPay đổi, nên evidence phải đi cùng snapshot', () => {
    const hourlyRate = hourlyRateFor(20_000_000, 22);
    const at15 = computeOvertimePay(120, hourlyRate, 1.5);
    const at16 = computeOvertimePay(120, hourlyRate, 1.6);
    expect(at16).toBeGreaterThan(at15);
  });
});
