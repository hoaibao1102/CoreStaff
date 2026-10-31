import {ConflictException,ForbiddenException,Injectable,NotFoundException,Optional} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';import {ClientSession,Model} from 'mongoose';
import {ManagerRequestDocument} from '../../database/schemas/manager-request.schema';
import {EmployeeProfileDocument} from '../../database/schemas/employee-profile.schema';
import {CreateManagerRequestDto} from './dto/manager-request.dto';import {ManagerScopeService} from './manager-scope.service';
import {EventsGateway} from '../../events/events.gateway';
import {dateOnly} from '../../common/date-only';
import {AttendanceConfirmationService} from './attendance-confirmation.service';
import {parseWindowInstant} from '../../common/vietnam-time';
import {OvertimeService} from '../overtime/overtime.service';
import {PeriodVersionService} from '../timesheet/period-version.service';
import {EmployeeAssignmentDocument} from '../../database/schemas/assignment.schema';
import {AttendanceApprovalStatus,AttendanceEventType,AttendanceMethod,AttendanceStatus,DayResult} from '../../database/schemas/enums';
@Injectable()
export class ManagerRequestService {
  constructor(
    @InjectModel('ManagerRequest') private readonly requests: Model<ManagerRequestDocument>,
    @InjectModel('EmployeeProfile') private readonly employees: Model<EmployeeProfileDocument>,
    @InjectModel('AttendanceDay') private readonly attendanceDays: Model<any>,
    @InjectModel('AttendanceEvent') private readonly attendanceEvents: Model<any>,
    private readonly scope: ManagerScopeService,
    private readonly periodVersion: PeriodVersionService,
    @Optional() private readonly eventsGateway?: EventsGateway,
    // TASK-068/070 — last so the existing spec's five positional args keep working.
    @Optional() private readonly ot?: OvertimeService,
    // Optional and last so older unit-test constructors remain compatible.
    @Optional() @InjectModel('Assignment') private readonly employeeAssignments?: Model<EmployeeAssignmentDocument>,
    @Optional() private readonly confirmation?: AttendanceConfirmationService,
  ) {}

  async attendanceConfirmationPreview(org:string,userId:string,date:string) {
    if(!this.confirmation) return {enabled:false,workDate:date,canSubmit:false,blockedReasons:['ATTENDANCE_CONFIRMATION_DISABLED']};
    try { const {snapshot,...safe}=await this.confirmation.preview(org,userId,date); return {...safe,enabled:true}; }
    catch(error:any){if(error.message==='ATTENDANCE_CONFIRMATION_DISABLED') return {enabled:false,workDate:date,canSubmit:false,blockedReasons:['ATTENDANCE_CONFIRMATION_DISABLED']}; throw error;}
  }

  async createMine(org: string, userId: string, dto: CreateManagerRequestDto, idempotencyKey?: string) {
    if ((dto as any).requestKind === 'ATTENDANCE_CONFIRMATION') {
      if (!this.confirmation) throw new ConflictException('ATTENDANCE_CONFIRMATION_DISABLED');
      return this.confirmation.create(org,userId,dto,idempotencyKey);
    }
    const emp = await this.employees.findOne({ organizationId: org, userId }).lean();
    if (!emp) throw new NotFoundException('EMPLOYEE_ASSIGNMENT_NOT_FOUND');
    const workDate = dateOnly(dto.workDate);
    const effectiveAssignment = this.employeeAssignments
      ? await this.employeeAssignments.findOne({
          organizationId: org,
          userId,
          active: true,
          $and: [
            { $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: null }, { effectiveFrom: { $lte: workDate } }] },
            { $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: workDate } }] },
          ],
        }).sort({ effectiveFrom: -1 }).lean()
      : null;
    const departmentId = effectiveAssignment?.departmentId ?? emp.departmentId;
    if (!departmentId) throw new NotFoundException('EMPLOYEE_ASSIGNMENT_NOT_FOUND');
    if (dto.type === 'ATTENDANCE') {
      await this.confirmation?.assertLegacyCreateAllowed(org);
      if (!dto.adjustmentType || !dto.requestedStart) throw new ConflictException('ATTENDANCE_ADJUSTMENT_DETAILS_REQUIRED');
      const requestedAt = new Date(dto.requestedStart);
      const requestedWorkDate = requestedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      if (Number.isNaN(requestedAt.getTime()) || requestedWorkDate !== workDate) {
        throw new ConflictException('ATTENDANCE_ADJUSTMENT_TIME_INVALID');
      }
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      if (workDate >= today) throw new ConflictException('ATTENDANCE_ADJUSTMENT_PAST_DATE_REQUIRED');
      const day: any = await this.attendanceDays.findOne({ organizationId: org, employeeId: userId, workDate }).lean();
      if (dto.adjustmentType === 'CHECK_IN' && day?.checkInAt) throw new ConflictException('CHECK_IN_ALREADY_EXISTS');
      if (dto.adjustmentType === 'CHECK_OUT' && day?.checkOutAt) throw new ConflictException('CHECK_OUT_ALREADY_EXISTS');
    }
    if (
      dto.type === 'OVERTIME' &&
      (!dto.requestedStart || !dto.requestedEnd || new Date(dto.requestedStart) >= new Date(dto.requestedEnd))
    ) {
      throw new ConflictException('OVERTIME_WINDOW_INVALID');
    }
    const { adjustmentType, ...requestData } = dto;
    const create = async (session?: ClientSession) => {
      const retro = dto.type === 'OVERTIME' ? await this.otGuards(org, userId, dto, session) : {};
      const { calculationContract, ...filing } = retro as { calculationContract?: string; isRetroactive?: boolean; retroactiveReason?: string };
      const document = {
      organizationId: org,
      employeeId: emp._id,
      employeeUserId: userId,
      departmentId,
      ...requestData,
      ...filing,
      metadata: calculationContract ? { calculationContract } : adjustmentType ? { actionType: adjustmentType, adjustmentSource: 'MANUAL_ADJUSTMENT' } : undefined,
      workDate: new Date(dto.workDate),
      requestedStart: dto.requestedStart ? new Date(dto.requestedStart) : undefined,
      requestedEnd: dto.requestedEnd ? new Date(dto.requestedEnd) : undefined,
      };
      return session ? (await this.requests.create([document], { session }))[0] : this.requests.create(document);
    };
    const row = dto.type === 'OVERTIME' && this.requests.db
      ? await this.inOtTransaction(create) : await create();

    try {
      this.eventsGateway?.notifyNewRequest(String(departmentId), {
        requestId: String(row._id),
        type: row.type,
        departmentId: String(departmentId),
        employeeUserId: userId,
        employeeName: (emp as any)?.fullName || (emp as any)?.employeeCode || 'Nhân viên',
        employeeCode: (emp as any)?.employeeCode || '',
        reason: row.reason,
        status: 'PENDING',
        createdAt: row.createdAt || new Date(),
      });
    } catch (wsErr) {
      console.warn('[ManagerRequestService] notifyNewRequest error:', wsErr);
    }

    return row.toObject();
  }

  /**
   * The guards a filing must clear (FR-OT-01 / BR-OT-04 / D39), run in the same
   * places so `POST /api/requests` and `POST /api/overtime` cannot drift apart.
   * Absent `OvertimeService` (a module that does not import it) OT filing stays
   * as permissive as it was before TASK-068, which is the point of `@Optional()`.
   *
   * The window is resolved with `parseWindowInstant`, not `new Date()`, so a
   * naive `2026-09-22T18:00:00` means 18:00 Vietnam on the work date for the
   * schedule guard too — the same reading the payable calculation uses.
   */
  private async otGuards(org: string, userId: string, dto: CreateManagerRequestDto, session?: ClientSession) {
    if (!this.ot) return {};
    this.ot.assertNoClientType(dto as unknown as Record<string, unknown>);
    const workDate = dateOnly(dto.workDate);
    // `createMine` has already refused an OVERTIME dto without both bounds.
    const window = {
      from: parseWindowInstant(dto.requestedStart!, workDate),
      to: parseWindowInstant(dto.requestedEnd!, workDate),
    };
    return this.ot.assertFilingAllowed(org, userId, window, workDate, new Date(), (dto as any).retroactiveReason, { session, previewHash: dto.previewHash });
  }

  private async inOtTransaction<T>(run: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.requests.db.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => { result = await run(session); });
      return result;
    } finally { await session.endSession(); }
  }

  async listMine(org: string, userId: string) {
    return this.requests.find({ organizationId: org, employeeUserId: userId }).sort({ createdAt: -1 }).lean();
  }

  async listForManager(org: string, managerId: string, filter: { type?: string; status?: string; departmentId?: string }) {
    const ids = await this.scope.getManagedDepartmentIds(org, managerId);
    if (filter.departmentId) await this.scope.requireDepartment(org, managerId, filter.departmentId);
    const departments = filter.departmentId ? [filter.departmentId] : ids;
    if (!departments.length) return [];
    const employeeUserIds = await this.scope.resolveEmployeeIdsForDepartments(org, departments);
    // The employee scope branch recovers pending legacy requests that were
    // stamped with a stale profile department before assignment-aware routing.
    const query: any = {
      organizationId: org,
      $or: [
        { departmentId: { $in: departments } },
        { employeeUserId: { $in: employeeUserIds } },
      ],
    };
    if (filter.type && filter.type !== 'ALL') query.type = filter.type;
    if (filter.status && filter.status !== 'ALL') query.status = filter.status;
    const rows = await this.requests.find(query)
      .populate('evidenceId')
      .populate('employeeId', 'employeeCode')
      .populate('employeeUserId', 'fullName email avatarUrl')
      .sort({ createdAt: -1 })
      .lean();
    const reviewDepartments=await this.scope.getAuthorizedReviewDepartmentIds(org,managerId);
    return rows.filter(row=>row.source!=='ATTENDANCE_CONFIRMATION'||(reviewDepartments.includes(String(row.departmentId))&&String((row.employeeUserId as any)?._id??row.employeeUserId)!==managerId));
  }

  async detail(org: string, managerId: string, id: string): Promise<any> {
    const row = await this.requests.findOne({ _id: id, organizationId: org })
      .populate('evidenceId')
      .populate('employeeId', 'employeeCode')
      .populate('employeeUserId', 'fullName email avatarUrl')
      .lean();
    if (!row) throw new NotFoundException('REQUEST_NOT_FOUND');
    if(row.source==='ATTENDANCE_CONFIRMATION') {
      const employee=String((row.employeeUserId as any)?._id??row.employeeUserId);
      if(employee===managerId)throw new ForbiddenException('SELF_APPROVAL_FORBIDDEN');
      await this.scope.requireReviewDepartment(org,managerId,String(row.departmentId));
      if(!this.confirmation)return {...row,canApprove:false,contextValidity:{valid:false}};
      try {
        const {snapshot,...confirmation}=await this.confirmation.preview(org,employee,new Date(row.workDate).toISOString().slice(0,10));
        const valid=confirmation.contextHash===row.confirmationContextHash;
        const blockers=confirmation.blockedReasons.filter(code=>code!=='MONTHLY_CONFIRMATION_LIMIT_EXCEEDED');
        return {...row,confirmation:{...confirmation,enabled:true},canApprove:row.status==='PENDING'&&valid&&blockers.length===0&&confirmation.period?.canMutate===true,contextValidity:{valid}};
      }catch(error:any){return {...row,canApprove:false,contextValidity:{valid:false},confirmation:{enabled:false,canSubmit:false,blockedReasons:[error.message]}};}

    }
    try {
      await this.scope.requireDepartment(org, managerId, String(row.departmentId));
    } catch (error) {
      const populatedEmployeeUser: any = row.employeeUserId;
      const employeeUserId = String(populatedEmployeeUser?._id ?? populatedEmployeeUser);
      if (!await this.scope.isEmployeeInManagedScope(org, managerId, employeeUserId)) throw error;
    }
    return row;
  }

  async decide(
    org: string,
    managerId: string,
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED',
    expectedVersion: number,
    reason?: string,
    approvedStart?: string,
    approvedEnd?: string,
    operationId?: string,
  ) {
    const current: any = await this.detail(org, managerId, id);
    if (current.source === 'ATTENDANCE_CONFIRMATION') {
      if (approvedStart !== undefined || approvedEnd !== undefined) throw new ConflictException('ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID');
      if (!this.confirmation) throw new ConflictException('ATTENDANCE_CONFIRMATION_DISABLED');
      return this.confirmation.decide(org,managerId,id,status,expectedVersion,operationId,reason);
    }
    const currentEmpUserId = String(
      (current.employeeUserId?._id ?? current.employeeUserId) ||
      (current.employeeId?._id ?? current.employeeId)
    );
    if (currentEmpUserId === String(managerId)) throw new ForbiddenException('SELF_APPROVAL_FORBIDDEN');
    if ((status === 'REJECTED' || status === 'CLARIFICATION_REQUESTED') && (!reason || reason.trim().length < 10)) {
      throw new ConflictException('REVIEW_REASON_REQUIRED');
    }
    if (current.type === 'OVERTIME' && status === 'APPROVED' && approvedStart && approvedEnd && new Date(approvedStart) >= new Date(approvedEnd)) {
      throw new ConflictException('OVERTIME_WINDOW_INVALID');
    }
    if (current.type === 'ATTENDANCE' && this.requests.db) {
      return this.decideAttendance(org, managerId, id, status, expectedVersion, reason, current);
    }
    // TASK-069/070 — the decision the calculator will see, before it is written.
    const asOt = current.type === 'OVERTIME' && status === 'APPROVED' && this.ot
      // `detail()` populates employeeUserId, so the id has to be unwrapped the same
      // way the two lines above do it; `otEmployeeUserId` handles both shapes.
      ? { ...current, _id: id, approvedStart: approvedStart ? new Date(approvedStart) : current.approvedStart, approvedEnd: approvedEnd ? new Date(approvedEnd) : current.approvedEnd }
      : null;
    // §30B.2 BLOCK lands here, deliberately *before* the update: a rejected
    // approval must leave status and version untouched so the manager's queue
    // does not show a decision that never happened.
    let otRow: any;
    let precheck: Awaited<ReturnType<OvertimeService['precheckApproval']>> | undefined;
    if (asOt && this.requests.db) {
      otRow = await this.inOtTransaction(async session => {
        const fresh = await this.requests.findOne({ _id: id, organizationId: org }).session(session).lean();
        if (!fresh || fresh.status !== 'PENDING' || fresh.version !== expectedVersion) throw new ConflictException('REQUEST_STATE_CHANGED');
        const candidate = { ...fresh, approvedStart: asOt.approvedStart, approvedEnd: asOt.approvedEnd };
        await this.ot!.claimApproval(org, candidate, session);
        precheck = await this.ot!.precheckApproval(org, candidate, session);
        const updated = await this.requests.findOneAndUpdate(
          { _id: id, organizationId: org, status: 'PENDING', version: expectedVersion },
          { $set: { status, reviewedBy: managerId, reviewComment: reason, reviewedAt: new Date(), approvedStart: candidate.approvedStart, approvedEnd: candidate.approvedEnd }, $inc: { version: 1 } },
          { new: true, session },
        ).lean();
        if (!updated) throw new ConflictException('REQUEST_STATE_CHANGED');
        await this.ot!.onApproved(org, candidate, session);
        return updated;
      });
    } else if (asOt) precheck = await this.ot!.precheckApproval(org, asOt);
    if (current.type === 'ATTENDANCE' && current.metadata?.adjustmentSource === 'MANUAL_ADJUSTMENT' && status === 'APPROVED') {
      await this.assertAttendanceAdjustmentCanApply(org, current);
    }
    const row: any = otRow ?? await this.requests
      .findOneAndUpdate(
        { _id: id, organizationId: org, status: 'PENDING', version: expectedVersion },
        {
          $set: {
            status,
            reviewedBy: managerId,
            reviewComment: reason,
            reviewedAt: new Date(),
            approvedStart: approvedStart ? new Date(approvedStart) : undefined,
            approvedEnd: approvedEnd ? new Date(approvedEnd) : undefined,
          },
          $inc: { version: 1 },
        },
        { new: true },
      )
      .lean();
    if (!row) throw new ConflictException('REQUEST_STATE_CHANGED');

    // Real model-backed OT approvals already committed decision, shared claims
    // and result atomically above. The fallback supports isolated legacy fakes
    // without a Mongoose connection; it is never the production write path.
    if (asOt && !otRow) {
      await this.ot!.onApproved(org, { ...asOt, _id: id, status: 'APPROVED', reviewedBy: managerId });
    }

    // §30B.2 — a WARNING never blocks, so it has to be loud instead: on the
    // response for the approver's UI, and over WS for the three accountable people.
    if (precheck?.labor.violations.length) {
      try {
        this.eventsGateway?.notifyComplianceWarning(
          current.employeeUserId ?? current.employeeId,
          org,
          row.departmentId ?? current.departmentId,
          {
            requestId: id,
            employeeUserId: currentEmpUserId,
            workDate: current.workDate,
            eligibleMinutes: precheck.computation.eligibleMinutes,
            violations: precheck.labor.violations,
            policyVersion: precheck.labor.policyVersion,
          },
        );
      } catch (wsErr) {
        console.warn('[ManagerRequestService] notifyComplianceWarning error:', wsErr);
      }
      row.compliance = precheck.labor;
    }


    if (current.type === 'ATTENDANCE' && current.attendanceDayId && (status === 'APPROVED' || status === 'REJECTED' || status === 'CLARIFICATION_REQUESTED')) {
      try {
        await this.attendanceDays.updateOne(
          { _id: current.attendanceDayId, organizationId: org },
          { $set: { overallApprovalStatus: status } },
        );
        await this.attendanceEvents.updateMany(
          { attendanceDayId: current.attendanceDayId, organizationId: org, method: 'SELFIE' },
          { $set: { approvalStatus: status } },
        );
      } catch (syncErr) {
        console.warn('[ManagerRequestService] Syncing attendance approval status failed:', syncErr);
      }
    }

    if (current.type === 'ATTENDANCE' && current.metadata?.adjustmentSource === 'MANUAL_ADJUSTMENT' && status === 'APPROVED') {
      await this.applyAttendanceAdjustment(org, current);
    }

    const changesProjection = current.type === 'ATTENDANCE' || (current.type === 'OVERTIME' && status === 'APPROVED');
    if (changesProjection && !otRow) {
      await this.periodVersion.bumpForWorkDates(org, [dateOnly(new Date(current.workDate).toISOString())]);
    }

    // Bắn sự kiện realtime qua Socket.io tới Nhân viên và Quản lý phòng ban
    try {
      const empUserId = String(
        row.employeeUserId ||
        (current.employeeUserId?._id ?? current.employeeUserId) ||
        (current.employeeId?._id ?? current.employeeId)
      );

      const deptId = row.departmentId
        ? String(row.departmentId)
        : (current.departmentId?._id ? String(current.departmentId._id) : (current.departmentId ? String(current.departmentId) : undefined));

      this.eventsGateway?.notifyApprovalDecision(empUserId, {
        requestId: id,
        type: current.type,
        status,
        organizationId: org,
        reviewedBy: managerId,
        reviewComment: reason,
        departmentId: deptId,
        attendanceDayId: current.attendanceDayId ? String(current.attendanceDayId) : undefined,
        workDate: current.workDate,
      });
    } catch (wsErr) {
      console.warn('[ManagerRequestService] notifyApprovalDecision error:', wsErr);
    }

    return row;
  }

  private async syncSelfieDecision(org: string, request: any, status: string, session: ClientSession) {
    const action = request.metadata?.actionType;
    if (!request.attendanceDayId || !['CHECK_IN', 'CHECK_OUT'].includes(action)) throw new ConflictException('ATTENDANCE_EVIDENCE_INVALID');
    const event: any = await this.attendanceEvents.findOne({ organizationId: org, attendanceDayId: request.attendanceDayId, employeeId: request.employeeUserId, eventType: action, method: 'SELFIE', evidenceId: request.evidenceId }).session(session).lean();
    if (!event || !request.evidenceId || event.provenance?.source === 'OBSERVED') throw new ConflictException('ATTENDANCE_EVIDENCE_INVALID');
    const day: any = await this.attendanceDays.findOne({ _id: request.attendanceDayId, organizationId: org }).session(session).lean();
    const endpoint = action === 'CHECK_IN' ? 'checkIn' : 'checkOut';
    if (!day || !day[`${endpoint}At`] || new Date(day[`${endpoint}At`]).getTime() !== new Date(event.recordedAt).getTime()
      || (day[`${endpoint}Provenance`]?.eventId && String(day[`${endpoint}Provenance`].eventId) !== String(event._id))
      || ['OBSERVED', 'CONFIRMED_SCHEDULE', 'MANUAL_ADJUSTMENT'].includes(day[`${endpoint}Provenance`]?.source)) throw new ConflictException('ATTENDANCE_EVIDENCE_INVALID');
    const set: any = { approvalStatus: status };
    const daySet: any = { overallApprovalStatus: status };
    if (status === 'APPROVED') {
      const evidence: any = await this.requests.db.model('Evidence').findOne({ _id: request.evidenceId, organizationId: org, ownerUserId: request.employeeUserId }).session(session).lean();
      if (!evidence?.storageKey || !['image/jpeg','image/png','image/webp'].includes(evidence.mimeType) || !(evidence.sizeBytes > 0)) throw new ConflictException('ATTENDANCE_EVIDENCE_INVALID');
      set.provenance = { source: 'OBSERVED', eventId: event._id, requestId: request._id };
      daySet[`${endpoint}Provenance`] = set.provenance;
    }
    await this.attendanceEvents.updateOne({ _id: event._id, organizationId: org, method: 'SELFIE', 'provenance.source': { $ne: 'OBSERVED' } }, { $set: set }, { session });
    await this.attendanceDays.updateOne({ _id: day._id, organizationId: org, [`${endpoint}At`]: event.recordedAt }, { $set: daySet }, { session });
  }

  private async decideAttendance(org: string, managerId: string, id: string, status: string, expectedVersion: number, reason: string | undefined, current: any) {
    const session = await this.requests.db.startSession();
    try {
      const row = await session.withTransaction(async () => {
        try {
          await this.periodVersion.claimForWorkDate(org, dateOnly(new Date(current.workDate).toISOString()), session);
        } catch (error: any) {
          if (error?.message !== 'PERIOD_REQUIRED') throw error;
          const organization: any = await this.requests.db.model('Organization').findById(org).session(session).lean();
          if (organization?.attendanceOvertimeV2Enabled === true) throw error;
          // Legacy requests without a covering period remain decidable. A covering
          // locked/payroll-claimed period is never bypassed by this exception.
        }
        const fresh: any = await this.requests.findOne({ _id: id, organizationId: org }).session(session).lean();
        if (!fresh || fresh.status !== 'PENDING' || fresh.version !== expectedVersion) throw new ConflictException('REQUEST_STATE_CHANGED');
        if (fresh.metadata?.adjustmentSource === 'MANUAL_ADJUSTMENT' && status === 'APPROVED') {
          await this.applyAttendanceAdjustment(org, fresh, session);
        } else if (fresh.metadata?.adjustmentSource !== 'MANUAL_ADJUSTMENT') {
          const hasSelfieIdentity = fresh.attendanceDayId && fresh.evidenceId && ['CHECK_IN', 'CHECK_OUT'].includes(fresh.metadata?.actionType);
          if (fresh.source === 'SELFIE' || hasSelfieIdentity) {
            await this.syncSelfieDecision(org, fresh, status, session);
          } else if (fresh.attendanceDayId) {
            // Old pending requests did not require endpoint/evidence metadata.
            // Preserve their approval-only contract, never infer OBSERVED from it.
            await this.attendanceDays.updateOne(
              { _id: fresh.attendanceDayId, organizationId: org },
              { $set: { overallApprovalStatus: status } }, { session },
            );
            await this.attendanceEvents.updateMany(
              { attendanceDayId: fresh.attendanceDayId, organizationId: org, method: 'SELFIE' },
              { $set: { approvalStatus: status } }, { session },
            );
          }
        }
        const row = await this.requests.findOneAndUpdate(
          { _id: id, organizationId: org, status: 'PENDING', version: expectedVersion },
          { $set: { status, reviewedBy: managerId, reviewedAt: new Date(), reviewComment: reason }, $inc: { version: 1 } },
          { new: true, session },
        ).lean();
        if (!row) throw new ConflictException('REQUEST_STATE_CHANGED');
        return row;
      });
      // Emit once, outside the retriable transaction and only after commit.
      try {
        await this.eventsGateway?.notifyApprovalDecision(String(row.employeeUserId), {
          requestId: id, type: 'ATTENDANCE', status, organizationId: org,
          reviewedBy: managerId, reviewComment: reason,
          departmentId: String(row.departmentId),
          attendanceDayId: row.attendanceDayId ? String(row.attendanceDayId) : undefined,
          workDate: row.workDate,
        });
      } catch (wsErr) {
        console.warn('[ManagerRequestService] notifyApprovalDecision error:', wsErr);
      }
      return row;
    } finally { await session.endSession(); }
  }

  private async applyAttendanceAdjustment(org: string, request: any, session?: ClientSession) {
    const action = request.metadata?.actionType as 'CHECK_IN' | 'CHECK_OUT';
    const recordedAt = new Date(request.requestedStart);
    const workDate = dateOnly(new Date(request.workDate).toISOString());
    const employeeUserId = String(request.employeeUserId?._id ?? request.employeeUserId);
    const query = this.attendanceDays.findOne({ organizationId: org, employeeId: employeeUserId, workDate });
    let day: any = await (session ? query.session(session) : query);
    if (!day) {
      const value = {
        organizationId: org,
        employeeId: employeeUserId,
        workDate,
        attendanceStatus: AttendanceStatus.NOT_CHECKED_IN,
        overallApprovalStatus: AttendanceApprovalStatus.APPROVED,
      };
      day = session ? (await this.attendanceDays.create([value], { session }))[0] : await this.attendanceDays.create(value);
    }
    if (action === 'CHECK_IN') {
      if (day.checkInAt) throw new ConflictException('CHECK_IN_ALREADY_EXISTS');
      if (day.checkOutAt && recordedAt >= new Date(day.checkOutAt)) throw new ConflictException('CHECK_IN_MUST_BE_BEFORE_CHECK_OUT');
      day.checkInAt = recordedAt;
      day.checkInProvenance = { source: 'MANUAL_ADJUSTMENT', requestId: String(request._id) };
    } else {
      if (day.checkOutAt) throw new ConflictException('CHECK_OUT_ALREADY_EXISTS');
      if (day.checkInAt && recordedAt <= new Date(day.checkInAt)) throw new ConflictException('CHECK_OUT_MUST_BE_AFTER_CHECK_IN');
      day.checkOutAt = recordedAt;
      day.checkOutProvenance = { source: 'MANUAL_ADJUSTMENT', requestId: String(request._id) };
    }
    if (day.checkInAt && day.checkOutAt) {
      const breakMinutes = Number(day.shiftSnapshot?.breakMinutes ?? 0);
      day.workingMinutes = Math.max(0, Math.floor((new Date(day.checkOutAt).getTime() - new Date(day.checkInAt).getTime()) / 60000) - breakMinutes);
      day.attendanceStatus = AttendanceStatus.COMPLETED;
      // A manual punch completes the business result as well as the UI status.
      // Leaving the old INCOMPLETE result in place makes the live summary keep
      // counting this day as missing even though both punches now exist.
      day.dayResult = DayResult.PRESENT;
    } else {
      day.attendanceStatus = day.checkInAt ? AttendanceStatus.CHECKED_IN : AttendanceStatus.NOT_CHECKED_IN;
      day.dayResult = DayResult.INCOMPLETE;
    }
    day.overallApprovalStatus = AttendanceApprovalStatus.APPROVED;
    await day.save(session ? { session } : undefined);
    const event = {
      organizationId: org,
      attendanceDayId: day._id,
      employeeId: employeeUserId,
      eventType: action === 'CHECK_IN' ? AttendanceEventType.CHECK_IN : AttendanceEventType.CHECK_OUT,
      method: AttendanceMethod.MANUAL,
      provenance: {source:'MANUAL_ADJUSTMENT',requestId:request._id},
      recordedAt,
      approvalStatus: AttendanceApprovalStatus.APPROVED,
      validationStatus: 'VALID',
      note: request.reason,
    };
    if (session) await this.attendanceEvents.create([event], { session });
    else await this.attendanceEvents.create(event);
  }

  private async assertAttendanceAdjustmentCanApply(org: string, request: any) {
    const action = request.metadata?.actionType as 'CHECK_IN' | 'CHECK_OUT';
    const recordedAt = new Date(request.requestedStart);
    const workDate = dateOnly(new Date(request.workDate).toISOString());
    const employeeUserId = String(request.employeeUserId?._id ?? request.employeeUserId);
    const day: any = await this.attendanceDays.findOne({ organizationId: org, employeeId: employeeUserId, workDate }).lean();
    if (action === 'CHECK_IN') {
      if (day?.checkInAt) throw new ConflictException('CHECK_IN_ALREADY_EXISTS');
      if (day?.checkOutAt && recordedAt >= new Date(day.checkOutAt)) throw new ConflictException('CHECK_IN_MUST_BE_BEFORE_CHECK_OUT');
    } else {
      if (day?.checkOutAt) throw new ConflictException('CHECK_OUT_ALREADY_EXISTS');
      if (day?.checkInAt && recordedAt <= new Date(day.checkInAt)) throw new ConflictException('CHECK_OUT_MUST_BE_AFTER_CHECK_IN');
    }
  }
}
