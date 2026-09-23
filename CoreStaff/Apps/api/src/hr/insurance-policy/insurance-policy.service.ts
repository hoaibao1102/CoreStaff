import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InsurancePolicyDocument } from '../../database/schemas/insurance-policy.schema';
import { InsuranceContributionType } from '../../database/schemas/enums';
import { rangesOverlap, findEffective } from '../../common/effective-dating';
import { CreateInsurancePolicyDto } from './dto/create-insurance-policy.dto';

const ALL_TYPES = Object.values(InsuranceContributionType);

@Injectable()
export class InsurancePolicyService {
	constructor(@InjectModel('InsurancePolicy') private readonly policyModel: Model<InsurancePolicyDocument>) {}

	async create(organizationId: string, createdBy: string, dto: CreateInsurancePolicyDto) {
		assertCoversAllTypes('salaryBaseRules', dto.salaryBaseRules);
		assertCoversAllTypes('capRules', dto.capRules);
		assertCoversAllTypes('employerContributionRates', dto.employerContributionRates);
		assertFloorBelowCap(dto.salaryBaseRules, dto.capRules);

		const effectiveFrom = new Date(dto.effectiveFrom);
		const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : undefined;
		if (effectiveTo && effectiveTo <= effectiveFrom) throw new ConflictException('INSURANCE_POLICY_DATE_RANGE_INVALID');

		const siblings = await this.policyModel.find({ organizationId }).lean();
		const overlaps = siblings.some((row) =>
			rangesOverlap({ effectiveFrom, effectiveTo }, { effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo }),
		);
		if (overlaps) throw new ConflictException('INSURANCE_POLICY_PERIOD_OVERLAPS');

		const nextVersion = 1 + Math.max(0, ...siblings.map((row) => row.version ?? 0));

		const doc = await this.policyModel.create({
			organizationId,
			effectiveFrom,
			effectiveTo,
			legalReference: dto.legalReference,
			socialInsuranceEmployeeRate: dto.socialInsuranceEmployeeRate,
			healthInsuranceEmployeeRate: dto.healthInsuranceEmployeeRate,
			unemploymentInsuranceEmployeeRate: dto.unemploymentInsuranceEmployeeRate,
			salaryBaseRules: dto.salaryBaseRules,
			capRules: dto.capRules,
			employerContributionRates: dto.employerContributionRates,
			version: nextVersion,
			createdBy,
		});
		return doc.toObject();
	}

	async findAll(organizationId: string) {
		return this.policyModel.find({ organizationId }).sort({ effectiveFrom: -1 }).lean();
	}

	async findOne(organizationId: string, id: string) {
		const doc = await this.policyModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('INSURANCE_POLICY_NOT_FOUND');
		return doc;
	}

	/** The policy in effect at `asOf` — AC-INS-01/AC-INS-04 input. */
	async findEffective(organizationId: string, asOf: Date = new Date()) {
		const rows = await this.policyModel.find({ organizationId }).lean();
		const effective = findEffective(rows, asOf);
		if (!effective) throw new NotFoundException('INSURANCE_POLICY_NOT_CONFIGURED');
		return effective;
	}
}

/** Every contribution type must have exactly one rule row — partial policies would leave a type silently unclamped/unrated. */
function assertCoversAllTypes(field: string, rows: Array<{ type: InsuranceContributionType }>): void {
	const types = new Set(rows.map((r) => r.type));
	if (types.size !== rows.length || ALL_TYPES.some((t) => !types.has(t))) {
		throw new BadRequestException(`${field.toUpperCase()}_MUST_COVER_ALL_TYPES`);
	}
}

/**
 * A misconfigured floor > cap for the same type would make `clampToBase`
 * (insurance-calculation.ts) silently clamp down to a base BELOW the floor
 * HR just set, instead of erroring — catch it here, once, at write time.
 */
function assertFloorBelowCap(
	salaryBaseRules: Array<{ type: InsuranceContributionType; floorAmount?: number | null }>,
	capRules: Array<{ type: InsuranceContributionType; capAmount?: number | null }>,
): void {
	for (const type of ALL_TYPES) {
		const floorAmount = salaryBaseRules.find((r) => r.type === type)?.floorAmount;
		const capAmount = capRules.find((r) => r.type === type)?.capAmount;
		if (floorAmount != null && capAmount != null && floorAmount > capAmount) {
			throw new BadRequestException('INSURANCE_POLICY_FLOOR_ABOVE_CAP');
		}
	}
}
