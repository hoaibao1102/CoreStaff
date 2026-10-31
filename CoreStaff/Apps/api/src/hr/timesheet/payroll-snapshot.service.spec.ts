import { createHash } from 'crypto';
import { PayrollSnapshotService } from './payroll-snapshot.service';

describe('payroll snapshot evidence hashing', () => {
  const service = new PayrollSnapshotService(...Array(10).fill({}) as [any, any, any, any, any, any, any, any, any, any]);
  const hash = (summary: any) => (service as any).generateSourceHash(summary, null, null, null, 0);
  const summary = { periodId: 'period', employeeProfileId: 'profile', totalDays: 1, workingDays: 1,
    totalWorkingMinutes: 480, otWorkingDayMinutes: 60, otWeeklyOffMinutes: 0, otPublicHolidayMinutes: 0 };

  it('binds the frozen V2 source hash when equal payable totals conceal changed evidence', () => {
    const first = { ...summary, calculationContract: 'VERSIONED_WORK_CREDIT_V2', sourceHash: 'policy-and-provenance-v1' };
    const second = { ...first, sourceHash: 'policy-and-provenance-v2' };
    expect(hash(first)).not.toBe(hash(second));
  });

  it('preserves the exact legacy source hash algorithm and does not reinterpret history', () => {
    const input = ['period', 'profile', '1', '1', '480', '60', '0', '0', 'none', '0', 'none', '', '', 'none', 'none',
      '0', 'false', '0', '0', '0', '0', 'true', 'true', 'true', '0', '0'].join('|');
    expect(hash(summary)).toBe(createHash('sha256').update(input).digest('hex'));
    expect(hash({ ...summary, calculationContract: 'LEGACY_WORKING_DAYS_V1', sourceHash: 'historical' })).toBe(hash(summary));
  });
});
