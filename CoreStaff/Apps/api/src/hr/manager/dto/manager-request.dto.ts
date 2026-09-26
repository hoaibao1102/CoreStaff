import {ApiProperty} from '@nestjs/swagger';
import {IsDateString,IsIn,IsInt,IsOptional,IsString,Length,Min} from 'class-validator';
export class CreateManagerRequestDto{
 @ApiProperty({enum:['ATTENDANCE','OVERTIME']}) @IsIn(['ATTENDANCE','OVERTIME']) type:'ATTENDANCE'|'OVERTIME';
 @ApiProperty() @IsDateString() workDate:string;
 @ApiProperty() @IsString() @Length(10,1000) reason:string;
 @ApiProperty({required:false}) @IsOptional() @IsDateString() requestedStart?:string;
 @ApiProperty({required:false}) @IsOptional() @IsDateString() requestedEnd?:string;
 /** TASK-068 — OT report only. Never trusted as data; `assertNoClientType` rejects `overtimeType`. */
 @ApiProperty({required:false}) @IsOptional() @IsString() @Length(3,1000) workDescription?:string;
 @ApiProperty({required:false}) @IsOptional() @IsString() @Length(10,1000) retroactiveReason?:string;
}
export class DecideManagerRequestDto{
 @ApiProperty() @IsInt() @Min(1) expectedVersion:number;
 @ApiProperty({required:false}) @IsOptional() @IsString() @Length(10,1000) reason?:string;
 @ApiProperty({required:false}) @IsOptional() @IsDateString() approvedStart?:string;
 @ApiProperty({required:false}) @IsOptional() @IsDateString() approvedEnd?:string;
}
