import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateManagerRequestDto, DecideManagerRequestDto } from './dto/manager-request.dto';
import { ManagerModule } from './manager.module';
import { AttendanceConfirmationService, CONFIRMATION_MODELS } from './attendance-confirmation.service';
import { ManagerController } from './manager.controller';

describe('confirmation API contract',()=>{
 it('registers confirmation transaction dependencies in manager module',()=>{
  const providers=Reflect.getMetadata('providers',ManagerModule);
  expect(providers).toContain(AttendanceConfirmationService);
  expect(providers.some((p:any)=>p.provide===CONFIRMATION_MODELS)).toBe(true);
 });
 it('rejects arbitrary hours in confirmation variant at DTO validation',async()=>{
  const dto=plainToInstance(CreateManagerRequestDto,{type:'ATTENDANCE',requestKind:'ATTENDANCE_CONFIRMATION',workDate:'2026-09-14',reason:'Forgot the checkout',previewHash:'a'.repeat(64),requestedStart:'2026-09-14T01:00:00Z'});
  expect(await validate(dto)).not.toEqual([]);
 });

 it('accepts confirmation DTO and operation identity without arbitrary hours',async()=>{
  const dto=plainToInstance(CreateManagerRequestDto,{type:'ATTENDANCE',requestKind:'ATTENDANCE_CONFIRMATION',workDate:'2026-09-14',reason:'  I forgot to check in  ',previewHash:'a'.repeat(64)});
  expect(await validate(dto,{whitelist:true,forbidNonWhitelisted:true})).toEqual([]);
  expect(dto.reason).toBe('I forgot to check in');
  expect(await validate(plainToInstance(DecideManagerRequestDto,{expectedVersion:1,operationId:'op'}),{whitelist:true,forbidNonWhitelisted:true})).toEqual([]);
 });
 it('rejects unknown request variants',async()=>{
  expect(await validate(plainToInstance(CreateManagerRequestDto,{type:'ATTENDANCE',requestKind:'FORGED',workDate:'2026-09-14',reason:'Forgot to check in'}))).not.toEqual([]);
 });
 it('exposes own-only preview through request service',async()=>{
  const requests:any={attendanceConfirmationPreview:jest.fn(async()=>({enabled:false,canSubmit:false}))};
  const controller=new ManagerController({} as any,{} as any,requests);
  await expect(controller.confirmationPreview('org',{_id:'user'} as any,'2026-09-14')).resolves.toEqual({success:true,data:{enabled:false,canSubmit:false}});
  expect(requests.attendanceConfirmationPreview).toHaveBeenCalledWith('org','user','2026-09-14');
 });
 it('forwards idempotency header and decision operation identity',async()=>{
  const requests:any={createMine:jest.fn(async()=>({})),decide:jest.fn(async()=>({}))};
  const controller=new ManagerController({} as any,{} as any,requests);
  await controller.createMine('org',{_id:'user'} as any,{} as any,'key');
  expect(requests.createMine).toHaveBeenCalledWith('org','user',{},'key');
  await controller.approve('org',{_id:'manager'} as any,'id',{expectedVersion:1,operationId:'op'} as any);
  expect(requests.decide).toHaveBeenCalledWith('org','manager','id','APPROVED',1,undefined,undefined,undefined,'op');
 });
});
