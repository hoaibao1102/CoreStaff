import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Update a dependent (người phụ thuộc) at a specific index in EmployeeProfile.
 * All fields are optional — only provided fields will be updated.
 */
export class UpdateDependentDto {
	@ApiProperty({ required: false, description: 'Họ và tên người phụ thuộc', example: 'Nguyễn Văn B' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	fullName?: string;

	@ApiProperty({ required: false, description: 'Ngày sinh (YYYY-MM-DD)', example: '2010-05-15' })
	@IsOptional()
	@IsString()
	birthDate?: string;

	@ApiProperty({ required: false, description: 'Số CCCD/CMND', example: '0123456789' })
	@IsOptional()
	@IsString()
	@MaxLength(12)
	idCardNumber?: string;

	@ApiProperty({ required: false, description: 'Quan hệ với nhân viên', enum: ['CON', 'BO_ME', 'ANH_EM'], example: 'CON' })
	@IsOptional()
	@IsString()
	@MaxLength(8)
	relationship?: 'CON' | 'BO_ME' | 'ANH_EM';

	@ApiProperty({ required: false, description: 'Trạng thái: ACTIVE hoặc INACTIVE (audit trail)', enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE' })
	@IsOptional()
	@IsString()
	status?: 'ACTIVE' | 'INACTIVE';
}
