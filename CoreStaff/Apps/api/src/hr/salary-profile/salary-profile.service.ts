import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SalaryProfileDocument } from '../../database/schemas/salary-profile.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { rangesOverlap, findEffective } from '../../common/effective-dating';
import { CreateSalaryProfileDto } from './dto/create-salary-profile.dto';

@Injectable()
export class SalaryProfileService {
	constructor(
		@InjectModel('SalaryProfile') private readonly salaryProfileModel: Model<SalaryProfileDocument>,
		@InjectModel('EmployeeProfile') private readonly profileModel: Model<EmployeeProfileDocument>,
	) {}

	async create(organizationId: string, createdBy: string, dto: CreateSalaryProfileDto) {
		const exists = await this.profileModel.exists({ _id: dto.employeeId, organizationId });
		if (!exists) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');

		const effectiveFrom = new Date(dto.effectiveFrom);
		const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : undefined;
		if (effectiveTo && effectiveTo <= effectiveFrom) throw new ConflictException('SALARY_PROFILE_DATE_RANGE_INVALID');

		const siblings = await this.salaryProfileModel.find({ organizationId, employeeId: dto.employeeId }).lean();
		const overlaps = siblings.some((row) =>
			rangesOverlap({ effectiveFrom, effectiveTo }, { effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo }),
		);
		if (overlaps) throw new ConflictException('SALARY_PROFILE_PERIOD_OVERLAPS');

		const nextVersion = 1 + Math.max(0, ...siblings.map((row) => row.version ?? 0));

		const doc = await this.salaryProfileModel.create({
			organizationId,
			employeeId: dto.employeeId,
			effectiveFrom,
			effectiveTo,
			baseSalary: dto.baseSalary,
			insuranceSalary: dto.insuranceSalary,
			probationJobSalary: dto.probationJobSalary,
			probationAgreedSalary: dto.probationAgreedSalary,
			probationRate: dto.probationRate,
			organizationAllowanceIds: dto.organizationAllowanceIds ?? [],
			attendanceBonusPolicyId: dto.attendanceBonusPolicyId,
			kpiAmount: dto.kpiAmount,
			version: nextVersion,
			createdBy,
		});
		return doc.toObject();
	}

	async findAll(organizationId: string, employeeId?: string) {
		const filter: Record<string, unknown> = { organizationId };
		if (employeeId) filter.employeeId = employeeId;
		return this.salaryProfileModel.find(filter).sort({ effectiveFrom: -1 }).lean();
	}

	async findOne(organizationId: string, id: string) {
		const doc = await this.salaryProfileModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('SALARY_PROFILE_NOT_FOUND');
		return doc;
	}

	/** The SalaryProfile in effect for `employeeId` at `asOf` — insuranceSalary source for AC-INS-01. */
	async findEffectiveForEmployee(organizationId: string, employeeId: string, asOf: Date = new Date()) {
		const rows = await this.salaryProfileModel.find({ organizationId, employeeId }).lean();
		const effective = findEffective(rows, asOf);
		if (!effective) throw new NotFoundException('SALARY_PROFILE_NOT_EFFECTIVE');
		return effective;
	}
}
