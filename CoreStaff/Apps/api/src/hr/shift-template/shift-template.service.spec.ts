import { BadRequestException, ConflictException } from '@nestjs/common';
import { ShiftScope } from '../../database/schemas/enums';
import { ShiftTemplateService } from './shift-template.service';

const dto={code:'HC-01',name:'Ca hành chính',scope:ShiftScope.ORGANIZATION,weekdays:[1,2,3,4,5],effectiveFrom:'2026-10-01',startTime:'08:00',endTime:'17:00',breakMinutes:60,gracePeriodMinutes:10};
const policy={effectiveFrom:new Date('2026-01-01'),effectiveTo:undefined as Date|undefined,active:true,normalDailyMinutes:480,normalWeeklyMinutes:2880,maxCombinedDailyMinutes:720,maxMonthlyOvertimeMinutes:2400,maxAnnualOvertimeMinutes:12000,exceptionalAnnualOvertimeMinutes:18000,warningThresholdPercent:90,version:1,legalReference:'Configured policy'};
function build(existing:Array<{weekdays:number[]}>=[]){const shifts={exists:jest.fn(async()=>false),find:jest.fn(()=>({select:()=>({lean:async()=>existing})})),create:jest.fn(async(value:any)=>({toObject:()=>value})),deleteOne:jest.fn(async()=>({deletedCount:1}))};const departments={exists:jest.fn(async()=>true)},assignments={exists:jest.fn(async()=>false)},attendanceDays={exists:jest.fn(async()=>false)};const policies={laborAt:jest.fn(async()=>policy),listLabor:jest.fn(async()=>[policy])};return{policies,service:new ShiftTemplateService(shifts as any,departments as any,assignments as any,attendanceDays as any,policies as any),shifts,departments}}

describe('ShiftTemplateService scoped recurring shifts',()=>{
 it('rejects daily net hours above policy',async()=>{
   const {service,shifts}=build();
   await expect(service.create('org',{...dto,endTime:'18:00'})).rejects.toThrow('SHIFT_DAILY_LABOR_LIMIT_EXCEEDED');
   expect(shifts.create).not.toHaveBeenCalled();
 });
 it('rejects weekly hours above policy',async()=>{
   const {service}=build();
   await expect(service.create('org',{...dto,weekdays:[1,2,3,4,5,6,7]})).rejects.toThrow('SHIFT_WEEKLY_LABOR_LIMIT_EXCEEDED');
 });
 it('accepts exact daily and weekly limits after subtracting break',async()=>{
   const {service,policies}=build();
   await expect(service.create('org',{...dto,weekdays:[1,2,3,4,5,6]})).resolves.toBeDefined();
   expect(policies.laborAt).toHaveBeenCalledWith('org',new Date(dto.effectiveFrom));
 });
 it('rejects a break that consumes the whole shift',async()=>{
   const {service}=build();
   await expect(service.create('org',{...dto,breakMinutes:540})).rejects.toThrow('SHIFT_BREAK_DURATION_INVALID');
 });
 it('requires a policy at the start date',async()=>{
   const {service,policies}=build();
   policies.laborAt.mockRejectedValueOnce(new Error('LABOR_POLICY_NOT_FOUND'));
   await expect(service.create('org',dto)).rejects.toThrow('LABOR_POLICY_NOT_FOUND');
 });
 it('checks future policy limits in the shift period',async()=>{
   const {service,policies}=build();
   policies.listLabor.mockResolvedValueOnce([{...policy,effectiveFrom:new Date('2027-01-01'),normalDailyMinutes:420}]);
   await expect(service.create('org',dto)).rejects.toThrow('SHIFT_DAILY_LABOR_LIMIT_EXCEEDED');
 });
 it('rejects a shift extending beyond available policy coverage',async()=>{
   const {service,policies}=build();
   policies.laborAt.mockResolvedValueOnce({...policy,effectiveTo:new Date('2026-11-01')});
   policies.listLabor.mockResolvedValueOnce([]);
   await expect(service.create('org',dto)).rejects.toThrow('SHIFT_LABOR_POLICY_COVERAGE_MISSING');
 });
 it('allows creating the company default when department shifts already exist',async()=>{
   const {service,shifts}=build();
   shifts.exists.mockImplementation(async(...args:any[])=>args[0].scope===ShiftScope.DEPARTMENT);
   await expect(service.create('org',dto)).resolves.toMatchObject({scope:ShiftScope.ORGANIZATION});
 });
 it('rejects a second company-wide shift',async()=>{
   const {service,shifts}=build();
   shifts.exists.mockImplementation(async(...args:any[])=>args[0].scope===ShiftScope.ORGANIZATION);
   await expect(service.create('org',dto)).rejects.toThrow('SHIFT_ORGANIZATION_ALREADY_ASSIGNED');
 });
 it('creates an organization shift with normalized weekdays',async()=>{const{service,shifts}=build();await service.create('org', {...dto,weekdays:[5,1,1,3]});expect(shifts.create).toHaveBeenCalledWith(expect.objectContaining({scope:'ORGANIZATION',weekdays:[1,3,5],departmentId:undefined}))});
 it('requires a department for department scope',async()=>{const{service}=build();await expect(service.create('org',{...dto,scope:ShiftScope.DEPARTMENT})).rejects.toBeInstanceOf(BadRequestException)});
 it('rejects overlapping weekdays in the same scope',async()=>{const{service}=build([{weekdays:[2,3]}]);await expect(service.create('org',{...dto,weekdays:[1,2]})).rejects.toBeInstanceOf(ConflictException)});
 it('validates effective and time ranges',async()=>{const{service}=build();await expect(service.create('org',{...dto,effectiveTo:'2026-09-01'})).rejects.toBeInstanceOf(BadRequestException);await expect(service.create('org',{...dto,startTime:'18:00',endTime:'09:00'})).rejects.toBeInstanceOf(BadRequestException)});
});
