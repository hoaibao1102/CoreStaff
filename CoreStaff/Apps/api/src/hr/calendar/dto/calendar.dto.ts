import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { CalendarExceptionType } from '../../../database/schemas/enums';

export class CreateCalendarExceptionDto {
  @ApiProperty() @IsDateString() date: string;
  @ApiProperty({ enum: CalendarExceptionType }) @IsEnum(CalendarExceptionType) type: CalendarExceptionType;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) name: string;
}
export class UpdateCalendarExceptionDto extends PartialType(CreateCalendarExceptionDto) {}

