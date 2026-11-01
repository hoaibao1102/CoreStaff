import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { ManagerRequestService } from './manager-request.service';

type Row=Record<string,any>;
function build(rows:Row[], managed=['d1'], ot?:any, employeeAssignments?:any, periodVersion:any={bumpForWorkDates:jest.fn().mockResolvedValue(1)}){
 const model={
  create:jest.fn(async(d:Row)=>({toObject:()=>({_id:'new',version:1,status:'PENDING',...d})})),
  find:jest.fn((f:Row)=>{
    const filtered = rows.filter(r=>r.organizationId===f.organizationId&&(!f.departmentId?.$in||f.departmentId.$in.includes(r.departmentId))&&(!f.$or||f.$or.some((x:Row)=>(x.departmentId?.$in??[]).includes(r.departmentId)||(x.employeeUserId?.$in??[]).includes(r.employeeUserId)))&&(!f.type||r.type===f.type)&&(!f.status||r.status===f.status));
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
 const scope={getAuthorizedReviewDepartmentIds:jest.fn(async()=>managed),requireReviewDepartment:jest.fn(async()=>{}),getManagedDepartmentIds:jest.fn(async()=>managed),resolveEmployeeIdsForDepartments:jest.fn(async()=>['u1']),isEmployeeInManagedScope:jest.fn(async(_o:string,_m:string,u:string)=>u==='u1'),requireDepartment:jest.fn(async(_o:string,_m:string,d:string)=>{if(!managed.includes(d))throw new ForbiddenException('DEPARTMENT_SCOPE_VIOLATION');})};
 const employees={findOne:jest.fn((f:Row)=>({lean:async()=>f.userId==='manager'?{_id:'pm',userId:'manager',departmentId:'d1'}:{_id:'p1',userId:f.userId,departmentId:'d1'}}))};
 const attendanceDays={
  findOne:jest.fn(()=>({lean:async()=>null})),
  create:jest.fn(),
  updateOne:jest.fn().mockResolvedValue({}),
 };
 const attendanceEvents={create:jest.fn(),updateMany:jest.fn().mockResolvedValue({})};
 const service = new ManagerRequestService(model as any,employees as any,attendanceDays as any,attendanceEvents as any,scope as any,periodVersion,undefined,ot,employeeAssignments);
 return Object.assign(service,{__periodVersion:periodVersion});
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
 it('blocks legacy SELFIE approval in locked period before request decision',async()=>{
  const row={_id:'r',organizationId:'o1',employeeUserId:'u1',departmentId:'d1',type:'ATTENDANCE',status:'PENDING',version:1,workDate:new Date('2026-09-14'),attendanceDayId:'day',metadata:{actionType:'CHECK_IN'}};
  const s=build([row]);
  const session={inTransaction:()=>true,withTransaction:async(fn:any)=>fn(),endSession:jest.fn()};
  (s as any).requests.db={startSession:async()=>session};
  (s as any).periodVersion.claimForWorkDate=jest.fn(async()=>{throw new ConflictException('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');});
  await expect(s.decide('o1','manager','r','APPROVED',1)).rejects.toThrow('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
  expect(row.status).toBe('PENDING');
 });
 it.each([
  {attendanceDayId:'day'},
  {attendanceDayId:'day',evidenceId:'evidence'},
  {attendanceDayId:'day',metadata:{actionType:'CHECK_IN'}},
  {},
 ])('keeps incomplete legacy attendance requests decidable without inventing provenance: %j',async(legacy)=>{
  const row:any={_id:'legacy',organizationId:'o1',employeeUserId:'u1',departmentId:'d1',type:'ATTENDANCE',status:'PENDING',version:1,workDate:new Date('2026-09-14'),...legacy};
  const s=build([row]);
  const session={withTransaction:jest.fn(async(fn:any)=>fn()),endSession:jest.fn()};
  (s as any).requests.db={startSession:async()=>session};
  (s as any).requests.findOne.mockImplementation(()=>{const q:any={populate:()=>q,session:()=>q,lean:async()=>row};return q;});
  (s as any).periodVersion.claimForWorkDate=jest.fn(async()=>{});
  await expect(s.decide('o1','manager','legacy','APPROVED',1)).resolves.toMatchObject({status:'APPROVED',version:2});
  expect((s as any).periodVersion.claimForWorkDate).toHaveBeenCalledWith('o1','2026-09-14',session);
  if(row.attendanceDayId){
   expect((s as any).attendanceDays.updateOne).toHaveBeenCalledWith({_id:'day',organizationId:'o1'},{$set:{overallApprovalStatus:'APPROVED'}},{session});
   expect((s as any).attendanceEvents.updateMany).toHaveBeenCalledWith({attendanceDayId:'day',organizationId:'o1',method:'SELFIE'},{$set:{approvalStatus:'APPROVED'}},{session});
  }else{
   expect((s as any).attendanceDays.updateOne).not.toHaveBeenCalled();
   expect((s as any).attendanceEvents.updateMany).not.toHaveBeenCalled();
  }
  expect(session.endSession).toHaveBeenCalled();
 });
 it.each(['MANUAL_ADJUSTMENT','SELFIE'])('notifies model-backed %s decisions only after commit and isolates notification failures',async(source)=>{
  for(const status of ['APPROVED','REJECTED'] as const){
   const row:any={_id:'r',organizationId:'o1',employeeUserId:'u1',departmentId:'d1',type:'ATTENDANCE',source,status:'PENDING',version:1,attendanceDayId:'day',workDate:new Date('2026-09-14'),metadata:source==='MANUAL_ADJUSTMENT'?{adjustmentSource:source}:undefined};
   const s=build([row]);let committed=false;
   const session={withTransaction:async(fn:any)=>{const result=await fn();committed=true;return result;},endSession:jest.fn()};
   (s as any).requests.db={startSession:async()=>session};
   (s as any).requests.findOne.mockImplementation(()=>{const q:any={populate:()=>q,session:()=>q,lean:async()=>row};return q;});
   (s as any).periodVersion.claimForWorkDate=jest.fn(async()=>{});
   (s as any).applyAttendanceAdjustment=jest.fn(async()=>{});
   (s as any).syncSelfieDecision=jest.fn(async()=>{});
   const notifiedAfterCommit:boolean[]=[];
   const notify=jest.fn(()=>{notifiedAfterCommit.push(committed);throw new Error('socket unavailable');});
   (s as any).eventsGateway={notifyApprovalDecision:notify};
   const warning=jest.spyOn(console,'warn').mockImplementation(()=>{});
   try{
    await expect(s.decide('o1','manager','r',status,1,'Reviewed attendance request')).resolves.toMatchObject({status});
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notifiedAfterCommit).toEqual([true]);
    expect(notify).toHaveBeenCalledWith('u1',expect.objectContaining({requestId:'r',type:'ATTENDANCE',status,organizationId:'o1',reviewedBy:'manager',departmentId:'d1',attendanceDayId:'day'}));
   }finally{warning.mockRestore();}
  }
 });
 it('does not notify an attendance decision when its transaction rolls back',async()=>{
  const row:any={_id:'r',organizationId:'o1',employeeUserId:'u1',departmentId:'d1',type:'ATTENDANCE',status:'PENDING',version:1,workDate:new Date('2026-09-14')};
  const s=build([row]);
  const session={withTransaction:async(fn:any)=>{await fn();throw new Error('commit failed');},endSession:jest.fn()};
  (s as any).requests.db={startSession:async()=>session};
  (s as any).requests.findOne.mockImplementation(()=>{const q:any={populate:()=>q,session:()=>q,lean:async()=>row};return q;});
  (s as any).periodVersion.claimForWorkDate=jest.fn(async()=>{});
  const notify=jest.fn();(s as any).eventsGateway={notifyApprovalDecision:notify};
  await expect(s.decide('o1','manager','r','APPROVED',1)).rejects.toThrow('commit failed');
  expect(notify).not.toHaveBeenCalled();
 });
 it('never falls back to legacy approval for an explicitly sourced SELFIE missing evidence',async()=>{
  const row:any={_id:'r',organizationId:'o1',employeeUserId:'u1',departmentId:'d1',type:'ATTENDANCE',source:'SELFIE',status:'PENDING',version:1,attendanceDayId:'day',workDate:new Date('2026-09-14')};
  const s=build([row]);
  const session={withTransaction:async(fn:any)=>fn(),endSession:jest.fn()};
  (s as any).requests.db={startSession:async()=>session};
  (s as any).requests.findOne.mockImplementation(()=>{const q:any={populate:()=>q,session:()=>q,lean:async()=>row};return q;});
  (s as any).periodVersion.claimForWorkDate=jest.fn(async()=>{});
  await expect(s.decide('o1','manager','r','APPROVED',1)).rejects.toThrow('ATTENDANCE_EVIDENCE_INVALID');
  expect(row.status).toBe('PENDING');
  expect((s as any).attendanceEvents.updateMany).not.toHaveBeenCalled();
 });
 it('rejects unverified SELFIE evidence without promoting provenance',async()=>{
  const s=build([]),at=new Date('2026-09-14T01:00:00Z');
  const q=(v:any)=>({session:()=>({lean:async()=>v})});
  (s as any).attendanceDays.findOne=()=>q({_id:'day',checkInAt:at,checkInProvenance:{source:'LEGACY_UNKNOWN'}});
  (s as any).attendanceEvents.findOne=()=>q({_id:'event',recordedAt:at});
  (s as any).attendanceEvents.updateOne=jest.fn();
  (s as any).requests.db={model:()=>({findOne:()=>q(null)})};
  await expect((s as any).syncSelfieDecision('o1',{_id:'r',attendanceDayId:'day',employeeUserId:'u1',evidenceId:'evidence',metadata:{actionType:'CHECK_IN'}},'APPROVED',{})).rejects.toThrow('ATTENDANCE_EVIDENCE_INVALID');
  expect((s as any).attendanceEvents.updateOne).not.toHaveBeenCalled();
  expect((s as any).attendanceDays.updateOne).not.toHaveBeenCalled();
 });
 it('promotes only matching valid SELFIE evidence to observed provenance',async()=>{
  const s=build([]), event={_id:'event',recordedAt:new Date('2026-09-14T01:00:00Z'),evidenceId:'evidence'};
  const day:any={_id:'day',checkInAt:event.recordedAt,checkInProvenance:{source:'LEGACY_UNKNOWN'},save:jest.fn()};
  const q=(v:any)=>({session:()=>({lean:async()=>v})});
  (s as any).attendanceDays.findOne=()=>q(day);
  (s as any).attendanceEvents.findOne=()=>q(event);
  (s as any).attendanceEvents.updateOne=jest.fn(async()=>({modifiedCount:1}));
  (s as any).requests.db={model:()=>({findOne:()=>q({_id:'evidence',storageKey:'selfie.jpg',mimeType:'image/jpeg',sizeBytes:3})})};
  await (s as any).syncSelfieDecision('o1',{_id:'r',attendanceDayId:'day',employeeUserId:'u1',evidenceId:'evidence',metadata:{actionType:'CHECK_IN'}},'APPROVED',{});
  expect((s as any).attendanceDays.updateOne).toHaveBeenCalledWith(expect.anything(),{$set:expect.objectContaining({checkInProvenance:{source:'OBSERVED',eventId:'event',requestId:'r'}})},expect.anything());
 });
 it.each(['OBSERVED','CONFIRMED_SCHEDULE','MANUAL_ADJUSTMENT'])('does not rewrite a protected %s endpoint on selfie approval',async(source)=>{
  const s=build([]),at=new Date('2026-09-14T01:00:00Z');
  const q=(v:any)=>({session:()=>({lean:async()=>v})});
  (s as any).attendanceDays.findOne=()=>q({_id:'day',checkInAt:at,checkInProvenance:{source}});
  (s as any).attendanceEvents.findOne=()=>q({_id:'event',recordedAt:at});
  (s as any).attendanceEvents.updateOne=jest.fn();
  await expect((s as any).syncSelfieDecision('o1',{_id:'r',attendanceDayId:'day',employeeUserId:'u1',evidenceId:'evidence',metadata:{actionType:'CHECK_IN'}},'APPROVED',{})).rejects.toThrow('ATTENDANCE_EVIDENCE_INVALID');
  expect((s as any).attendanceEvents.updateOne).not.toHaveBeenCalled();
 });
 it('delegates confirmation create to dedicated transaction service',async()=>{
  const s=build([]), confirmation={create:jest.fn(async()=>({_id:'confirmation'}))};
  (s as any).confirmation=confirmation;
  await expect(s.createMine('o1','u1',{requestKind:'ATTENDANCE_CONFIRMATION',type:'ATTENDANCE',workDate:'2026-09-14',reason:'I forgot to check in',previewHash:'hash'} as any,'key')).resolves.toEqual({_id:'confirmation'});
  expect(confirmation.create).toHaveBeenCalledWith('o1','u1',expect.objectContaining({requestKind:'ATTENDANCE_CONFIRMATION'}),'key');
 });
 it('delegates confirmation decisions without legacy effects and rejects time overrides',async()=>{
  const s=build([{_id:'c',organizationId:'o1',source:'ATTENDANCE_CONFIRMATION',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:1}]);
  const confirmation={decide:jest.fn(async()=>({status:'APPROVED'})),requireManagerAccess:jest.fn(async()=>{})};
  (s as any).confirmation=confirmation;
  await expect(s.decide('o1','manager','c','APPROVED',1,undefined,undefined,undefined,'op')).resolves.toMatchObject({status:'APPROVED'});
  expect(confirmation.decide).toHaveBeenCalledWith('o1','manager','c','APPROVED',1,'op',undefined);
  expect((s as any).__periodVersion.bumpForWorkDates).not.toHaveBeenCalled();
  await expect(s.decide('o1','manager','c','APPROVED',1,undefined,'2026-09-14T01:00:00Z',undefined,'op')).rejects.toThrow('ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID');
 });
 it('denies confirmation detail outside explicit review assignment',async()=>{
  const s=build([{_id:'c',organizationId:'o1',source:'ATTENDANCE_CONFIRMATION',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:1}]);
  (s as any).scope.requireReviewDepartment=jest.fn(async()=>{throw new ForbiddenException('DEPARTMENT_SCOPE_VIOLATION');});
  await expect(s.detail('o1','manager','c')).rejects.toThrow('DEPARTMENT_SCOPE_VIOLATION');
 });
 it('returns manager confirmation validity and safe preview without internal snapshot',async()=>{
  const s=build([{_id:'c',organizationId:'o1',source:'ATTENDANCE_CONFIRMATION',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:1,workDate:new Date('2026-09-14'),confirmationContextHash:'hash'}]);
  (s as any).confirmation={preview:jest.fn(async()=>({contextHash:'hash',blockedReasons:[],period:{canMutate:true},proposedChanges:{},snapshot:{secret:'internal'}}))};
  const row:any=await s.detail('o1','manager','c');
  expect(row).toMatchObject({canApprove:true,contextValidity:{valid:true},confirmation:{contextHash:'hash',enabled:true}});
  expect(row.confirmation.snapshot).toBeUndefined();
 });
 it('filters confirmation list by explicit review scope rather than profile fallback',async()=>{
  const s=build([{_id:'c',organizationId:'o1',source:'ATTENDANCE_CONFIRMATION',employeeUserId:'u1',departmentId:'d1',status:'PENDING'}]);
  (s as any).scope.getAuthorizedReviewDepartmentIds=jest.fn(async()=>[]);
  await expect(s.listForManager('o1','manager',{})).resolves.toEqual([]);
 });
 it('marks legacy manual endpoint provenance explicitly',async()=>{
  const s=build([]),day:any={_id:'day',save:jest.fn(async()=>{})};
  (s as any).attendanceDays.findOne.mockImplementation(()=>({then:(resolve:any)=>resolve(day)}));
  await (s as any).applyAttendanceAdjustment('o1',{_id:'r',employeeUserId:'u1',workDate:new Date('2026-09-14'),requestedStart:new Date('2026-09-14T01:00:00Z'),metadata:{actionType:'CHECK_IN'}});
  expect(day.checkInProvenance).toEqual({source:'MANUAL_ADJUSTMENT',requestId:'r'});
 });

 it('routes an attendance adjustment to the assignment effective on its work date',async()=>{
  const assignment={findOne:jest.fn(()=>{const q:any={};q.sort=()=>q;q.lean=async()=>({departmentId:'d2'});return q;})};
  const s=build([],['d2'],undefined,assignment);
  await expect(s.createMine('o1','u1',{type:'ATTENDANCE',workDate:'2026-09-14',reason:'Forgot the start-of-shift check-in',adjustmentType:'CHECK_IN',requestedStart:'2026-09-14T08:00:00+07:00'})).resolves.toMatchObject({departmentId:'d2',status:'PENDING',metadata:{actionType:'CHECK_IN',adjustmentSource:'MANUAL_ADJUSTMENT'}});
  expect(assignment.findOne).toHaveBeenCalledWith(expect.objectContaining({organizationId:'o1',userId:'u1',active:true}));
 });
 it('creates an employee overtime request using profile department rather than client scope',async()=>{const s=build([]);await expect(s.createMine('o1','u1',{type:'OVERTIME',workDate:'2026-09-22',reason:'Cần hoàn tất phát hành',requestedStart:'2026-09-22T18:00:00Z',requestedEnd:'2026-09-22T20:00:00Z'})).resolves.toMatchObject({employeeId:'p1',departmentId:'d1',status:'PENDING'});});
 it('lists only requests in managed departments',async()=>{const s=build([{_id:'1',organizationId:'o1',departmentId:'d1',type:'OVERTIME',status:'PENDING'},{_id:'2',organizationId:'o1',departmentId:'d2',type:'OVERTIME',status:'PENDING'}]);await expect(s.listForManager('o1','manager',{})).resolves.toHaveLength(1);});
 it('includes a legacy request with stale department when its employee is currently managed',async()=>{
  const s=build([{_id:'legacy',organizationId:'o1',employeeUserId:'u1',departmentId:'old-dept',type:'ATTENDANCE',status:'PENDING'}]);
  await expect(s.listForManager('o1','manager',{status:'PENDING'})).resolves.toMatchObject([{_id:'legacy'}]);
  await expect(s.detail('o1','manager','legacy')).resolves.toMatchObject({_id:'legacy'});
 });
 it('writes an approved missing check-in into the attendance day and event',async()=>{
  const row={_id:'adj1',organizationId:'o1',employeeUserId:'u1',employeeId:'p1',departmentId:'d1',type:'ATTENDANCE',status:'PENDING',version:1,workDate:new Date('2026-09-14T00:00:00Z'),requestedStart:new Date('2026-09-14T01:00:00Z'),reason:'Forgot the start-of-shift check-in',metadata:{actionType:'CHECK_IN',adjustmentSource:'MANUAL_ADJUSTMENT'}};
  const day:any={_id:'day1',checkOutAt:new Date('2026-09-14T10:00:00Z'),shiftSnapshot:{breakMinutes:60},save:jest.fn().mockResolvedValue(undefined)};
  const s=build([row]);
  const dayQuery:any={lean:async()=>day,then:(resolve:any)=>resolve(day)};
  (s as any).attendanceDays.findOne.mockImplementation(()=>dayQuery);
  await expect(s.decide('o1','manager','adj1','APPROVED',1)).resolves.toMatchObject({status:'APPROVED'});
  expect(day.checkInAt).toEqual(new Date('2026-09-14T01:00:00Z'));
  expect(day.attendanceStatus).toBe('COMPLETED');
  expect(day.dayResult).toBe('PRESENT');
  expect((s as any).attendanceEvents.create).toHaveBeenCalledWith(expect.objectContaining({eventType:'CHECK_IN',method:'MANUAL',approvalStatus:'APPROVED'}));
  expect((s as any).__periodVersion.bumpForWorkDates).toHaveBeenCalledTimes(1);
 });
 it('fails closed when attendance invalidation fails',async()=>{
  const row={_id:'adj1',organizationId:'o1',employeeUserId:'u1',employeeId:'p1',departmentId:'d1',type:'ATTENDANCE',status:'PENDING',version:1,workDate:new Date('2026-09-14T00:00:00Z'),requestedStart:new Date('2026-09-14T01:00:00Z'),reason:'Forgot the start-of-shift check-in',metadata:{actionType:'CHECK_IN',adjustmentSource:'MANUAL_ADJUSTMENT'}};
  const periodVersion={bumpForWorkDates:jest.fn().mockRejectedValue(new Error('version unavailable'))};
  const s=build([row],['d1'],undefined,undefined,periodVersion);
  const day:any={_id:'day1',save:jest.fn().mockResolvedValue(undefined)};
  const dayQuery:any={lean:async()=>day,then:(resolve:any)=>resolve(day)};
  (s as any).attendanceDays.findOne.mockImplementation(()=>dayQuery);
  await expect(s.decide('o1','manager','adj1','APPROVED',1)).rejects.toThrow('version unavailable');
  expect(periodVersion.bumpForWorkDates).toHaveBeenCalledTimes(1);
 });
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
  expect((s as any).__periodVersion.bumpForWorkDates).toHaveBeenCalledTimes(1);
 });
 it('fails closed when OT approval invalidation fails',async()=>{
  const ot=fakeOt();
  const periodVersion={bumpForWorkDates:jest.fn().mockRejectedValue(new Error('version unavailable'))};
  const s=build([structuredClone(pendingOt)],['d1'],ot,undefined,periodVersion);
  await expect(s.decide('o1','manager','1','APPROVED',1)).rejects.toThrow('version unavailable');
  expect(periodVersion.bumpForWorkDates).toHaveBeenCalledTimes(1);
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
  const s=build([{_id:'1',organizationId:'o1',type:'ATTENDANCE',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:1,workDate:new Date('2026-09-22T00:00:00Z')}],['d1'],ot);
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
