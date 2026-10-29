import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { LeaveDurationType, LeaveRequestStatus, LeaveType } from '../../../database/schemas/enums';

export class CreateLeaveRequestDto {
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiProperty({ enum: LeaveType }) @IsEnum(LeaveType) leaveType: LeaveType;
  @ApiProperty({ enum: LeaveDurationType, required: false }) @IsOptional() @IsEnum(LeaveDurationType) durationType?: LeaveDurationType;
  @ApiProperty({ required: false }) @ValidateIf(dto => dto.durationType === LeaveDurationType.CUSTOM_HOURS) @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) requestedStart?: string;
  @ApiProperty({ required: false }) @ValidateIf(dto => dto.durationType === LeaveDurationType.CUSTOM_HOURS) @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) requestedEnd?: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(1000) reason: string;
  @ApiProperty({ required: false }) @IsOptional() @IsMongoId() evidenceId?: string;
}

export class PreviewLeaveRequestDto {
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiProperty({ enum: LeaveDurationType }) @IsEnum(LeaveDurationType) durationType: LeaveDurationType;
  @ApiProperty({ required: false }) @ValidateIf(dto => dto.durationType === LeaveDurationType.CUSTOM_HOURS) @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) requestedStart?: string;
  @ApiProperty({ required: false }) @ValidateIf(dto => dto.durationType === LeaveDurationType.CUSTOM_HOURS) @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) requestedEnd?: string;
}

export class RejectLeaveRequestDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

export class LeaveRequestQueryDto {
  @IsOptional() @IsEnum(LeaveRequestStatus) status?: LeaveRequestStatus;
  @IsOptional() @IsMongoId() employeeId?: string;
  @IsOptional() @IsMongoId() departmentId?: string;
}

export class RebuildClassificationDto {
  @ApiProperty() @IsDateString() from: string;
  @ApiProperty() @IsDateString() to: string;
  @ApiProperty({ required: false }) @IsOptional() @IsMongoId() employeeId?: string;
}

