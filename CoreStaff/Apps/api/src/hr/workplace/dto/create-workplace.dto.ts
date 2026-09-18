import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, Min, Max, IsOptional, IsMongoId } from 'class-validator';

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

	@ApiProperty({ required: false, example: '123 Đường ABC, Quận 8, TP.HCM' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(512)
	address?: string;

	// ─── Geofence — BẮT BUỘC điền đầy đủ 4 field ───

	@ApiProperty({ example: 10.762622, description: 'Latitude [-90, 90].' })
	@IsNotEmpty()
	@Min(-90)
	@Max(90)
	latitude!: number;

	@ApiProperty({ example: 106.660247, description: 'Longitude [-180, 180].' })
	@IsNotEmpty()
	@Min(-180)
	@Max(180)
	longitude!: number;

	@ApiProperty({ example: 200, description: 'Geofence radius in meters (minimum: 100).' })
	@IsNotEmpty()
	@Min(100)
	allowedRadiusMeters!: number;

	@ApiProperty({ example: 100, description: 'Maximum GPS accuracy in meters (minimum: 80).' })
	@IsNotEmpty()
	@Min(80)
	maximumAccuracyMeters!: number;
}
