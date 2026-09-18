import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkplaceDocument } from '../../database/schemas/workplace.schema';
import { EmployeeAssignmentDocument } from '../../database/schemas/assignment.schema';
import { normalizeCode } from '../../database/schemas/enums';
import { CreateWorkplaceDto } from './dto/create-workplace.dto';
import { UpdateWorkplaceDto } from './dto/update-workplace.dto';
import { BatchValidator } from '../../common/batch-validator';

const DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class WorkplaceService {
	constructor(
		@InjectModel('Workplace') private readonly workplaceModel: Model<WorkplaceDocument>,
		@InjectModel('Assignment') private readonly assignmentModel: Model<EmployeeAssignmentDocument>,
	) {}

	async create(organizationId: string, dto: CreateWorkplaceDto) {
		const batch = new BatchValidator();

		// Check for duplicate code within the same tenant
		const existingByCode = await this.workplaceModel.findOne({
			organizationId,
			code: normalizeCode(dto.code),
		}).lean();
		batch.check(!existingByCode, 'code', 'WORKPLACE_CODE_ALREADY_EXISTS');

		// Check for duplicate coordinates within the same tenant
		const existingByCoords = await this.workplaceModel.findOne({
			organizationId,
			latitude: dto.latitude,
			longitude: dto.longitude,
		}).lean();
		batch.check(!existingByCoords, 'coordinates', 'WORKPLACE_COORDINATES_ALREADY_EXISTS');

		batch.throwIfAny();

		try {
			const doc = await this.workplaceModel.create({ ...dto, organizationId });
			return doc.toObject();
		} catch (err) {
			throw mapDuplicateKey(err);
		}
	}

	async findAll(organizationId: string, active?: boolean, search?: string) {
		const filter: Record<string, unknown> = { organizationId };
		if (active !== undefined) filter.active = active;

		// Search by code, name or address
		if (search) {
			filter.$or = [
				{ code: new RegExp(search, 'i') },
				{ name: new RegExp(search, 'i') },
				{ address: new RegExp(search, 'i') },
			];
		}

		return this.workplaceModel.find(filter).sort({ name: 1 }).lean();
	}

	async findOne(organizationId: string, id: string) {
		const doc = await this.workplaceModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('WORKPLACE_NOT_FOUND');
		return doc;
	}

	async update(organizationId: string, id: string, dto: UpdateWorkplaceDto) {
		const batch = new BatchValidator();
		const patch: Record<string, unknown> = { ...dto };
		if (typeof patch.code === 'string') patch.code = normalizeCode(patch.code);

		// Check for duplicate coordinates within the same tenant (excluding current)
		if (patch.latitude !== undefined && patch.longitude !== undefined) {
			const existing = await this.workplaceModel.findOne({
				organizationId,
				latitude: patch.latitude,
				longitude: patch.longitude,
				_id: { $ne: id },
			}).lean();
			batch.check(!existing, 'coordinates', 'WORKPLACE_COORDINATES_ALREADY_EXISTS');
		}

		batch.throwIfAny();

		try {
			const doc = await this.workplaceModel
				.findOneAndUpdate({ _id: id, organizationId }, { $set: patch }, { new: true, runValidators: true })
				.lean();
			if (!doc) throw new NotFoundException('WORKPLACE_NOT_FOUND');
			return doc;
		} catch (err) {
			if (err instanceof NotFoundException) throw err;
			throw mapDuplicateKey(err);
		}
	}

	async setActive(organizationId: string, id: string, active: boolean) {
		const doc = await this.workplaceModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('WORKPLACE_NOT_FOUND');

		if (!active) {
			// BR-WORKPLACE-DEACTIVATE: Cannot deactivate if still in use by active assignments
			const activeAssignments = await this.assignmentModel.countDocuments({
				workplaceId: id,
				active: true,
			});

			if (activeAssignments > 0) {
				throw new ConflictException(
					'CANNOT_DEACTIVATE_WORKPLACE_IN_USE_BY_ACTIVE_ASSIGNMENTS',
				);
			}
		}

		const updated = await this.workplaceModel.findByIdAndUpdate(id, { active }, { new: true }).lean();
		return updated;
	}
}

function mapDuplicateKey(err: unknown): unknown {
	if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
		return new ConflictException('WORKPLACE_CODE_TAKEN');
	}
	return err;
}
