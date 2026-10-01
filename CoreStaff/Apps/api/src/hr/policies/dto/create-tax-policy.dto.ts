import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsDateString,
	IsIn,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

export class TaxBracketDto {
	@ApiProperty({ description: 'Ngưỡng trên của bậc thuế (VND/tháng); null = vô cùng (bậc cuối)', example: 10_000_000 })
	@ValidateIf((_o, v) => v !== null)
	@IsNumber()
	@Min(0)
	upperLimit: number | null;

	@ApiProperty({ description: 'Thuế suất (%)', example: 5 })
	@IsNumber()
	@Min(0)
	@Max(100)
	rate: number;
}

/**
 * TASK-041 — Create a new TaxPolicy version for an organization.
 *
 * `organizationId` from the body is ignored on purpose (BR-TENANT-01: tenant
 * comes from the session). `personalDeduction` / `dependentDeduction` are
 * kept on the wire for backward compatibility with older clients; the modern
 * shape uses `standardDeduction` (a single personal deduction amount).
 */
export class CreateTaxPolicyDto {
	@ApiPropertyOptional({
		description: 'Tenant id (ignored — derived from session)',
		example: '65f...',
	})
	@IsOptional()
	@IsString()
	organizationId?: string;

	@ApiProperty({ description: 'Ngày hiệu lực', example: '2026-01-01' })
	@IsDateString()
	effectiveFrom: string;

	@ApiPropertyOptional({
		description: 'Ngày hết hiện lực (null = đang hiệu lực)',
		example: '2026-12-31',
		nullable: true,
	})
	@IsOptional()
	effectiveTo?: string | null;

	@ApiPropertyOptional({
		description: 'Giảm trừ bản thân / chuẩn (VND/tháng); có thể dùng personalDeduction làm alias',
		example: 11_000_000,
	})
	@ValidateIf((o: CreateTaxPolicyDto) => o.standardDeduction != null || o.personalDeduction == null)
	@IsNumber()
	@Min(0)
	standardDeduction?: number;

	@ApiPropertyOptional({
		description: 'Alias cho standardDeduction (giảm trừ bản thân)',
		example: 11_000_000,
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	personalDeduction?: number;

	@ApiPropertyOptional({
		description: 'Giảm trừ/người phụ thuộc (VND/tháng)',
		example: 4_400_000,
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	dependentDeduction?: number;

	@ApiProperty({ description: 'Biểu thuế lũy tiến (Vietnam 5-tier)', type: [TaxBracketDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => TaxBracketDto)
	progressiveBrackets: TaxBracketDto[];

	@ApiProperty({
		description: 'Quy tắc làm tròn',
		example: 'ROUND_HALF_UP_TO_VND',
		default: 'ROUND_HALF_UP_TO_VND',
	})
	@IsOptional()
	@IsIn(['ROUND_HALF_UP_TO_VND', 'ROUND_DOWN_TO_VND', 'ROUND_UP_TO_VND'])
	roundingRule?: 'ROUND_HALF_UP_TO_VND' | 'ROUND_DOWN_TO_VND' | 'ROUND_UP_TO_VND';

	@ApiPropertyOptional({ description: 'Văn bản pháp lý tham chiếu', example: 'Luật Thuế TNCN 2007/QH12' })
	@IsOptional()
	@IsString()
	legalReference?: string;

	@ApiPropertyOptional({
		description: 'Optional client-supplied version hint (ignored — version is auto-incremented)',
		example: 1,
	})
	@IsOptional()
	@IsNumber()
	version?: number;
}