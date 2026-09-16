import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/** SRS FR-SYS-01 — `organizationCode` is unique platform-wide. */
export class CreateOrganizationDto {
	@ApiProperty({ example: 'TVS', description: 'Mã tổ chức, duy nhất toàn nền tảng.' })
	@IsString()
	@IsNotEmpty()
	@Matches(/^[A-Z0-9-]{2,20}$/, { message: 'ORGANIZATION_CODE_INVALID' })
	code: string;

	@ApiProperty({ example: 'TVS Corporation' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(256)
	name: string;
}

/**
 * SRS FR-SYS-02 — the first HR of a tenant. Deliberately only the login
 * identity: no `employeeCode`, because the EmployeeProfile that owns one is HR's
 * own record to create (`POST /api/hr/employees/me`, Phase C), and no `role`,
 * because this route only ever mints HR.
 */
export class CreateInitialHrDto {
	@ApiProperty({ example: 'hr-a@tvs.local' })
	@IsEmail({}, { message: 'EMAIL_INVALID' })
	@MaxLength(256)
	email: string;

	@ApiProperty({ example: 'Nguyễn Thị HR' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(256)
	fullName: string;
}
