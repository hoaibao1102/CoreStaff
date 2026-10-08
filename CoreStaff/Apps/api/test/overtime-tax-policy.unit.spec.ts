/**
 * R2 — Cờ thuế OT theo công ty (TaxPolicy.overtimeTaxable).
 *
 * Cờ là NHỊ PHÂN và áp cho TOÀN BỘ tiền OT: bật → cả `otPay` vào thu nhập tính
 * thuế; tắt → cả `otPay` miễn thuế. Không có trạng thái chia một phần.
 *
 * Tiền OT vẫn tính bằng: số giờ × tiền công 1 giờ × hệ số (1.5 / 2.0 / 3.0).
 * Test này khoá phần QUYẾT ĐỊNH THUẾ, không khoá công thức ra tiền.
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

function buildService() {
  const taxPolicyModel = {
    findOne: () => ({ sort: () => ({ limit: () => ({ lean: async () => TAX_POLICY }) }) }),
  };
  const employeeProfileModel = { findById: () => ({ lean: async () => ({ dependents: [] }) }) };
  return new PitService(taxPolicyModel as any, employeeProfileModel as any);
}

/** Base PIT call — chỉ khác nhau ở cờ, để so sánh cô lập. */
const baseParams = (otPay: number, overtimeTaxable: boolean) => ({
  grossEarnings: 30_000_000,
  insuranceContributions: 2_625_000,
  employeeProfileId: 'p1',
  organizationId: ORG_ID,
  otPay,
  overtimeTaxable,
});

describe('cờ tắt thuế (overtimeTaxable = false)', () => {
  it('miễn TOÀN BỘ tiền OT khỏi thu nhập tính thuế', async () => {
    const otPay = 390_624;
    const result = await buildService().calculateFullPIT(baseParams(otPay, false));

    // gross 30M đã gồm otPay → thu nhập chịu thuế = 30M − otPay.
    expect(result.taxableIncome).toBe(30_000_000 - otPay);
  });

  it('không có OT thì cờ không đổi kết quả', async () => {
    const off = await buildService().calculateFullPIT(baseParams(0, false));
    const on = await buildService().calculateFullPIT(baseParams(0, true));

    expect(off.taxableIncome).toBe(on.taxableIncome);
    expect(off.taxableEarnings).toBe(on.taxableEarnings);
    expect(off.pitAmount).toBe(on.pitAmount);
  });
});

describe('cờ bật thuế (overtimeTaxable = true)', () => {
  it('đưa TOÀN BỘ tiền OT vào thu nhập tính thuế', async () => {
    const otPay = 390_624;
    const result = await buildService().calculateFullPIT(baseParams(otPay, true));

    expect(result.taxableIncome).toBe(30_000_000);
  });

  it('bật cờ làm tăng thu nhập tính thuế và PIT so với tắt cờ', async () => {
    const otPay = 390_624;
    const off = await buildService().calculateFullPIT(baseParams(otPay, false));
    const on = await buildService().calculateFullPIT(baseParams(otPay, true));

    expect(on.taxableIncome).toBe(off.taxableIncome + otPay);
    expect(on.taxableEarnings).toBe(off.taxableEarnings + otPay);
    expect(on.pitAmount).toBeGreaterThanOrEqual(off.pitAmount);
  });
});

describe('bất biến', () => {
  it('chênh lệch giữa hai nhánh LUÔN bằng otPay — không bao giờ chia đôi', async () => {
    for (const otPay of [0, 1, 390_624, 5_100_000]) {
      const off = await buildService().calculateFullPIT(baseParams(otPay, false));
      const on = await buildService().calculateFullPIT(baseParams(otPay, true));

      expect(on.taxableIncome - off.taxableIncome).toBe(otPay);
    }
  });

  it('taxableIncome − bảo hiểm − giảm trừ gia cảnh === taxableEarnings', async () => {
    const result = await buildService().calculateFullPIT(baseParams(390_624, true));

    expect(
      result.taxableIncome - 2_625_000 - result.personalDeduction - result.dependentDeduction,
    ).toBe(result.taxableEarnings);
  });
});
