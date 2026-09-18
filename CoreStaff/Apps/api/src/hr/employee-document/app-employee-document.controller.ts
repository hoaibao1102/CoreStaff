import { Controller, Get, NotFoundException, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiErrorExamples, ApiSuccess, employeeDocumentExample } from '../../common/swagger-responses';
import { EmployeeDocumentService } from './employee-document.service';

/**
 * TASK-029 — self-service "my documents". Deliberately no `@Roles`: mirrors the
 * `GET /hr/employees/me` precedent (any authenticated tenant member with a
 * profile). Every read is scoped to the caller's OWN `employeeProfileId`
 * (resolved from the session) — a document they do not own 404s exactly like a
 * missing one (AC-CONTRACT-01). No profile → empty list.
 */
@ApiTags('App / My Documents')
@UseGuards(AuthGuard)
@Controller('app/documents')
export class AppEmployeeDocumentController {
	constructor(private readonly documents: EmployeeDocumentService) {}

	@Get()
	@ApiOperation({ summary: 'List my own private documents.' })
	@ApiSuccess('My documents.', [employeeDocumentExample])
	@ApiErrorExamples()
	async myDocuments(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser) {
		const orgId = requireOrganizationId(organizationId);
		const profile = await this.documents.findOwnProfile(orgId, String(user._id ?? user.id));
		if (!profile) return { success: true, data: [] };
		const data = await this.documents.findAllOwn(orgId, String(profile._id));
		return { success: true, data };
	}

	@Get(':id/download')
	@ApiOperation({ summary: 'Download one of my own documents.' })
	@ApiResponse({ status: 200, description: 'The document bytes.' })
	@ApiResponse({ status: 404, description: 'EMPLOYEE_DOCUMENT_NOT_FOUND' })
	@ApiErrorExamples()
	async download(@Tenant() organizationId: string | null, @CurrentUser() user: SessionUser, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		const profile = await this.documents.findOwnProfile(orgId, String(user._id ?? user.id));
		if (!profile) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');
		const { stream, originalName, mimeType } = await this.documents.getStream(orgId, id, String(profile._id));
		return new StreamableFile(stream, {
			type: mimeType,
			disposition: `attachment; filename="${encodeURIComponent(originalName)}"`,
		});
	}
}