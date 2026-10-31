import { ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { ClientSession, Types } from 'mongoose';
import { buildPeriodObligationProjection } from '../timesheet/period-obligation.service';
import { calculateLeaveDay } from '../leave/leave.service';
import { LeaveDurationType } from '../../database/schemas/enums';
import { vnTimeToUtc } from '../../common/vietnam-time';
import { proposeAttendanceConfirmation } from './attendance-confirmation-domain';
export const CONFIRMATION_MODELS = 'CONFIRMATION_MODELS';
function stable(value:any):any {if(value instanceof Date)return value.toISOString();if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])]));return value;}
const read = (query: any, session?: ClientSession): Promise<any> => query.session(session ?? null).lean();
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class AttendanceConfirmationService {
  constructor(@InjectModel('Organization') private readonly organizations: Model<any>, @Optional() @Inject(CONFIRMATION_MODELS) private readonly models?: any) {}

  async assertLegacyCreateAllowed(org:string) {
    const organization=await read(this.organizations.findOne({_id:org}));
    if(organization?.attendanceOvertimeV2Enabled===true)throw new ConflictException('ATTENDANCE_CONFIRMATION_FLOW_REQUIRED');
  }

  async decide(org:string,managerId:string,id:string,status:string,expectedVersion:number,operationId?:string,reason?:string) {
    if(!operationId||operationId.length>128)throw new ConflictException('OPERATION_ID_REQUIRED');
    if(!['APPROVED','REJECTED','CLARIFICATION_REQUESTED'].includes(status))throw new ConflictException('REQUEST_STATE_CHANGED');
    if(status!=='APPROVED'&&(!reason||reason.trim().length<10||reason.trim().length>1000))throw new ConflictException('REVIEW_REASON_REQUIRED');
    const m=this.models,session=await m.requests.db.startSession();let result:any,changed=false;
    const operationHash=createHash('sha256').update(JSON.stringify({managerId,status,expectedVersion,reason:reason?.trim()})).digest('hex');
    try {
      await session.withTransaction(async()=>{
        const current=await read(m.requests.findOne({_id:id,organizationId:org,source:'ATTENDANCE_CONFIRMATION'}),session);
        if(!current)throw new ConflictException('REQUEST_NOT_FOUND');
        if(String(current.employeeUserId)===managerId)throw new ConflictException('SELF_APPROVAL_FORBIDDEN');
        await m.scope.requireReviewDepartment(org,managerId,String(current.departmentId));
        if(current.confirmationDecision?.operationId===operationId){if(current.confirmationDecision.operationHash!==operationHash)throw new ConflictException('REQUEST_STATE_CHANGED');result=current;return;}
        if(current.status!=='PENDING'||current.version!==expectedVersion)throw new ConflictException('REQUEST_STATE_CHANGED');
        const workDate=new Date(current.workDate).toISOString().slice(0,10);
        let preview:any;
        if(status==='APPROVED'){
          preview=await this.preview(org,String(current.employeeUserId),workDate,session);
          if(preview.contextHash!==current.confirmationContextHash)throw new ConflictException('ATTENDANCE_CONFIRMATION_STALE');
          const blockers=preview.blockedReasons.filter((code:string)=>code!=='MONTHLY_CONFIRMATION_LIMIT_EXCEEDED');
          if(blockers.length)throw new ConflictException(blockers[0]);
        }
        const claim=await m.periodVersion.claimForWorkDate(org,workDate,session);
        const row=await m.requests.findOneAndUpdate({_id:id,organizationId:org,status:'PENDING',version:expectedVersion,confirmationSlotActive:true},{$set:{status,reviewedBy:managerId,reviewedAt:new Date(),reviewComment:reason?.trim(),confirmationSlotActive:status==='APPROVED',confirmationDecision:{operationId,operationHash,audit:{requestId:id,actorId:managerId,reason:reason?.trim(),decidedAt:new Date(),synthetic:status==='APPROVED',before:preview?.existingPunches??current.confirmationSnapshot?.punches,after:preview?{checkInAt:preview.proposedChanges.checkInAt,checkOutAt:preview.proposedChanges.checkOutAt,...preview.proposedChanges.calculation}:undefined,sourceRefs:preview?.snapshot?.source??current.confirmationSnapshot?.source,contextHash:current.confirmationContextHash}}},$inc:{version:1}},{new:true,session}).session(session).lean();
        if(!row)throw new ConflictException('REQUEST_STATE_CHANGED');
        if(status==='APPROVED'){
          const filter:any={organizationId:org,employeeId:current.employeeUserId,workDate,checkInAt:preview.existingPunches.checkInAt?new Date(preview.existingPunches.checkInAt):null,checkOutAt:preview.existingPunches.checkOutAt?new Date(preview.existingPunches.checkOutAt):null};
          const before=await read(m.days.findOne({organizationId:org,employeeId:current.employeeUserId,workDate}),session);
          const set:any={...preview.proposedChanges.calculation,periodId:claim.periodId,attendanceStatus:'COMPLETED',overallApprovalStatus:'APPROVED',dayResult:'PRESENT',shiftSnapshot:{...preview.snapshot.shift,requiredWorkingIntervals:preview.requiredWorkingIntervals,approvedLeaveIntervals:preview.approvedLeaveIntervals}};
          const events:any[]=[];
          for(const [field,eventType] of [['checkInAt','CHECK_IN'],['checkOutAt','CHECK_OUT']]){
            if(preview.existingPunches[field])continue;
            const eventId=new Types.ObjectId();
            set[field]=new Date(preview.proposedChanges[field]);
            set[field==='checkInAt'?'checkInProvenance':'checkOutProvenance']={source:'CONFIRMED_SCHEDULE',requestId:id,eventId};
            events.push({_id:eventId,organizationId:org,employeeId:current.employeeUserId,eventType,method:'MANUAL',recordedAt:set[field],approvalStatus:'APPROVED',validationStatus:'VALID',requestId:id,provenance:{source:'CONFIRMED_SCHEDULE',requestId:id,eventId},note:current.reason});
          }
          const day=await m.days.findOneAndUpdate(filter,{$set:set,$setOnInsert:{organizationId:org,employeeId:current.employeeUserId,workDate}},{new:true,upsert:!before,session}).session(session).lean();
          if(!day)throw new ConflictException('ATTENDANCE_CONFIRMATION_STALE');
          await m.events.create(events.map(event=>({...event,attendanceDayId:day._id})),{session,ordered:true});
        }else{
          const released=await m.quotas.updateOne({organizationId:org,employeeUserId:current.employeeUserId,monthKey:current.confirmationMonthKey,usedSlots:{$gt:0}},{$inc:{usedSlots:-1}},{session});
          if(released.modifiedCount!==1)throw new ConflictException('CONFIRMATION_QUOTA_INCONSISTENT');
        }
        await m.audit.create([{organizationId:org,approvalRequestId:id,actorId:managerId,action:status,previousStatus:'PENDING',newStatus:status,comment:reason}],{session});
        result=row;changed=true;
      });
      if(changed){try{m.notify?.notifyApprovalDecision(String(result.employeeUserId),{requestId:id,type:'ATTENDANCE',status,organizationId:org,reviewedBy:managerId,reviewComment:reason,departmentId:String(result.departmentId),workDate:result.workDate});}catch{/* Commit is authoritative. */}}
      return result;
    }finally{await session.endSession();}
  }

  async create(org:string,userId:string,dto:any,key?:string) {
    if (!key || key.length>128 || !/^[\x21-\x7e]+$/.test(key)) throw new ConflictException('IDEMPOTENCY_KEY_REQUIRED');
    const allowed=['requestKind','type','workDate','reason','previewHash'];
    if(Object.keys(dto).some(k=>!allowed.includes(k)) || dto.type!=='ATTENDANCE' || dto.requestKind!=='ATTENDANCE_CONFIRMATION' || typeof dto.reason!=='string' || dto.reason.trim().length<10 || dto.reason.trim().length>1000 || typeof dto.previewHash!=='string') throw new ConflictException('ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID');
    const payload={requestKind:dto.requestKind,type:dto.type,workDate:dto.workDate,reason:dto.reason.trim(),previewHash:dto.previewHash};
    const payloadHash=createHash('sha256').update(JSON.stringify(payload)).digest('hex'), m=this.models;
    for(let attempt=0;attempt<3;attempt++) {
      const session=await m.requests.db.startSession();
      let result:any,created=false;
      try {
        await session.withTransaction(async()=>{
          const identity={organizationId:org,employeeUserId:userId,source:'ATTENDANCE_CONFIRMATION',confirmationIdempotencyKey:key};
          const existing=await read(m.requests.findOne(identity),session);
          if(existing){if(existing.confirmationPayloadHash!==payloadHash)throw new ConflictException('IDEMPOTENCY_KEY_REUSED');result=existing;return;}
          const preview=await this.preview(org,userId,dto.workDate,session);
          if(preview.contextHash!==dto.previewHash)throw new ConflictException('ATTENDANCE_CONFIRMATION_STALE');
          if(!preview.canSubmit)throw new ConflictException(preview.blockedReasons[0]);
          await m.periodVersion.claimForWorkDate(org,dto.workDate,session);
          const quotaIdentity={organizationId:org,employeeUserId:userId,monthKey:preview.quota.monthKey};
          await m.quotas.updateOne(quotaIdentity,{$setOnInsert:{...quotaIdentity,usedSlots:0}},{upsert:true,session});
          const slot=await m.quotas.findOneAndUpdate({...quotaIdentity,usedSlots:{$lt:preview.quota.limit}},{$inc:{usedSlots:1}},{new:true,session}).session(session).lean();
          if(!slot)throw new ConflictException('MONTHLY_CONFIRMATION_LIMIT_EXCEEDED');
          const [row]=await m.requests.create([{...identity,employeeId:preview.snapshot.employeeProfileId,departmentId:preview.snapshot.departmentId,type:'ATTENDANCE',workDate:new Date(`${dto.workDate}T00:00:00Z`),reason:payload.reason,status:'PENDING',version:1,confirmationSlotActive:true,confirmationMonthKey:preview.quota.monthKey,confirmationPayloadHash:payloadHash,confirmationContextHash:preview.contextHash,confirmationSnapshot:preview.snapshot,metadata:{adjustmentSource:'ATTENDANCE_CONFIRMATION',actionType:preview.actionType}}],{session});
          result=row.toObject(); created=true;
        });
        if(created){try{m.notify?.notifyNewRequest(String(result.departmentId),{requestId:String(result._id),type:'ATTENDANCE',departmentId:String(result.departmentId),employeeUserId:userId,reason:result.reason,status:'PENDING',createdAt:result.createdAt??new Date()});}catch{/* REST remains source of truth after commit. */}}
        return result;
      } catch(error:any){
        if(error?.code===11000 && attempt<2)continue;
        if(error?.code===11000)throw new ConflictException('ATTENDANCE_CONFIRMATION_DUPLICATE');
        throw error;
      } finally {await session.endSession();}
    }
  }

  async preview(org: string, userId: string, workDate: string, session?: ClientSession) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(new Date(`${workDate}T00:00:00Z`).getTime()) || new Date(`${workDate}T00:00:00Z`).toISOString().slice(0, 10) !== workDate) throw new ConflictException('WORK_DATE_INVALID');
    const organization = await read(this.organizations.findOne({ _id: org }), session);
    if (organization?.attendanceOvertimeV2Enabled !== true) throw new ConflictException('ATTENDANCE_CONFIRMATION_DISABLED');
    const m = this.models, monthKey = workDate.slice(0,7), blockedReasons: string[] = [];
    const facts = await m.source.load({organizationId:org,periodKey:monthKey,startDate:workDate,endDate:workDate},session);
    facts.employees = facts.employees.filter((row:any)=>row.userId===userId);
    let obligation:any;
    try { obligation = buildPeriodObligationProjection(facts,{overtimeStatus:'REVIEWABLE'}).days[0]; }
    catch { blockedReasons.push('CONTEXT_REQUIRES_REVIEW'); }
    let policy:any;
    try{policy=await m.policyRules.attendanceConfirmationRulesForWorkDate(org,workDate,session);}catch{blockedReasons.push('POLICY_CONFIGURATION_REQUIRED');}
    const limit=policy?.maxMonthlyAttendanceConfirmations;
    if (!Number.isInteger(limit)||limit<0||limit>31) blockedReasons.push('POLICY_CONFIGURATION_REQUIRED');
    const counter = await read(m.quotas.findOne({organizationId:org,employeeUserId:userId,monthKey}),session), usedSlots=counter?.usedSlots??0;
    if (Number.isInteger(limit)&&usedSlots>=limit) blockedReasons.push('MONTHLY_CONFIRMATION_LIMIT_EXCEEDED');
    const instant = new Date(`${workDate}T00:00:00Z`);
    const periods = await read(m.periods.find({organizationId:org,active:true,startDate:{$lte:instant},endDate:{$gte:instant}}),session), period=periods.length===1?periods[0]:null;
    if (!period) blockedReasons.push(periods.length?'CONTEXT_REQUIRES_REVIEW':'PERIOD_REQUIRED');
    else if (period.status==='CLOSED'||period.payrollRunId) blockedReasons.push('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
    if(workDate>=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'})) blockedReasons.push('ATTENDANCE_CONFIRMATION_PAST_DATE_REQUIRED');
    const day = await read(m.days.findOne({organizationId:org,employeeId:userId,workDate}),session);
    const overrides = await read(m.overrides.find({organizationId:org,employeeId:userId,date:workDate}),session);
    if(day?.resolution || day&&!['APPROVED','NOT_REQUIRED'].includes(day.overallApprovalStatus)) blockedReasons.push('CONTEXT_REQUIRES_REVIEW');
    const shift=obligation?.source.shiftTemplateId ? await read(m.shifts.findOne({organizationId:org,_id:obligation.source.shiftTemplateId}),session):null;
    let requiredWorkingIntervals:Array<{from:string;to:string}>=[], approvedLeaveIntervals:Array<{from:string;to:string}>=[];
    if(shift&&obligation.scheduledObligationMinutes>0){
      if(shift.endTime<=shift.startTime) blockedReasons.push('UNSUPPORTED_OVERNIGHT_SHIFT');
      else {
        requiredWorkingIntervals=calculateLeaveDay(workDate,shift.startTime,shift.endTime,shift.breakMinutes,LeaveDurationType.FULL_DAY,undefined,undefined,shift.breakStartTime,shift.breakEndTime).approvedLeaveIntervals;
        const leaves=facts.leaveRequests.filter((row:any)=>obligation.source.leaveRequestIds.includes(row.id));
        if(leaves.some((row:any)=>!Array.isArray(row.approvedLeaveIntervals))) blockedReasons.push('CONTEXT_REQUIRES_REVIEW');
        approvedLeaveIntervals=leaves.flatMap((row:any)=>row.approvedLeaveIntervals??[]);
        for(const removed of approvedLeaveIntervals) requiredWorkingIntervals=requiredWorkingIntervals.flatMap(a=>removed.to<=a.from||removed.from>=a.to?[a]:[...(removed.from>a.from?[{from:a.from,to:removed.from}]:[]),...(removed.to<a.to?[{from:removed.to,to:a.to}]:[])]);
        for(const override of overrides){
          if(!Array.isArray(override.requiredWorkingIntervals)){blockedReasons.push('CONTEXT_REQUIRES_REVIEW');continue;}
          requiredWorkingIntervals=requiredWorkingIntervals.flatMap(a=>override.requiredWorkingIntervals.map((b:any)=>({from:a.from>b.from?a.from:b.from,to:a.to<b.to?a.to:b.to}))).filter(a=>a.from<a.to);
        }
      }
    }
    const punches={checkInAt:day?.checkInAt?new Date(day.checkInAt).toISOString():undefined,checkOutAt:day?.checkOutAt?new Date(day.checkOutAt).toISOString():undefined,checkInProvenance:day?.checkInProvenance??{source:'LEGACY_UNKNOWN'},checkOutProvenance:day?.checkOutProvenance??{source:'LEGACY_UNKNOWN'}};
    const proposal=proposeAttendanceConfirmation({workDate,requiredWorkingIntervals,gracePeriodMinutes:shift?.gracePeriodMinutes??0,...punches,blockedReasons:blockedReasons.filter(code=>!['MONTHLY_CONFIRMATION_LIMIT_EXCEEDED','PERIOD_REQUIRED','PERIOD_CLOSED_OR_PAYROLL_CLAIMED','ATTENDANCE_CONFIRMATION_PAST_DATE_REQUIRED'].includes(code))});
    const policyRef=policy?{id:String(policy._id),version:policy.version,effectiveFrom:policy.effectiveFrom,effectiveTo:policy.effectiveTo,maxMonthlyAttendanceConfirmations:limit}:null;
    if(obligation){delete obligation.source.overtimeResultIds;delete obligation.source.overtimeEvidence;}
    overrides.sort((a:any,b:any)=>String(a._id).localeCompare(String(b._id)));
    const snapshot={workDate,employeeProfileId:facts.employees[0]?.employeeProfileId,departmentId:obligation?.departmentId,source:obligation?.source,shift:shift?{id:String(shift._id??shift.id),startTime:shift.startTime,endTime:shift.endTime,breakMinutes:shift.breakMinutes,breakStartTime:shift.breakStartTime,breakEndTime:shift.breakEndTime,gracePeriodMinutes:shift.gracePeriodMinutes,updatedAt:shift.updatedAt}:null,requiredWorkingIntervals,approvedLeaveIntervals,punches,policyRef,overrides:overrides.map((o:any)=>({id:String(o._id),updatedAt:o.updatedAt,requiredWorkingIntervals:o.requiredWorkingIntervals})),proposedChanges:proposal};
    const contextHash=createHash('sha256').update(JSON.stringify(stable(snapshot))).digest('hex');
    return {enabled:true,workDate,obligation:{shiftLabel:shift?.name,breakMinutes:shift?.breakMinutes??0,leaveMinutes:proposal.calculation?.approvedLeaveMinutes??0,requiredWorkingIntervals:requiredWorkingIntervals.map(interval=>({from:new Date(vnTimeToUtc(workDate,interval.from)).toISOString(),to:new Date(vnTimeToUtc(workDate,interval.to)).toISOString()}))},canSubmit:proposal.blockedReasons.length===0&&blockedReasons.length===0,blockedReasons:[...new Set([...blockedReasons,...proposal.blockedReasons])],actionType:proposal.actionType,existingPunches:punches,proposedChanges:proposal,requiredWorkingIntervals,approvedLeaveIntervals,quota:{monthKey,usedSlots,limit:limit??null,remaining:Number.isInteger(limit)?Math.max(0,limit-usedSlots):0,policyRef},period:period?{id:String(period._id),status:period.status,canMutate:period.status!=='CLOSED'&&!period.payrollRunId}:null,contextHash,snapshot};
  }
}
