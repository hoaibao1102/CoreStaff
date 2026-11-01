import { validate } from 'class-validator';
import { CreateWorkCreditPolicyDto } from './policies.dto';

describe('CreateWorkCreditPolicyDto', () => {
  it('accepts the organization-wide BLOCK policy contract', async () => {
    const dto = Object.assign(new CreateWorkCreditPolicyDto(), {
      effectiveFrom: '2026-01-01',
      halfDayMinimumRatio: 0.5,
      fullDayMinimumRatio: 0.9,
      paidLeaveCreditEnabled: true,
      incompleteDayRule: 'BLOCK',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects unsupported incomplete-day rules', async () => {
    const dto = Object.assign(new CreateWorkCreditPolicyDto(), {
      effectiveFrom: '2026-01-01',
      halfDayMinimumRatio: 0.5,
      fullDayMinimumRatio: 0.9,
      paidLeaveCreditEnabled: true,
      incompleteDayRule: 'IGNORE',
    });
    expect((await validate(dto)).some((error) => error.property === 'incompleteDayRule')).toBe(true);
  });
});
