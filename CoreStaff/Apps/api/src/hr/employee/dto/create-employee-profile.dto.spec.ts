import { validate } from 'class-validator';
import { CreateEmployeeProfileDto } from './create-employee-profile.dto';

const makeDto = (fields: Partial<CreateEmployeeProfileDto> = {}) => Object.assign(new CreateEmployeeProfileDto(), {
    userId: '507f1f77bcf86cd799439011', employeeCode: 'NV-001', joinDate: '2026-01-01', ...fields,
});

describe('CreateEmployeeProfileDto', () => {
    it('accepts required fields without optional contact, legal or management fields', async () => {
        expect(await validate(makeDto())).toEqual([]);
    });
    it('requires account, employee code and join date', async () => {
        expect((await validate(new CreateEmployeeProfileDto())).map(error => error.property).sort())
            .toEqual(['employeeCode', 'joinDate', 'userId']);
    });
    it.each([
        ['phone', '12345'], ['phone', '12345678901'], ['phone', '0968abc066'],
        ['email', 'invalid'], ['citizenId', '1234'], ['citizenId', '1234567890123'],
        ['bankAccount', 'abc123'], ['socialInsuranceCode', 'abc'],
    ])('rejects invalid %s: %s', async (field, value) => {
        expect((await validate(makeDto({ [field]: value }))).map(error => error.property)).toContain(field);
    });
    it.each(['123456789', '0123456789', '12345678901', '123456789012'])('accepts API-compatible CCCD/CMND length: %s', async citizenId => {
        expect(await validate(makeDto({ citizenId }))).toEqual([]);
    });
});
