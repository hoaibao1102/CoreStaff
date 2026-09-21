import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmployeeAssignmentDocument } from '../../database/schemas/assignment.schema';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { WorkplaceDocument } from '../../database/schemas/workplace.schema';
import { ShiftTemplateDocument } from '../../database/schemas/shift-template.schema';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { BatchValidator } from '../../common/batch-validator';

const DUPLICATE_KEY_ERROR = 11000;
const LEGACY_UNIQUE_INDEXES = [
    'organizationId_1_userId_1_departmentId_1',
    'organizationId_1_employeeId_1_departmentId_1',
];

@Injectable()
export class AssignmentService {
    constructor(
        @InjectModel('Assignment') private readonly assignmentModel: Model<EmployeeAssignmentDocument>,
        @InjectModel('Department') private readonly departmentModel: Model<DepartmentDocument>,
        @InjectModel('EmployeeProfile') private readonly profileModel: Model<EmployeeProfileDocument>,
        @InjectModel('Workplace') private readonly workplaceModel: Model<WorkplaceDocument>,
        @InjectModel('ShiftTemplate') private readonly shiftTemplateModel: Model<ShiftTemplateDocument>,
    ) { }

    private async removeLegacyUniqueIndex(): Promise<void> {
      for (const indexName of LEGACY_UNIQUE_INDEXES) {
        try {
            await this.assignmentModel.collection.dropIndex(indexName);
        } catch (error) {
            // MongoDB throws when the old index is already gone; that is the
            // desired state. Do not hide any other database error.
            const code = (error as { code?: number }).code;
            if (code !== 27 && code !== 26) throw error;
        }
      }
    }

    async create(organizationId: string, user: any, dto: CreateAssignmentDto) {
        // Older databases may still have the pre-time-range unique index,
        // which incorrectly returns 409 for a valid historical assignment.
        await this.removeLegacyUniqueIndex();
        const batch = new BatchValidator();

        // Validate effectiveFrom / effectiveTo
        if (dto.effectiveFrom && dto.effectiveTo) {
            batch.check(new Date(dto.effectiveFrom) <= new Date(dto.effectiveTo), 'effectiveTo', 'EFFECTIVE_TO_MUST_BE_AFTER_EFFECTIVE_FROM');
        }
        if (dto.effectiveFrom) {
            batch.check(new Date(dto.effectiveFrom) >= new Date(), 'effectiveFrom', 'EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST');
        }

        // Validate department exists and belongs to tenant
        const dept = await this.departmentModel.findOne({ _id: dto.departmentId, organizationId }).lean();
        batch.checkExists(dept, 'departmentId', 'DEPARTMENT_NOT_FOUND_OR_NOT_IN_TENANT');

        // Validate workplace exists and belongs to tenant
        let workplace: any;
        if (dto.workplaceId) {
            workplace = await this.workplaceModel.findOne({ _id: dto.workplaceId, organizationId }).lean();
            batch.checkExists(workplace, 'workplaceId', 'WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT');
        }

        const userIds = dto.userIds;

        // Validate each user exists
        for (const userId of userIds) {
            const userDoc = await this.profileModel.findOne({ userId, organizationId }).lean();
            batch.checkExists(userDoc, 'userId', `USER_${userId}_NOT_FOUND_IN_TENANT`);
        }
        batch.throwIfAny();

        // An employee may already have an active assignment created without a
        // workplace. In that case, adding a workplace is an enrichment of the
        // existing assignment, not a conflicting second assignment.
        const enriched: any[] = [];
        const toCreate: string[] = [];
        for (const userId of userIds) {
            if (dto.workplaceId) {
                const assignmentWithoutWorkplace = await this.assignmentModel.findOne({
                    organizationId,
                    userId,
                    departmentId: dto.departmentId,
                    active: true,
                    $or: [{ workplaceId: { $exists: false } }, { workplaceId: null }],
                }).lean();
                if (assignmentWithoutWorkplace) {
                    const updated = await this.assignmentModel.findByIdAndUpdate(
                        assignmentWithoutWorkplace._id,
                        { workplaceId: dto.workplaceId },
                        { new: true },
                    ).lean();
                    if (updated) {
                        enriched.push(updated);
                        continue;
                    }
                }
            }

            const overlap = await this.checkOverlap(organizationId, userId, dto.departmentId, undefined, dto.effectiveFrom, dto.effectiveTo);
            if (overlap) {
                batch.add(`user ${userId}`, 'OVERLAPPING_ASSIGNMENT_EXISTS');
            } else {
                toCreate.push(userId);
            }
        }

        batch.throwIfAny();

        if (!toCreate.length) {
            return enriched.map((item) => ({
                _id: item._id,
                organizationId: item.organizationId,
                userId: item.userId,
                departmentId: item.departmentId,
                workplaceId: item.workplaceId,
                effectiveFrom: item.effectiveFrom,
                effectiveTo: item.effectiveTo,
                active: item.active,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }));
        }

        try {
            const docs = await this.assignmentModel.insertMany(
                toCreate.map((userId) => ({
                    organizationId,
                    userId,
                    departmentId: dto.departmentId,
                    workplaceId: dto.workplaceId,
                    effectiveFrom: dto.effectiveFrom,
                    effectiveTo: dto.effectiveTo,
                })),
                { ordered: false }
            );
            const data = docs.map((doc) => doc.toObject({ versionKey: false }));

            return [...enriched, ...data].map((item) => ({
                _id: item._id,
                organizationId: item.organizationId,
                userId: item.userId,
                departmentId: item.departmentId,
                workplaceId: item.workplaceId,
                effectiveFrom: item.effectiveFrom,
                effectiveTo: item.effectiveTo,
                active: item.active,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }));
        } catch (err) {
            throw mapDuplicateKey(err);
        }
    }

    async findAll(
        organizationId: string,
        userId?: string,
        departmentId?: string,
        workplaceId?: string,
        active?: boolean,
    ) {
        const filter: Record<string, unknown> = { organizationId };
        if (userId) filter.userId = userId;
        if (departmentId) filter.departmentId = departmentId;
        if (workplaceId) filter.workplaceId = workplaceId;
        if (active !== undefined) filter.active = active;
        return this.assignmentModel.find(filter).sort({ createdAt: -1 }).lean();
    }

    async findOne(organizationId: string, id: string) {
        const doc = await this.assignmentModel.findOne({ _id: id, organizationId }).lean();
        if (!doc) throw new NotFoundException('ASSIGNMENT_NOT_FOUND');
        return doc;
    }

    async update(organizationId: string, id: string, dto: UpdateAssignmentDto) {
        const batch = new BatchValidator();
        const patch: Record<string, unknown> = { ...dto };

        // Validate references if being updated
        if (patch.userId || patch.departmentId || patch.workplaceId) {
            const current = await this.assignmentModel.findById(id).lean();
            if (!current) throw new NotFoundException('ASSIGNMENT_NOT_FOUND');

            const refs: Record<string, unknown> = {
                userId: (patch.userId as string) || current.userId,
                departmentId: (patch.departmentId as string) || current.departmentId,
                workplaceId: (patch.workplaceId as string) || current.workplaceId,
                effectiveFrom: (patch.effectiveFrom as string) || current.effectiveFrom,
                effectiveTo: (patch.effectiveTo as string) || current.effectiveTo,
            };

            // Validate effectiveFrom / effectiveTo
            if (refs.effectiveFrom && refs.effectiveTo) {
                batch.check(new Date(refs.effectiveFrom as string) <= new Date(refs.effectiveTo as string), 'effectiveTo', 'EFFECTIVE_TO_MUST_BE_AFTER_EFFECTIVE_FROM');
            }
            if (refs.effectiveFrom) {
                batch.check(new Date(refs.effectiveFrom as string) >= new Date(), 'effectiveFrom', 'EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST');
            }

            // Validate user exists in tenant
            if (refs.userId) {
                const userDoc = await this.profileModel.findOne({ userId: refs.userId, organizationId }).lean();
                batch.checkExists(userDoc, 'userId', 'USER_NOT_FOUND_IN_TENANT');
            }

            // Validate department exists
            if (refs.departmentId) {
                const dept = await this.departmentModel.findOne({ _id: refs.departmentId, organizationId }).lean();
                batch.checkExists(dept, 'departmentId', 'DEPARTMENT_NOT_FOUND_OR_NOT_IN_TENANT');
            }

            // Validate workplace exists
            if (refs.workplaceId) {
                const workplace = await this.workplaceModel.findOne({ _id: refs.workplaceId, organizationId }).lean();
                batch.checkExists(workplace, 'workplaceId', 'WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT');
            }

            await this.validateReferences(organizationId, {
                userId: refs.userId as string | undefined,
                departmentId: refs.departmentId as string | undefined,
                workplaceId: refs.workplaceId as string | undefined,
            });

            if (refs.userId && refs.departmentId) {
                const overlap = await this.checkOverlap(
                    organizationId,
                    refs.userId as string,
                    refs.departmentId as string,
                    id,
                    refs.effectiveFrom as string | undefined,
                    refs.effectiveTo as string | undefined
                );
                if (overlap) {
                    batch.add('user + department', 'OVERLAPPING_ASSIGNMENT_EXISTS');
                }
            }
        }

        batch.throwIfAny();

        try {
            const doc = await this.assignmentModel
                .findOneAndUpdate({ _id: id, organizationId }, { $set: patch }, { new: true, runValidators: true })
                .lean();
            if (!doc) throw new NotFoundException('ASSIGNMENT_NOT_FOUND');
            return doc;
        } catch (err) {
            if (err instanceof NotFoundException) throw err;
            throw mapDuplicateKey(err);
        }
    }

    async setActive(organizationId: string, id: string, active: boolean) {
        const doc = await this.assignmentModel.findOne({ _id: id, organizationId }).lean();
        if (!doc) throw new NotFoundException('ASSIGNMENT_NOT_FOUND');

        // HR có thể deactivate bất kỳ assignment nào mà không cần điều kiện
        // (NV nghỉ việc, chuyển phòng, hoặc sửa lỗi dữ liệu)

        const updated = await this.assignmentModel.findByIdAndUpdate(id, { active }, { new: true }).lean();
        return updated;
    }

    private async validateReferences(organizationId: string, refs: {
        userId?: string;
        departmentId?: string;
        workplaceId?: string;
    }) {
        // Validate Department exists and belongs to tenant
        if (refs.departmentId) {
            const dept = await this.departmentModel.findOne({ _id: refs.departmentId, organizationId }).lean();
            if (!dept) throw new NotFoundException('DEPARTMENT_NOT_FOUND_OR_NOT_IN_TENANT');
        }

        // Validate Workplace exists and belongs to tenant
        if (refs.workplaceId) {
            const workplace = await this.workplaceModel.findOne({ _id: refs.workplaceId, organizationId }).lean();
            if (!workplace) throw new NotFoundException('WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT');
        }
    }

    private async checkOverlap(
        organizationId: string,
        userId: string,
        departmentId: string,
        excludeId?: string,
        effectiveFrom?: string,
        effectiveTo?: string,
    ): Promise<boolean> {
        // FR-HRCFG-04: No two active assignments can overlap for same user + department
        const query: Record<string, unknown> = {
            organizationId,
            userId,
            departmentId,
            active: true,
        };
        if (excludeId) query._id = { $ne: excludeId };

        const existing = await this.assignmentModel.find(query).sort({ createdAt: -1 }).lean();
        const nextFrom = effectiveFrom ? new Date(effectiveFrom).getTime() : Number.NEGATIVE_INFINITY;
        const nextTo = effectiveTo ? new Date(effectiveTo).getTime() : Number.POSITIVE_INFINITY;

        return existing.some((assignment) => {
            const currentFrom = assignment.effectiveFrom
                ? new Date(assignment.effectiveFrom).getTime()
                : Number.NEGATIVE_INFINITY;
            const currentTo = assignment.effectiveTo
                ? new Date(assignment.effectiveTo).getTime()
                : Number.POSITIVE_INFINITY;
            return currentFrom <= nextTo && nextFrom <= currentTo;
        });
    }
}

function mapDuplicateKey(err: unknown): unknown {
    if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
        return new ConflictException('ASSIGNMENT_ALREADY_EXISTS');
    }
    return err;
}
