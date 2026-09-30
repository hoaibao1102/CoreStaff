import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TaxBracketDto {
	@ApiProperty({ description: 'Ngưỡng trên của bậc thuế (VND/tháng)', example: 5000000 })
	@IsNumber()
	@Min(0)
	upperLimit: number;

	@ApiProperty({ description: 'Thuế suất (%)', example: 5 })
	@IsNumber()
	@Min(0)
	@Max(100)
	rate: number;
}

/**
 * TASK-041 — Create a new TaxPolicy version for an organization.
 */
export class CreateTaxPolicyDto {
	@ApiProperty({ description: 'Ngày hiệu lực', example: '2026-01-01' })
	@IsDateString()
	effectiveFrom: string;

	@ApiPropertyOptional({ description: 'Ngày hết hạn (null = hiện tại)', example: '2026-12-31' })
	@IsOptional()
	@IsDateString()
	effectiveTo?: string;

	@ApiProperty({ description: 'Giảm trừ bản thân (VND/tháng)', example: 15500000 })
	@IsNumber()
	@Min(0)
	personalDeduction: number;

	@ApiProperty({ description: 'Giảm trừ/người phụ thuộc (VND/tháng)', example: 6200000 })
	@IsNumber()
	@Min(0)
	dependentDeduction: number;

	@ApiProperty({ description: 'Biểu thuế lũy tiến 5 bậc', type: [TaxBracketDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => TaxBracketDto)
	progressiveBrackets: TaxBracketDto[];

	@ApiProperty({ description: 'Quy tắc làm tròn', example: 'ROUND_HALF_UP_TO_VND', default: 'ROUND_HALF_UP_TO_VND' })
	@IsString()
	@IsOptional()
	roundingRule?: string;

	@ApiProperty({ description: 'Văn bản pháp lý tham chiếu', example: 'Luật Thuế TNCN 2007/QH12' })
	@IsString()
	legalReference: string;
}
