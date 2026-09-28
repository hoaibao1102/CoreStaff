import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { EnterpriseInsuranceCostBearer } from '../../../database/schemas/enums';

/**
 * New module (D40, 2026-09-28) — see enterprise-insurance-policy.schema.ts
 * header. Field shape is an engineering proposal; no legal number is seeded.
 */
export class CreateEnterpriseInsurancePolicyDto {
	@ApiProperty({ example: '2026-09-25' })
	@IsDateString()
	effectiveFrom: string;

	@ApiProperty({ required: false, example: '2027-09-24' })
	@IsOptional()
	@IsDateString()
	effectiveTo?: string;

	@ApiProperty({ example: 'Bảo Việt' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(256)
	provider: string;

	@ApiProperty({ required: false, example: 'HD-2026-00123' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	policyNumber?: string;

	@ApiProperty({ example: 'Bảo hiểm tai nạn con người 24/24 + chăm sóc sức khỏe cơ bản', description: 'Free text — no fixed coverage-type taxonomy is documented.' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	coverageDescription: string;

	@ApiProperty({ required: false, nullable: true, description: 'Premium per employee for the period. null = not finalized yet.' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	premiumPerEmployee?: number | null;

	@ApiProperty({ enum: Object.values(EnterpriseInsuranceCostBearer) })
	@IsEnum(EnterpriseInsuranceCostBearer)
	costBearer: EnterpriseInsuranceCostBearer;

	@ApiProperty({ required: false, nullable: true, description: 'Only meaningful when costBearer is EMPLOYEE/SHARED.' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	employeeContributionAmount?: number | null;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
