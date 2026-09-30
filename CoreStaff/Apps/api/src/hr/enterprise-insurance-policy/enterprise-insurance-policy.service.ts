import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EnterpriseInsurancePolicyDocument } from '../../database/schemas/enterprise-insurance-policy.schema';
import { EnterpriseInsuranceCostBearer } from '../../database/schemas/enums';
import { rangesOverlap, findEffective } from '../../common/effective-dating';
import { CreateEnterpriseInsurancePolicyDto } from './dto/create-enterprise-insurance-policy.dto';

@Injectable()
export class EnterpriseInsurancePolicyService {
	constructor(@InjectModel('EnterpriseInsurancePolicy') private readonly policyModel: Model<EnterpriseInsurancePolicyDocument>) {}

	async create(organizationId: string, createdBy: string, dto: CreateEnterpriseInsurancePolicyDto) {
		if (dto.costBearer === EnterpriseInsuranceCostBearer.EMPLOYER && (dto.employeeContributionAmount ?? 0) > 0) {
			throw new BadRequestException('ENTERPRISE_INSURANCE_EMPLOYEE_CONTRIBUTION_NOT_ALLOWED');
		}

		const effectiveFrom = new Date(dto.effectiveFrom);
		const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : undefined;
		if (effectiveTo && effectiveTo <= effectiveFrom) throw new ConflictException('ENTERPRISE_INSURANCE_POLICY_DATE_RANGE_INVALID');

		const siblings = await this.policyModel.find({ organizationId }).lean();
		const overlaps = siblings.some((row) =>
			rangesOverlap({ effectiveFrom, effectiveTo }, { effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo }),
		);
		if (overlaps) throw new ConflictException('ENTERPRISE_INSURANCE_POLICY_PERIOD_OVERLAPS');

		const nextVersion = 1 + Math.max(0, ...siblings.map((row) => row.version ?? 0));

		const doc = await this.policyModel.create({
			organizationId,
			effectiveFrom,
			effectiveTo,
			provider: dto.provider,
			policyNumber: dto.policyNumber,
			coverageDescription: dto.coverageDescription,
			premiumPerEmployee: dto.premiumPerEmployee ?? null,
			costBearer: dto.costBearer,
			employeeContributionAmount: dto.employeeContributionAmount ?? null,
			note: dto.note,
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
		if (!doc) throw new NotFoundException('ENTERPRISE_INSURANCE_POLICY_NOT_FOUND');
		return doc;
	}

	/**
	 * D42: the ONE mutation allowed on an existing policy — set `effectiveTo`
	 * on a currently open-ended one, so `create()` (blocked otherwise by the
	 * overlap check against an infinite-ended sibling) can add a next version.
	 */
	async close(organizationId: string, id: string, effectiveToInput: string) {
		const doc = await this.policyModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('ENTERPRISE_INSURANCE_POLICY_NOT_FOUND');
		if (doc.effectiveTo) throw new ConflictException('ENTERPRISE_INSURANCE_POLICY_ALREADY_CLOSED');

		const effectiveTo = new Date(effectiveToInput);
		if (effectiveTo <= new Date(doc.effectiveFrom)) throw new ConflictException('ENTERPRISE_INSURANCE_POLICY_DATE_RANGE_INVALID');

		return this.policyModel.findOneAndUpdate({ _id: id, organizationId }, { $set: { effectiveTo } }, { new: true }).lean();
	}

	async findEffective(organizationId: string, asOf: Date = new Date()) {
		const rows = await this.policyModel.find({ organizationId }).lean();
		const effective = findEffective(rows, asOf);
		if (!effective) throw new NotFoundException('ENTERPRISE_INSURANCE_POLICY_NOT_CONFIGURED');
		return effective;
	}
}
