import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsDateString, IsMongoId, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** SRS §30D.1 field list. `currency`/`roundingRule` are fixed MVP constants, not caller input. */
export class CreateSalaryProfileDto {
	@ApiProperty({ description: 'EmployeeProfile._id this salary profile belongs to.' })
	@IsMongoId()
	employeeId: string;

	@ApiProperty({ example: '2026-09-25' })
	@IsDateString()
	effectiveFrom: string;

	@ApiProperty({ required: false, example: '2027-09-24' })
	@IsOptional()
	@IsDateString()
	effectiveTo?: string;

	@ApiProperty({ example: 15000000 })
	@IsNumber()
	@Min(0)
	baseSalary: number;

	@ApiProperty({ example: 15000000, description: 'Contribution base for BHXH/BHYT/BHTN (AC-INS-01) — never derived from baseSalary.' })
	@IsNumber()
	@Min(0)
	insuranceSalary: number;

	@ApiProperty({ required: false, description: 'Job salary during probation (§30A.3).' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	probationJobSalary?: number;

	@ApiProperty({ required: false, description: 'Agreed probation salary — must not be below the LaborCompliancePolicy minimum (AC-PROBATION-01).' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	probationAgreedSalary?: number;

	@ApiProperty({ required: false, description: 'probationAgreedSalary / probationJobSalary, 0–1.' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(1)
	probationRate?: number;

	@ApiProperty({ required: false, type: [String], description: 'OrganizationAllowance._id[] (TASK-033, not yet available) — stored as loose refs.' })
	@IsOptional()
	@ArrayUnique()
	@IsMongoId({ each: true })
	organizationAllowanceIds?: string[];

	@ApiProperty({ required: false, description: 'AttendanceBonusPolicy._id (TASK-034, not yet available) — stored as a loose ref.' })
	@IsOptional()
	@IsMongoId()
	attendanceBonusPolicyId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	kpiAmount?: number;
}
