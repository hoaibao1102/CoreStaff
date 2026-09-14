import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EmploymentType, Gender } from '../../../database/schemas/enums';

export class CreateEmployeeProfileDto {
	@ApiProperty({ description: 'Existing User._id (same organization) to attach this HR profile to.' })
	@IsMongoId()
	userId: string;

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
	@MaxLength(32)
	phone?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(256)
	email?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(256)
	address?: string;

	@ApiProperty({ required: false, description: 'CCCD/CMND.' })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	citizenId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	taxCode?: string;

	@ApiProperty({ required: false, description: 'Mã số BHXH.' })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	socialInsuranceCode?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(64)
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
