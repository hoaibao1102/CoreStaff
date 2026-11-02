import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { HrAuditService } from './hr-audit.service';

@ApiTags('HR Audit')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/audit-logs')
export class HrAuditController {
  constructor(private readonly auditService: HrAuditService) {}

  @Roles('HR')
  @Get()
  @ApiOperation({ summary: 'List tenant audit logs with filtering' })
  async list(
    @Tenant() org: string | null,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('isSelfApproved') isSelfApproved?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const orgId = requireOrganizationId(org);
    const data = await this.auditService.list(orgId, {
      action,
      actorId,
      targetType,
      isSelfApproved,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return { success: true, data: data.items, total: data.total };
  }
}
