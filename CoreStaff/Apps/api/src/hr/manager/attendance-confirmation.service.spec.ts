import { AttendanceConfirmationService } from './attendance-confirmation.service';

describe('attendance confirmation cutover', () => {
  it('previews canonical obligation with safe punches and month-start quota', async () => {
    const query = (value: any) => ({ session: () => ({ lean: async () => value }) });
    const facts: any = { organizationId: 'org', periodKey: '2026-09', startDate: '2026-09-14', endDate: '2026-09-14', employees: [{employeeProfileId:'profile',userId:'user',departmentIds:['dept']}], assignments:[{id:'assignment',userId:'user',departmentId:'dept',active:true}], shifts:[{id:'shift',scope:'ORGANIZATION',active:true,weekdays:[1],effectiveFrom:'2026-01-01',startTime:'08:00',endTime:'17:00',breakMinutes:60}], calendarExceptions:[], leaveRequests:[], attendanceDays:[], overtimeResults:[] };
    const models: any = {
      source: { load: jest.fn(async () => facts) },
      shifts: { findOne: () => query({...facts.shifts[0],gracePeriodMinutes:5}) },
      days: { findOne: () => query(null) }, overrides: { find: () => query([]) },
      policyRules: {attendanceConfirmationRulesForWorkDate:jest.fn(async()=>({_id:'policy',version:2,maxMonthlyAttendanceConfirmations:3}))},
      quotas: { findOne: () => query({usedSlots:1}) }, periods: { find: () => query([{_id:'period',status:'OPEN'}]) },
    };
    const service = new AttendanceConfirmationService({ findOne: () => query({attendanceOvertimeV2Enabled:true}) } as any, models);
    const result = await service.preview('org','user','2026-09-14');
    expect(result).toMatchObject({canSubmit:true,actionType:'FULL_DAY',quota:{monthKey:'2026-09',usedSlots:1,limit:3,remaining:2},proposedChanges:{checkInAt:'2026-09-14T01:00:00.000Z',checkOutAt:'2026-09-14T10:00:00.000Z',calculation:{workingMinutes:480}}});
    expect(models.source.load).toHaveBeenCalledWith(expect.objectContaining({startDate:'2026-09-14',endDate:'2026-09-14'}), undefined);
    expect(models.policyRules.attendanceConfirmationRulesForWorkDate).toHaveBeenCalledWith('org','2026-09-14',undefined); await expect(service.preview('org','user','2026-09-14')).resolves.toMatchObject({contextHash:result.contextHash});
    facts.overtimeResults=[{id:'unrelated',userId:'user',workDate:'2026-09-14',periodKey:'2026-09',classificationStatus:'PROVISIONAL',eligibleMinutes:30}];
    expect((await service.preview('org','user','2026-09-14')).contextHash).toBe(result.contextHash);
    expect(result).toMatchObject({obligation:{requiredWorkingIntervals:[{from:'2026-09-14T01:00:00.000Z',to:'2026-09-14T05:00:00.000Z'},{from:'2026-09-14T06:00:00.000Z',to:'2026-09-14T10:00:00.000Z'}],breakMinutes:60}});
    expect(JSON.stringify(result)).not.toMatch(/latitude|evidenceUrl/);
  });
  it('reserves quota and inserts one server-owned pending request in the period transaction', async()=>{
    const session:any={withTransaction:async(fn:any)=>fn(),endSession:jest.fn()};
    const query=(value:any)=>({session:()=>({lean:async()=>value})});
    const requests={db:{startSession:async()=>session},findOne:jest.fn(()=>query(null)),create:jest.fn(async(rows:any)=>[{_id:'request',...rows[0],toObject(){return {...rows[0],_id:'request'};}}])};
    const quotas={updateOne:jest.fn(async()=>({matchedCount:1})),findOneAndUpdate:jest.fn(()=>query({usedSlots:1}))};
    const periodVersion={claimForWorkDate:jest.fn(async()=>({periodId:'period',version:2}))};
    const service=new AttendanceConfirmationService({} as any,{requests,quotas,periodVersion});
    jest.spyOn(service,'preview').mockResolvedValue({canSubmit:true,contextHash:'hash',blockedReasons:[],quota:{monthKey:'2026-09',limit:3},snapshot:{employeeProfileId:'profile',departmentId:'dept'},actionType:'FULL_DAY'} as any);
    await expect(service.create('org','user',{requestKind:'ATTENDANCE_CONFIRMATION',type:'ATTENDANCE',workDate:'2026-09-14',reason:'I forgot to punch in',previewHash:'hash'},'key')).resolves.toMatchObject({_id:'request',source:'ATTENDANCE_CONFIRMATION',status:'PENDING',confirmationSlotActive:true});
    expect(periodVersion.claimForWorkDate).toHaveBeenCalledWith('org','2026-09-14',session);
    expect(quotas.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({usedSlots:{$lt:3}}),{$inc:{usedSlots:1}},expect.objectContaining({session,new:true}));
    expect(requests.create).toHaveBeenCalledWith([expect.objectContaining({employeeId:'profile',employeeUserId:'user',departmentId:'dept'})],{session});
  });
  it('atomically approves only missing endpoint with confirmed-schedule provenance',async()=>{
    const query=(v:any)=>({session:()=>({lean:async()=>v})});
    const session:any={withTransaction:async(fn:any)=>fn(),endSession:jest.fn()};
    const request={_id:'req',source:'ATTENDANCE_CONFIRMATION',employeeUserId:'user',departmentId:'dept',status:'PENDING',version:1,workDate:new Date('2026-09-14'),confirmationContextHash:'hash',confirmationMonthKey:'2026-09',confirmationSlotActive:true};
    const requests={db:{startSession:async()=>session},findOne:()=>query(request),findOneAndUpdate:jest.fn(()=>query({...request,status:'APPROVED',version:2}))};
    const days={findOne:()=>query({_id:'day',checkInAt:new Date('2026-09-14T01:15:00Z')}),findOneAndUpdate:jest.fn(()=>query({_id:'day'}))};
    const notify={notifyApprovalDecision:jest.fn()};
    const events={create:jest.fn(async()=>[])},audit={create:jest.fn(async()=>[])},periodVersion={claimForWorkDate:jest.fn(async()=>({periodId:'period',version:2}))};
    const scope={requireReviewDepartment:jest.fn(async()=>{})};
    const service=new AttendanceConfirmationService({} as any,{requests,days,events,audit,periodVersion,scope,notify});
    jest.spyOn(service,'preview').mockResolvedValue({contextHash:'hash',blockedReasons:[],snapshot:{shift:{startTime:'08:00',endTime:'17:00',breakMinutes:60}},proposedChanges:{actionType:'CHECK_OUT',checkInAt:'2026-09-14T01:15:00.000Z',checkOutAt:'2026-09-14T10:00:00.000Z',calculation:{workingMinutes:465,lateMinutes:10,earlyMinutes:0}},existingPunches:{checkInAt:'2026-09-14T01:15:00.000Z'},requiredWorkingIntervals:[{from:'08:00',to:'12:00'},{from:'13:00',to:'17:00'}]} as any);
    await expect(service.decide('org','manager','req','APPROVED',1,'op')).resolves.toMatchObject({status:'APPROVED'});
    expect(notify.notifyApprovalDecision).toHaveBeenCalledTimes(1);
    expect(scope.requireReviewDepartment).toHaveBeenCalledWith('org','manager','dept');
    expect(periodVersion.claimForWorkDate).toHaveBeenCalledTimes(1);
    expect(events.create).toHaveBeenCalledWith([expect.objectContaining({eventType:'CHECK_OUT',method:'MANUAL',requestId:'req',provenance:expect.objectContaining({source:'CONFIRMED_SCHEDULE',requestId:'req'})})],{session,ordered:true});
    const update=days.findOneAndUpdate.mock.calls[0] as any;
    expect(update[0]).toMatchObject({checkOutAt:null,checkInAt:new Date('2026-09-14T01:15:00.000Z')});
    expect(update[1].$set).toMatchObject({workingMinutes:465,checkOutProvenance:{source:'CONFIRMED_SCHEDULE',requestId:'req'}});
    expect(update[1].$set.checkInAt).toBeUndefined();
    expect(audit.create).toHaveBeenCalledWith([expect.objectContaining({approvalRequestId:'req',actorId:'manager',action:'APPROVED'})],{session});
  });
  it('provides safe disabled preview and blocks legacy create after cutover',async()=>{
    const service=new AttendanceConfirmationService({findOne:()=>({session:()=>({lean:async()=>({attendanceOvertimeV2Enabled:true})})})} as any);
    await expect(service.assertLegacyCreateAllowed('org')).rejects.toThrow('ATTENDANCE_CONFIRMATION_FLOW_REQUIRED');
  });
  it('notifies only after committed create and tolerates socket failure',async()=>{
    let committed=false;
    const session={withTransaction:async(fn:any)=>{await fn();committed=true;},endSession:async()=>{}};
    const query=(value:any)=>({session:()=>({lean:async()=>value})});
    const notify={notifyNewRequest:jest.fn(()=>{expect(committed).toBe(true);throw new Error('socket offline');})};
    const requests={db:{startSession:async()=>session},findOne:()=>query(null),create:async()=>[{toObject:()=>({_id:'r',departmentId:'d',reason:'Forgot attendance punches'})}]};
    const service=new AttendanceConfirmationService({} as any,{requests,quotas:{updateOne:async()=>({}),findOneAndUpdate:()=>query({usedSlots:1})},periodVersion:{claimForWorkDate:async()=>({})},notify});
    jest.spyOn(service,'preview').mockResolvedValue({canSubmit:true,contextHash:'hash',quota:{monthKey:'2026-09',limit:3},snapshot:{employeeProfileId:'p',departmentId:'d'},actionType:'FULL_DAY'} as any);
    await expect(service.create('org','user',{requestKind:'ATTENDANCE_CONFIRMATION',type:'ATTENDANCE',workDate:'2026-09-14',reason:'Forgot attendance punches',previewHash:'hash'},'k')).resolves.toMatchObject({_id:'r'});
    expect(notify.notifyNewRequest).toHaveBeenCalledTimes(1);
  });
  it('rejects impossible date-only input before querying tenant data', async () => {
    const organizations = { findOne: jest.fn() };
    const service = new AttendanceConfirmationService(organizations as any);
    await expect(service.preview('org', 'user', '2026-02-30')).rejects.toThrow('WORK_DATE_INVALID');
    expect(organizations.findOne).not.toHaveBeenCalled();
  });
  it('is disabled unless organization explicitly opted in', async () => {
    const organizations = { findOne: jest.fn(() => ({ session: () => ({ lean: async () => ({}) }) })) };
    const service = new AttendanceConfirmationService(organizations as any);
    await expect(service.preview('org', 'user', '2026-09-14')).rejects.toThrow('ATTENDANCE_CONFIRMATION_DISABLED');
  });
});
