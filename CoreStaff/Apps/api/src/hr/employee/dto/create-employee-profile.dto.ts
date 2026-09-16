import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { EmploymentType, Gender } from '../../../database/schemas/enums';

/**
 * Two modes (SRS §4.1, TASK-120): with `userId` the profile links to an existing
 * account; without it the server provisions a new EMPLOYEE account from
 * `email`/`fullName` and returns its one-time password. `role` is deliberately
 * NOT a field — HR may not mint any other role (§16.6), and the global
 * whitelist + forbidNonWhitelisted pipe 400s anything not declared here.
 */
export class CreateEmployeeProfileDto {
	@ApiProperty({ required: false, description: 'Existing User._id (same organization) to attach this HR profile to. Omit to create the account.' })
	@IsOptional()
	@IsMongoId()
	userId?: string;

	@ApiProperty({ required: false, example: 'Nguyễn Văn An', description: 'Required only when creating a new account — enforced by the service, since the self route (/me) also sends no userId.' })
	@IsOptional()
	@IsString()
	@MaxLength(256)
	fullName?: string;

	@ApiProperty({ example: 'TVS-0248' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(32)
	employeeCode: string;

	@ApiProperty({ enum: Object.values(EmploymentType), default: EmploymentType.FULL_TIME, required: false })
	@IsOptional()
	@IsEnum(EmploymentType)
	employmentType?: EmploymentType;

	@ApiProperty({ example: '2026-09-16' })
	@IsDateString()
	joinDate: string;

	@ApiProperty({ example: '1998-02-14', required: false })
	@IsOptional()
	@IsDateString()
	dateOfBirth?: string;

	@ApiProperty({ enum: Object.values(Gender), required: false })
	@IsOptional()
	@IsEnum(Gender)
	gender?: Gender;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@Matches(/^\d{10}$/, { message: 'PHONE_INVALID' })
	phone?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsEmail({}, { message: 'EMAIL_INVALID' })
	@MaxLength(256)
	email?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(256)
	address?: string;

	@ApiProperty({ required: false, description: 'CCCD/CMND, 9–12 chữ số.', example: '0123456789' })
	@IsOptional()
	@IsString()
	@Matches(/^\d{9,12}$/, { message: 'CITIZEN_ID_INVALID' })
	citizenId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@Matches(/^\d{10,12}$/, { message: 'TAX_CODE_INVALID' })
	taxCode?: string;

	@ApiProperty({ required: false, description: 'Mã số BHXH.' })
	@IsOptional()
	@IsString()
	@Matches(/^\d{1,12}$/, { message: 'SOCIAL_INSURANCE_CODE_INVALID' })
	socialInsuranceCode?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@Matches(/^\d{6,17}$/, { message: 'BANK_ACCOUNT_INVALID' })
	bankAccount?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsMongoId()
	departmentId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsMongoId()
	positionId?: string;

	@ApiProperty({ required: false, description: 'User._id of the direct manager.' })
	@IsOptional()
	@IsMongoId()
	directManagerId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsMongoId()
	workplaceId?: string;
}
