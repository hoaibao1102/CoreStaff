import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InsuranceProfileDocument } from '../../database/schemas/insurance-profile.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { rangesOverlap, findEffective } from '../../common/effective-dating';
import { CreateInsuranceProfileDto } from './dto/create-insurance-profile.dto';

@Injectable()
export class InsuranceProfileService {
	constructor(
		@InjectModel('InsuranceProfile') private readonly insuranceProfileModel: Model<InsuranceProfileDocument>,
		@InjectModel('EmployeeProfile') private readonly profileModel: Model<EmployeeProfileDocument>,
	) {}

	async create(organizationId: string, createdBy: string, dto: CreateInsuranceProfileDto) {
		const exists = await this.profileModel.exists({ _id: dto.employeeId, organizationId });
		if (!exists) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');

		const effectiveFrom = new Date(dto.effectiveFrom);
		const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : undefined;
		if (effectiveTo && effectiveTo <= effectiveFrom) throw new ConflictException('INSURANCE_PROFILE_DATE_RANGE_INVALID');

		const siblings = await this.insuranceProfileModel.find({ organizationId, employeeId: dto.employeeId }).lean();
		const overlaps = siblings.some((row) =>
			rangesOverlap({ effectiveFrom, effectiveTo }, { effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo }),
		);
		if (overlaps) throw new ConflictException('INSURANCE_PROFILE_PERIOD_OVERLAPS');

		const nextVersion = 1 + Math.max(0, ...siblings.map((row) => row.version ?? 0));

		const doc = await this.insuranceProfileModel.create({
			organizationId,
			employeeId: dto.employeeId,
			effectiveFrom,
			effectiveTo,
			participatesSocialInsurance: dto.participatesSocialInsurance,
			participatesHealthInsurance: dto.participatesHealthInsurance,
			participatesUnemploymentInsurance: dto.participatesUnemploymentInsurance,
			note: dto.note,
			version: nextVersion,
			createdBy,
		});
		return doc.toObject();
	}

	async findAll(organizationId: string, employeeId?: string) {
		const filter: Record<string, unknown> = { organizationId };
		if (employeeId) filter.employeeId = employeeId;
		return this.insuranceProfileModel.find(filter).sort({ effectiveFrom: -1 }).lean();
	}

	async findOne(organizationId: string, id: string) {
		const doc = await this.insuranceProfileModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('INSURANCE_PROFILE_NOT_FOUND');
		return doc;
	}

	/** The participation flags in effect for `employeeId` at `asOf` — AC-INS-02 gate. */
	async findEffectiveForEmployee(organizationId: string, employeeId: string, asOf: Date = new Date()) {
		const rows = await this.insuranceProfileModel.find({ organizationId, employeeId }).lean();
		const effective = findEffective(rows, asOf);
		if (!effective) throw new NotFoundException('INSURANCE_PROFILE_NOT_EFFECTIVE');
		return effective;
	}
}
