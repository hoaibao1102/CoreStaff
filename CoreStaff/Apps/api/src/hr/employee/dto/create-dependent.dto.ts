import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * TASK-040 — Dependent (người phụ thuộc) item embedded in EmployeeProfile.
 *
 * Unlike top-level TaxProfile/InsuranceProfile, individual dependents do NOT
 * have effectiveFrom/effectiveTo — they are just an array inside the profile.
 * Each time a dependent is added or removed, the dependent itself gets a new
 * `version` (auto-increment on update).
 */
export class CreateDependentDto {
	@ApiProperty({ description: 'Họ và tên người phụ thuộc', example: 'Nguyễn Văn A' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(128)
	fullName: string;

	@ApiProperty({ description: 'Ngày sinh (YYYY-MM-DD)', example: '2015-05-10' })
	@IsDateString()
	dateOfBirth: string;

	@ApiProperty({ required: false, description: 'Số CCCD/CMND', example: '0123456789' })
	@IsOptional()
	@IsString()
	@MaxLength(12)
	idCardNumber?: string;

	@ApiProperty({
		description: 'Quan hệ với nhân viên',
		enum: ['CHILD', 'SPOUSE', 'PARENT', 'SIBLING'],
		example: 'CHILD',
	})
	@IsString()
	@MaxLength(16)
	relationship: 'CHILD' | 'SPOUSE' | 'PARENT' | 'SIBLING';

	@ApiProperty({ description: 'Người phụ thuộc khuyết tật', example: false })
	@IsBoolean()
	isDisabled: boolean;
}