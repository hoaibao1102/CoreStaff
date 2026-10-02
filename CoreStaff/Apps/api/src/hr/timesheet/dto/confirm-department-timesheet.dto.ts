import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, Min } from 'class-validator';

export class ConfirmDepartmentTimesheetDto {
  @ApiProperty()
  @IsMongoId()
  departmentId: string;

  @ApiProperty({ minimum: 1, description: 'Period version reviewed by the manager.' })
  @IsInt()
  @Min(1)
  expectedPeriodVersion: number;
}
