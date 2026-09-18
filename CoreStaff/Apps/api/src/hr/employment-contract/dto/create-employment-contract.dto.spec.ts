import { validate } from 'class-validator';
import { CreateEmploymentContractDto } from './create-employment-contract.dto';
import { ContractType } from '../../../database/schemas/enums';

const makeDto = (fields: Partial<CreateEmploymentContractDto> = {}) =>
  Object.assign(new CreateEmploymentContractDto(), {
    employeeId: '507f1f77bcf86cd799439011',
    contractType: ContractType.FIXED_TERM,
    effectiveDate: '2026-01-01',
    expiryDate: '2026-12-31',
    ...fields,
  });

describe('CreateEmploymentContractDto', () => {
  it('accepts a full fixed-term contract', async () => {
    expect(await validate(makeDto())).toEqual([]);
  });

  it('requires employeeId, contractType and effectiveDate', async () => {
    const errors = await validate(new CreateEmploymentContractDto());
    expect(errors.map((e) => e.property).sort()).toEqual(['contractType', 'effectiveDate', 'employeeId']);
  });

  it('accepts INDEFINITE_TERM without expiryDate', async () => {
    const dto = makeDto({ contractType: ContractType.INDEFINITE_TERM, expiryDate: undefined });
    expect(await validate(dto)).toEqual([]);
  });

  it('tolerates an expiryDate on INDEFINITE_TERM at the DTO — service rejects it (CONTRACT_INDEFINITE_TERM_NO_EXPIRY)', async () => {
    const dto = makeDto({ contractType: ContractType.INDEFINITE_TERM });
    // `@ValidateIf` only requires expiryDate for non-INDEFINITE; the business
    // rule (INDEFINITE must not carry one) lives in the service.
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a non-MongoId employeeId/invalid enum/status field', async () => {
    const errors = await validate(
      makeDto({ employeeId: 'nope', contractType: 'MAGIC' as never }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    const properties = errors.map((e) => e.property);
    expect(properties).toContain('employeeId');
    expect(properties).toContain('contractType');
  });

  it('rejects a status field — HR never sets it directly', async () => {
    const errors = await validate(makeDto({ status: 'ACTIVE' } as never), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toContain('status');
  });
});