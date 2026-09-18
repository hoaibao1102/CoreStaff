import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContractStatus } from '../../../database/schemas/enums';

/**
 * TASK-030 — move a contract along `CONTRACT_STATUS_TRANSITIONS`. The renewal
 * transition EXPIRED → ACTIVE requires a new `effectiveDate` + `expiryDate`
 * (service enforces); `effectiveDate` is also the termination date on
 * ACTIVE/DRAFT → TERMINATED.
 */
export class UpdateContractStatusDto {
	@ApiProperty({ enum: Object.values(ContractStatus) })
	@IsEnum(ContractStatus)
	newStatus: ContractStatus;

	@ApiProperty({ required: false, description: 'Renewal start or termination date.' })
	@IsOptional()
	@IsDateString()
	effectiveDate?: string;

	@ApiProperty({ required: false, description: 'New expiry — required only on renewal (EXPIRED -> ACTIVE).' })
	@IsOptional()
	@IsDateString()
	expiryDate?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	reason?: string;
}