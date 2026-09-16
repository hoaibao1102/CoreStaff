import { validate } from 'class-validator';
import { CreateEmployeeProfileDto } from './create-employee-profile.dto';

const makeDto = (fields: Partial<CreateEmployeeProfileDto> = {}) => Object.assign(new CreateEmployeeProfileDto(), {
    userId: '507f1f77bcf86cd799439011', employeeCode: 'NV-001', joinDate: '2026-01-01', ...fields,
});

describe('CreateEmployeeProfileDto', () => {
    it('accepts required fields without optional contact, legal or management fields', async () => {
        expect(await validate(makeDto())).toEqual([]);
    });
    it('requires employee code and join date; fullName is service-enforced on the new-account branch', async () => {
        expect((await validate(new CreateEmployeeProfileDto())).map(error => error.property).sort())
            .toEqual(['employeeCode', 'joinDate']);
    });
    it('fullName validity is still piped (length), just not required — the self route sends none', async () => {
        const dto = makeDto();
        delete dto.fullName;
        expect(await validate(dto)).toEqual([]); // linked or self mode: name is already on the account
        const long = makeDto({ fullName: 'x'.repeat(257) });
        const errors = await validate(long);
        expect(errors.map((e) => e.property)).toContain('fullName');
    });
    it.each([
        ['phone', '12345'], ['phone', '12345678901'], ['phone', '0968abc066'],
        ['email', 'invalid'], ['citizenId', '1234'], ['citizenId', '1234567890123'],
        ['bankAccount', 'abc123'], ['socialInsuranceCode', 'abc'],
    ])('rejects invalid %s: %s', async (field, value) => {
        expect((await validate(makeDto({ [field]: value }))).map(error => error.property)).toContain(field);
    });
    it('rejects a role: HR may not mint any other role (§16.6)', async () => {
        // Mirrors the global ValidationPipe({whitelist, forbidNonWhitelisted})
        // (configure-app.ts) — an undeclared field is an error, not silently dropped.
        const errors = await validate(makeDto({ role: 'SYSTEM_ADMIN' } as never), {
            whitelist: true,
            forbidNonWhitelisted: true,
        });
        expect(errors.map((e) => e.property)).toContain('role');
    });
    it.each(['123456789', '0123456789', '12345678901', '123456789012'])('accepts API-compatible CCCD/CMND length: %s', async citizenId => {
        expect(await validate(makeDto({ citizenId }))).toEqual([]);
    });
});
