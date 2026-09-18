import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, Min, IsMongoId } from 'class-validator';

export class CreateShiftTemplateDto {
	@ApiProperty({ example: 'workplace-object-id-here', description: 'Workplace ID (valid ObjectId).' })
	@IsNotEmpty()
	@IsMongoId()
	workplaceId: string;

	@ApiProperty({ example: '08:00', description: 'Start time in HH:mm format.' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(5)
	startTime: string;

	@ApiProperty({ example: '17:00', description: 'End time in HH:mm format.' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(5)
	endTime: string;

	@ApiProperty({ required: false, example: 60, description: 'Break duration in minutes.' })
	@IsOptional()
	@Min(0)
	breakMinutes?: number;

	@ApiProperty({ required: false, example: 5, description: 'Grace period for late arrival in minutes.' })
	@IsOptional()
	@Min(0)
	gracePeriodMinutes?: number;
}
