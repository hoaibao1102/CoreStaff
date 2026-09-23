import { IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkMode } from '../../database/schemas/enums';

export class LocationDto {
  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  accuracyMeters?: number;

  @IsString()
  @IsOptional()
  capturedAtClient?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class CheckInDto {
  @IsEnum(WorkMode)
  workMode: WorkMode;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  location?: LocationDto;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  accuracyMeters?: number;
}
