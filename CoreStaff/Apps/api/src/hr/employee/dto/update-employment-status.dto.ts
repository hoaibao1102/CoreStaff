import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EmploymentStatus } from '../../../database/schemas/enums';

export class UpdateEmploymentStatusDto {
	@ApiProperty({ enum: Object.values(EmploymentStatus) })
	@IsEnum(EmploymentStatus)
	newStatus: EmploymentStatus;

	@ApiProperty({ example: '2026-09-16', description: 'Date the transition takes effect.' })
	@IsDateString()
	effectiveDate: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	reason?: string;
}
