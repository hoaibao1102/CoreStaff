import { computeOvertime } from './overtime-domain';
import { OvertimeType } from '../policies/policies-domain';

describe('OT V2 per-request payable contract', () => {
  it('requires validated explicit policy and refuses overnight rather than clamping', () => {
    const from = Date.parse('2026-09-22T10:00:00Z');
    const input: any = { workDate: '2026-09-22', overtimeType: OvertimeType.WORKING_DAY,
      requested: { from, to: from + 85 * 60000 }, actual: { from, to: from + 85 * 60000 }, scheduled: [], calculationContract: 'OVERTIME_V2' };
    expect(() => computeOvertime(input)).toThrow('POLICY_CONFIGURATION_REQUIRED');
    expect(computeOvertime({ ...input, policy: { minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 0 } })).toMatchObject({ eligibleMinutes: 85, roundingDroppedMinutes: 0 });
    expect(() => computeOvertime({ ...input, policy: { minimumOvertimeMinutes: 45, overtimeRoundingMinutes: 30 } })).toThrow('POLICY_CONFIGURATION_REQUIRED');
    expect(() => computeOvertime({ ...input, requested: { from, to: Date.parse('2026-09-22T18:00:00Z') }, policy: { minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 } })).toThrow('UNSUPPORTED_OVERNIGHT_SHIFT');
  });
  it('preserves raw intervals while applying the explicit minimum and rounding', () => {
    const from = Date.parse('2026-09-22T10:00:00Z');
    for (const [raw, payable] of [[45, 0], [59, 0], [60, 60], [89, 60], [90, 90], [95, 90], [120, 120]]) {
      const result = computeOvertime({ workDate: '2026-09-22', overtimeType: OvertimeType.WORKING_DAY,
        requested: { from, to: from + raw * 60000 }, actual: { from, to: from + raw * 60000 }, scheduled: [],
        calculationContract: 'OVERTIME_V2', policy: { minimumOvertimeMinutes: 60, overtimeRoundingMinutes: 30 } } as any) as any;
      expect(result).toMatchObject({ rawEligibleMinutes: raw, payableMinutes: payable, eligibleMinutes: payable,
        roundingDroppedMinutes: raw - payable, minimumThresholdApplied: raw < 60, calculationContract: 'OVERTIME_V2' });
      expect(result.eligibleIntervals).toEqual([{ from, to: from + raw * 60000 }]);
      expect(result.reasons).toEqual(raw < 60 ? ['OVERTIME_BELOW_MINIMUM'] : []);
    }
  });
});
