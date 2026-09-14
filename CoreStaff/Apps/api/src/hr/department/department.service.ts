import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { normalizeCode } from '../../database/schemas/enums';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

const DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class DepartmentService {
	constructor(@InjectModel('Department') private readonly departmentModel: Model<DepartmentDocument>) {}

	async create(organizationId: string, dto: CreateDepartmentDto) {
		try {
			const doc = await this.departmentModel.create({ ...dto, organizationId });
			return doc.toObject();
		} catch (err) {
			throw mapDuplicateKey(err);
		}
	}

	async findAll(organizationId: string, active?: boolean) {
		const filter: Record<string, unknown> = { organizationId };
		if (active !== undefined) filter.active = active;
		return this.departmentModel.find(filter).sort({ name: 1 }).lean();
	}

	async findOne(organizationId: string, id: string) {
		const doc = await this.departmentModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('DEPARTMENT_NOT_FOUND');
		return doc;
	}

	async update(organizationId: string, id: string, dto: UpdateDepartmentDto) {
		const patch: Record<string, unknown> = { ...dto };
		if (typeof patch.code === 'string') patch.code = normalizeCode(patch.code);

		try {
			const doc = await this.departmentModel
				.findOneAndUpdate({ _id: id, organizationId }, { $set: patch }, { new: true, runValidators: true })
				.lean();
			if (!doc) throw new NotFoundException('DEPARTMENT_NOT_FOUND');
			return doc;
		} catch (err) {
			if (err instanceof NotFoundException) throw err;
			throw mapDuplicateKey(err);
		}
	}

	async setActive(organizationId: string, id: string, active: boolean) {
		const doc = await this.departmentModel
			.findOneAndUpdate({ _id: id, organizationId }, { $set: { active } }, { new: true })
			.lean();
		if (!doc) throw new NotFoundException('DEPARTMENT_NOT_FOUND');
		return doc;
	}
}

function mapDuplicateKey(err: unknown): unknown {
	if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
		return new ConflictException('DEPARTMENT_CODE_TAKEN');
	}
	return err;
}
