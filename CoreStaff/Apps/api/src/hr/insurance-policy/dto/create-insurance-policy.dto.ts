import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { InsuranceContributionType } from '../../../database/schemas/enums';

export class SalaryBaseRuleDto {
	@ApiProperty({ enum: Object.values(InsuranceContributionType) })
	@IsEnum(InsuranceContributionType)
	type: InsuranceContributionType;

	@ApiProperty({ required: false, nullable: true, description: 'Minimum contribution base. null = no floor enforced (pending HR/legal input).' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	floorAmount?: number | null;
}

export class CapRuleDto {
	@ApiProperty({ enum: Object.values(InsuranceContributionType) })
	@IsEnum(InsuranceContributionType)
	type: InsuranceContributionType;

	@ApiProperty({ required: false, nullable: true, description: 'Maximum contribution base. null = no cap enforced (pending HR/legal input).' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	capAmount?: number | null;
}

export class EmployerContributionRateDto {
	@ApiProperty({ enum: Object.values(InsuranceContributionType) })
	@IsEnum(InsuranceContributionType)
	type: InsuranceContributionType;

	@ApiProperty({ example: 0.1, description: 'Ratio 0–1 (e.g. 0.1 = 10%). Illustrative only — no employer rate is confirmed in Docs/; HR/legal must supply the real value.' })
	@IsNumber()
	@Min(0)
	@Max(1)
	rate: number;
}

/** SRS §30D.3 field list, verbatim — see insurance-policy.schema.ts header for the full citation. */
export class CreateInsurancePolicyDto {
	@ApiProperty({ example: '2026-09-25' })
	@IsDateString()
	effectiveFrom: string;

	@ApiProperty({ required: false, example: '2027-09-24' })
	@IsOptional()
	@IsDateString()
	effectiveTo?: string;

	@ApiProperty({ example: 'Luật BHXH 41/2024/QH15' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(256)
	legalReference: string;

	@ApiProperty({ example: 0.08, description: 'Seed reference §30D.3: BHXH 8%.' })
	@IsNumber()
	@Min(0)
	@Max(1)
	socialInsuranceEmployeeRate: number;

	@ApiProperty({ example: 0.015, description: 'Seed reference §30D.3: BHYT 1,5%.' })
	@IsNumber()
	@Min(0)
	@Max(1)
	healthInsuranceEmployeeRate: number;

	@ApiProperty({ example: 0.01, description: 'Seed reference §30D.3: BHTN 1%.' })
	@IsNumber()
	@Min(0)
	@Max(1)
	unemploymentInsuranceEmployeeRate: number;

	@ApiProperty({ type: [SalaryBaseRuleDto] })
	@IsArray()
	@ArrayMinSize(3)
	@ValidateNested({ each: true })
	@Type(() => SalaryBaseRuleDto)
	salaryBaseRules: SalaryBaseRuleDto[];

	@ApiProperty({ type: [CapRuleDto] })
	@IsArray()
	@ArrayMinSize(3)
	@ValidateNested({ each: true })
	@Type(() => CapRuleDto)
	capRules: CapRuleDto[];

	@ApiProperty({ type: [EmployerContributionRateDto] })
	@IsArray()
	@ArrayMinSize(3)
	@ValidateNested({ each: true })
	@Type(() => EmployerContributionRateDto)
	employerContributionRates: EmployerContributionRateDto[];
}
