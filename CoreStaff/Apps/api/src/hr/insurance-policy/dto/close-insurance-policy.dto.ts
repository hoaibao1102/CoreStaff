import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

/** D42 — closes an open-ended InsurancePolicy (sets effectiveTo) so a next version can be created. */
export class CloseInsurancePolicyDto {
	@ApiProperty({ example: '2026-09-30', description: 'Must be after this policy\'s effectiveFrom.' })
	@IsDateString()
	effectiveTo: string;
}
