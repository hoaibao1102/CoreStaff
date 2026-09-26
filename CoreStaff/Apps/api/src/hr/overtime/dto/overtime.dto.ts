import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsMongoId, IsOptional, IsString, Length, Min } from 'class-validator';

/**
 * TASK-068/069 — SRS §16.6C `POST /api/overtime`.
 *
 * `overtimeType` is declared *only* so the whitelist pipe lets it reach the
 * handler, where `assertNoClientType` rejects it with
 * `OVERTIME_SELF_TYPE_FORBIDDEN` (§17). It is never read as data: the backend
 * derives the type from the calendar and schedule (BR-OT-01). Declaring it is
 * what turns a silent strip into the explicit 400 the SRS asks for.
 */
export class CreateOvertimeRequestDto {
  @ApiProperty({ description: 'YYYY-MM-DD' }) @IsDateString() workDate: string;
  @ApiProperty() @IsDateString() requestedStart: string;
  @ApiProperty() @IsDateString() requestedEnd: string;
  @ApiProperty() @IsString() @Length(10, 1000) reason: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 1000) workDescription?: string;
  /** Required only past the grace window — see `deriveRetroactive`. */
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(10, 1000) retroactiveReason?: string;
  @ApiPropertyOptional({ description: 'Not accepted — the backend classifies OT itself (SRS §17)' })
  @IsOptional() @IsString() overtimeType?: string;
}

/**
 * §16.6C manager decision, keeping the existing optimistic-concurrency contract.
 * Every property needs a validator: `forbidNonWhitelisted` treats an undecorated
 * field as an unknown one and 400s the body, which is why `expectedVersion`
 * repeats the `@IsInt() @Min(1)` of `DecideManagerRequestDto`.
 */
export class DecideOvertimeDto {
  @ApiProperty() @IsInt() @Min(1) expectedVersion: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(10, 1000) reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() approvedStart?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() approvedEnd?: string;
}

export class OvertimeResultQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() employeeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() departmentId?: string;
}

/** Standalone, not a subclass: `from`/`to` are required here and optional there. */
export class RecalculateOvertimeDto {
  @ApiProperty() @IsDateString() from: string;
  @ApiProperty() @IsDateString() to: string;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() employeeId?: string;
}
