import { hasCompoundIndex } from '../../database/indexes';
import {
  LaborCompliancePolicySchema,
  OvertimePayPolicySchema,
} from '../../database/schemas/compensation.schema';

describe('policies schema contracts (TASK-036/037)', () => {
  it('indexes effective tenant labor policies by start date', () => {
    expect(hasCompoundIndex(LaborCompliancePolicySchema, ['organizationId', 'effectiveFrom'])).toBe(true);
  });
  it('indexes effective tenant overtime pay policies by start date', () => {
    expect(hasCompoundIndex(OvertimePayPolicySchema, ['organizationId', 'effectiveFrom'])).toBe(true);
  });
  it('declares the §30B.1 labor fields with required limits', () => {
    const props = (LaborCompliancePolicySchema.paths as Record<string, { isRequired?: boolean }>);
    for (const name of [
      'normalDailyMinutes', 'normalWeeklyMinutes', 'maxCombinedDailyMinutes',
      'maxMonthlyOvertimeMinutes', 'maxAnnualOvertimeMinutes',
      'exceptionalAnnualOvertimeMinutes', 'warningThresholdPercent', 'legalReference',
    ]) {
      expect(props[name]).toBeDefined();
      expect(props[name].isRequired).toBe(true);
    }
  });
  it('declares the §30D.2 overtime rates as required policy fields', () => {
    const props = (OvertimePayPolicySchema.paths as Record<string, { isRequired?: boolean }>);
    for (const name of ['workingDayRate', 'weeklyOffRate', 'publicHolidayRate', 'legalReference']) {
      expect(props[name]).toBeDefined();
      expect(props[name].isRequired).toBe(true);
    }
  });
});