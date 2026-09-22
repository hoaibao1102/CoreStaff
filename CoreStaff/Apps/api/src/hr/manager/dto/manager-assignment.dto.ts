import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsMongoId, IsOptional } from 'class-validator';

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
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() active?: boolean;
}
