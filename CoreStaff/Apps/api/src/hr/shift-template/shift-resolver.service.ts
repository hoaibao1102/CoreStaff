import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { ShiftTemplateDocument } from '../../database/schemas/shift-template.schema';
import { ShiftScope } from '../../database/schemas/enums';

@Injectable()
export class ShiftResolverService {
  constructor(@InjectModel('ShiftTemplate') private readonly shifts:Model<ShiftTemplateDocument>,@InjectModel('EmployeeProfile') private readonly employees:Model<EmployeeProfileDocument>){}
  async resolveForEmployeeDate(organizationId:string,employeeId:string,date:string){const profile=await this.employees.findOne({organizationId,userId:employeeId}).select('departmentId').lean();const weekday=isoWeekday(date);const common={organizationId,active:true,weekdays:weekday,effectiveFrom:{$lte:date},$or:[{effectiveTo:{$exists:false}},{effectiveTo:null},{effectiveTo:{$gte:date}}]};if(profile?.departmentId){const department=await this.shifts.findOne({...common,scope:ShiftScope.DEPARTMENT,departmentId:profile.departmentId}).lean();if(department)return department}return this.shifts.findOne({...common,scope:ShiftScope.ORGANIZATION}).lean()}
}
function isoWeekday(date:string){const day=new Date(`${date}T00:00:00Z`).getUTCDay();return day===0?7:day}
