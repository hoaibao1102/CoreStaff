import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { Tenant, requireOrganizationId } from '../../common/tenant-context';
import { CalendarService } from './calendar.service';
import { CreateCalendarExceptionDto, UpdateCalendarExceptionDto } from './dto/calendar.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/calendar-exceptions')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}
  @Roles('HR') @Post()
  async create(@Tenant() org: string | null, @Req() req: any, @Body() dto: CreateCalendarExceptionDto) { return { success: true, data: await this.calendar.create(requireOrganizationId(org), String(req.user._id), dto) }; }
  @Roles('HR') @Get()
  async list(@Tenant() org: string | null, @Query('from') from?: string, @Query('to') to?: string) { return { success: true, data: await this.calendar.list(requireOrganizationId(org), from, to) }; }
  @Roles('HR') @Get(':id')
  async one(@Tenant() org: string | null, @Param('id') id: string) { return { success: true, data: await this.calendar.get(requireOrganizationId(org), id) }; }
  @Roles('HR') @Patch(':id')
  async update(@Tenant() org: string | null, @Req() req: any, @Param('id') id: string, @Body() dto: UpdateCalendarExceptionDto) { return { success: true, data: await this.calendar.update(requireOrganizationId(org), String(req.user._id), id, dto) }; }
  @Roles('HR') @Delete(':id')
  async remove(@Tenant() org: string | null, @Param('id') id: string) { return { success: true, data: await this.calendar.remove(requireOrganizationId(org), id) }; }
}

