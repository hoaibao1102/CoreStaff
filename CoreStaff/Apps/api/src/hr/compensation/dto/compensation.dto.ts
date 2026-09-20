import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsMongoId, IsNumber, IsObject, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { BonusMetric, BonusOperator } from '../compensation-domain';
import { KpiSource } from '../../../database/schemas/compensation.schema';

export class EmployeeAllowanceItemDto {
  @IsMongoId() allowanceId: string;
  @IsNumber() @Min(0) amount: number;
}

export class CreateSalaryProfileDto {
  @IsMongoId() employeeId: string;
  @IsDateString() effectiveFrom: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsInt() @Min(0) baseSalary: number;
  @IsInt() @Min(0) insuranceSalary: number;
  @IsOptional() @IsInt() @Min(1) probationJobSalary?: number;
  @IsOptional() @IsInt() @Min(1) probationAgreedSalary?: number;
  @IsOptional() @IsArray() @IsMongoId({ each: true }) organizationAllowanceIds?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EmployeeAllowanceItemDto) allowances?: EmployeeAllowanceItemDto[];
  @IsOptional() @IsMongoId() attendanceBonusPolicyId?: string;
}
export class UpdateSalaryProfileDto extends PartialType(CreateSalaryProfileDto) {}

export class CreateAllowanceDto {
  @IsOptional() @IsMongoId() catalogId?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(0) amount?: number;
  @IsOptional() @IsBoolean() taxable?: boolean;
  @IsOptional() @IsBoolean() insuranceBased?: boolean;
  @IsOptional() @IsBoolean() prorated?: boolean;
  @IsDateString() effectiveFrom: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}
export class UpdateAllowanceDto extends PartialType(CreateAllowanceDto) {}

export class BonusConditionDto {
  @IsEnum(['LATE_COUNT','LATE_MINUTES','EARLY_COUNT','EARLY_MINUTES','ABSENT_DAYS','INCOMPLETE_DAYS']) metric: BonusMetric;
  @IsEnum(['EQ','LT','LTE','GT','GTE']) operator: BonusOperator;
  @IsNumber() value: number;
}
export class BonusTierDto {
  @IsInt() @Min(1) order: number;
  @IsNumber() @Min(0) @Max(100) percentage: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BonusConditionDto) conditions: BonusConditionDto[];
}
export class CreateBonusPolicyDto {
  @IsOptional() @IsMongoId() templateId?: string;
  @IsString() name: string;
  @IsInt() @Min(0) bonusAmount: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BonusTierDto) tiers: BonusTierDto[];
  @IsDateString() effectiveFrom: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsEnum(['ALL', 'DEPARTMENT']) scope?: 'ALL' | 'DEPARTMENT';
  @IsOptional() @IsArray() @IsMongoId({ each: true }) departmentIds?: string[];
}
export class UpdateBonusPolicyDto extends PartialType(CreateBonusPolicyDto) {}
export class PreviewBonusDto {
  @IsMongoId() policyId: string;
  @IsOptional() @IsObject() metrics?: Partial<Record<BonusMetric, number>>;
}

export class KpiTierDto {
  @IsString() name: string;
  @IsNumber() @Min(0) percentage: number;
  @IsOptional() @IsNumber() @Min(0) minScore?: number;
  @IsOptional() @IsNumber() @Min(0) maxScore?: number;
  @IsInt() @Min(1) order: number;
}

export class CreateKpiPolicyDto {
  @IsString() name: string;
  @IsEnum(['PASS_FAIL', 'GRADE', 'SCORE_RANGE']) policyType: 'PASS_FAIL' | 'GRADE' | 'SCORE_RANGE';
  @IsInt() @Min(0) baseAmount: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => KpiTierDto) tiers: KpiTierDto[];
  @IsDateString() effectiveFrom: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsEnum(['ALL', 'DEPARTMENT']) scope?: 'ALL' | 'DEPARTMENT';
  @IsOptional() @IsArray() @IsMongoId({ each: true }) departmentIds?: string[];
}
export class UpdateKpiPolicyDto extends PartialType(CreateKpiPolicyDto) {}

export class CreateKpiInputDto {
  @IsMongoId() employeeId: string;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period: string;
  @IsOptional() @IsMongoId() policyId?: string;
  @IsOptional() @IsString() tierName?: string;
  @IsOptional() @IsNumber() @Min(0) tierPercentage?: number;
  @IsOptional() @IsNumber() @Min(0) baseAmount?: number;
  @IsOptional() @IsNumber() @Min(0) score?: number;
  @IsInt() @Min(0) amount: number;
  @IsOptional() @IsEnum(KpiSource) source?: KpiSource;
  @IsOptional() @IsString() note?: string;
}
export class UpdateKpiInputDto extends PartialType(CreateKpiInputDto) {}

