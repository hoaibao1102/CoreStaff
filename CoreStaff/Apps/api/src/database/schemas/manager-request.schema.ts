import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
export type ManagerRequestDocument=HydratedDocument<ManagerRequest>;
@Schema({collection:'manager_requests',timestamps:true})
export class ManagerRequest{
 @Prop({type:'ObjectId',ref:'Organization',required:true,index:true}) organizationId:string;
 @Prop({type:'ObjectId',ref:'EmployeeProfile',required:true,index:true}) employeeId:string;
 @Prop({type:'ObjectId',ref:'User',required:true,index:true}) employeeUserId:string;
 @Prop({type:'ObjectId',ref:'Department',required:true,index:true}) departmentId:string;
 @Prop({required:true,enum:['ATTENDANCE','OVERTIME']}) type:'ATTENDANCE'|'OVERTIME';
 @Prop({required:true,type:Date}) workDate:Date;
 @Prop({required:true,minlength:10,maxlength:1000}) reason:string;
 @Prop({type:Date}) requestedStart?:Date;
 @Prop({type:Date}) requestedEnd?:Date;
 @Prop({type:Date}) approvedStart?:Date;
 @Prop({type:Date}) approvedEnd?:Date;
 @Prop({required:true,enum:['PENDING','APPROVED','REJECTED','CLARIFICATION_REQUESTED'],default:'PENDING',index:true}) status:string;
 @Prop({type:'ObjectId',ref:'User'}) reviewedBy?:string;
 @Prop({maxlength:1000}) reviewComment?:string;
 @Prop({type:Date}) reviewedAt?:Date;
 @Prop({required:true,min:1,default:1}) version:number;
 @Prop() createdAt?:Date; @Prop() updatedAt?:Date;
}
export const ManagerRequestSchema=SchemaFactory.createForClass(ManagerRequest);
ManagerRequestSchema.index({organizationId:1,departmentId:1,status:1,createdAt:-1});
ManagerRequestSchema.index({organizationId:1,employeeUserId:1,createdAt:-1});
