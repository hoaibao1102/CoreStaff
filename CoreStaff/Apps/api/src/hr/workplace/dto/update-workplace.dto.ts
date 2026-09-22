import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, Min, Max, IsOptional, IsEnum } from 'class-validator';
import { WorkplaceType } from '../../../database/schemas/workplace.schema';

export class UpdateWorkplaceDto {
	@ApiProperty({ required: false, example: 'OUTDOOR-01', description: 'Workplace code' })
	@IsString()
	@IsOptional()
	@MaxLength(32)
	code?: string;

	@ApiProperty({ required: false, example: 'Văn phòng chi nhánh', description: 'Workplace name' })
	@IsString()
	@IsOptional()
	@MaxLength(256)
	name?: string;

	@ApiProperty({ enum: WorkplaceType, required: false, description: 'IN_OFFICE or OUT_OFFICE' })
	@IsEnum(WorkplaceType)
	@IsOptional()
	type?: WorkplaceType;

	@ApiProperty({ required: false, example: '123 Đường ABC, Quận 8, TP.HCM' })
	@IsString()
	@IsOptional()
	@MaxLength(512)
	address?: string;

	@ApiProperty({ required: false, example: 10.762622, description: 'Latitude [-90, 90]' })
	@IsOptional()
	@Min(-90)
	@Max(90)
	latitude?: number;

	@ApiProperty({ required: false, example: 106.660247, description: 'Longitude [-180, 180]' })
	@IsOptional()
	@Min(-180)
	@Max(180)
	longitude?: number;

	@ApiProperty({ required: false, example: 200, description: 'Geofence radius in meters' })
	@IsOptional()
	@Min(0)
	allowedRadiusMeters?: number;

	@ApiProperty({ required: false, example: 100, description: 'Maximum GPS accuracy in meters' })
	@IsOptional()
	@Min(0)
	maximumAccuracyMeters?: number;
}

