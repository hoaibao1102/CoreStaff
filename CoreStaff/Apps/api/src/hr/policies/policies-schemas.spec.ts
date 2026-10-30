import { hasCompoundIndex } from '../../database/indexes';
import {
  LaborCompliancePolicySchema,
  OvertimePayPolicySchema,
} from '../../database/schemas/compensation.schema';
import { WorkCreditPolicySchema } from '../../database/schemas/work-credit-policy.schema';

const requiredWorkCreditFields = [
  'organizationId', 'effectiveFrom', 'halfDayMinimumRatio', 'fullDayMinimumRatio',
  'paidLeaveCreditEnabled', 'incompleteDayRule', 'version', 'active',
];

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

  it('indexes organization-wide work-credit policies by effective start date', () => {
    expect(hasCompoundIndex(WorkCreditPolicySchema, ['organizationId', 'effectiveFrom'])).toBe(true);
  });

  it('declares the work-credit policy contract and BLOCK-only MVP rule', () => {
    const props = WorkCreditPolicySchema.paths as Record<string, { isRequired?: boolean; options?: { enum?: string[] } }>;
    for (const name of requiredWorkCreditFields) {
      expect(props[name]).toBeDefined();
      expect(props[name].isRequired).toBe(true);
    }
    expect(props.incompleteDayRule.options?.enum).toEqual(['BLOCK']);
  });
});