import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * TASK-040 — Update an existing TaxProfile version (rare; usually HR creates a new version).
 * Used only when correcting data within the same effective period before payroll runs.
 */
export class UpdateTaxProfileDto {
	@ApiProperty({ required: false, description: 'EmployeeProfile._id' })
	@IsOptional()
	@IsMongoId()
	employeeId?: string;

	@ApiProperty({ required: false, description: 'Tax code' })
	@IsOptional()
	@IsString()
	@Matches(/^\d{10,12}$/, { message: 'TAX_CODE_INVALID' })
	@MaxLength(12)
	taxCode?: string;
}
