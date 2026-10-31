import './env-guard';
import mongoose, {Connection, Types} from 'mongoose';
import {SCHEMA_REGISTRY} from '../src/database/schemas/registry';
import {AttendanceService} from '../src/attendance/attendance.service';
import {AttendanceCalculatorService} from '../src/attendance/services/attendance-calculator.service';
import {HaversineService} from '../src/attendance/services/haversine.service';
import {AttendanceConfirmationService} from '../src/hr/manager/attendance-confirmation.service';
import {ManagerRequestService} from '../src/hr/manager/manager-request.service';
import {TimesheetPeriodService} from '../src/hr/timesheet/timesheet-period.service';
import {PeriodVersionService} from '../src/hr/timesheet/period-version.service';
let db:Connection, punch:AttendanceService, confirmation:AttendanceConfirmationService, version:PeriodVersionService;
const org=new Types.ObjectId(),user=new Types.ObjectId(),manager=new Types.ObjectId(),dept=new Types.ObjectId();
const date='2026-09-14', model=(name:string)=>db.model(name);
beforeAll(async()=>{
 if(process.env.TEST_MONGO_EPHEMERAL!=='1'||!/^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(process.env.TEST_MONGO_URI??''))throw new Error('EPHEMERAL_LOOPBACK_REQUIRED');
 db=await mongoose.createConnection(process.env.TEST_MONGO_URI!,{dbName:'attendance_checkout_boundary_isolated'}).asPromise();
 console.log('[checkout boundary] disposable database attendance_checkout_boundary_isolated');
 for(const {name,schema} of SCHEMA_REGISTRY)db.model(name,schema);
 await Promise.all(['AttendanceDay','AttendanceEvent','ManagerRequest','AttendanceConfirmationQuota','IdempotencyRecord'].map(n=>model(n).init()));
 version=new PeriodVersionService(model('TimesheetPeriod') as any);
 punch=new AttendanceService(model('AttendanceDay') as any,model('AttendanceEvent') as any,model('Evidence') as any,model('Assignment'),model('Workplace'),model('ShiftTemplate'),model('ManagerAssignment'),model('ManagerRequest'),model('EmployeeProfile'),model('IdempotencyRecord'),model('TimesheetPeriod') as any,new HaversineService(),new AttendanceCalculatorService(),{isConfigured:()=>false} as any,{resolveForEmployeeDate:async()=>null} as any,version);
 jest.spyOn(punch,'getTodayWorkDate').mockReturnValue(date);
 confirmation=new AttendanceConfirmationService(model('Organization'),{requests:model('ManagerRequest'),quotas:model('AttendanceConfirmationQuota'),days:model('AttendanceDay'),events:model('AttendanceEvent'),audit:model('ApprovalHistory'),scope:{requireReviewDepartment:async()=>{}},periodVersion:version} as any);
 jest.spyOn(confirmation,'preview').mockImplementation(async()=>({workDate:date,contextHash:'hash',canSubmit:true,blockedReasons:[],quota:{monthKey:'2026-09',limit:1},snapshot:{employeeProfileId:String(user),departmentId:String(dept),shift:{startTime:'08:00',endTime:'17:00',breakMinutes:60}},actionType:'CHECK_OUT',existingPunches:{checkInAt:'2026-09-14T01:00:00.000Z'},proposedChanges:{actionType:'CHECK_OUT',checkOutAt:'2026-09-14T10:00:00.000Z',calculation:{workingMinutes:480,lateMinutes:0,earlyMinutes:0}},requiredWorkingIntervals:[]} as any));
});
afterAll(async()=>{if(db){await db.dropDatabase();await db.close();}});
beforeEach(async()=>{
 for(const n of ['Organization','TimesheetPeriod','AttendanceDay','AttendanceEvent','ManagerRequest','AttendanceConfirmationQuota','ApprovalHistory','IdempotencyRecord','Assignment','Workplace','Evidence'])await model(n).deleteMany({});
 await model('Organization').collection.insertOne({_id:org,attendanceOvertimeV2Enabled:true});
 await model('TimesheetPeriod').create({organizationId:org,period:'2026-09',startDate:'2026-09-01',endDate:'2026-09-30',active:true,status:'OPEN',version:1});
 await model('AttendanceDay').create({organizationId:org,employeeId:user,workDate:date,attendanceStatus:'CHECKED_IN',workMode:'IN_OFFICE',checkInAt:new Date('2026-09-14T01:00:00Z'),checkInProvenance:{source:'OBSERVED'},shiftSnapshot:{startTime:'08:00',endTime:'17:00',breakMinutes:60}});
 const workplace=await model('Workplace').collection.insertOne({organizationId:org,latitude:10,longitude:106,allowedRadiusMeters:100});
 await model('Assignment').collection.insertOne({organizationId:org,userId:user,active:true,departmentId:dept,workplaceId:workplace.insertedId});
});
const checkout=()=>punch.checkOut(String(user),String(org),{latitude:10,longitude:106,address:'Office'} as any,undefined,undefined,undefined,'checkout');
it.each([true,false])('real SELFIE approval promotes matching endpoint/event; enabled=%s',async(enabled)=>{
 if(!enabled){await model('Organization').updateOne({_id:org},{$unset:{attendanceOvertimeV2Enabled:1}});await model('TimesheetPeriod').deleteMany({});}
 const day:any=await model('AttendanceDay').findOne().lean();
 const evidence=await model('Evidence').create({organizationId:org,ownerUserId:user,storageKey:'selfie.jpg',mimeType:'image/jpeg',originalFileName:'selfie.jpg',sizeBytes:3});
 const event=await model('AttendanceEvent').create({organizationId:org,employeeId:user,attendanceDayId:day._id,eventType:'CHECK_IN',method:'SELFIE',recordedAt:day.checkInAt,evidenceId:evidence._id,approvalStatus:'PENDING',provenance:{source:'LEGACY_UNKNOWN'}});
 await model('AttendanceDay').updateOne({_id:day._id},{$set:{checkInProvenance:{source:'LEGACY_UNKNOWN',eventId:event._id}}});
 const row=await model('ManagerRequest').create({organizationId:org,employeeId:user,employeeUserId:user,departmentId:dept,type:'ATTENDANCE',workDate:date,reason:'Selfie approval evidence',status:'PENDING',version:1,attendanceDayId:day._id,evidenceId:evidence._id,metadata:{actionType:'CHECK_IN'}});
 const managerService:any=Object.create(ManagerRequestService.prototype);
 Object.assign(managerService,{requests:model('ManagerRequest'),attendanceDays:model('AttendanceDay'),attendanceEvents:model('AttendanceEvent'),periodVersion:version,detail:async()=>row.toObject()});
 await managerService.decide(String(org),String(manager),String(row._id),'APPROVED',1);
 const stored:any=await model('AttendanceDay').findById(day._id).lean();
 const storedEvent:any=await model('AttendanceEvent').findById(event._id).lean();
 expect(stored.checkInProvenance.source).toBe('OBSERVED');expect(storedEvent.provenance.source).toBe('OBSERVED');
 expect(String(stored.checkInProvenance.eventId)).toBe(String(event._id));
 if(enabled)expect((await model('TimesheetPeriod').findOne().lean() as any).version).toBe(2);
});
it('V2 checkin commits endpoint event idempotency and exactly one period version',async()=>{
 await model('AttendanceDay').deleteMany({});
 await punch.checkIn(String(user),String(org),{workMode:'IN_OFFICE',latitude:10,longitude:106,address:'Office'} as any,undefined,undefined,undefined,'checkin');
 const day:any=await model('AttendanceDay').findOne().lean(),event:any=await model('AttendanceEvent').findOne().lean();
 expect(day.checkInProvenance.source).toBe('OBSERVED');expect(String(day.checkInProvenance.eventId)).toBe(String(event._id));
 expect((await model('TimesheetPeriod').findOne().lean() as any).version).toBe(2);
 expect(await model('IdempotencyRecord').countDocuments()).toBe(1);
});
it.each([
 ['morning','08:00','12:00',240],
 ['afternoon','13:00','17:00',240],
 ['OT outside shift','07:00','19:00',480],
])('real persisted checkin/checkout excludes exact lunch and OT: %s',async(_name,from,to,minutes)=>{
 await model('AttendanceDay').deleteMany({});
 const shift=await model('ShiftTemplate').collection.insertOne({organizationId:org,startTime:'08:00',endTime:'17:00',breakMinutes:60,breakStartTime:'12:00',breakEndTime:'13:00',gracePeriodMinutes:15});
 await model('Assignment').updateOne({organizationId:org},{$set:{shiftTemplateId:shift.insertedId}});
 jest.useFakeTimers({now:new Date(`${date}T${from}:00+07:00`),doNotFake:['nextTick','queueMicrotask','performance','hrtime','setImmediate','clearImmediate','setInterval','clearInterval','setTimeout','clearTimeout']});
 try {
  await punch.checkIn(String(user),String(org),{workMode:'IN_OFFICE',latitude:10,longitude:106,address:'Office'} as any,undefined,undefined,undefined,'break-in');
  const checkedIn:any=await model('AttendanceDay').findOne().lean();
  expect(checkedIn.shiftSnapshot.requiredWorkingIntervals).toEqual([{from:'08:00',to:'12:00'},{from:'13:00',to:'17:00'}]);
  jest.setSystemTime(new Date(`${date}T${to}:00+07:00`));
  await checkout();
  const stored:any=await model('AttendanceDay').findOne().lean();
  expect(stored.workingMinutes).toBe(minutes);
  expect(stored.requiredWorkingMinutes).toBe(480);
  expect(stored.checkInAt.toISOString()).toBe(new Date(`${date}T${from}:00+07:00`).toISOString());
  expect(stored.checkOutAt.toISOString()).toBe(new Date(`${date}T${to}:00+07:00`).toISOString());
 } finally {jest.useRealTimers();}
});

it('V2 checkout refuses an occupied endpoint even when legacy status is stale',async()=>{
 await model('AttendanceDay').updateOne({organizationId:org},{$set:{checkOutAt:new Date('2026-09-14T10:00:00Z'),checkOutProvenance:{source:'CONFIRMED_SCHEDULE'}}});
 await expect(checkout()).rejects.toThrow('ALREADY_CHECKED_OUT');
 expect((await model('AttendanceDay').findOne().lean() as any).checkOutProvenance.source).toBe('CONFIRMED_SCHEDULE');
 expect((await model('TimesheetPeriod').findOne().lean() as any).version).toBe(1);
});
it('checkout event failure rolls back endpoint, idempotency and period claim',async()=>{
 const spy=jest.spyOn(model('AttendanceEvent'),'create').mockRejectedValueOnce(new Error('INJECTED_EVENT_FAILURE'));
 try {await expect(checkout()).rejects.toThrow('INJECTED_EVENT_FAILURE');}finally{spy.mockRestore();}
 expect((await model('AttendanceDay').findOne().lean() as any).checkOutAt).toBeUndefined();
 expect((await model('TimesheetPeriod').findOne().lean() as any).version).toBe(1);
 expect(await model('IdempotencyRecord').countDocuments()).toBe(0);
});
it('actual checkout and confirmation approval race preserves one endpoint and one event',async()=>{
 const row=await confirmation.create(String(org),String(user),{requestKind:'ATTENDANCE_CONFIRMATION',type:'ATTENDANCE',workDate:date,reason:'Forgot checkout yesterday',previewHash:'hash'} as any,'request');
 const results=await Promise.allSettled([checkout(),confirmation.decide(String(org),String(manager),String(row._id),'APPROVED',1,'approve')]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const day:any=await model('AttendanceDay').findOne().lean(), events:any[]=await model('AttendanceEvent').find({eventType:'CHECK_OUT'}).lean();
 expect(events).toHaveLength(1);expect(String(day.checkOutProvenance.eventId)).toBe(String(events[0]._id));
 expect(day.checkOutProvenance.source).toBe(events[0].provenance.source);
});
it('real close service loses its established snapshot after checkout commits',async()=>{
 const period:any=await model('TimesheetPeriod').findOneAndUpdate({organizationId:org},{$set:{status:'READY_TO_CLOSE'}},{new:true}).lean();
 let entered!:()=>void,release!:()=>void;
 const ready=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const close:any=Object.create(TimesheetPeriodService.prototype);
 Object.assign(close,{periodModel:model('TimesheetPeriod'),confirmationModel:model('DepartmentTimesheetConfirmation'),overtimeService:{recompute:async()=>{entered();await gate;}},summaryService:{generateSummaries:async()=>0},snapshotService:{generateSnapshots:async()=>0}});
 close.collectBlockers=async()=>[];close.getRequiredDepartmentIds=async()=>[];
 const closing=close.hrClosePeriod(String(org),String(period._id),String(manager));
 // Close read READY/version=1 in its active session before the punch starts.
 await ready;
 await checkout();release();
 await expect(closing).rejects.toThrow('PERIOD_VERSION_CONFLICT');
 const stored:any=await model('TimesheetPeriod').findById(period._id).lean();
 expect(stored.status).toBe('REVIEWING');expect(stored.version).toBe(2);
 expect((await model('AttendanceDay').findOne().lean() as any).checkOutProvenance.source).toBe('OBSERVED');
});
it('checkout loses after close commits and leaves no endpoint',async()=>{
 await model('TimesheetPeriod').updateOne({organizationId:org},{$set:{status:'CLOSED'}});
 await expect(checkout()).rejects.toThrow('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
 expect((await model('AttendanceDay').findOne().lean() as any).checkOutAt).toBeUndefined();
});
