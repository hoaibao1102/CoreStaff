import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * TASK-040 — Dependent (người phụ thuộc) item embedded in TaxProfile.
 *
 * Unlike top-level TaxProfile/InsuranceProfile, individual dependents do NOT
 * have effectiveFrom/effectiveTo — they are just an array inside the profile.
 * Each time a dependent is added or removed, HR creates a new version of the
 * TaxProfile document.
 */
export class CreateDependentDto {
	@ApiProperty({ description: 'Họ và tên người phụ thuộc', example: 'Nguyễn Văn B' })
	@IsString()
	@MaxLength(128)
	fullName: string;

	@ApiProperty({ required: false, description: 'Ngày sinh (YYYY-MM-DD)', example: '2010-05-15' })
	@IsOptional()
	@IsString()
	birthDate?: string;

	@ApiProperty({ required: false, description: 'Số CCCD/CMND', example: '0123456789' })
	@IsOptional()
	@IsString()
	@MaxLength(12)
	idCardNumber?: string;

	@ApiProperty({ description: 'Quan hệ với nhân viên', enum: ['CON', 'BO_ME', 'ANH_EM'], example: 'CON' })
	@IsString()
	@MaxLength(8)
	relationship: 'CON' | 'BO_ME' | 'ANH_EM';
}
