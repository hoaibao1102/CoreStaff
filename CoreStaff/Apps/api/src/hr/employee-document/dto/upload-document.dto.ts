import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

/**
 * TASK-029. Multipart text fields — multer populates `@Body()` from the form
 * parts alongside the `file` part handled by `FileInterceptor('file', …)`.
 */
export class UploadDocumentDto {
	@ApiProperty({ description: 'EmployeeProfile._id the document belongs to (same tenant).' })
	@IsMongoId()
	employeeProfileId: string;

	@ApiProperty({ required: false, description: 'EmploymentContract._id this scan belongs to (optional).' })
	@IsOptional()
	@IsMongoId()
	contractId?: string;
}