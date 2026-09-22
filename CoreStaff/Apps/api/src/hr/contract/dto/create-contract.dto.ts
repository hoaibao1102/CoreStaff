import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsOptional, ValidateIf } from 'class-validator';
import { ContractType } from '../../../database/schemas/enums';

export class CreateContractDto {
	@ApiProperty({ description: 'EmployeeProfile._id this contract belongs to.' })
	@IsMongoId()
	employeeId: string;

	@ApiProperty({ enum: Object.values(ContractType) })
	@IsEnum(ContractType)
	contractType: ContractType;

	@ApiProperty({ example: '2026-09-25' })
	@IsDateString()
	startDate: string;

	@ApiProperty({
		required: false,
		example: '2027-09-24',
		description: 'Required unless contractType is INDEFINITE_TERM (SRS §30A.2).',
	})
	@ValidateIf((dto: CreateContractDto) => dto.contractType !== ContractType.INDEFINITE_TERM || dto.endDate !== undefined)
	@IsDateString()
	endDate?: string;

	@ApiProperty({ required: false, description: 'EmployeeDocument._id of the uploaded contract file (TASK-029, not yet available).' })
	@IsOptional()
	@IsMongoId()
	documentRef?: string;
}
