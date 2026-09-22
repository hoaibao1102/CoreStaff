import { validate } from 'class-validator';
import { UpdateContractStatusDto } from './update-contract-status.dto';
import { ContractStatus } from '../../../database/schemas/enums';

const makeDto = (fields: Partial<UpdateContractStatusDto> = {}) =>
  Object.assign(new UpdateContractStatusDto(), { newStatus: ContractStatus.ACTIVE, ...fields });

describe('UpdateContractStatusDto', () => {
  it('accepts a bare newStatus', async () => {
    expect(await validate(makeDto())).toEqual([]);
  });

  it('accepts renewal dates and the reason (service persists it as statusReason)', async () => {
    const dto = makeDto({
      newStatus: ContractStatus.ACTIVE,
      effectiveDate: '2027-01-01',
      expiryDate: '2027-12-31',
      reason: 'Hết hạn, gia hạn hợp đồng',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('requires newStatus and rejects an unknown status', async () => {
    expect((await validate(new UpdateContractStatusDto())).map((e) => e.property)).toContain('newStatus');
    const errors = await validate(makeDto({ newStatus: 'EXPIRING_SOON' as never }));
    expect(errors.map((e) => e.property)).toContain('newStatus');
  });

  it('rejects a non-date effectiveDate/expiryDate', async () => {
    const errors = await validate(makeDto({ effectiveDate: '31/12/2026', expiryDate: 'tomorrow' }));
    const properties = errors.map((e) => e.property);
    expect(properties).toContain('effectiveDate');
    expect(properties).toContain('expiryDate');
  });

  it('rejects an over-long reason (>500)', async () => {
    const errors = await validate(makeDto({ reason: 'x'.repeat(501) }));
    expect(errors.map((e) => e.property)).toContain('reason');
  });

  it('rejects unknown fields (forbidNonWhitelisted mirror)', async () => {
    const dto = Object.assign(makeDto(), { status: 'ACTIVE' });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((e) => e.property)).toContain('status');
  });
});
