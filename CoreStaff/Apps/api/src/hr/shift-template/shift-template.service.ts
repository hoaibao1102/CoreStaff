import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShiftTemplateDocument } from '../../database/schemas/shift-template.schema';
import { WorkplaceDocument } from '../../database/schemas/workplace.schema';
import { EmployeeAssignmentDocument } from '../../database/schemas/assignment.schema';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';
import { BatchValidator } from '../../common/batch-validator';

const DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class ShiftTemplateService {
	constructor(
		@InjectModel('ShiftTemplate') private readonly shiftTemplateModel: Model<ShiftTemplateDocument>,
		@InjectModel('Workplace') private readonly workplaceModel: Model<WorkplaceDocument>,
		@InjectModel('Assignment') private readonly assignmentModel: Model<EmployeeAssignmentDocument>,
	) {}

	async create(organizationId: string, dto: CreateShiftTemplateDto) {
		const batch = new BatchValidator();

		// FR-SCH-01: startTime must be before endTime
		batch.check(this.validateTimeOrder(dto.startTime, dto.endTime), 'time', 'SHIFT_START_TIME_MUST_BE_BEFORE_END');

		// Validate workplace exists and belongs to the same tenant
		const workplace = await this.workplaceModel.findOne({
			_id: dto.workplaceId,
			organizationId,
		}).lean();
		batch.checkExists(workplace, 'workplaceId', 'WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT');

		if (workplace) {
			// Cannot create shift template for inactive workplace
			batch.check(workplace.active, 'workplaceId', 'CANNOT_CREATE_SHIFT_FOR_INACTIVE_WORKPLACE');
		}

		// One shift template per workplace only
		const existing = await this.shiftTemplateModel.findOne({
			organizationId,
			workplaceId: dto.workplaceId,
		}).lean();
		batch.check(!existing, 'workplaceId', 'SHIFT_TEMPLATE_ALREADY_EXISTS_FOR_WORKPLACE');

		batch.throwIfAny();

		try {
			const doc = await this.shiftTemplateModel.create({ ...dto, organizationId });
			return doc.toObject();
		} catch (err) {
			throw mapDuplicateKey(err);
		}
	}

	async findAll(organizationId: string, workplaceId?: string, active?: boolean) {
		const filter: Record<string, unknown> = { organizationId };
		if (workplaceId) {
			// Validate workplace exists and belongs to tenant
			const workplace = await this.workplaceModel.findOne({ _id: workplaceId, organizationId }).lean();
			if (!workplace) {
				throw new NotFoundException('WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT');
			}
			filter.workplaceId = workplaceId;
		}
		if (active !== undefined) filter.active = active;
		return this.shiftTemplateModel.find(filter).sort({ workplaceId: 1 }).lean();
	}

	async findOne(organizationId: string, id: string) {
		const doc = await this.shiftTemplateModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('SHIFT_TEMPLATE_NOT_FOUND');
		return doc;
	}

	async update(organizationId: string, id: string, dto: UpdateShiftTemplateDto) {
		const batch = new BatchValidator();
		const patch: Record<string, unknown> = { ...dto };

		// Validate time order if both times are provided
		if (patch.startTime && patch.endTime) {
			batch.check(
				this.validateTimeOrder(patch.startTime as string, patch.endTime as string),
				'time',
				'SHIFT_START_TIME_MUST_BE_BEFORE_END'
			);
		}

		// Validate workplace if being updated
		if (patch.workplaceId) {
			const workplace = await this.workplaceModel.findOne({
				_id: patch.workplaceId,
				organizationId,
			}).lean();
			batch.checkExists(workplace, 'workplaceId', 'WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT');

			if (workplace) {
				// Cannot update to inactive workplace
				batch.check(workplace.active, 'workplaceId', 'CANNOT_UPDATE_SHIFT_FOR_INACTIVE_WORKPLACE');

				// Check: target workplace already has a shift template (excluding current)
				const existing = await this.shiftTemplateModel.findOne({
					organizationId,
					workplaceId: patch.workplaceId,
					_id: { $ne: id },
				}).lean();
				batch.check(!existing, 'workplaceId', 'SHIFT_TEMPLATE_ALREADY_EXISTS_FOR_WORKPLACE');
			}
		}

		batch.throwIfAny();

		try {
			const doc = await this.shiftTemplateModel
				.findOneAndUpdate({ _id: id, organizationId }, { $set: patch }, { new: true, runValidators: true })
				.lean();
			if (!doc) throw new NotFoundException('SHIFT_TEMPLATE_NOT_FOUND');
			return doc;
		} catch (err) {
			if (err instanceof NotFoundException) throw err;
			throw mapDuplicateKey(err);
		}
	}

	async setActive(organizationId: string, id: string, active: boolean) {
		const doc = await this.shiftTemplateModel.findOne({ _id: id, organizationId }).lean();
		if (!doc) throw new NotFoundException('SHIFT_TEMPLATE_NOT_FOUND');

		if (!active) {
			// BR-SHIFT-DEACTIVATE: Cannot deactivate if still in use by active assignments
			const activeAssignments = await this.assignmentModel.countDocuments({
				workplaceId: doc.workplaceId,
				active: true,
			});

			if (activeAssignments > 0) {
				throw new ConflictException(
					'CANNOT_DEACTIVATE_SHIFT_IN_USE_BY_ACTIVE_ASSIGNMENTS',
				);
			}
		}

		const updated = await this.shiftTemplateModel.findByIdAndUpdate(id, { active }, { new: true }).lean();
		return updated;
	}

	private validateTimeOrder(startTime: string, endTime: string): boolean {
		return startTime < endTime;
	}
}

function mapDuplicateKey(err: unknown): unknown {
	if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
		return new ConflictException('SHIFT_TEMPLATE_CODE_TAKEN');
	}
	return err;
}
