import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, requireOrganizationId, Tenant } from '../../common/tenant-context';
import { EmployeeTimesheetReviewService } from './employee-timesheet-review.service';

@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/timesheet-reviews')
export class TimesheetReviewController {
  constructor(private readonly reviews: EmployeeTimesheetReviewService) {}

  @Roles('EMPLOYEE', 'DEPARTMENT_MANAGER')
  @Get('my')
  async discoverMine(@Tenant() organizationId: string | null, @CurrentUser() user: any) {
    return { success: true, data: await this.reviews.discoverMine(requireOrganizationId(organizationId), String(user._id ?? user.id)) };
  }
}
