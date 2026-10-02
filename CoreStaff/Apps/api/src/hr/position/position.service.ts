import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { PositionDocument } from '../../database/schemas/position.schema';
import { normalizeCode } from '../../database/schemas/enums';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

const DUPLICATE_KEY_ERROR = 11000;

export interface FindAllPositionsOptions {
	departmentId?: string;
	active?: boolean;
}

@Injectable()
export class PositionService {
	constructor(
		@InjectModel('Position') private readonly positionModel: Model<PositionDocument>,
		@InjectModel('Department') private readonly departmentModel: Model<DepartmentDocument>,
	) {}

	async create(organizationId: string, dto: CreatePositionDto) {
		// A position must live inside a department of the same tenant.
		const departmentExists = await this.departmentModel.exists({ _id: dto.departmentId, organizationId });
		if (!departmentExists) throw new NotFoundException('DEPARTMENT_NOT_FOUND');
		try {
			const doc = await this.positionModel.create({ ...dto, organizationId });
			return doc.toObject();
		} catch (err) {
			throw mapDuplicateKey(err);
		}
	}

	async findAll(organizationId: string, options: FindAllPositionsOptions = {}) {
		const filter: Record<string, unknown> = { organizationId };
		if (options.departmentId) filter.departmentId = options.departmentId;
		if (options.active !== undefined) filter.active = options.active;
		return this.positionModel.find(filter).sort({ name: 1 }).lean();
	}

	async findOne(organizationId: string, id: string) {
		const doc = await this.positionModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('POSITION_NOT_FOUND');
		return doc;
	}

	async update(organizationId: string, id: string, dto: UpdatePositionDto) {
		const patch: Record<string, unknown> = { ...dto };
		if (typeof patch.code === 'string') patch.code = normalizeCode(patch.code);

		try {
			const doc = await this.positionModel
				.findOneAndUpdate({ _id: id, organizationId }, { $set: patch }, { new: true, runValidators: true })
				.lean();
			if (!doc) throw new NotFoundException('POSITION_NOT_FOUND');
			return doc;
		} catch (err) {
			if (err instanceof NotFoundException) throw err;
			throw mapDuplicateKey(err);
		}
	}

	async setActive(organizationId: string, id: string, active: boolean) {
		const doc = await this.positionModel
			.findOneAndUpdate({ _id: id, organizationId }, { $set: { active } }, { new: true })
			.lean();
		if (!doc) throw new NotFoundException('POSITION_NOT_FOUND');
		return doc;
	}
}

function mapDuplicateKey(err: unknown): unknown {
	if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
		return new ConflictException('POSITION_CODE_TAKEN');
	}
	return err;
}
