import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsMongoId, IsOptional, ValidateIf } from 'class-validator';

export class CreateManagerAssignmentDto {
  @ApiProperty() @IsMongoId() managerUserId: string;
  @ApiProperty() @IsMongoId() departmentId: string;
  @ApiProperty() @IsDateString() effectiveFrom: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() effectiveTo?: string;
}

export class UpdateManagerAssignmentDto {
  @ApiProperty({ required: false }) @IsOptional() @IsMongoId() managerUserId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsMongoId() departmentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() effectiveFrom?: string;
  /** `null` clears an open-ended assignment (QC 5.1). */
  @ApiProperty({ required: false, nullable: true }) @ValidateIf((_, value) => value !== null && value !== undefined) @IsDateString() effectiveTo?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() active?: boolean;
}
