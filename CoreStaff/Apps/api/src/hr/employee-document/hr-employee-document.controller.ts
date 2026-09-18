import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/rbac.decorator';
import { CurrentUser, SessionUser, Tenant, requireOrganizationId } from '../../common/tenant-context';
import { ApiCreatedSuccess, ApiErrorExamples, ApiSuccess, employeeDocumentExample } from '../../common/swagger-responses';
import { EmployeeDocumentService } from './employee-document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

/** Whitelisted upload types (SRS privacy: contracts, scans, HR paperwork). */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@ApiTags('HR / Documents')
@UseGuards(AuthGuard, RolesGuard)
@Controller('hr/documents')
export class HrEmployeeDocumentController {
	constructor(private readonly documents: EmployeeDocumentService) {}

	@Roles('HR')
	@Post('upload')
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: 10 * 1024 * 1024 },
			fileFilter(_req, file, cb) {
				if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
					cb(new BadRequestException('EMPLOYEE_DOCUMENT_TYPE_NOT_ALLOWED'), false);
					return;
				}
				cb(null, true);
			},
		}),
	)
	@ApiOperation({ summary: 'Upload a private employee document (multipart). (TASK-029)' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		description: 'File part `file` + form fields `employeeProfileId`, `contractId?`.',
		type: UploadDocumentDto,
	})
	@ApiCreatedSuccess('Employee document uploaded.', employeeDocumentExample)
	@ApiResponse({ status: 400, description: 'EMPLOYEE_DOCUMENT_FILE_REQUIRED | EMPLOYEE_DOCUMENT_TYPE_NOT_ALLOWED | EMPLOYEE_DOCUMENT_FILE_TOO_LARGE | STORAGE_NOT_CONFIGURED' })
	@ApiResponse({ status: 404, description: 'EMPLOYEE_PROFILE_NOT_FOUND | EMPLOYMENT_CONTRACT_NOT_FOUND' })
	@ApiErrorExamples()
	async upload(
		@Tenant() organizationId: string | null,
		@CurrentUser() user: SessionUser,
		@Body() dto: UploadDocumentDto,
		@UploadedFile() file?: Express.Multer.File,
	) {
		const orgId = requireOrganizationId(organizationId);
		// Multer rejects oversized files with a raw error code; map it to ours.
		if (file && file.size > 10 * 1024 * 1024) throw new BadRequestException('EMPLOYEE_DOCUMENT_FILE_TOO_LARGE');
		const data = await this.documents.upload(orgId, String(user._id ?? user.id), dto, file);
		return { success: true, data };
	}

	@Roles('HR')
	@Get()
	@ApiOperation({ summary: 'List documents in the current tenant.' })
	@ApiSuccess('Employee documents in the current tenant.', [employeeDocumentExample])
	@ApiErrorExamples()
	async findAll(
		@Tenant() organizationId: string | null,
		@Query('employeeId') employeeId?: string,
		@Query('contractId') contractId?: string,
	) {
		const orgId = requireOrganizationId(organizationId);
		const data = await this.documents.findAll(orgId, { employeeId, contractId });
		return { success: true, data };
	}

	@Roles('HR')
	@Get(':id/download')
	@ApiOperation({ summary: 'Download a private document (streamed, authorization-gated).' })
	@ApiResponse({ status: 200, description: 'The document bytes.' })
	@ApiResponse({ status: 404, description: 'EMPLOYEE_DOCUMENT_NOT_FOUND' })
	@ApiErrorExamples()
	async download(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		return this.streamDocument(orgId, id, undefined);
	}

	@Roles('HR')
	@Delete(':id')
	@ApiOperation({ summary: 'Delete a document (DB row + best-effort S3 object).' })
	@ApiSuccess('Employee document deleted.')
	@ApiResponse({ status: 404, description: 'EMPLOYEE_DOCUMENT_NOT_FOUND' })
	@ApiErrorExamples()
	async remove(@Tenant() organizationId: string | null, @Param('id') id: string) {
		const orgId = requireOrganizationId(organizationId);
		await this.documents.remove(orgId, id);
		return { success: true, data: { id } };
	}

	private async streamDocument(orgId: string, id: string, ownerProfileId?: string): Promise<StreamableFile> {
		const { stream, originalName, mimeType } = await this.documents.getStream(orgId, id, ownerProfileId);
		return new StreamableFile(stream, {
			type: mimeType,
			disposition: `attachment; filename="${encodeURIComponent(originalName)}"`,
		});
	}
}