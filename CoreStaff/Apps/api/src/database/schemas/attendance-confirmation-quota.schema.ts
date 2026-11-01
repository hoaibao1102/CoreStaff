import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
export type AttendanceConfirmationQuotaDocument = HydratedDocument<AttendanceConfirmationQuota>;
@Schema({collection:'attendance_confirmation_quotas',timestamps:true})
export class AttendanceConfirmationQuota {
 @Prop({type:'ObjectId',ref:'Organization',required:true}) organizationId:string;
 @Prop({type:'ObjectId',ref:'User',required:true}) employeeUserId:string;
 @Prop({required:true,match:/^\d{4}-\d{2}$/}) monthKey:string;
 @Prop({type:Number,required:true,min:0,default:0,validate:Number.isInteger}) usedSlots:number;
}
export const AttendanceConfirmationQuotaSchema=SchemaFactory.createForClass(AttendanceConfirmationQuota);
AttendanceConfirmationQuotaSchema.index({organizationId:1,employeeUserId:1,monthKey:1},{unique:true});
