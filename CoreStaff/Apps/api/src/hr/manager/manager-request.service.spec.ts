import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { ManagerRequestService } from './manager-request.service';

type Row=Record<string,any>;
function build(rows:Row[], managed=['d1'], ot?:any){
 const model={
  create:jest.fn(async(d:Row)=>({toObject:()=>({_id:'new',version:1,status:'PENDING',...d})})),
  find:jest.fn((f:Row)=>{
    const filtered = rows.filter(r=>r.organizationId===f.organizationId&&(!f.departmentId?.$in||f.departmentId.$in.includes(r.departmentId))&&(!f.type||r.type===f.type)&&(!f.status||r.status===f.status));
    const c: any = {};
    c.populate = () => c;
    c.sort = () => c;
    c.lean = async () => filtered;
    return c;
  }),
  findOne:jest.fn((f:Row)=>{
    const found = rows.find(r=>String(r._id)===String(f._id)&&r.organizationId===f.organizationId)??null;
    const c: any = {};
    c.populate = () => c;
    c.lean = async () => found;
    return c;
  }),
  findOneAndUpdate:jest.fn((f:Row,u:Row)=>({lean:async()=>{const r=rows.find(x=>String(x._id)===String(f._id)&&x.organizationId===f.organizationId&&x.version===f.version&&x.status===f.status);if(!r)return null;Object.assign(r,u.$set);r.version++;return r;}})),
 };
 const scope={getManagedDepartmentIds:jest.fn(async()=>managed),requireDepartment:jest.fn(async(_o:string,_m:string,d:string)=>{if(!managed.includes(d))throw new ForbiddenException('DEPARTMENT_SCOPE_VIOLATION');})};
 const employees={findOne:jest.fn((f:Row)=>({lean:async()=>f.userId==='manager'?{_id:'pm',userId:'manager',departmentId:'d1'}:{_id:'p1',userId:f.userId,departmentId:'d1'}}))};
 const attendanceDays={updateOne:jest.fn().mockResolvedValue({})};
 const attendanceEvents={updateMany:jest.fn().mockResolvedValue({})};
 return new ManagerRequestService(model as any,employees as any,attendanceDays as any,attendanceEvents as any,scope as any,undefined,ot);
}
/** Records the OT calls and lets each test decide whether the precheck blocks. */
function fakeOt(overrides:Record<string,any>={}):any{
 const calls:string[]=[];
 return {
  calls,
  assertNoClientType:jest.fn(()=>overrides.selfType?.()),
  assertNoOverlap:jest.fn(async()=>{calls.push('overlap');overrides.overlap?.();}),
  deriveRetroactive:jest.fn((workDate:string,at:Date,reason?:string)=>{calls.push('retro');return overrides.retro?.()??{isRetroactive:false};}),
  // D39 — filing now runs through one method that clears the schedule guard,
  // then the overlap guard, then derives the retroactive fields. Delegating to
  // the fakes above keeps the existing ordering assertions meaningful.
  assertOutsideSchedule:jest.fn(async()=>{calls.push('schedule');}),
  assertFilingAllowed:jest.fn(async function(this:any){await this.assertOutsideSchedule();await this.assertNoOverlap();return this.deriveRetroactive();}),
  precheckApproval:jest.fn(async()=>{calls.push('precheck');if(overrides.block)throw new UnprocessableEntityException('OVERTIME_MONTHLY_LIMIT_EXCEEDED');return overrides.precheck??{overtimeType:'OT_WORKING_DAY',computation:{eligibleMinutes:120},labor:{policyVersion:1,violations:[],approvable:true}};}),
  onApproved:jest.fn(async()=>{calls.push('onApproved');return {_id:'r1'};}),
 };
}
describe('ManagerRequestService',()=>{
 it('creates an employee overtime request using profile department rather than client scope',async()=>{const s=build([]);await expect(s.createMine('o1','u1',{type:'OVERTIME',workDate:'2026-09-22',reason:'Cần hoàn tất phát hành',requestedStart:'2026-09-22T18:00:00Z',requestedEnd:'2026-09-22T20:00:00Z'})).resolves.toMatchObject({employeeId:'p1',departmentId:'d1',status:'PENDING'});});
 it('lists only requests in managed departments',async()=>{const s=build([{_id:'1',organizationId:'o1',departmentId:'d1',type:'OVERTIME',status:'PENDING'},{_id:'2',organizationId:'o1',departmentId:'d2',type:'OVERTIME',status:'PENDING'}]);await expect(s.listForManager('o1','manager',{})).resolves.toHaveLength(1);});
 it('forbids self approval',async()=>{const s=build([{_id:'1',organizationId:'o1',employeeUserId:'manager',departmentId:'d1',status:'PENDING',version:1}]);await expect(s.decide('o1','manager','1','APPROVED',1)).rejects.toBeInstanceOf(ForbiddenException);});
 it('rejects a stale decision version',async()=>{const s=build([{_id:'1',organizationId:'o1',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:2}]);await expect(s.decide('o1','manager','1','APPROVED',1)).rejects.toBeInstanceOf(ConflictException);});
 it('requires a reason for rejection and clarification',async()=>{const s=build([{_id:'1',organizationId:'o1',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:1}]);await expect(s.decide('o1','manager','1','REJECTED',1,'ngắn')).rejects.toBeInstanceOf(ConflictException);});

 // TASK-069/070 — the approval hook contract.
 const pendingOt={_id:'1',organizationId:'o1',type:'OVERTIME',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:1,workDate:new Date('2026-09-22T12:00:00Z'),requestedStart:new Date('2026-09-22T11:00:00Z'),requestedEnd:new Date('2026-09-22T13:00:00Z')};
 it('runs the OT precheck before writing and the result write after',async()=>{
  const order:string[]=[];
  const ot=fakeOt();
  const s=build([structuredClone(pendingOt)],['d1'],ot);
  (s as any).requests.findOneAndUpdate.mockImplementation((f:Row,u:Row)=>({lean:async()=>{order.push('write');const r=structuredClone(pendingOt);Object.assign(r,u.$set);r.version++;return r;}}));
  ot.precheckApproval.mockImplementation(async()=>{order.push('precheck');return{labor:{policyVersion:1,violations:[],approvable:true}};});
  ot.onApproved.mockImplementation(async()=>{order.push('result');});
  await s.decide('o1','manager','1','APPROVED',1);
  expect(order).toEqual(['precheck','write','result']);
 });
 it('leaves status and version untouched when a labor limit blocks the approval',async()=>{
  const rows=[structuredClone(pendingOt)];
  const ot=fakeOt({block:true});
  const s=build(rows,['d1'],ot);
  await expect(s.decide('o1','manager','1','APPROVED',1)).rejects.toBeInstanceOf(UnprocessableEntityException);
  expect(rows[0].status).toBe('PENDING');
  expect(rows[0].version).toBe(1);
  expect(ot.onApproved).not.toHaveBeenCalled();
 });
 it('surfaces a WARNING on the response without blocking',async()=>{
  const ot=fakeOt({precheck:{overtimeType:'OT_WORKING_DAY',computation:{eligibleMinutes:120},labor:{policyVersion:4,violations:[{code:'OVERTIME_MONTHLY_LIMIT_WARNING',severity:'WARNING'}],approvable:true}}});
  const s=build([structuredClone(pendingOt)],['d1'],ot);
  await expect(s.decide('o1','manager','1','APPROVED',1)).resolves.toMatchObject({status:'APPROVED',compliance:{policyVersion:4}});
 });
 it('does not touch the OT engine for an attendance request or a rejection',async()=>{
  const ot=fakeOt();
  const s=build([{_id:'1',organizationId:'o1',type:'ATTENDANCE',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:1}],['d1'],ot);
  await s.decide('o1','manager','1','APPROVED',1);
  expect(ot.calls).toEqual([]);
  const ot2=fakeOt();
  const s2=build([structuredClone(pendingOt)],['d1'],ot2);
  await s2.decide('o1','manager','1','REJECTED',1,'Không phù hợp lịch làm');
  expect(ot2.calls).toEqual([]);
 });
 it('refuses self approval before any precheck runs',async()=>{
  const ot=fakeOt();
  const s=build([{...structuredClone(pendingOt),employeeUserId:'manager'}],['d1'],ot);
  await expect(s.decide('o1','manager','1','APPROVED',1)).rejects.toBeInstanceOf(ForbiddenException);
  expect(ot.calls).toEqual([]);
 });
 it('derives the retroactive flag and overlap guard when an employee files OT',async()=>{
  const ot=fakeOt({retro:()=>({isRetroactive:true,retroactiveReason:'Báo late vì đi công tác'})});
  const s=build([],['d1'],ot);
  const created=await s.createMine('o1','u1',{type:'OVERTIME',workDate:'2026-09-22',reason:'Cần hoàn tất phát hành',requestedStart:'2026-09-22T11:00:00Z',requestedEnd:'2026-09-22T13:00:00Z'} as any);
  expect(ot.calls).toEqual(['schedule','overlap','retro']);
  expect(created).toMatchObject({isRetroactive:true,retroactiveReason:'Báo late vì đi công tác'});
 });
 it('works without the OT engine wired in',async()=>{
  const s=build([structuredClone(pendingOt)]);
  await expect(s.decide('o1','manager','1','APPROVED',1)).resolves.toMatchObject({status:'APPROVED'});
 });
});
