import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * TASK-038. Field shape is an engineering proposal (see insurance-profile.schema.ts
 * header) — the SRS names InsuranceProfile but never its fields.
 */
export class CreateInsuranceProfileDto {
	@ApiProperty({ description: 'EmployeeProfile._id this participation record belongs to.' })
	@IsMongoId()
	employeeId: string;

	@ApiProperty({ example: '2026-09-25' })
	@IsDateString()
	effectiveFrom: string;

	@ApiProperty({ required: false, example: '2027-09-24' })
	@IsOptional()
	@IsDateString()
	effectiveTo?: string;

	@ApiProperty({ default: false })
	@IsBoolean()
	participatesSocialInsurance: boolean;

	@ApiProperty({ default: false })
	@IsBoolean()
	participatesHealthInsurance: boolean;

	@ApiProperty({ default: false })
	@IsBoolean()
	participatesUnemploymentInsurance: boolean;

	@ApiProperty({ required: false, description: 'HR justification, esp. when a flag above is false.' })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
