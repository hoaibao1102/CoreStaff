import { hasCompoundIndex } from '../../database/indexes';
import {
  AllowanceCatalogSchema,
  AttendanceBonusPolicySchema,
  AttendanceBonusTemplateSchema,
  KpiPayrollInputSchema,
  LaborCompliancePolicySchema,
  OrganizationAllowanceSchema,
  SalaryProfileSchema,
} from '../../database/schemas/compensation.schema';

describe('compensation schema contracts (TASK-031..035)', () => {
  it('indexes effective salary lookup by tenant and employee', () => {
    expect(hasCompoundIndex(SalaryProfileSchema, ['organizationId', 'employeeProfileId', 'effectiveFrom'])).toBe(true);
  });
  it('keeps allowance codes unique per tenant', () => {
    expect(hasCompoundIndex(OrganizationAllowanceSchema, ['organizationId', 'code'], true)).toBe(true);
  });
  it('keeps catalog/template codes unique platform-wide', () => {
    expect(hasCompoundIndex(AllowanceCatalogSchema, ['code'], true)).toBe(true);
    expect(hasCompoundIndex(AttendanceBonusTemplateSchema, ['code'], true)).toBe(true);
  });
  it('indexes effective tenant policies', () => {
    expect(hasCompoundIndex(LaborCompliancePolicySchema, ['organizationId', 'effectiveFrom'])).toBe(true);
    expect(hasCompoundIndex(AttendanceBonusPolicySchema, ['organizationId', 'effectiveFrom'])).toBe(true);
  });
  it('allows one KPI input per employee and period', () => {
    expect(hasCompoundIndex(KpiPayrollInputSchema, ['organizationId', 'employeeProfileId', 'period'], true)).toBe(true);
  });
});
