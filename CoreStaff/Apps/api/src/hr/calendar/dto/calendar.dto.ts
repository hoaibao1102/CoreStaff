import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { CalendarExceptionType } from '../../../database/schemas/enums';

export class CreateCalendarExceptionDto {
  @ApiProperty() @IsDateString() date: string;
  @ApiProperty({ enum: CalendarExceptionType }) @IsEnum(CalendarExceptionType) type: CalendarExceptionType;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) name: string;
}
export class UpdateCalendarExceptionDto extends PartialType(CreateCalendarExceptionDto) {}

/** Several adjacent days (e.g. a multi-day holiday) created in one request. */
export class CreateCalendarRangeDto {
  @ApiProperty({ description: 'First day, YYYY-MM-DD' }) @IsDateString({}, { message: 'Ngày bắt đầu (startDate) phải đúng định dạng YYYY-MM-DD.' }) startDate: string;
  @ApiProperty({ description: 'Last day (inclusive), YYYY-MM-DD' }) @IsDateString({}, { message: 'Ngày kết thúc (endDate) phải đúng định dạng YYYY-MM-DD.' }) endDate: string;
  @ApiProperty({ enum: CalendarExceptionType }) @IsEnum(CalendarExceptionType, { message: 'Loại ngày (type) không hợp lệ.' }) type: CalendarExceptionType;
  @ApiProperty() @IsString({ message: 'Tên ngày phải là chuỗi ký tự.' }) @MinLength(2, { message: 'Tên ngày phải có ít nhất 2 ký tự.' }) @MaxLength(200, { message: 'Tên ngày không được vượt quá 200 ký tự.' }) name: string;
}

/** Re-shape a run of adjacent days: new range/type/name replace what is in [originalFrom, originalTo]. */
export class UpdateCalendarRangeDto extends CreateCalendarRangeDto {
  @ApiProperty({ description: 'First day of the range being edited' }) @IsDateString({}, { message: 'Ngày bắt đầu hiện tại (originalFrom) phải đúng định dạng YYYY-MM-DD.' }) originalFrom: string;
  @ApiProperty({ description: 'Last day of the range being edited' }) @IsDateString({}, { message: 'Ngày kết thúc hiện tại (originalTo) phải đúng định dạng YYYY-MM-DD.' }) originalTo: string;
}

