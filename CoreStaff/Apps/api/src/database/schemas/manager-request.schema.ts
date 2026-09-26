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
 @Prop({type:'ObjectId',ref:'AttendanceDay',required:false,index:true}) attendanceDayId?:string;
 @Prop({type:'ObjectId',ref:'Evidence',required:false}) evidenceId?:string;
 @Prop({type:Object,required:false}) metadata?:Record<string,any>;
 @Prop({type:'ObjectId',ref:'User'}) reviewedBy?:string;
 @Prop({maxlength:1000}) reviewComment?:string;
 @Prop({type:Date}) reviewedAt?:Date;
 /**
  * TASK-068 §15.11 additions for `type:'OVERTIME'`. All optional: existing web
  * payloads and existing rows stay valid, and `ATTENDANCE` requests ignore them.
  */
 @Prop({required:false,maxlength:1000}) workDescription?:string;
 /** Set when the report arrived after the grace window (FR-OT-01 retroactive path). */
 @Prop({required:false,default:false}) isRetroactive?:boolean;
 @Prop({required:false,maxlength:1000}) retroactiveReason?:string;
 /** Bumped on every OT recompute so readers can tell which pass produced their numbers. */
 @Prop({required:false,min:0}) otComputationVersion?:number;
 @Prop({required:true,min:1,default:1}) version:number;
 @Prop() createdAt?:Date; @Prop() updatedAt?:Date;
}
export const ManagerRequestSchema=SchemaFactory.createForClass(ManagerRequest);
ManagerRequestSchema.index({organizationId:1,departmentId:1,status:1,createdAt:-1});
ManagerRequestSchema.index({organizationId:1,employeeUserId:1,createdAt:-1});
