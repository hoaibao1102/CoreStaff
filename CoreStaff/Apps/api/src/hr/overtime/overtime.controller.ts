import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { parseWindowInstant, vnDateOf } from '../../common/vietnam-time';
import { dateOnly } from '../../common/date-only';
import { ManagerRequestService } from '../manager/manager-request.service';
import { CreateOvertimeRequestDto, DecideOvertimeDto, OvertimeResultQueryDto, RecalculateOvertimeDto } from './dto/overtime.dto';
import { OvertimeService } from './overtime.service';

/** §16.6C `POST/GET /api/overtime`, `/api/overtime/mine` — Employee scope. */
@ApiTags('Overtime')
@UseGuards(AuthGuard, RolesGuard)
@Controller('overtime')
export class OvertimeController {
  constructor(private readonly overtime: OvertimeService, private readonly requests: ManagerRequestService) {}

  @Roles('EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR') @Post()
  async create(
    @Tenant() orgId: string | null,
    @Req() req: any,
    @Body() dto: CreateOvertimeRequestDto,
  ) {
    const org = requireOrganizationId(orgId);
    const userId = String(req.user._id);
    // BR-OT-01 / AC-OT-01 before anything else: a client may not choose the type
    // or report the minutes it wants to be paid for.
    this.overtime.assertNoClientType(dto as unknown as Record<string, unknown>);
    const workDate = dateOnly(dto.workDate);
    const window = {
      from: parseWindowInstant(dto.requestedStart, workDate),
      to: parseWindowInstant(dto.requestedEnd, workDate),
    };
    // The filing guards (D39 cutoff, no-schedule-encroachment, no-overlap,
    // retroactive derivation) run once inside `createMine`, so both this route
    // and the generic `POST /api/requests` clear the identical bar.
    const created = await this.requests.createMine(org, userId, {
      type: 'OVERTIME',
      workDate: dto.workDate,
      reason: dto.reason,
      requestedStart: dto.requestedStart,
      requestedEnd: dto.requestedEnd,
      workDescription: dto.workDescription,
      retroactiveReason: dto.retroactiveReason,
    });
    // Warning only. The block lives at approval (§30B.2), and until the day is
    // worked there is no eligible figure to block on.
    //
    // A tenant with no labor policy configured therefore must not fail here:
    // the request is already persisted, and a 404 would tell the employee their
    // report of real worked hours was refused because of an HR configuration
    // gap. The projection comes back empty and the approval path is the one that
    // insists on a policy.
    try {
      const projection = await this.overtime.previewLimits(org, userId, workDate, window.to > window.from ? Math.floor((window.to - window.from) / 60_000) : 0);
      return { success: true, data: { ...created, compliance: projection } };
    } catch (previewError) {
      // Only the missing-configuration case is tolerated; anything else is a real
      // fault and must still fail the request.
      if (!(previewError instanceof NotFoundException) || previewError.message !== 'LABOR_POLICY_NOT_FOUND') throw previewError;
      return { success: true, data: { ...created, compliance: null, complianceNote: previewError.message } };
    }
  }

  @Roles('EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR') @Get('mine')
  async mine(@Tenant() orgId: string | null, @Req() req: any, @Query('month') month?: string) {
    const org = requireOrganizationId(orgId);
    const rows = await this.requests.listMine(org, String(req.user._id));
    const overtimeOnly = rows.filter((row: Record<string, unknown>) => row.type === 'OVERTIME'
      && (!month || monthKeyOf(row.workDate) === month));
    return { success: true, data: await this.overtime.withResults(org, overtimeOnly as Array<Record<string, unknown>>) };
  }

  /**
   * D39 — the shift the employee is assigned on one date, so the OT form can
   * keep its time inputs outside it *before* posting. Resolved by the same
   * `dayContext` the filing guard and the payable calculation use: a client
   * that re-implemented the department-beats-company precedence here would drift
   * from the rule that actually rejects it.
   *
   * `scheduled: null` means no shift applies that day (weekly off, holiday with
   * the shift withdrawn, unscheduled) — which is also the signal for the form to
   * stop constraining the window at all.
   */
  @Roles('EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR') @Get('schedule')
  async schedule(@Tenant() orgId: string | null, @Req() req: any, @Query('date') date?: string) {
    const org = requireOrganizationId(orgId);
    const workDate = dateOnly(date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const context = await this.overtime.dayContext(org, String(req.user._id), workDate);
    const window = this.overtime.scheduledIntervals(context)[0];
    return {
      success: true,
      data: {
        workDate,
        scheduled: context.shift && window
          ? {
              startTime: context.shift.startTime,
              endTime: context.shift.endTime,
              breakMinutes: context.shift.breakMinutes ?? 0,
              from: new Date(window.from).toISOString(),
              to: new Date(window.to).toISOString(),
            }
          : null,
        calendarType: context.calendarType ?? null,
        overrideType: context.overrideType ?? null,
        overtimeType: this.overtime.classifyDay(context),
      },
    };
  }
}

/**
 * 'YYYY-MM' for a stored `workDate`. The column is a **Date** (TASK-066), so
 * `String(row.workDate).slice(0, 7)` would yield `"Fri Sep"` and every month
 * filter would silently return nothing.
 */
function monthKeyOf(value: unknown): string {
  return value instanceof Date
    ? vnDateOf(value.getTime()).slice(0, 7)
    : String(value).slice(0, 7);
}

/** §16.6C `POST /api/manager/overtime/:id/approve|reject` — Manager scope. */
@ApiTags('Overtime')
@UseGuards(AuthGuard, RolesGuard)
@Controller('manager/overtime')
export class ManagerOvertimeController {
  constructor(private readonly requests: ManagerRequestService) {}

  @Roles('DEPARTMENT_MANAGER') @Post(':id/approve')
  async approve(@Tenant() orgId: string | null, @Req() req: any, @Param('id') id: string, @Body() dto: DecideOvertimeDto) {
    return { success: true, data: await this.requests.decide(requireOrganizationId(orgId), String(req.user._id), id, 'APPROVED', dto.expectedVersion, dto.reason, dto.approvedStart, dto.approvedEnd) };
  }

  @Roles('DEPARTMENT_MANAGER') @Post(':id/reject')
  async reject(@Tenant() orgId: string | null, @Req() req: any, @Param('id') id: string, @Body() dto: DecideOvertimeDto) {
    return { success: true, data: await this.requests.decide(requireOrganizationId(orgId), String(req.user._id), id, 'REJECTED', dto.expectedVersion, dto.reason) };
  }
}

/** §16.6C `GET /api/hr/overtime-results` + the recalculate/backfill path. */
@ApiTags('Overtime')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/overtime-results')
export class HrOvertimeController {
  constructor(private readonly overtime: OvertimeService) {}

  @Roles('HR') @Get()
  async list(@Tenant() orgId: string | null, @Query() query: OvertimeResultQueryDto) {
    return { success: true, data: await this.overtime.listResults(requireOrganizationId(orgId), query) };
  }

  /**
   * Recomputes PROVISIONAL results over a range. Doubles as the backfill for
   * requests approved before TASK-069 existed, and as the recovery path for an
   * interrupted run — the write is an idempotent upsert per request.
   */
  @Roles('HR') @Post('recalculate')
  async recalculate(@Tenant() orgId: string | null, @Body() dto: RecalculateOvertimeDto) {
    return { success: true, data: await this.overtime.recompute(requireOrganizationId(orgId), dto.from, dto.to, { employeeId: dto.employeeId }) };
  }
}
