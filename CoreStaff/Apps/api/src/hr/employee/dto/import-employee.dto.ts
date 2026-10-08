import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * The multipart form fields that ride alongside the file part. Everything else
 * about an import lives in the workbook — this DTO exists so the global
 * `whitelist`/`forbidNonWhitelisted` pipe doesn't 400 the switch.
 */
export class ImportEmployeesDto {
	@ApiProperty({ required: false, default: false, description: 'Validate and report only — writes nothing.' })
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	dryRun?: boolean;
}
