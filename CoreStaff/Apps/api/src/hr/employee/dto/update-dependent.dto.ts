import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Update a dependent (người phụ thuộc) by id within EmployeeProfile.
 * All fields are optional — only provided fields will be updated.
 * The `version` is auto-incremented by the service on each successful PUT.
 */
export class UpdateDependentDto {
	@ApiProperty({ required: false, description: 'Họ và tên người phụ thuộc', example: 'Nguyễn Văn A' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	fullName?: string;

	@ApiProperty({ required: false, description: 'Ngày sinh (YYYY-MM-DD)', example: '2015-05-10' })
	@IsOptional()
	@IsDateString()
	dateOfBirth?: string;

	@ApiProperty({ required: false, description: 'Số CCCD/CMND', example: '0123456789' })
	@IsOptional()
	@IsString()
	@MaxLength(12)
	idCardNumber?: string;

	@ApiProperty({
		required: false,
		description: 'Quan hệ với nhân viên',
		enum: ['CHILD', 'SPOUSE', 'PARENT', 'SIBLING'],
		example: 'CHILD',
	})
	@IsOptional()
	@IsString()
	@MaxLength(16)
	relationship?: 'CHILD' | 'SPOUSE' | 'PARENT' | 'SIBLING';

	@ApiProperty({ required: false, description: 'Người phụ thuộc khuyết tật', example: false })
	@IsOptional()
	@IsBoolean()
	isDisabled?: boolean;

	@ApiProperty({
		required: false,
		description: 'Trạng thái: ACTIVE hoặc INACTIVE (audit trail)',
		enum: ['ACTIVE', 'INACTIVE'],
		example: 'ACTIVE',
	})
	@IsOptional()
	@IsString()
	status?: 'ACTIVE' | 'INACTIVE';
}