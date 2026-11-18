import { ConflictException, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { ClientSession, Types } from 'mongoose';
import { buildPeriodObligationProjection } from '../timesheet/period-obligation.service';
import { calculateLeaveDay } from '../leave/leave.service';
import { LeaveDurationType } from '../../database/schemas/enums';
import { vnTimeToUtc } from '../../common/vietnam-time';
import { evaluateWorkCreditDay } from '../policies/work-credit-domain';
import { proposeAttendanceConfirmation } from './attendance-confirmation-domain';
import { closeSiblingRequests } from './close-sibling-requests';
export const CONFIRMATION_MODELS = 'CONFIRMATION_MODELS';
function stable(value:any):any {if(value instanceof Date)return value.toISOString();if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])]));return value;}
const read = (query: any, session?: ClientSession): Promise<any> => query.session(session ?? null).lean();
function minutesBetween(from: string, to: string): number {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  return (th * 60 + tm) - (fh * 60 + fm);
}
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
        const isSelfApproved = String(current.employeeUserId) === managerId;
        // SRS BR-SELF-APPROVAL-01: no self-decision, rejected before any write.
        if (isSelfApproved) throw new ForbiddenException('SELF_APPROVAL_FORBIDDEN');
        const auditNote = isSelfApproved ? 'Quản lý tự duyệt (Self-approved) - Lưu vết kiểm toán cho HR hậu kiểm' : undefined;
        await m.scope.requireReviewDepartment(org,managerId,String(current.departmentId));
        if(current.confirmationDecision?.operationId===operationId){if(current.confirmationDecision.operationHash!==operationHash)throw new ConflictException('REQUEST_STATE_CHANGED');result=current;return;}
        if(current.status!=='PENDING'||current.version!==expectedVersion)throw new ConflictException('REQUEST_STATE_CHANGED');
        const workDate=new Date(current.workDate).toISOString().slice(0,10);
        let preview:any;
        if(status==='APPROVED'){
          preview=await this.preview(org,String(current.employeeUserId),workDate,session);
          const isContextValid = preview.contextHash === current.confirmationContextHash || Boolean(
            current.confirmationSnapshot &&
            (current.confirmationSnapshot.punches?.checkInAt ?? undefined) === (preview.existingPunches?.checkInAt ?? undefined) &&
            (current.confirmationSnapshot.punches?.checkOutAt ?? undefined) === (preview.existingPunches?.checkOutAt ?? undefined),
          );
          if(!isContextValid)throw new ConflictException('ATTENDANCE_CONFIRMATION_STALE');
          const blockers=preview.blockedReasons.filter((code:string)=>code!=='MONTHLY_CONFIRMATION_LIMIT_EXCEEDED');
          if(blockers.length)throw new ConflictException(blockers[0]);
        }
        let claim: any = null;
        if (m.periodVersion?.claimForWorkDate) {
          try {
            claim = await m.periodVersion.claimForWorkDate(org, workDate, session);
          } catch (e: any) {
            const msg = e?.response?.message || e?.message;
            if (msg !== 'PERIOD_REQUIRED') throw e;
          }
        }
        const row=await m.requests.findOneAndUpdate({_id:id,organizationId:org,status:'PENDING',version:expectedVersion,confirmationSlotActive:true},{$set:{
          status,
          reviewedBy:managerId,
          reviewedAt:new Date(),
          reviewComment:reason?.trim(),
          confirmationSlotActive:status==='APPROVED',
          isSelfApproved,
          auditTag: isSelfApproved ? 'SELF_APPROVED' : undefined,
          auditNote,
          confirmationDecision:{
            operationId,
            operationHash,
            audit:{
              requestId:id,
              actorId:managerId,
              reason:reason?.trim(),
              decidedAt:new Date(),
              synthetic:status==='APPROVED',
              isSelfApproved,
              auditTag: isSelfApproved ? 'SELF_APPROVED' : undefined,
              auditNote,
              before:preview?.existingPunches??current.confirmationSnapshot?.punches,
              after:preview?{checkInAt:preview.proposedChanges.checkInAt,checkOutAt:preview.proposedChanges.checkOutAt,...preview.proposedChanges.calculation}:undefined,
              sourceRefs:preview?.snapshot?.source??current.confirmationSnapshot?.source,
              contextHash:current.confirmationContextHash
            }
          }
        },$inc:{version:1}},{new:true,session}).session(session).lean();
        if(!row)throw new ConflictException('REQUEST_STATE_CHANGED');
        if(status==='APPROVED'){
          const filter:any={organizationId:org,employeeId:current.employeeUserId,workDate,checkInAt:preview.existingPunches.checkInAt?new Date(preview.existingPunches.checkInAt):null,checkOutAt:preview.existingPunches.checkOutAt?new Date(preview.existingPunches.checkOutAt):null};
          const before=await read(m.days.findOne({organizationId:org,employeeId:current.employeeUserId,workDate}),session);
          const set:any={...preview.proposedChanges.calculation,...(claim?.periodId ? { periodId: claim.periodId } : {}),attendanceStatus:'COMPLETED',overallApprovalStatus:'APPROVED',dayResult:'PRESENT',shiftSnapshot:{...preview.snapshot.shift,requiredWorkingIntervals:preview.requiredWorkingIntervals,approvedLeaveIntervals:preview.approvedLeaveIntervals}};
          const events:any[]=[];
          const bothPunchesExistWithoutCustom = Boolean(
            preview.existingPunches?.checkInAt &&
            preview.existingPunches?.checkOutAt &&
            !(current.requestedStart || current.metadata?.customCheckInTime) &&
            !(current.requestedEnd || current.metadata?.customCheckOutTime),
          );
          for(const [field,eventType] of [['checkInAt','CHECK_IN'],['checkOutAt','CHECK_OUT']]){
            const customValue = field === 'checkInAt'
              ? (current.requestedStart || current.metadata?.customCheckInTime)
              : (current.requestedEnd || current.metadata?.customCheckOutTime);
            const customTime = customValue ? new Date(customValue) : null;
            if (!customTime && preview.existingPunches[field] && !bothPunchesExistWithoutCustom) continue;
            const eventId=new Types.ObjectId();
            const isActual = Boolean(customTime);
            const fallbackScheduleTime = field === 'checkInAt'
              ? new Date(vnTimeToUtc(workDate, preview.requiredWorkingIntervals?.[0]?.from || '08:00'))
              : new Date(vnTimeToUtc(workDate, preview.requiredWorkingIntervals?.[preview.requiredWorkingIntervals.length - 1]?.to || '17:00'));
            set[field] = customTime || (bothPunchesExistWithoutCustom ? fallbackScheduleTime : new Date(preview.proposedChanges[field]));
            const source = isActual ? 'CONFIRMED_ACTUAL' : 'CONFIRMED_SCHEDULE';
            set[field==='checkInAt'?'checkInProvenance':'checkOutProvenance']={source,requestId:id,eventId};
            events.push({
              _id:eventId,
              organizationId:org,
              employeeId:current.employeeUserId,
              eventType,
              method:'MANUAL',
              recordedAt:set[field],
              approvalStatus:'APPROVED',
              validationStatus:'VALID',
              requestId:id,
              provenance:{
                source,
                requestId:id,
                eventId,
                ...(isSelfApproved ? { isSelfApproved: true, auditTag: 'SELF_APPROVED' } : {}),
              },
              note: isSelfApproved ? `[TỰ DUYỆT] ${current.reason || ''}`.trim() : current.reason,
            });
          }
          const finalIn = set.checkInAt ?? (preview.existingPunches?.checkInAt ? new Date(preview.existingPunches.checkInAt) : null);
          const finalOut = set.checkOutAt ?? (preview.existingPunches?.checkOutAt ? new Date(preview.existingPunches.checkOutAt) : null);
          if (finalIn && finalOut) {
            if (new Date(finalIn) >= new Date(finalOut)) throw new ConflictException('TIME_WINDOW_INVALID');
            if (set.checkInAt && set.checkOutAt) {
              const breakMinutes = Number(preview.snapshot?.shift?.breakMinutes ?? 60);
              set.workingMinutes = Math.max(0, Math.floor((new Date(set.checkOutAt).getTime() - new Date(set.checkInAt).getTime()) / 60000) - breakMinutes);
            }
          }
          let day=await m.days.findOneAndUpdate(filter,{$set:set,$setOnInsert:{organizationId:org,employeeId:current.employeeUserId,workDate}},{new:true,upsert:!before,session}).session(session).lean();
          if(!day && before?._id){
            day=await m.days.findOneAndUpdate({_id:before._id,organizationId:org},{$set:set},{new:true,session}).session(session).lean();
          }
          if(!day)throw new ConflictException('ATTENDANCE_CONFIRMATION_STALE');
          if (events.length > 0) {
            if (typeof m.events.deleteMany === 'function') {
              await m.events.deleteMany(
                { organizationId: org, attendanceDayId: day._id, eventType: { $in: events.map((e: any) => e.eventType) } },
                { session },
              );
            }
            await m.events.create(events.map(event=>({...event,attendanceDayId:day._id})),{session,ordered:true});
          }
          // QC 2.4 — the day is complete; nothing else may stay actionable on it.
          await closeSiblingRequests(m.requests,{organizationId:org,attendanceDayId:day._id,reason:'ATTENDANCE_CONFIRMED',session});
        }else{
          const released=await m.quotas.updateOne({organizationId:org,employeeUserId:current.employeeUserId,monthKey:current.confirmationMonthKey,usedSlots:{$gt:0}},{$inc:{usedSlots:-1}},{session});
          if(released.modifiedCount!==1)throw new ConflictException('CONFIRMATION_QUOTA_INCONSISTENT');
        }
        await m.audit.create([{
          organizationId:org,
          approvalRequestId:id,
          actorId:managerId,
          action:status,
          previousStatus:'PENDING',
          newStatus:status,
          comment:reason,
          isSelfApproved,
          auditTag: isSelfApproved ? 'SELF_APPROVED' : undefined,
        }],{session});
        result=row;changed=true;
      });
      if(changed){try{m.notify?.notifyApprovalDecision(String(result.employeeUserId),{requestId:id,type:'ATTENDANCE',status,organizationId:org,reviewedBy:managerId,reviewComment:reason,departmentId:String(result.departmentId),workDate:result.workDate});}catch{/* Commit is authoritative. */}}
      return result;
    } catch (error: any) {
      if (error instanceof ConflictException || error instanceof ForbiddenException || error?.status) throw error;
      throw new ConflictException(`ATTENDANCE_CONFIRMATION_DECIDE_FAILED: ${error?.message || 'Không thể xử lý phê duyệt đơn xác nhận công.'}`);
    } finally {await session.endSession();}
  }

  async create(org:string,userId:string,dto:any,key?:string) {
    if (!key || key.length>128 || !/^[\x21-\x7e]+$/.test(key)) throw new ConflictException('IDEMPOTENCY_KEY_REQUIRED');
    const allowed=['requestKind','type','workDate','reason','previewHash','customCheckOutTime','customCheckInTime'];
    const extraKeys = Object.keys(dto).filter(k => dto[k] !== undefined && !allowed.includes(k));
    if (extraKeys.length) {
      throw new ConflictException(`ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: Yêu cầu chứa các trường không hợp lệ: ${extraKeys.join(', ')}`);
    }
    if (dto.type !== 'ATTENDANCE') {
      throw new ConflictException('ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: Loại yêu cầu (type) phải là ATTENDANCE.');
    }
    if (dto.requestKind !== 'ATTENDANCE_CONFIRMATION') {
      throw new ConflictException('ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: Kiểu yêu cầu (requestKind) phải là ATTENDANCE_CONFIRMATION.');
    }
    if (!dto.workDate || !/^\d{4}-\d{2}-\d{2}$/.test(dto.workDate)) {
      throw new ConflictException('ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: Ngày làm việc không hợp lệ (định dạng YYYY-MM-DD).');
    }
    if (typeof dto.reason !== 'string' || !dto.reason.trim()) {
      throw new ConflictException('ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: Vui lòng nhập lý do xác nhận công.');
    }
    if (dto.reason.trim().length < 10) {
      throw new ConflictException(`ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: Lý do xác nhận công quá ngắn (hiện có ${dto.reason.trim().length} ký tự, tối thiểu 10 ký tự).`);
    }
    if (dto.reason.trim().length > 1000) {
      throw new ConflictException(`ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: Lý do xác nhận công vượt quá giới hạn (hiện có ${dto.reason.trim().length} ký tự, tối đa 1000 ký tự).`);
    }
    if (typeof dto.previewHash !== 'string' || !dto.previewHash.trim()) {
      throw new ConflictException('ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: Thiếu mã xác thực xem trước (previewHash). Vui lòng bấm "Tải lại xem trước".');
    }
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
          // QC 1.2 — the employee may correct either endpoint, not just check-out.
          const customCheckIn=dto.customCheckInTime?new Date(dto.customCheckInTime):null;
          const customCheckOut=dto.customCheckOutTime?new Date(dto.customCheckOutTime):null;
          const effectiveIn=customCheckIn??(preview.existingPunches?.checkInAt?new Date(preview.existingPunches.checkInAt):preview.proposedChanges?.checkInAt?new Date(preview.proposedChanges.checkInAt):null);
          const effectiveOut=customCheckOut??(preview.existingPunches?.checkOutAt?new Date(preview.existingPunches.checkOutAt):preview.proposedChanges?.checkOutAt?new Date(preview.proposedChanges.checkOutAt):null);
          if(effectiveIn&&effectiveOut&&effectiveIn>=effectiveOut)throw new ConflictException('TIME_WINDOW_INVALID');
          if (m.periodVersion?.claimForWorkDate) {
            try {
              await m.periodVersion.claimForWorkDate(org, dto.workDate, session);
            } catch (e: any) {
              const msg = e?.response?.message || e?.message;
              if (msg !== 'PERIOD_REQUIRED') throw e;
            }
          }
          const quotaIdentity={organizationId:org,employeeUserId:userId,monthKey:preview.quota.monthKey};
          await m.quotas.updateOne(quotaIdentity,{$setOnInsert:{...quotaIdentity,usedSlots:0}},{upsert:true,session});
          const slot=await m.quotas.findOneAndUpdate({...quotaIdentity,usedSlots:{$lt:preview.quota.limit}},{$inc:{usedSlots:1}},{new:true,session}).session(session).lean();
          if(!slot)throw new ConflictException('MONTHLY_CONFIRMATION_LIMIT_EXCEEDED');
          const [row]=await m.requests.create([{...identity,employeeId:preview.snapshot.employeeProfileId,departmentId:preview.snapshot.departmentId,type:'ATTENDANCE',workDate:new Date(`${dto.workDate}T00:00:00Z`),reason:payload.reason,status:'PENDING',version:1,confirmationSlotActive:true,confirmationMonthKey:preview.quota.monthKey,confirmationPayloadHash:payloadHash,confirmationContextHash:preview.contextHash,confirmationSnapshot:preview.snapshot,requestedStart:dto.customCheckInTime?new Date(dto.customCheckInTime):undefined,requestedEnd:dto.customCheckOutTime?new Date(dto.customCheckOutTime):undefined,metadata:{adjustmentSource:'ATTENDANCE_CONFIRMATION',actionType:preview.actionType,customCheckInTime:dto.customCheckInTime,customCheckOutTime:dto.customCheckOutTime}}],{session});
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
    const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    if (workDate > todayVN) {
      blockedReasons.push('ATTENDANCE_CONFIRMATION_FUTURE_DATE_FORBIDDEN');
    }
    const instant = new Date(`${workDate}T00:00:00Z`);
    const periods = await read(m.periods.find({
      organizationId: org,
      active: true,
      $or: [
        { period: monthKey },
        { startDate: { $lte: instant }, endDate: { $gte: instant } },
      ],
    }), session);
    const period = periods.find((p: any) => p.period === monthKey) || (periods.length === 1 ? periods[0] : null);
    if (!period) {
      if (periods.length > 1) blockedReasons.push('CONTEXT_REQUIRES_REVIEW');
    } else {
      if (period.status === 'CLOSED' || period.payrollRunId) {
        blockedReasons.push('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
      }
      const ackModel = m.acknowledgements || (m.requests?.db?.model ? m.requests.db.model('EmployeeTimesheetAcknowledgement') : null);
      if (ackModel) {
        const userObjId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;
        const periodObjId = Types.ObjectId.isValid(String(period._id)) ? new Types.ObjectId(String(period._id)) : period._id;
        const orgObjId = Types.ObjectId.isValid(org) ? new Types.ObjectId(org) : org;
        const latestAck = await read(ackModel.findOne({
          $or: [
            { organizationId: orgObjId, periodId: periodObjId, userId: userObjId },
            { organizationId: org, periodId: String(period._id), userId },
            { organizationId: orgObjId, periodId: String(period._id), userId: userObjId },
          ],
        }).sort({ actedAt: -1 }), session);
        if (latestAck?.action === 'ACKNOWLEDGED') {
          blockedReasons.push('TIMESHEET_ALREADY_ACKNOWLEDGED');
        }
      }
    }
    const payrollRunModel = m.payrollRuns || (m.requests?.db?.model ? m.requests.db.model('PayrollRun') : null);
    if (payrollRunModel && !blockedReasons.includes('PERIOD_CLOSED_OR_PAYROLL_CLAIMED')) {
      const orgObjId = Types.ObjectId.isValid(org) ? new Types.ObjectId(org) : org;
      const altLabel = `${monthKey.slice(5, 7)}/${monthKey.slice(0, 4)}`;
      const periodObjId = period?._id ? (Types.ObjectId.isValid(String(period._id)) ? new Types.ObjectId(String(period._id)) : period._id) : null;
      const existingRun = await read(payrollRunModel.findOne({
        organizationId: { $in: [orgObjId, org] },
        status: { $nin: ['CANCELLED', 'DISCARDED'] },
        $or: [
          { periodLabel: { $in: [monthKey, altLabel] } },
          ...(periodObjId ? [{ timesheetPeriodId: { $in: [periodObjId, String(period._id)] } }] : []),
        ],
      }), session);
      if (existingRun) {
        blockedReasons.push('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
      }
    }
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
    if (requiredWorkingIntervals.length === 0) {
      if (shift && shift.startTime && shift.endTime && shift.startTime < shift.endTime) {
        requiredWorkingIntervals = [{ from: shift.startTime, to: shift.endTime }];
      } else {
        requiredWorkingIntervals = [{ from: '08:00', to: '12:00' }, { from: '13:00', to: '17:00' }];
      }
    }
    let checkInAt = day?.checkInAt ? new Date(day.checkInAt).toISOString() : undefined;
    let checkOutAt = day?.checkOutAt ? new Date(day.checkOutAt).toISOString() : undefined;
    if (!checkInAt && day?.checkInProvenance?.eventId && m.events) {
      const inEvt = await read(m.events.findOne({ _id: day.checkInProvenance.eventId }), session);
      if (inEvt?.recordedAt) checkInAt = new Date(inEvt.recordedAt).toISOString();
    }
    if (!checkOutAt && day?.checkOutProvenance?.eventId && m.events) {
      const outEvt = await read(m.events.findOne({ _id: day.checkOutProvenance.eventId }), session);
      if (outEvt?.recordedAt) checkOutAt = new Date(outEvt.recordedAt).toISOString();
    }
    const punches={checkInAt,checkOutAt,checkInProvenance:day?.checkInProvenance??{source:'LEGACY_UNKNOWN'},checkOutProvenance:day?.checkOutProvenance??{source:'LEGACY_UNKNOWN'}};
    if (punches.checkInAt && punches.checkOutAt) {
      const scheduledObligation = obligation?.scheduledObligationMinutes ?? (shift ? Math.max(0, minutesBetween(shift.startTime, shift.endTime) - (shift.breakMinutes ?? 60)) : 480);
      if (scheduledObligation > 0) {
        let isFullCredit = false;
        let wcPolicy: any = null;
        try {
          if (m.policyRules?.workCreditAt) {
            wcPolicy = await m.policyRules.workCreditAt(org, new Date(`${workDate}T12:00:00.000Z`), session);
          }
        } catch {}

        const shiftBreak = shift?.breakMinutes ?? 60;
        const workedMinutes = day?.workingMinutes ?? Math.max(0, Math.floor((new Date(punches.checkOutAt).getTime() - new Date(punches.checkInAt).getTime()) / 60000) - shiftBreak);
        const payableLeaveMinutes = obligation?.payableLeaveMinutes ?? (day?.approvedLeaveMinutes ?? 0);

        if (wcPolicy) {
          try {
            const evalResult = evaluateWorkCreditDay(wcPolicy, {
              scheduledObligationMinutes: scheduledObligation,
              workedScheduledMinutes: Math.min(scheduledObligation, workedMinutes),
              payableLeaveMinutes,
              unpaidLeaveMinutes: obligation?.unpaidLeaveMinutes ?? 0,
              dayType: 'SCHEDULED',
              incompleteState: 'COMPLETE',
            });
            if (evalResult.workCredit === 1) {
              isFullCredit = true;
            }
          } catch {}
        }

        if (!isFullCredit && (workedMinutes + payableLeaveMinutes) >= scheduledObligation) {
          isFullCredit = true;
        }

        if (isFullCredit) {
          blockedReasons.push('ALREADY_FULL_WORK_CREDIT');
        }
      }
    }
    let proposal: any = proposeAttendanceConfirmation({workDate,requiredWorkingIntervals,gracePeriodMinutes:shift?.gracePeriodMinutes??0,...punches,blockedReasons:blockedReasons.filter(code=>!['MONTHLY_CONFIRMATION_LIMIT_EXCEEDED','PERIOD_REQUIRED','PERIOD_CLOSED_OR_PAYROLL_CLAIMED','TIMESHEET_ALREADY_ACKNOWLEDGED','ALREADY_FULL_WORK_CREDIT','ATTENDANCE_CONFIRMATION_FUTURE_DATE_FORBIDDEN','ATTENDANCE_CONFIRMATION_PAST_DATE_REQUIRED','ALREADY_COMPLETE','NO_WORK_OBLIGATION'].includes(code))});
    if (proposal.blockedReasons?.includes('ALREADY_COMPLETE')) {
      proposal = {
        actionType: 'FULL_DAY',
        blockedReasons: [],
        checkInAt: punches.checkInAt!,
        checkOutAt: punches.checkOutAt!,
        calculation: proposal.calculation ?? { workingMinutes: 480 },
      };
    }
    if (!proposal.checkInAt) {
      proposal.checkInAt = new Date(vnTimeToUtc(workDate, requiredWorkingIntervals[0]?.from || '08:00')).toISOString();
    }
    if (!proposal.checkOutAt) {
      proposal.checkOutAt = new Date(vnTimeToUtc(workDate, requiredWorkingIntervals[requiredWorkingIntervals.length - 1]?.to || '17:00')).toISOString();
    }
    if (!proposal.actionType) {
      proposal.actionType = punches.checkInAt ? 'CHECK_OUT' : punches.checkOutAt ? 'CHECK_IN' : 'FULL_DAY';
    }
    const policyRef=policy?{id:String(policy._id),version:policy.version,effectiveFrom:policy.effectiveFrom,effectiveTo:policy.effectiveTo,maxMonthlyAttendanceConfirmations:limit}:null;
    if(obligation){delete obligation.source.overtimeResultIds;delete obligation.source.overtimeEvidence;}
    overrides.sort((a:any,b:any)=>String(a._id).localeCompare(String(b._id)));
    const snapshot={workDate,employeeProfileId:facts.employees[0]?.employeeProfileId,departmentId:obligation?.departmentId,source:obligation?.source,shift:shift?{id:String(shift._id??shift.id),startTime:shift.startTime,endTime:shift.endTime,breakMinutes:shift.breakMinutes,breakStartTime:shift.breakStartTime,breakEndTime:shift.breakEndTime,gracePeriodMinutes:shift.gracePeriodMinutes,updatedAt:shift.updatedAt}:null,requiredWorkingIntervals,approvedLeaveIntervals,punches,policyRef,overrides:overrides.map((o:any)=>({id:String(o._id),updatedAt:o.updatedAt,requiredWorkingIntervals:o.requiredWorkingIntervals})),proposedChanges:proposal};
    const contextHash=createHash('sha256').update(JSON.stringify(stable(snapshot))).digest('hex');
    const hardBlockers = ['ATTENDANCE_CONFIRMATION_FUTURE_DATE_FORBIDDEN', 'PERIOD_CLOSED_OR_PAYROLL_CLAIMED', 'TIMESHEET_ALREADY_ACKNOWLEDGED', 'ALREADY_FULL_WORK_CREDIT', 'MONTHLY_CONFIRMATION_LIMIT_EXCEEDED', 'POLICY_CONFIGURATION_REQUIRED'];
    const activeBlockers = [...new Set([...blockedReasons, ...(proposal.blockedReasons ?? [])])].filter(c => hardBlockers.includes(c));
    const canMutatePeriod = (!period || (period.status !== 'CLOSED' && !period.payrollRunId)) && !blockedReasons.includes('PERIOD_CLOSED_OR_PAYROLL_CLAIMED');
    return {enabled:true,workDate,obligation:{shiftLabel:shift?.name||'Ca hành chính (08:00 – 17:00)',breakMinutes:shift?.breakMinutes??60,leaveMinutes:proposal.calculation?.approvedLeaveMinutes??0,requiredWorkingIntervals:requiredWorkingIntervals.map(interval=>({from:new Date(vnTimeToUtc(workDate,interval.from)).toISOString(),to:new Date(vnTimeToUtc(workDate,interval.to)).toISOString()}))},canSubmit:activeBlockers.length===0,blockedReasons:activeBlockers,actionType:proposal.actionType,existingPunches:punches,proposedChanges:proposal,requiredWorkingIntervals,approvedLeaveIntervals,quota:{monthKey,usedSlots,limit:limit??null,remaining:Number.isInteger(limit)?Math.max(0,limit-usedSlots):0,policyRef},period:{id:period?String(period._id):null,status:period?period.status:'OPEN',canMutate:canMutatePeriod},contextHash,previewHash:contextHash,snapshot};
  }
}
