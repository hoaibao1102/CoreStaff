import { earningsKpiBonus } from './payroll-earnings-contract';
import { CompensationController } from '../compensation/compensation.controller';

describe('payroll earnings contract', () => {
  it('preserves KPI amounts only for historical snapshots without the no-KPI contract', () => {
    expect(earningsKpiBonus({ kpiBonus: 2_000_000 })).toBe(2_000_000);
    expect(earningsKpiBonus({ earningsContract: 'LEGACY_KPI_V1', kpiBonus: 2_000_000 })).toBe(2_000_000);
  });

  it('excludes KPI from every new no-KPI snapshot even if a stale value is present', () => {
    expect(earningsKpiBonus({ earningsContract: 'NO_KPI_V2', kpiBonus: 2_000_000 })).toBe(0);
    expect(earningsKpiBonus({ earningsContract: 'NO_KPI_V2' })).toBe(0);
  });

  it('does not expose retired KPI controller handlers', () => {
    const prototype = CompensationController.prototype as unknown as Record<string, unknown>;
    for (const handler of ['kpiPolicies', 'createKpiPolicy', 'updateKpiPolicy', 'applicableKpiPolicy', 'kpis', 'createKpi', 'updateKpi', 'confirmKpi']) {
      expect(prototype[handler]).toBeUndefined();
    }
  });
});
