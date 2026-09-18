import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ContractType } from '../../../database/schemas/enums';

/**
 * TASK-028 / SRS §30A.2. `status` is deliberately NOT declared — HR never sends
 * it (creation always starts DRAFT server-side; later states go through
 * PATCH /:id/status). `employeeId` naming matches the EmployeeProfile the
 * contract belongs to (`employeeProfileId` in storage).
 */
export class CreateEmploymentContractDto {
	@ApiProperty({ description: 'EmployeeProfile._id the contract belongs to (same tenant).' })
	@IsMongoId()
	employeeId: string;

	@ApiProperty({ enum: Object.values(ContractType) })
	@IsEnum(ContractType)
	contractType: ContractType;

	@ApiProperty({ example: '2026-01-01' })
	@IsDateString()
	effectiveDate: string;

	@ApiProperty({ required: false, description: 'Required for PROBATION/FIXED_TERM; forbidden for INDEFINITE_TERM (service rule).' })
	@IsOptional()
	@IsDateString()
	@ValidateIf((o: CreateEmploymentContractDto) => o.contractType !== ContractType.INDEFINITE_TERM)
	expiryDate?: string;

	@ApiProperty({ required: false, maxLength: 1000 })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	note?: string;
}