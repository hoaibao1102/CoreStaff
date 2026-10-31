import './env-guard';
import mongoose, {Connection,Types} from 'mongoose';
import {AttendanceConfirmationService} from '../src/hr/manager/attendance-confirmation.service';
import {SCHEMA_REGISTRY} from '../src/database/schemas/registry';
import {PoliciesService} from '../src/hr/policies/policies.service';
import {MongoosePeriodFactSource} from '../src/hr/timesheet/mongoose-period-fact-source';
import {PeriodVersionService} from '../src/hr/timesheet/period-version.service';

let db:Connection,service:AttendanceConfirmationService,m:any;
const org=new Types.ObjectId(),user=new Types.ObjectId(),manager=new Types.ObjectId(),dept=new Types.ObjectId(),profile=new Types.ObjectId();
const date='2026-09-14';
beforeAll(async()=>{
 db=await mongoose.createConnection(process.env.TEST_MONGO_URI!,{dbName:'confirmation_isolated'}).asPromise();
 for(const {name,schema} of SCHEMA_REGISTRY)db.model(name,schema);
 m={requests:db.model('ManagerRequest'),quotas:db.model('AttendanceConfirmationQuota'),days:db.model('AttendanceDay'),events:db.model('AttendanceEvent'),audit:db.model('ApprovalHistory'),scope:{requireReviewDepartment:async()=>{}},periodVersion:new PeriodVersionService(db.model('TimesheetPeriod') as any)};
 service=new AttendanceConfirmationService(db.model('Organization'),m);
 await Promise.all([m.requests.init(),m.quotas.init(),m.days.init(),m.events.init()]);
});
afterAll(async()=>{await db.dropDatabase();await db.close();});
beforeEach(async()=>{
 for(const name of ['ManagerRequest','AttendanceConfirmationQuota','AttendanceDay','AttendanceEvent','ApprovalHistory','TimesheetPeriod'])await db.model(name).deleteMany({});
 await db.model('TimesheetPeriod').create({organizationId:org,period:'2026-09',startDate:new Date('2026-09-01'),endDate:new Date('2026-09-30'),active:true,status:'OPEN',version:1});
 jest.spyOn(service,'preview').mockImplementation(async(_o,_u,d)=>({workDate:d,contextHash:'hash',canSubmit:true,blockedReasons:[],quota:{monthKey:'2026-09',limit:1},snapshot:{employeeProfileId:String(profile),departmentId:String(dept),shift:{startTime:'08:00',endTime:'17:00',breakMinutes:60}},actionType:'FULL_DAY',existingPunches:{},proposedChanges:{actionType:'FULL_DAY',checkInAt:'2026-09-14T01:00:00.000Z',checkOutAt:'2026-09-14T10:00:00.000Z',calculation:{workingMinutes:480,lateMinutes:0,earlyMinutes:0}},requiredWorkingIntervals:[{from:'08:00',to:'12:00'},{from:'13:00',to:'17:00'}]} as any));
});
afterEach(()=>jest.restoreAllMocks());
const dto=(d=date)=>({requestKind:'ATTENDANCE_CONFIRMATION',type:'ATTENDANCE',workDate:d,reason:'Forgot both attendance punches',previewHash:'hash'});
it('real canonical preview create approval remains valid after quota reservation',async()=>{
 jest.restoreAllMocks();
 for(const name of ['Organization','EmployeeProfile','Assignment','ShiftTemplate','LaborCompliancePolicy'])await db.model(name).deleteMany({});
 await db.model('Organization').collection.insertOne({_id:org,attendanceOvertimeV2Enabled:true});
 await db.model('EmployeeProfile').collection.insertOne({_id:profile,organizationId:org,userId:user,employmentStatus:'ACTIVE',departmentId:dept});
 await db.model('Assignment').collection.insertOne({organizationId:org,userId:user,departmentId:dept,active:true,effectiveFrom:'2026-01-01'});
 await db.model('ShiftTemplate').collection.insertOne({organizationId:org,active:true,scope:'ORGANIZATION',weekdays:[1,2,3,4,5],effectiveFrom:'2026-01-01',startTime:'08:00',endTime:'17:00',breakMinutes:60,gracePeriodMinutes:5});
 await db.model('LaborCompliancePolicy').collection.insertOne({organizationId:org,active:true,effectiveFrom:new Date('2026-01-01'),version:1,maxMonthlyAttendanceConfirmations:1});
 const model=(name:string)=>db.model(name);
 Object.assign(m,{policyRules:new PoliciesService(model('LaborCompliancePolicy') as any,model('OvertimePayPolicy') as any,model('WorkCreditPolicy') as any,m.periodVersion),source:new MongoosePeriodFactSource(model('EmployeeProfile'),model('Assignment'),model('ShiftTemplate'),model('CalendarException'),model('LeaveRequest'),model('AttendanceDay'),model('OvertimeResult')),shifts:model('ShiftTemplate'),overrides:model('EmployeeDayOverride'),policies:model('LaborCompliancePolicy'),periods:model('TimesheetPeriod')});
 const preview=await service.preview(String(org),String(user),date);
 expect(preview.canSubmit).toBe(true);
 const row=await service.create(String(org),String(user),{...dto(),previewHash:preview.contextHash},'real');
 await expect(service.decide(String(org),String(manager),String(row._id),'APPROVED',1,'approve')).resolves.toMatchObject({status:'APPROVED'});
 expect((await m.days.findOne().lean()).workingMinutes).toBe(480);
 const approved=await m.requests.findById(row._id).lean();
 expect(approved.confirmationDecision.audit).toMatchObject({synthetic:true,requestId:String(row._id),after:{workingMinutes:480}});
});
it('last slot race commits exactly one request and counter',async()=>{
 const results=await Promise.allSettled([service.create(String(org),String(user),dto(),'one'),service.create(String(org),String(user),dto('2026-09-15'),'two')]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(await m.requests.countDocuments()).toBe(1);
 expect((await m.quotas.findOne().lean()).usedSlots).toBe(1);
});
it('same key replay and reject release are exactly once',async()=>{
 const first=await service.create(String(org),String(user),dto(),'one');
 const again=await service.create(String(org),String(user),dto(),'one');
 expect(String(again._id)).toBe(String(first._id));
 await expect(service.create(String(org),String(user),{...dto(),reason:'Different reason for same key'},'one')).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
 await service.decide(String(org),String(manager),String(first._id),'REJECTED',1,'reject','Not enough evidence for approval');
 await service.decide(String(org),String(manager),String(first._id),'REJECTED',1,'reject','Not enough evidence for approval');
 expect((await m.quotas.findOne().lean()).usedSlots).toBe(0);
 expect(await m.audit.countDocuments()).toBe(1);
});
it('event failure rolls back decision, endpoints and period claim',async()=>{
 const row=await service.create(String(org),String(user),dto(),'one');
 jest.spyOn(m.events,'create').mockRejectedValue(new Error('injected event failure'));
 await expect(service.decide(String(org),String(manager),String(row._id),'APPROVED',1,'approve')).rejects.toThrow('injected event failure');
 expect((await m.requests.findById(row._id).lean()).status).toBe('PENDING');
 expect(await m.days.countDocuments()).toBe(0);
 expect((await db.model('TimesheetPeriod').findOne().lean() as any).version).toBe(2);
});
it('concurrent approval operations apply endpoints only once',async()=>{
 const row=await service.create(String(org),String(user),dto(),'one');
 const results=await Promise.allSettled([service.decide(String(org),String(manager),String(row._id),'APPROVED',1,'a'),service.decide(String(org),String(manager),String(row._id),'APPROVED',1,'b')]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(await m.events.countDocuments()).toBe(2);
 expect(await m.audit.countDocuments()).toBe(1);
});
it('closed period blocks approval without consuming endpoints',async()=>{
 const row=await service.create(String(org),String(user),dto(),'one');
 await db.model('TimesheetPeriod').updateOne({organizationId:org},{$set:{status:'CLOSED'}});
 await expect(service.decide(String(org),String(manager),String(row._id),'APPROVED',1,'a')).rejects.toThrow('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
 expect((await m.requests.findById(row._id).lean()).status).toBe('PENDING');
 expect(await m.events.countDocuments()).toBe(0);
});
it('existing observed endpoint defeats stale synthetic approval by endpoint CAS',async()=>{
 const row=await service.create(String(org),String(user),dto(),'one');
 await m.days.create({organizationId:org,employeeId:user,workDate:date,checkInAt:new Date('2026-09-14T02:00:00Z'),checkInProvenance:{source:'OBSERVED'}});
 await expect(service.decide(String(org),String(manager),String(row._id),'APPROVED',1,'a')).rejects.toThrow('ATTENDANCE_CONFIRMATION_STALE');
 expect((await m.days.findOne().lean()).checkInProvenance.source).toBe('OBSERVED');
 expect((await m.requests.findById(row._id).lean()).status).toBe('PENDING');
});
it('full day writes two linked synthetic events',async()=>{
 const row=await service.create(String(org),String(user),dto(),'one');
 await service.decide(String(org),String(manager),String(row._id),'APPROVED',1,'approve');
 const events=await m.events.find().lean();
 expect(events).toHaveLength(2);
 for(const event of events){expect(event.provenance).toMatchObject({source:'CONFIRMED_SCHEDULE',requestId:new Types.ObjectId(row._id),eventId:event._id}); const day=await m.days.findOne().lean();expect(day[event.eventType==='CHECK_IN'?'checkInProvenance':'checkOutProvenance'].eventId).toEqual(event._id);}
 expect((await m.days.findOne().lean()).workingMinutes).toBe(480);
 const approved=await m.requests.findById(row._id).lean();
 expect(approved.confirmationDecision.audit).toMatchObject({synthetic:true,requestId:String(row._id),after:{workingMinutes:480}});
});
