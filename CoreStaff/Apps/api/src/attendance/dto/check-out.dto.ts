import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from './check-in.dto';

export class CheckOutDto {
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

  /** Wi-Fi the device is on. Only `wifiBssid` is verified; `wifiSsid` is kept for audit. */
  @IsString()
  @IsOptional()
  wifiSsid?: string;

  @IsString()
  @IsOptional()
  wifiBssid?: string;
}
