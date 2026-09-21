import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

/** Shared: effective-dated policy base. EffectiveFrom is required; EffectiveTo must be after EffectiveFrom (validated in service via assertNoEffectiveOverlap). */
export class CreateLaborPolicyDto {
  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' }) @IsDateString() effectiveFrom: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiProperty({ example: 480 }) @IsInt() @Min(0) normalDailyMinutes: number;
  @ApiProperty({ example: 2880 }) @IsInt() @Min(0) normalWeeklyMinutes: number;
  @ApiProperty({ example: 720 }) @IsInt() @Min(0) maxCombinedDailyMinutes: number;
  @ApiProperty({ example: 2400 }) @IsInt() @Min(0) maxMonthlyOvertimeMinutes: number;
  @ApiProperty({ example: 20000 }) @IsInt() @Min(0) maxAnnualOvertimeMinutes: number;
  @ApiProperty({ example: 24000 }) @IsInt() @Min(0) exceptionalAnnualOvertimeMinutes: number;
  @ApiProperty({ example: 80 }) @IsInt() @Min(0) @Max(100) warningThresholdPercent: number;
  @ApiProperty({ example: 0.85 }) @IsNumber() @Min(0.01) @Max(1) probationMinimumRate: number;
  @ApiProperty({ example: 'BLLĐ 45/2019/QH14' }) @IsString() legalReference: string;
  @ApiProperty({ required: false, default: true }) @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateLaborPolicyDto extends PartialType(CreateLaborPolicyDto) {}

export class CreateOvertimePolicyDto {
  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' }) @IsDateString() effectiveFrom: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() effectiveTo?: string;
  /** Multipliers, e.g. 1.5 = +150% per OT minute on a working day. */
  @ApiProperty({ example: 1.5 }) @IsNumber() @Min(0) workingDayRate: number;
  @ApiProperty({ example: 2.0 }) @IsNumber() @Min(0) weeklyOffRate: number;
  @ApiProperty({ example: 3.0 }) @IsNumber() @Min(0) publicHolidayRate: number;
  @ApiProperty({ example: 'BLLĐ 45/2019/QH14' }) @IsString() legalReference: string;
  @ApiProperty({ required: false, default: true }) @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateOvertimePolicyDto extends PartialType(CreateOvertimePolicyDto) {}

/** Query DTO for the labor enforcement preview (AC-LABOR-01). All minutes are optional; only provided ones are checked. */
export class PreviewLaborLimitsQuery {
  @IsOptional() @IsInt() @Min(0) normalDailyMinutes?: number;
  @IsOptional() @IsInt() @Min(0) normalWeeklyMinutes?: number;
  @IsOptional() @IsInt() @Min(0) combinedDailyMinutes?: number;
  @IsOptional() @IsInt() @Min(0) overtimeMonthlyMinutes?: number;
  @IsOptional() @IsInt() @Min(0) overtimeAnnualMinutes?: number;
}
export class PreviewOvertimeRatesQuery {
  /** ISO date; date-level weekly-off / public-holiday flags supplied below. */
  @IsDateString() date: string;
  @IsOptional() @IsBoolean() weeklyOff?: boolean;
  @IsOptional() @IsBoolean() publicHoliday?: boolean;
}