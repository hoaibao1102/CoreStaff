import {ConflictException,ForbiddenException,Injectable,NotFoundException,Optional} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';import {Model} from 'mongoose';
import {ManagerRequestDocument} from '../../database/schemas/manager-request.schema';
import {EmployeeProfileDocument} from '../../database/schemas/employee-profile.schema';
import {CreateManagerRequestDto} from './dto/manager-request.dto';import {ManagerScopeService} from './manager-scope.service';
import {EventsGateway} from '../../events/events.gateway';
import {dateOnly} from '../../common/date-only';
import {parseWindowInstant} from '../../common/vietnam-time';
import {OvertimeService} from '../overtime/overtime.service';
@Injectable()
export class ManagerRequestService {
  constructor(
    @InjectModel('ManagerRequest') private readonly requests: Model<ManagerRequestDocument>,
    @InjectModel('EmployeeProfile') private readonly employees: Model<EmployeeProfileDocument>,
    @InjectModel('AttendanceDay') private readonly attendanceDays: Model<any>,
    @InjectModel('AttendanceEvent') private readonly attendanceEvents: Model<any>,
    private readonly scope: ManagerScopeService,
    @Optional() private readonly eventsGateway?: EventsGateway,
    // TASK-068/070 — last so the existing spec's five positional args keep working.
    @Optional() private readonly ot?: OvertimeService,
  ) {}

  async createMine(org: string, userId: string, dto: CreateManagerRequestDto) {
    const emp = await this.employees.findOne({ organizationId: org, userId }).lean();
    if (!emp || !emp.departmentId) throw new NotFoundException('EMPLOYEE_ASSIGNMENT_NOT_FOUND');
    if (
      dto.type === 'OVERTIME' &&
      (!dto.requestedStart || !dto.requestedEnd || new Date(dto.requestedStart) >= new Date(dto.requestedEnd))
    ) {
      throw new ConflictException('OVERTIME_WINDOW_INVALID');
    }
    const retro = dto.type === 'OVERTIME' ? await this.otGuards(org, userId, dto) : {};
    const row = await this.requests.create({
      organizationId: org,
      employeeId: emp._id,
      employeeUserId: userId,
      departmentId: emp.departmentId,
      ...dto,
      ...retro,
      workDate: new Date(dto.workDate),
      requestedStart: dto.requestedStart ? new Date(dto.requestedStart) : undefined,
      requestedEnd: dto.requestedEnd ? new Date(dto.requestedEnd) : undefined,
    });

    try {
      this.eventsGateway?.notifyNewRequest(String(emp.departmentId), {
        requestId: String(row._id),
        type: row.type,
        departmentId: String(emp.departmentId),
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
  private async otGuards(org: string, userId: string, dto: CreateManagerRequestDto) {
    if (!this.ot) return {};
    this.ot.assertNoClientType(dto as unknown as Record<string, unknown>);
    const workDate = dateOnly(dto.workDate);
    // `createMine` has already refused an OVERTIME dto without both bounds.
    const window = {
      from: parseWindowInstant(dto.requestedStart!, workDate),
      to: parseWindowInstant(dto.requestedEnd!, workDate),
    };
    return this.ot.assertFilingAllowed(org, userId, window, workDate, new Date(), (dto as any).retroactiveReason);
  }

  async listMine(org: string, userId: string) {
    return this.requests.find({ organizationId: org, employeeUserId: userId }).sort({ createdAt: -1 }).lean();
  }

  async listForManager(org: string, managerId: string, filter: { type?: string; status?: string; departmentId?: string }) {
    const ids = await this.scope.getManagedDepartmentIds(org, managerId);
    if (filter.departmentId) await this.scope.requireDepartment(org, managerId, filter.departmentId);
    const departments = filter.departmentId ? [filter.departmentId] : ids;
    if (!departments.length) return [];
    const query: any = { organizationId: org, departmentId: { $in: departments } };
    if (filter.type && filter.type !== 'ALL') query.type = filter.type;
    if (filter.status && filter.status !== 'ALL') query.status = filter.status;
    return this.requests.find(query)
      .populate('evidenceId')
      .populate('employeeId', 'employeeCode')
      .populate('employeeUserId', 'fullName email avatarUrl')
      .sort({ createdAt: -1 })
      .lean();
  }

  async detail(org: string, managerId: string, id: string) {
    const row = await this.requests.findOne({ _id: id, organizationId: org })
      .populate('evidenceId')
      .populate('employeeId', 'employeeCode')
      .populate('employeeUserId', 'fullName email avatarUrl')
      .lean();
    if (!row) throw new NotFoundException('REQUEST_NOT_FOUND');
    await this.scope.requireDepartment(org, managerId, String(row.departmentId));
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
  ) {
    const current: any = await this.detail(org, managerId, id);
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
    // TASK-069/070 — the decision the calculator will see, before it is written.
    const asOt = current.type === 'OVERTIME' && status === 'APPROVED' && this.ot
      // `detail()` populates employeeUserId, so the id has to be unwrapped the same
      // way the two lines above do it; `otEmployeeUserId` handles both shapes.
      ? { ...current, _id: id, approvedStart: approvedStart ? new Date(approvedStart) : current.approvedStart, approvedEnd: approvedEnd ? new Date(approvedEnd) : current.approvedEnd }
      : null;
    // §30B.2 BLOCK lands here, deliberately *before* the update: a rejected
    // approval must leave status and version untouched so the manager's queue
    // does not show a decision that never happened.
    const precheck = asOt ? await this.ot!.precheckApproval(org, asOt) : undefined;
    const row: any = await this.requests
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

    // §7.7 — approval creates the PROVISIONAL overtime result. After the write, so
    // a concurrent second approver loses the version filter above and never gets
    // here. A failure must not un-approve the request: the upsert is idempotent and
    // `POST /api/hr/overtime-results/recalculate` recovers it.
    if (asOt) {
      try {
        await this.ot!.onApproved(org, { ...asOt, _id: id, status: 'APPROVED', reviewedBy: managerId });
      } catch (otErr) {
        console.warn('[ManagerRequestService] overtime result write failed:', otErr);
      }
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
}
