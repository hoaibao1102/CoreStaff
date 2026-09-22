import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmploymentContractDocument } from '../../database/schemas/employment-contract.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { rangesOverlap, findEffective } from '../../common/effective-dating';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractService {
	constructor(
		@InjectModel('EmploymentContract') private readonly contractModel: Model<EmploymentContractDocument>,
		@InjectModel('EmployeeProfile') private readonly profileModel: Model<EmployeeProfileDocument>,
	) {}

	async create(organizationId: string, createdBy: string, dto: CreateContractDto) {
		const exists = await this.profileModel.exists({ _id: dto.employeeId, organizationId });
		if (!exists) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');

		const startDate = new Date(dto.startDate);
		const endDate = dto.endDate ? new Date(dto.endDate) : undefined;
		if (endDate && endDate <= startDate) throw new ConflictException('CONTRACT_DATE_RANGE_INVALID');
		// INDEFINITE_TERM may still carry an endDate (e.g. converted to a fixed one
		// later) but PROBATION/FIXED_TERM always need one — DTO already enforces this.

		const siblings = await this.contractModel.find({ organizationId, employeeId: dto.employeeId }).lean();
		const overlaps = siblings.some((row) =>
			rangesOverlap(
				{ effectiveFrom: startDate, effectiveTo: endDate },
				{ effectiveFrom: row.startDate, effectiveTo: row.endDate },
			),
		);
		if (overlaps) throw new ConflictException('CONTRACT_PERIOD_OVERLAPS');

		const doc = await this.contractModel.create({
			organizationId,
			employeeId: dto.employeeId,
			contractType: dto.contractType,
			startDate,
			endDate,
			documentRef: dto.documentRef,
			createdBy,
		});
		return doc.toObject();
	}

	async findAll(organizationId: string, employeeId?: string) {
		const filter: Record<string, unknown> = { organizationId };
		if (employeeId) filter.employeeId = employeeId;
		return this.contractModel.find(filter).sort({ startDate: -1 }).lean();
	}

	async findOne(organizationId: string, id: string) {
		const doc = await this.contractModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('CONTRACT_NOT_FOUND');
		return doc;
	}

	/** The contract in effect for `employeeId` at `asOf` (default now) — §30A.3 eligibility input. */
	async findEffectiveForEmployee(
		organizationId: string,
		employeeId: string,
		asOf: Date = new Date(),
	): Promise<Record<string, unknown>> {
		const rows = await this.contractModel.find({ organizationId, employeeId }).lean();
		const ranged: Array<Record<string, unknown> & { effectiveFrom: Date; effectiveTo?: Date }> = rows.map((r) => ({
			...r,
			effectiveFrom: r.startDate,
			effectiveTo: r.endDate,
		}));
		const effective = findEffective(ranged, asOf);
		if (!effective) throw new NotFoundException('CONTRACT_NOT_EFFECTIVE');
		return effective;
	}
}
