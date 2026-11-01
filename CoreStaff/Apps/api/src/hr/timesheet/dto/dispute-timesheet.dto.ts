import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';

export class DisputeTimesheetDto {
  @IsInt() @Min(1) expectedPeriodVersion!: number;
  @IsString() @Length(64, 64) projectionHash!: string;
  @IsString() @Length(10, 2000) reason!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(31) @IsString({ each: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  disputedWorkDates?: string[];
}
