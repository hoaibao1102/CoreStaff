import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { EmployeeTimesheetAcknowledgementDocument } from '../../database/schemas/employee-timesheet-acknowledgement.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { TimesheetPeriodDocument } from '../../database/schemas/timesheet-period.schema';
import { PoliciesService } from '../policies/policies.service';
import { AcknowledgeTimesheetDto } from './dto/acknowledge-timesheet.dto';
import { DisputeTimesheetDto } from './dto/dispute-timesheet.dto';
import { mapEmployeeTimesheetReview } from './employee-timesheet-review.mapper';
import { PeriodObligationService } from './period-obligation.service';
import { buildWorkCreditSummaryProjection, ResolvedWorkCreditPolicy } from './timesheet-summary.service';

function toDateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

@Injectable()
export class EmployeeTimesheetReviewService {
  constructor(
    @InjectModel('TimesheetPeriod') private readonly periods: Model<TimesheetPeriodDocument>,
    @InjectModel('EmployeeTimesheetAcknowledgement') private readonly actions: Model<EmployeeTimesheetAcknowledgementDocument>,
    @InjectModel('EmployeeProfile') private readonly profiles: Model<EmployeeProfileDocument>,
    private readonly obligations: PeriodObligationService,
    private readonly policies: PoliciesService,
  ) {}

  async discoverMine(organizationId: string, userId: string) {
    const profile: any = await this.profiles.findOne({ organizationId, userId, employmentStatus: { $in: ['ACTIVE', 'PROBATION'] } }).select('_id').lean();
    if (!profile) return [];
    // An OPEN period is still collecting attendance and can legitimately have
    // missing future days. Employees only review a period after HR moves it to
    // the review workflow; exposing OPEN here made the UI request an incomplete
    // projection and surface MISSING_ATTENDANCE_DAY as a bad request.
    const periods: any[] = await this.periods.find({ organizationId, active: true, status: { $in: ['REVIEWING', 'READY_TO_CLOSE'] } }).sort({ period: -1 }).lean();
    const result = [];
    for (const period of periods) {
      const latest: any = await this.actions.findOne({
        organizationId: new Types.ObjectId(organizationId),
        periodId: period._id,
        periodVersion: period.version,
        userId: new Types.ObjectId(userId),
      }).sort({ actedAt: -1 }).lean();
      result.push({ periodId: String(period._id), periodKey: period.period, periodVersion: period.version, startDate: period.startDate, endDate: period.endDate, state: this.stateOf(latest) });
    }
    return result;
  }

  async getOwnReview(organizationId: string, periodId: string, userId: string, session?: ClientSession) {
    return mapEmployeeTimesheetReview(await this.buildOwnReview(organizationId, periodId, userId, session));
  }

  async acknowledge(organizationId: string, periodId: string, userId: string, dto: AcknowledgeTimesheetDto) {
    const review: any = await this.buildOwnReview(organizationId, periodId, userId);
    this.assertCurrent(review, dto.expectedPeriodVersion, dto.projectionHash);
    if (review.hasUnresolvedDays) throw new ConflictException('TIMESHEET_HAS_UNRESOLVED_DAYS');
    if (review.state === 'ACKNOWLEDGED') return mapEmployeeTimesheetReview(review);
    await this.appendAction(organizationId, review, userId, 'ACKNOWLEDGED');
    return this.getOwnReview(organizationId, periodId, userId);
  }

  async dispute(organizationId: string, periodId: string, userId: string, dto: DisputeTimesheetDto) {
    const review: any = await this.buildOwnReview(organizationId, periodId, userId);
    this.assertCurrent(review, dto.expectedPeriodVersion, dto.projectionHash);
    if (review.state === 'ACKNOWLEDGED') throw new ConflictException('TIMESHEET_ALREADY_ACKNOWLEDGED');
    if (review.state === 'DISPUTED' && review.history.at(-1)?.disputeReason === dto.reason.trim()) return mapEmployeeTimesheetReview(review);
    await this.appendAction(organizationId, review, userId, 'DISPUTED', {
      disputeReason: dto.reason.trim(), disputedWorkDates: dto.disputedWorkDates,
    });
    return this.getOwnReview(organizationId, periodId, userId);
  }

  async getDepartmentProgress(organizationId: string, period: any, departmentId: string, session?: ClientSession) {
    const projection = await this.obligations.loadPeriod({ organizationId, periodKey: period.period,
      startDate: toDateOnly(period.startDate), endDate: toDateOnly(period.endDate), overtimeStatus: 'REVIEWABLE', session });
    const employees = [...new Map(projection.days.filter(day => day.departmentId === departmentId).map(day => [day.userId, day])).values()];
    const rows = [];
    for (const employee of employees) {
      try {
        const review: any = await this.buildOwnReview(organizationId, String(period._id), employee.userId, session);
        rows.push({ userId: employee.userId, employeeProfileId: employee.employeeProfileId, state: review.state, projectionHash: review.projectionHash,
          disputeReason: review.state === 'DISPUTED' ? review.history.at(-1)?.disputeReason : undefined });
      } catch (error) {
        // A manager must still be able to preview the department precisely when
        // an employee has an unresolved attendance day. Keep that employee in
        // acknowledgement progress as pending; period blockers remain the
        // authoritative reason the department cannot be confirmed yet.
        if (error instanceof ConflictException && error.message === 'WORK_CREDIT_DAY_UNRESOLVED') {
          rows.push({ userId: employee.userId, employeeProfileId: employee.employeeProfileId, state: 'PENDING', projectionHash: '' });
          continue;
        }
        throw error;
      }
    }
    const progress = {
      eligibleEmployees: rows.length,
      acknowledgedEmployees: rows.filter(row => row.state === 'ACKNOWLEDGED').length,
      disputedEmployees: rows.filter(row => row.state === 'DISPUTED').length,
      pendingEmployees: rows.filter(row => row.state === 'PENDING').length,
      employees: rows,
    };
    return progress;
  }

  static requireCompleteCoverage(rows: Array<{ state: string }> | { pendingEmployees: number; disputedEmployees: number }) {
    const disputed = Array.isArray(rows) ? rows.some(row => row.state === 'DISPUTED') : rows.disputedEmployees > 0;
    const pending = Array.isArray(rows) ? rows.some(row => row.state === 'PENDING') : rows.pendingEmployees > 0;
    if (disputed) throw new ConflictException('EMPLOYEE_TIMESHEET_DISPUTED');
    if (pending) throw new ConflictException('EMPLOYEE_ACKNOWLEDGEMENT_PENDING');
  }

  private async buildOwnReview(organizationId: string, periodId: string, userId: string, session?: ClientSession) {
    const periodQuery = this.periods.findOne({ _id: periodId, organizationId, active: true });
    const period: any = session ? await periodQuery.session(session).lean() : await periodQuery.lean();
    if (!period) throw new NotFoundException('PERIOD_NOT_FOUND');
    const profileQuery = this.profiles.findOne({ organizationId, userId });
    const profile: any = session ? await profileQuery.session(session).lean() : await profileQuery.lean();
    if (!profile) throw new NotFoundException('TIMESHEET_REVIEW_NOT_FOUND');
    const obligation = await this.obligations.loadPeriod({ organizationId, periodKey: period.period,
      startDate: toDateOnly(period.startDate), endDate: toDateOnly(period.endDate), overtimeStatus: 'REVIEWABLE', session });
    const days = obligation.days.filter(day => day.userId === userId);
    if (!days.length) throw new NotFoundException('TIMESHEET_REVIEW_NOT_FOUND');
    const evaluated = await buildWorkCreditSummaryProjection(days, async workDate => {
      try { return await this.policies.workCreditAt(organizationId, new Date(`${workDate}T12:00:00.000Z`), session) as ResolvedWorkCreditPolicy; }
      catch (error) { if (error instanceof NotFoundException) return null; throw error; }
    }, { allowUnresolved: true });
    const historyQuery = this.actions.find({
      organizationId,
      periodId: period._id,
      periodVersion: period.version,
      userId,
      projectionHash: evaluated.sourceHash,
    }).sort({ actedAt: 1 });
    const history: any[] = session ? await historyQuery.session(session).lean() : await historyQuery.lean();
    return { periodId: String(period._id), periodKey: period.period, periodVersion: period.version, projectionHash: evaluated.sourceHash,
      state: this.stateOf(history.at(-1)), standardWorkUnits: evaluated.standardWorkUnits, standardWorkMinutes: evaluated.standardWorkMinutes,
      payableWorkUnits: evaluated.payableWorkUnits, hasUnresolvedDays: evaluated.hasUnresolvedDays,
      days: evaluated.dailyWorkCredits, history, profileId: String(profile._id), userId,
      departmentId: days[0].departmentId };
  }

  private assertCurrent(review: any, expectedVersion: number, projectionHash: string) {
    if (review.periodVersion !== expectedVersion) throw new ConflictException('PERIOD_VERSION_CONFLICT');
    if (review.projectionHash !== projectionHash) throw new ConflictException('TIMESHEET_REVIEW_CHANGED');
  }

  private stateOf(action?: any): 'PENDING' | 'ACKNOWLEDGED' | 'DISPUTED' {
    if (action?.action === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
    if (action?.action === 'DISPUTED') return 'DISPUTED';
    return 'PENDING';
  }

  private async appendAction(
    organizationId: string,
    review: any,
    actorUserId: string,
    action: 'ACKNOWLEDGED' | 'DISPUTED',
    extra: any = {},
  ) {
    const previousActionId = String(review.history?.at(-1)?._id ?? 'ROOT');
    const idempotencyKey = `${review.userId}:${action}:${review.projectionHash}:${previousActionId}`;
    try {
      await this.actions.create({ organizationId: new Types.ObjectId(organizationId), periodId: new Types.ObjectId(review.periodId),
        periodVersion: review.periodVersion, employeeProfileId: new Types.ObjectId(review.profileId), userId: new Types.ObjectId(review.userId),
        departmentId: new Types.ObjectId(review.departmentId), action, projectionHash: review.projectionHash, idempotencyKey,
        actorUserId: new Types.ObjectId(actorUserId), actedAt: new Date(), ...extra });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const existing = await this.actions.exists({
        organizationId: new Types.ObjectId(organizationId),
        periodId: new Types.ObjectId(review.periodId),
        periodVersion: review.periodVersion,
        userId: new Types.ObjectId(review.userId),
        projectionHash: review.projectionHash,
        idempotencyKey,
        action,
      });
      if (!existing) throw error;
    }
  }
}
