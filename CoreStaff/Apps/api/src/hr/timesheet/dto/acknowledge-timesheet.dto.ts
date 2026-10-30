import { IsInt, IsString, Length, Min } from 'class-validator';

export class AcknowledgeTimesheetDto {
  @IsInt() @Min(1) expectedPeriodVersion!: number;
  @IsString() @Length(64, 64) projectionHash!: string;
}
