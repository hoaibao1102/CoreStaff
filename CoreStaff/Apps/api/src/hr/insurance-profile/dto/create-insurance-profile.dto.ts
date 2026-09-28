import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * TASK-038. Field shape is an engineering proposal (see insurance-profile.schema.ts
 * header) — the SRS names InsuranceProfile but never its fields.
 *
 * D40 (2026-09-28): BHXH/BHYT/BHTN are a legal obligation for employees under
 * a labor contract, not an HR choice — the three `participates*` flags default
 * to `true` when omitted. They stay optional booleans (not removed) only so a
 * documented legal exemption can still be recorded via a direct API call with
 * `note`; the web create form no longer exposes them as checkboxes.
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

	@ApiProperty({ required: false, default: true, description: 'Mandatory by law unless a documented exemption applies.' })
	@IsOptional()
	@IsBoolean()
	participatesSocialInsurance?: boolean;

	@ApiProperty({ required: false, default: true, description: 'Mandatory by law unless a documented exemption applies.' })
	@IsOptional()
	@IsBoolean()
	participatesHealthInsurance?: boolean;

	@ApiProperty({ required: false, default: true, description: 'Mandatory by law unless a documented exemption applies.' })
	@IsOptional()
	@IsBoolean()
	participatesUnemploymentInsurance?: boolean;

	@ApiProperty({ required: false, description: 'HR justification, required when a flag above is explicitly set to false for a legal exemption.' })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
