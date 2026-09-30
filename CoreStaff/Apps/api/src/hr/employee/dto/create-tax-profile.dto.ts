import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * TASK-040 — Create a new TaxProfile version for an employee.
 *
 * Each mutation (change taxCode) creates a NEW version document rather than
 * updating the existing one.  The service validates that effectiveFrom does not
 * overlap with any existing profile's period.
 *
 * NOTE: Dependents are stored in EmployeeProfile.dependents (flat array).
 */
export class CreateTaxProfileDto {
	@ApiProperty({ description: 'EmployeeProfile._id', example: '507f1f77bcf86cd799439011' })
	@IsMongoId()
	@IsNotEmpty()
	employeeId: string;

	@ApiProperty({ description: 'Effective date of this TaxProfile version', example: '2026-01-01' })
	@IsDateString()
	effectiveFrom: string;

	@ApiProperty({ required: false, description: 'End date (null = current). MVP may omit.', example: '2026-12-31' })
	@IsOptional()
	@IsDateString()
	effectiveTo?: string;

	@ApiProperty({ description: 'Tax code (Mã số thuế cá nhân)', example: '0123456789' })
	@IsString()
	@Matches(/^\d{10,12}$/, { message: 'TAX_CODE_INVALID' })
	@MaxLength(12)
	taxCode: string;
}
