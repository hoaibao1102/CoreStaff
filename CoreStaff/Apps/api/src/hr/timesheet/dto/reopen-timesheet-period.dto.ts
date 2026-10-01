import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReopenTimesheetPeriodDto {
  @ApiProperty({ example: 'Data was incorrect, need to fix attendance records', description: 'Reason for reopening (minimum 10 characters)' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
