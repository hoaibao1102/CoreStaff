import {ApiProperty} from '@nestjs/swagger';
import {Transform} from 'class-transformer';
import {IsDateString,IsIn,IsInt,IsOptional,IsString,Length,Min,Validate,ValidatorConstraint,ValidatorConstraintInterface} from 'class-validator';
@ValidatorConstraint({name:'confirmationVariant',async:false})
class ConfirmationVariant implements ValidatorConstraintInterface {
 validate(_value:unknown,args:any){const d=args.object;if(d.requestKind!=='ATTENDANCE_CONFIRMATION')return true;return d.type==='ATTENDANCE'&&/^\d{4}-\d{2}-\d{2}$/.test(d.workDate)&&typeof d.previewHash==='string'&&/^[a-f0-9]{64}$/.test(d.previewHash)&&['requestedStart','requestedEnd','adjustmentType','workDescription','retroactiveReason'].every(k=>d[k]===undefined);}
 defaultMessage(){return 'ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID';}
}
export class CreateManagerRequestDto{
 @ApiProperty({enum:['ATTENDANCE','OVERTIME']}) @IsIn(['ATTENDANCE','OVERTIME']) @Validate(ConfirmationVariant) type:'ATTENDANCE'|'OVERTIME';
 @ApiProperty() @IsDateString() workDate:string;
 @ApiProperty() @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @Length(10,1000) reason:string;
 @IsOptional() @IsIn(['ATTENDANCE_CONFIRMATION']) requestKind?:'ATTENDANCE_CONFIRMATION';
 @IsOptional() @IsString() @Length(64,64) previewHash?:string;
 @ApiProperty({required:false}) @IsOptional() @IsDateString() requestedStart?:string;
 @ApiProperty({required:false}) @IsOptional() @IsDateString() requestedEnd?:string;
 @ApiProperty({required:false,enum:['CHECK_IN','CHECK_OUT']}) @IsOptional() @IsIn(['CHECK_IN','CHECK_OUT']) adjustmentType?:'CHECK_IN'|'CHECK_OUT';
 /** TASK-068 — OT report only. Never trusted as data; `assertNoClientType` rejects `overtimeType`. */
 @ApiProperty({required:false}) @IsOptional() @IsString() @Length(3,1000) workDescription?:string;
 @ApiProperty({required:false}) @IsOptional() @IsString() @Length(10,1000) retroactiveReason?:string;
}
export class DecideManagerRequestDto{
 @IsOptional() @IsString() @Length(1,128) operationId?:string;
 @ApiProperty() @IsInt() @Min(1) expectedVersion:number;
 @ApiProperty({required:false}) @IsOptional() @IsString() @Length(10,1000) reason?:string;
 @ApiProperty({required:false}) @IsOptional() @IsDateString() approvedStart?:string;
 @ApiProperty({required:false}) @IsOptional() @IsDateString() approvedEnd?:string;
}
