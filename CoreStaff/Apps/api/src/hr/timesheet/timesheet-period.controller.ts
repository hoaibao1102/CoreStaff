import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId, CurrentUser } from '../../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess } from '../../common/swagger-responses';
import { TimesheetPeriodService } from './timesheet-period.service';
import { CreateTimesheetPeriodDto } from './dto/create-timesheet-period.dto';
import { ReopenTimesheetPeriodDto } from './dto/reopen-timesheet-period.dto';
import { TimesheetPeriodStatus } from '../../database/schemas/timesheet-period.schema';
import { ConfirmDepartmentTimesheetDto } from './dto/confirm-department-timesheet.dto';

@ApiTags('HR / Timesheet Periods')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/timesheet-periods')
export class TimesheetPeriodController {
	constructor(private readonly service: TimesheetPeriodService) {}

	@Roles('HR')
	@Post()
	@ApiOperation({ summary: 'Create a new timesheet period (TASK-072).' })
	@ApiCreatedSuccess('Timesheet period created.', {
		_id: '64f1a2b3c4d5e6f7a8b9c0d1',
		organizationId: '64f1a2b3c4d5e6f7a8b9c0d0',
		period: '2026-10',
		status: 'OPEN',
		version: 1,
		startDate: '2026-10-01T00:00:00.000Z',
		endDate: '2026-10-31T23:59:59.999Z',
		createdAt: '2026-09-27T10:00:00.000Z',
		updatedAt: '2026-09-27T10:00:00.000Z',
	})
	@ApiResponse({ status: 409, description: 'PERIOD_ALREADY_EXISTS' })
	@ApiErrorExamples()
	async create(@Tenant() organizationId: string | null, @Body() dto: CreateTimesheetPeriodDto) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.create(orgId, dto);
		return { success: true, data };
	}

	@Get()
	@ApiOperation({ summary: 'List timesheet periods for the current tenant.' })
	@ApiSuccess('List of timesheet periods.', [
		{
			_id: '64f1a2b3c4d5e6f7a8b9c0d1',
			period: '2026-10',
			status: 'OPEN',
			version: 1,
			startDate: '2026-10-01T00:00:00.000Z',
			endDate: '2026-10-31T23:59:59.999Z',
		},
	])
	@ApiErrorExamples()
	async findAll(
		@Tenant() organizationId: string | null,
		@Query('status') status?: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.findAll(orgId, status as any);
		return { success: true, data };
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a timesheet period by id.' })
	@ApiSuccess('Timesheet period detail.', {
		_id: '64f1a2b3c4d5e6f7a8b9c0d1',
		period: '2026-10',
		status: 'OPEN',
		version: 1,
		startDate: '2026-10-01T00:00:00.000Z',
		endDate: '2026-10-31T23:59:59.999Z',
	})
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND' })
	@ApiErrorExamples()
	async findOne(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.findOne(orgId, id);
		return { success: true, data };
	}

	@Roles('HR', 'DEPARTMENT_MANAGER')
	@Get(':id/review-stats')
	@ApiOperation({ summary: 'Get review statistics for a timesheet period.' })
	@ApiSuccess('Review statistics.', {
		totalEmployees: 50,
		summariesGenerated: 45,
		attendanceComplete: 90,
		pendingApprovals: 5,
		missingSummaries: 5,
		blockers: [],
	})
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND' })
	@ApiErrorExamples()
	async getReviewStats(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@CurrentUser() user: any,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.getReviewStats(orgId, id, {
			userId: String(user._id ?? user.id),
			role: user.role,
		});
		return { success: true, data };
	}

	@Roles('HR', 'DEPARTMENT_MANAGER')
	@Get(':id/blockers')
	@ApiOperation({ summary: 'List blockers for a timesheet period (TASK-074 drill-down).' })
	@ApiSuccess('Blocker page.', {
		total: 2,
		page: 1,
		limit: 50,
		items: [
			{
				id: '64f1a2b3c4d5e6f7a8b9c0d9:MISSING_CHECK_IN',
				type: 'MISSING_CHECK_IN',
				attendanceDayId: '64f1a2b3c4d5e6f7a8b9c0d9',
				employeeId: '64f1a2b3c4d5e6f7a8b9c0d2',
				employee: { code: 'EMP001', name: 'Nguyễn Văn An', department: 'Kỹ thuật' },
				date: '2026-10-06',
				note: 'Thiếu check-in',
			},
		],
		summary: [{ type: 'MISSING_CHECK_IN', message: 'Thiếu check-in', count: 1 }],
	})
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND' })
	@ApiErrorExamples()
	async getBlockers(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Query('type') type: any,
		@Query('departmentId') departmentId: string | undefined,
		@Query('page') page: string | undefined,
		@Query('limit') limit: string | undefined,
		@CurrentUser() user: any,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.getBlockers(orgId, id, {
			userId: String(user._id ?? user.id),
			role: user.role,
			type,
			departmentId,
			page: page ? Number(page) : undefined,
			limit: limit ? Number(limit) : undefined,
		});
		return { success: true, data };
	}

	@Roles('HR', 'DEPARTMENT_MANAGER')
	@Get(':id/days/:dayId')
	@ApiOperation({ summary: 'Drill-down detail for one attendance day in the period (TASK-074).' })
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND | ATTENDANCE_DAY_NOT_FOUND' })
	@ApiErrorExamples()
	async getDayDetail(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Param('dayId') dayId: string,
		@CurrentUser() user: any,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.getDayDetail(orgId, id, dayId, {
			userId: String(user._id ?? user.id),
			role: user.role,
		});
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/status')
	@ApiOperation({ summary: 'Update period status with state machine validation (TASK-072).' })
	@ApiSuccess('Status updated.', {
		_id: '64f1a2b3c4d5e6f7a8b9c0d1',
		period: '2026-10',
		status: 'REVIEWING',
		version: 1,
	})
	@ApiResponse({ status: 400, description: 'INVALID_TRANSITION' })
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND' })
	@ApiErrorExamples()
	async updateStatus(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body('status') status: TimesheetPeriodStatus,
		@CurrentUser() user: any,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.updateStatus(orgId, id, status, String(user._id ?? user.id));
		return { success: true, data };
	}

	@Roles('HR')
	@Patch(':id/reopen')
	@ApiOperation({ summary: 'Reopen a closed period with reason (TASK-072/079).' })
	@ApiSuccess('Period reopened, version incremented.', {
		_id: '64f1a2b3c4d5e6f7a8b9c0d1',
		period: '2026-10',
		status: 'REVIEWING',
		version: 2,
		reopenReason: 'Data was incorrect, need to fix attendance records',
		reopenedAt: '2026-10-05T10:00:00.000Z',
	})
	@ApiResponse({ status: 400, description: 'Can only reopen CLOSED period or MIN_LENGTH_REASON' })
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND' })
	@ApiErrorExamples()
	async reopen(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: ReopenTimesheetPeriodDto,
		@CurrentUser() user: any,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.reopen(orgId, id, dto, String(user._id ?? user.id));
		return { success: true, data };
	}

	@Roles('DEPARTMENT_MANAGER')
	@Post(':id/department-confirmations')
	@ApiOperation({ summary: 'Confirm one department for the current period version (TASK-075).' })
	@ApiResponse({ status: 409, description: 'DEPARTMENT_NOT_READY | PERIOD_VERSION_CONFLICT' })
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND' })
	@ApiErrorExamples()
	async confirmDepartment(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body() dto: ConfirmDepartmentTimesheetDto,
		@CurrentUser() user: any,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.confirmDepartment(
			orgId,
			id,
			String(user._id ?? user.id),
			dto,
		);
		return { success: true, data };
	}

	@Roles('DEPARTMENT_MANAGER')
	@Get(':id/snapshot-preview')
	@ApiOperation({ summary: 'Manager previews snapshot data for their department before closing.' })
	@ApiResponse({ status: 400, description: 'PERIOD_NOT_READY | DEPARTMENT_SCOPE_VIOLATION' })
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND' })
	@ApiErrorExamples()
	async previewManagerSnapshot(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Query('departmentId') departmentId: string,
		@CurrentUser() user: any,
	) {
		const orgId = requireOrganizationId(organizationId);
		const managerUserId = String(user._id ?? user.id);
		const data = await this.service.previewManagerSnapshot(orgId, id, managerUserId, departmentId);
		return { success: true, data };
	}

	@Roles('DEPARTMENT_MANAGER')
	@Post(':id/close-snapshot')
	@ApiOperation({ summary: 'Manager closes snapshot for their department.' })
	@ApiResponse({ status: 400, description: 'PERIOD_NOT_READY | DEPARTMENT_SCOPE_VIOLATION | DEPARTMENT_SNAPSHOT_ALREADY_CLOSED' })
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND' })
	@ApiErrorExamples()
	async managerCloseSnapshot(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@Body('departmentId') departmentId: string,
		@CurrentUser() user: any,
	) {
		const orgId = requireOrganizationId(organizationId);
		const managerUserId = String(user._id ?? user.id);
		try {
			const data = await this.service.managerCloseSnapshot(orgId, id, managerUserId, departmentId);
			return { success: true, data };
		} catch (error) {
			console.error('[close-snapshot] controller error:', error);
			throw error;
		}
	}

	@Roles('HR')
	@Post(':id/close')
	@ApiOperation({ summary: 'HR closes a timesheet period after all manager snapshots are closed.' })
	@ApiResponse({ status: 400, description: 'CANNOT_CLOSE_PERIOD | MANAGER_SNAPSHOT_NOT_CLOSED' })
	@ApiResponse({ status: 404, description: 'PERIOD_NOT_FOUND' })
	@ApiErrorExamples()
	async hrClosePeriod(
		@Tenant() organizationId: string | null,
		@Param('id') id: string,
		@CurrentUser() user: any,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.service.hrClosePeriod(orgId, id, user.id);
		return { success: true, data };
	}
}
