import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, Min, Max, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { WorkplaceType } from '../../../database/schemas/workplace.schema';

export class CreateWorkplaceDto {
	@ApiProperty({ example: 'OUTDOOR-01', description: 'Unique workplace code within the tenant.' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(32)
	code!: string;

	@ApiProperty({ example: 'Công trường xây dựng' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(256)
	name!: string;

	@ApiProperty({ enum: WorkplaceType, default: WorkplaceType.IN_OFFICE, description: 'Workplace category: IN_OFFICE or OUT_OFFICE.' })
	@IsEnum(WorkplaceType)
	@IsOptional()
	type?: WorkplaceType;

	@ApiProperty({ required: false, example: '123 Đường ABC, Quận 8, TP.HCM' })
	@IsString()
	@IsOptional()
	@MaxLength(512)
	address?: string;

	// ─── Geofence — Bắt buộc nếu type === IN_OFFICE ───

	@ApiProperty({ required: false, example: 10.762622, description: 'Latitude [-90, 90]. Required if IN_OFFICE.' })
	@ValidateIf((o) => o.type !== WorkplaceType.OUT_OFFICE)
	@IsNotEmpty()
	@Min(-90)
	@Max(90)
	latitude?: number;

	@ApiProperty({ required: false, example: 106.660247, description: 'Longitude [-180, 180]. Required if IN_OFFICE.' })
	@ValidateIf((o) => o.type !== WorkplaceType.OUT_OFFICE)
	@IsNotEmpty()
	@Min(-180)
	@Max(180)
	longitude?: number;

	@ApiProperty({ required: false, example: 200, description: 'Geofence radius in meters (minimum: 100). Required if IN_OFFICE.' })
	@ValidateIf((o) => o.type !== WorkplaceType.OUT_OFFICE)
	@IsNotEmpty()
	@Min(100)
	allowedRadiusMeters?: number;

	@ApiProperty({ required: false, example: 100, description: 'Maximum GPS accuracy in meters (minimum: 80). Required if IN_OFFICE.' })
	@ValidateIf((o) => o.type !== WorkplaceType.OUT_OFFICE)
	@IsNotEmpty()
	@Min(80)
	maximumAccuracyMeters?: number;
}
