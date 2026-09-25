import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LeaveRequestStatus, LeaveType } from '../../../database/schemas/enums';

export class CreateLeaveRequestDto {
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiProperty({ enum: LeaveType }) @IsEnum(LeaveType) leaveType: LeaveType;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(1000) reason: string;
  @ApiProperty({ required: false }) @IsOptional() @IsMongoId() evidenceId?: string;
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

