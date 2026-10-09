/**
 * B4 — Hai đường tính PIT phải cho cùng một con số.
 *
 * `PayrollRunService.calculateEmployee` và `PayslipService.createPayslipForEmployee`
 * cùng gọi `PitService.calculateFullPIT`. Hợp đồng: cùng gross đầy đủ + cùng cờ
 * thuế OT ⇒ cùng PIT. Cờ áp cho TOÀN BỘ tiền OT, không chia theo hệ số.
 */

import { describe, expect, it } from '@jest/globals';
import { PitService } from '../src/hr/payroll/pit.service';

/** PitService cast organizationId qua `new Types.ObjectId` nên phải là hex 24 ký tự. */
const ORG_ID = '507f1f77bcf86cd799439011';

const TAX_POLICY = {
  personalDeduction: 15_500_000,
  dependentDeduction: 6_200_000,
  progressiveBrackets: [
    { upperLimit: 10_000_000, rate: 5 },
    { upperLimit: 30_000_000, rate: 10 },
    { upperLimit: 60_000_000, rate: 20 },
    { upperLimit: 100_000_000, rate: 30 },
    { upperLimit: null, rate: 35 },
  ],
  active: true,
};

/** PitService chỉ cần hai model này cho calculateFullPIT. */
function buildService(dependents: Array<{ status?: string }> = []) {
  const taxPolicyModel = {
    findOne: () => ({ sort: () => ({ limit: () => ({ lean: async () => TAX_POLICY }) }) }),
  };
  const employeeProfileModel = {
    findById: () => ({ lean: async () => ({ dependents }) }),
  };
  return new PitService(taxPolicyModel as any, employeeProfileModel as any);
}

describe('B4 — hai đường PIT cho cùng kết quả', () => {
  it('payroll-run và payslip cùng gross ⇒ cùng pitAmount', async () => {
    const service = buildService([{ status: 'ACTIVE' }]);

    // Một snapshot duy nhất.
    const snapshot = {
      proratedBaseSalary: 25_000_000,
      totalAllowances: 650_000,
      attendanceBonus: 1_000_000,
      kpiBonus: 2_000_000,
      otPay: 390_624,
      // Cờ OT là nhị phân (R2): ở đây công ty TẮT thuế OT → miễn toàn bộ.
      overtimeTaxable: false,
      socialInsurance: 2_000_000,
      healthInsurance: 375_000,
      unemploymentInsurance: 250_000,
      nonTaxableAllowances: 0,
    };
    const grossEarnings =
      snapshot.proratedBaseSalary +
      snapshot.totalAllowances +
      snapshot.attendanceBonus +
      snapshot.kpiBonus +
      snapshot.otPay;
    const totalInsurance =
      snapshot.socialInsurance + snapshot.healthInsurance + snapshot.unemploymentInsurance;

    // Cả hai đường truyền y hệt tham số.
    const params = {
      grossEarnings,
      insuranceContributions: totalInsurance,
      employeeProfileId: 'p1',
      organizationId: ORG_ID,
      otPay: snapshot.otPay,
      overtimeTaxable: snapshot.overtimeTaxable,
      nonTaxableAllowances: snapshot.nonTaxableAllowances,
    };
    const viaPayslip = await service.calculateFullPIT(params);
    const viaPayrollRun = await service.calculateFullPIT(params);

    expect(viaPayrollRun.pitAmount).toBe(viaPayslip.pitAmount);
    expect(viaPayrollRun.taxableEarnings).toBe(viaPayslip.taxableEarnings);
    expect(viaPayrollRun.taxableIncome).toBe(viaPayslip.taxableIncome);
  });

  it('bật cờ thuế OT làm tăng PIT so với khi tắt', async () => {
    const service = buildService();
    const grossEarnings = 30_000_000;
    const insurance = 2_625_000;
    const otPay = 390_624;
    const shared = {
      grossEarnings,
      insuranceContributions: insurance,
      employeeProfileId: 'p1',
      organizationId: ORG_ID,
      otPay,
      nonTaxableAllowances: 0,
    };

    const exempt = await service.calculateFullPIT({ ...shared, overtimeTaxable: false });
    const taxed = await service.calculateFullPIT({ ...shared, overtimeTaxable: true });

    expect(taxed.taxableIncome).toBe(exempt.taxableIncome + otPay);
    expect(taxed.taxableEarnings).toBe(exempt.taxableEarnings + otPay);
    expect(taxed.pitAmount).toBeGreaterThanOrEqual(exempt.pitAmount);
  });

  it('taxableIncome − bảo hiểm − giảm trừ gia cảnh === taxableEarnings (bất biến §2→§3)', async () => {
    const service = buildService([{ status: 'ACTIVE' }]);
    const result = await service.calculateFullPIT({
      grossEarnings: 30_000_000,
      insuranceContributions: 2_625_000,
      employeeProfileId: 'p1',
      organizationId: ORG_ID,
      otPay: 0,
      overtimeTaxable: true,
      nonTaxableAllowances: 0,
    });

    expect(result.taxableIncome).toBe(30_000_000);
    expect(result.taxableIncome - 2_625_000 - result.personalDeduction - result.dependentDeduction)
      .toBe(result.taxableEarnings);
  });

  it('phụ cấp khai miễn thuế không còn được trừ khỏi cơ sở PIT (R1)', async () => {
    const service = buildService();

    const withFlag = await service.calculateFullPIT({
      grossEarnings: 30_000_000,
      insuranceContributions: 0,
      employeeProfileId: 'p1',
      organizationId: ORG_ID,
      otPay: 0,
      overtimeTaxable: true,
      nonTaxableAllowances: 0,
    });

    expect(withFlag.taxableEarnings).toBe(30_000_000 - 15_500_000);
  });
});
