import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsString, IsNotEmpty, IsOptional, Matches, Min, Max, IsMongoId, IsInt, MaxLength, MinLength } from 'class-validator';
import { ShiftScope } from '../../../database/schemas/enums';

export class CreateShiftTemplateDto {
	@ApiProperty({ required: false, example: 'OFFICE-01', description: 'Tenant-scoped template code. Optional for legacy workplace clients.' })
	@IsOptional() @IsString() @MinLength(2) @MaxLength(50) @Matches(/^[A-Za-z0-9_-]+$/)
	code?: string;

	@ApiProperty({ example: 'Ca hành chính 1' })
	@IsString() @IsNotEmpty() @MinLength(2) @MaxLength(200)
	name?: string;

	@ApiProperty({ enum: ShiftScope }) @IsEnum(ShiftScope)
	scope: ShiftScope;

	@ApiProperty({ required: false }) @IsOptional() @IsMongoId()
	departmentId?: string;

	@ApiProperty({ type: [Number], example: [1, 2, 3, 4, 5] })
	@IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @IsInt({ each: true }) @Min(1, { each: true }) @Max(7, { each: true })
	weekdays: number[];

	@ApiProperty() @IsDateString()
	effectiveFrom: string;

	@ApiProperty({ required: false }) @IsOptional() @IsDateString()
	effectiveTo?: string;

	@ApiProperty({ example: '08:00', description: 'Start time in HH:mm format.' })
	@IsString()
	@IsNotEmpty()
	@Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
	startTime: string;

	@ApiProperty({ example: '17:00', description: 'End time in HH:mm format.' })
	@IsString()
	@IsNotEmpty()
	@Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
	endTime: string;

	@ApiProperty({ required: false, example: 60, description: 'Break duration in minutes.' })
	@IsOptional()
	@IsInt()
	@Min(0)
	breakMinutes?: number;

	@ApiProperty({ required: false, example: 5, description: 'Grace period for late arrival in minutes.' })
	@IsOptional()
	@IsInt()
	@Min(0)
	gracePeriodMinutes?: number;
}
