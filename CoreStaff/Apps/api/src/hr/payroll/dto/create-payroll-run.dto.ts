import { IsString, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePayrollRunDto {
  @ApiProperty({ description: 'TimesheetPeriod id to calculate payroll for' })
  @IsMongoId()
  timesheetPeriodId: string;

  @ApiPropertyOptional({ description: 'HR notes for this payroll run' })
  @IsString()
  @IsOptional()
  notes?: string;
}
