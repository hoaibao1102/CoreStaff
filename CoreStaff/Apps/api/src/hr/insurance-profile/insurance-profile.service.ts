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
			// D40: BHXH/BHYT/BHTN is a legal obligation, not an HR choice — default true when omitted.
			participatesSocialInsurance: dto.participatesSocialInsurance ?? true,
			participatesHealthInsurance: dto.participatesHealthInsurance ?? true,
			participatesUnemploymentInsurance: dto.participatesUnemploymentInsurance ?? true,
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

	/**
	 * The ONE mutation allowed on an existing record: set `effectiveTo` on a
	 * currently open-ended one. Without this, an open-ended record overlaps
	 * every possible future period (see `rangesOverlap`), so `create()` would
	 * reject any attempt at a next version forever — closing it first is what
	 * actually makes "correction = new version" usable via the API instead of
	 * only via a DB script. Never touches `participates*`/`note` — those are
	 * still only settable at creation.
	 */
	async close(organizationId: string, id: string, effectiveToInput: string) {
		const doc = await this.insuranceProfileModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('INSURANCE_PROFILE_NOT_FOUND');
		if (doc.effectiveTo) throw new ConflictException('INSURANCE_PROFILE_ALREADY_CLOSED');

		const effectiveTo = new Date(effectiveToInput);
		if (effectiveTo <= new Date(doc.effectiveFrom)) throw new ConflictException('INSURANCE_PROFILE_DATE_RANGE_INVALID');

		const updated = await this.insuranceProfileModel
			.findOneAndUpdate({ _id: id, organizationId }, { $set: { effectiveTo } }, { new: true })
			.lean();
		return updated;
	}

	/** The participation flags in effect for `employeeId` at `asOf` — AC-INS-02 gate. */
	async findEffectiveForEmployee(organizationId: string, employeeId: string, asOf: Date = new Date()) {
		const rows = await this.insuranceProfileModel.find({ organizationId, employeeId }).lean();
		const effective = findEffective(rows, asOf);
		if (!effective) throw new NotFoundException('INSURANCE_PROFILE_NOT_EFFECTIVE');
		return effective;
	}
}
