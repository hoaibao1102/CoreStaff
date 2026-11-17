import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PlatformOnly, RolesGuard } from '../common/rbac.decorator';
import { PLATFORM_AUDIT_ACTIONS } from './platform-audit.constants';
import { PlatformAuditService } from './platform-audit.service';

/**
 * Read-only on purpose: there is no route to edit or delete a platform audit
 * row, so even a platform admin cannot rewrite their own trail through the API.
 */
@ApiTags('Platform / Audit')
@UseGuards(AuthGuard, RolesGuard)
@PlatformOnly()
@Controller('platform/audit-logs')
export class PlatformAuditController {
  constructor(private readonly audit: PlatformAuditService) {}

  @Get()
  @ApiOperation({ summary: 'List platform audit events (tenant lifecycle and admin account security).' })
  async list(
    @Query('action') action?: string,
    @Query('outcome') outcome?: string,
    @Query('actorId') actorId?: string,
    @Query('organizationId') targetOrganizationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.audit.list({
      action,
      outcome,
      actorId,
      targetOrganizationId,
      from,
      to,
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    // One object under `data`: the web client unwraps `data` and would otherwise lose `total`.
    return { success: true, data: { items: data.items, total: data.total, actions: PLATFORM_AUDIT_ACTIONS } };
  }
}
