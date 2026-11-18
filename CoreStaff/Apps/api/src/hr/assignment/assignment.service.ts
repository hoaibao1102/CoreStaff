import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { EmployeeAssignmentDocument } from '../../database/schemas/assignment.schema';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { WorkplaceDocument } from '../../database/schemas/workplace.schema';
import { ShiftTemplateDocument } from '../../database/schemas/shift-template.schema';
import { WORKING_EMPLOYMENT_STATUSES } from '../../database/schemas/enums';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { BatchValidator } from '../../common/batch-validator';
import { PeriodVersionService } from '../timesheet/period-version.service';
import { dateVN } from '../../common/date-only';

const DUPLICATE_KEY_ERROR = 11000;
const LEGACY_UNIQUE_INDEXES = [
    'organizationId_1_userId_1_departmentId_1',
    'organizationId_1_employeeId_1_departmentId_1',
];

/**
 * Error messages follow `CODE: chi tiết tiếng Việt`. The exception filter turns
 * the prefix into `error.code` and keeps the whole string as `error.message`,
 * so the UI can show the specific reason instead of a generic failure.
 */
const EMPLOYMENT_STATUS_LABEL: Record<string, string> = {
    PROBATION: 'Thử việc',
    ACTIVE: 'Đang làm việc',
    ON_LEAVE: 'Đang nghỉ phép dài hạn',
    RESIGNED: 'Đã nghỉ việc',
    TERMINATED: 'Đã nghỉ việc',
};

function todayVietnam(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function dateOnly(value: string): string {
    return value.slice(0, 10);
}

function isDateBeforeToday(dateStr: string): boolean {
    return dateOnly(dateStr) < todayVietnam();
}

function describeRange(from?: string, to?: string): string {
    if (from && to) return `từ ${dateVN(from)} đến ${dateVN(to)}`;
    if (from) return `từ ${dateVN(from)}, không thời hạn`;
    if (to) return `đến ${dateVN(to)}`;
    return 'không giới hạn thời gian';
}

function describeEmployee(profile: any, fallbackId: string): string {
    if (!profile) return `người dùng ${fallbackId}`;
    const name = profile.fullName || 'Nhân viên';
    return profile.employeeCode ? `${name} (${profile.employeeCode})` : name;
}

@Injectable()
export class AssignmentService {
    constructor(
        @InjectModel('Assignment') private readonly assignmentModel: Model<EmployeeAssignmentDocument>,
        @InjectModel('Department') private readonly departmentModel: Model<DepartmentDocument>,
        @InjectModel('EmployeeProfile') private readonly profileModel: Model<EmployeeProfileDocument>,
        @InjectModel('Workplace') private readonly workplaceModel: Model<WorkplaceDocument>,
        @InjectModel('ShiftTemplate') private readonly shiftTemplateModel: Model<ShiftTemplateDocument>,
        private readonly periodVersion: PeriodVersionService,
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

    /**
     * Only an employee who is currently working (PROBATION / ACTIVE / ON_LEAVE,
     * SRS §176) can be assigned. Returns the profile so callers can name the
     * employee in later messages.
     */
    private async checkAssignableEmployee(
        organizationId: string,
        userId: string,
        batch: BatchValidator,
    ): Promise<any | null> {
        const profile: any = await this.profileModel.findOne({ userId, organizationId }).lean();
        if (!profile) {
            batch.add('userId', `EMPLOYEE_PROFILE_NOT_FOUND: Không tìm thấy hồ sơ nhân viên của người dùng ${userId} trong tổ chức này nên không thể phân công.`);
            return null;
        }
        if (!WORKING_EMPLOYMENT_STATUSES.includes(profile.employmentStatus)) {
            const statusLabel = EMPLOYMENT_STATUS_LABEL[profile.employmentStatus] ?? String(profile.employmentStatus);
            batch.add('userId', `EMPLOYEE_NOT_WORKING: Nhân viên ${describeEmployee(profile, userId)} đang ở trạng thái "${statusLabel}" nên không thể phân công. Chỉ phân công được nhân viên đang làm việc.`);
            return null;
        }
        return profile;
    }

    async create(organizationId: string, user: any, dto: CreateAssignmentDto) {
        // Older databases may still have the pre-time-range unique index,
        // which incorrectly returns 409 for a valid historical assignment.
        await this.removeLegacyUniqueIndex();
        const batch = new BatchValidator();

        // Validate effectiveFrom / effectiveTo
        if (dto.effectiveFrom && dto.effectiveTo) {
            batch.check(
                dateOnly(dto.effectiveFrom) <= dateOnly(dto.effectiveTo),
                'effectiveTo',
                `EFFECTIVE_TO_MUST_BE_AFTER_EFFECTIVE_FROM: Ngày kết thúc (${dateVN(dto.effectiveTo)}) không được trước ngày bắt đầu (${dateVN(dto.effectiveFrom)}).`,
            );
        }
        if (dto.effectiveFrom) {
            batch.check(
                !isDateBeforeToday(dto.effectiveFrom),
                'effectiveFrom',
                `EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST: Ngày bắt đầu (${dateVN(dto.effectiveFrom)}) đã qua. Ngày bắt đầu phải từ hôm nay (${dateVN(todayVietnam())}) trở đi.`,
            );
        }

        // Validate department exists and belongs to tenant
        const dept = await this.departmentModel.findOne({ _id: dto.departmentId, organizationId }).lean();
        batch.checkExists(dept, 'departmentId', 'DEPARTMENT_NOT_FOUND_OR_NOT_IN_TENANT: Phòng ban đã chọn không tồn tại trong tổ chức này.');

        // Validate workplace exists and belongs to tenant
        let workplace: any;
        if (dto.workplaceId) {
            workplace = await this.workplaceModel.findOne({ _id: dto.workplaceId, organizationId }).lean();
            batch.checkExists(workplace, 'workplaceId', 'WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT: Nơi làm việc đã chọn không tồn tại trong tổ chức này.');
        }

        const userIds = dto.userIds?.length ? dto.userIds : dto.userId ? [dto.userId] : [];
        if (!userIds.length) {
            throw new BadRequestException('AT_LEAST_ONE_USER_REQUIRED: Vui lòng chọn ít nhất một nhân viên để phân công.');
        }

        // Each user must have a profile in this tenant and be currently working.
        const profiles = new Map<string, any>();
        for (const userId of userIds) {
            const profile = await this.checkAssignableEmployee(organizationId, userId, batch);
            if (profile) profiles.set(userId, profile);
        }
        batch.throwIfAny();

        // An employee may already have an active assignment created without a
        // workplace. In that case, adding a workplace is an enrichment of the
        // existing assignment, not a conflicting second assignment.
        const enrichmentIds: string[] = [];
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
                    enrichmentIds.push(String(assignmentWithoutWorkplace._id));
                    continue;
                }
            }

            const conflict = await this.checkOverlap(organizationId, userId, dto.departmentId, undefined, dto.effectiveFrom, dto.effectiveTo);
            if (conflict) {
                batch.add(
                    'assignment',
                    `OVERLAPPING_ASSIGNMENT_EXISTS: Nhân viên ${describeEmployee(profiles.get(userId), userId)} đã có phân công tại phòng ban ${(dept as any)?.name ?? 'này'} ${describeRange(conflict.effectiveFrom, conflict.effectiveTo)}, trùng với khoảng thời gian bạn chọn (${describeRange(dto.effectiveFrom, dto.effectiveTo)}). Hãy chọn ngày khác hoặc ngưng phân công cũ trước.`,
                );
            } else {
                toCreate.push(userId);
            }
        }

        batch.throwIfAny();

        try {
            return await this.transaction(async session => {
                const enriched: any[] = [];
                for (const assignmentId of enrichmentIds) {
                    const updated = await this.assignmentModel.findByIdAndUpdate(
                        assignmentId, { workplaceId: dto.workplaceId }, { new: true, session },
                    ).lean();
                    if (!updated) throw new NotFoundException('ASSIGNMENT_NOT_FOUND: Không tìm thấy phân công cần bổ sung nơi làm việc (có thể đã bị xóa).');
                    enriched.push(updated);
                }
                const docs = toCreate.length ? await this.assignmentModel.insertMany(
                    toCreate.map((userId) => ({
                        organizationId,
                        userId,
                        departmentId: dto.departmentId,
                        workplaceId: dto.workplaceId,
                        effectiveFrom: dto.effectiveFrom,
                        effectiveTo: dto.effectiveTo,
                    })),
                    { ordered: false, session },
                ) : [];
                const data = docs.map((doc) => doc.toObject({ versionKey: false }));
                const changed = [...enriched, ...data];
                if (changed.length) {
                    const window = unionAssignmentWindows(changed);
                    await this.invalidate(organizationId, window.from, window.to, session);
                }
                return changed.map(publicAssignment);
            });
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
        if (!doc) throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
        return doc;
    }

    async update(organizationId: string, id: string, dto: UpdateAssignmentDto) {
        const batch = new BatchValidator();
        const patch: Record<string, unknown> = { ...dto };

        // Validate references if being updated
        if (patch.userId || patch.departmentId || patch.workplaceId || patch.effectiveFrom || patch.effectiveTo) {
            const current = await this.assignmentModel.findOne({ _id: id, organizationId }).lean();
            if (!current) throw new NotFoundException(ASSIGNMENT_NOT_FOUND);

            const refs: Record<string, unknown> = {
                userId: (patch.userId as string) || current.userId,
                departmentId: (patch.departmentId as string) || current.departmentId,
                workplaceId: (patch.workplaceId as string) || current.workplaceId,
                effectiveFrom: (patch.effectiveFrom as string) || current.effectiveFrom,
                effectiveTo: (patch.effectiveTo as string) || current.effectiveTo,
            };

            // Only what the caller actually changes is re-validated. Rows that
            // were seeded or imported earlier (past start date, user without a
            // profile, an old overlapping window) must stay editable for the
            // untouched fields.
            const same = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');
            const userChanged = !same(refs.userId, current.userId);
            const departmentChanged = !same(refs.departmentId, current.departmentId);
            const workplaceChanged = !same(refs.workplaceId, current.workplaceId);
            const fromChanged = !same(dateOnly(String(refs.effectiveFrom ?? '')), dateOnly(String(current.effectiveFrom ?? '')));
            const toChanged = !same(dateOnly(String(refs.effectiveTo ?? '')), dateOnly(String(current.effectiveTo ?? '')));

            // Validate effectiveFrom / effectiveTo
            if (refs.effectiveFrom && refs.effectiveTo) {
                batch.check(
                    dateOnly(String(refs.effectiveFrom)) <= dateOnly(String(refs.effectiveTo)),
                    'effectiveTo',
                    `EFFECTIVE_TO_MUST_BE_AFTER_EFFECTIVE_FROM: Ngày kết thúc (${dateVN(String(refs.effectiveTo))}) không được trước ngày bắt đầu (${dateVN(String(refs.effectiveFrom))}).`,
                );
            }
            if (fromChanged && patch.effectiveFrom) {
                batch.check(
                    !isDateBeforeToday(patch.effectiveFrom as string),
                    'effectiveFrom',
                    `EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST: Ngày bắt đầu mới (${dateVN(patch.effectiveFrom as string)}) đã qua. Ngày bắt đầu phải từ hôm nay (${dateVN(todayVietnam())}) trở đi.`,
                );
            }

            // Re-assigning to a different employee: they must be a working employee.
            let profile: any = null;
            if (refs.userId) {
                if (userChanged) profile = await this.checkAssignableEmployee(organizationId, refs.userId as string, batch);
                else profile = await this.profileModel.findOne({ userId: refs.userId, organizationId }).lean();
            }

            let dept: any = null;
            if (refs.departmentId) {
                dept = await this.departmentModel.findOne({ _id: refs.departmentId, organizationId }).lean();
                if (departmentChanged) batch.checkExists(dept, 'departmentId', 'DEPARTMENT_NOT_FOUND_OR_NOT_IN_TENANT: Phòng ban đã chọn không tồn tại trong tổ chức này.');
            }

            if (refs.workplaceId && workplaceChanged) {
                const workplace = await this.workplaceModel.findOne({ _id: refs.workplaceId, organizationId }).lean();
                batch.checkExists(workplace, 'workplaceId', 'WORKPLACE_NOT_FOUND_OR_NOT_IN_TENANT: Nơi làm việc đã chọn không tồn tại trong tổ chức này.');
            }

            if (refs.userId && refs.departmentId && (userChanged || departmentChanged || fromChanged || toChanged)) {
                const conflict = await this.checkOverlap(
                    organizationId,
                    refs.userId as string,
                    refs.departmentId as string,
                    id,
                    refs.effectiveFrom as string | undefined,
                    refs.effectiveTo as string | undefined
                );
                if (conflict) {
                    batch.add(
                        'assignment',
                        `OVERLAPPING_ASSIGNMENT_EXISTS: Nhân viên ${describeEmployee(profile, String(refs.userId))} đã có phân công khác tại phòng ban ${dept?.name ?? 'này'} ${describeRange(conflict.effectiveFrom, conflict.effectiveTo)}, trùng với khoảng thời gian bạn chọn (${describeRange(refs.effectiveFrom as string | undefined, refs.effectiveTo as string | undefined)}). Hãy chọn ngày khác hoặc ngưng phân công kia trước.`,
                    );
                }
            }
        }

        batch.throwIfAny();

        try {
            const old = await this.findOne(organizationId, id);
            return await this.transaction(async session => {
                const doc = await this.assignmentModel
                    .findOneAndUpdate({ _id: id, organizationId }, { $set: patch }, { new: true, runValidators: true, session })
                    .lean();
                if (!doc) throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
                const window = unionAssignmentWindows([old, { ...old, ...patch }]);
                await this.invalidate(organizationId, window.from, window.to, session);
                return doc;
            });
        } catch (err) {
            if (err instanceof NotFoundException) throw err;
            throw mapDuplicateKey(err);
        }
    }

    async setActive(organizationId: string, id: string, active: boolean) {
        const doc = await this.assignmentModel.findOne({ _id: id, organizationId }).lean();
        if (!doc) throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
        if (doc.active === active) return doc;

        // HR có thể deactivate bất kỳ assignment nào mà không cần điều kiện
        // (NV nghỉ việc, chuyển phòng, hoặc sửa lỗi dữ liệu)

        return this.transaction(async session => {
            const updated = await this.assignmentModel.findByIdAndUpdate(id, { active }, { new: true, session }).lean();
            if (!updated) throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
            await this.invalidate(organizationId, doc.effectiveFrom, doc.effectiveTo, session);
            return updated;
        });
    }

    private async transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
        const session = await this.assignmentModel.db.startSession();
        try {
            let result!: T;
            await session.withTransaction(async () => { result = await work(session); });
            return result;
        } finally {
            await session.endSession();
        }
    }

    private invalidate(organizationId: string, from: string | undefined, to: string | undefined, session: ClientSession) {
        return this.periodVersion.bumpForEffectiveWindow(
            organizationId, from ? effectiveStart(from) : undefined, to ? dayAfter(to) : undefined, session,
        );
    }

    /** Returns the existing active assignment the new window collides with, if any. */
    private async checkOverlap(
        organizationId: string,
        userId: string,
        departmentId: string,
        excludeId?: string,
        effectiveFrom?: string,
        effectiveTo?: string,
    ): Promise<{ effectiveFrom?: string; effectiveTo?: string } | null> {
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

        return existing.find((assignment) => {
            const currentFrom = assignment.effectiveFrom
                ? new Date(assignment.effectiveFrom).getTime()
                : Number.NEGATIVE_INFINITY;
            const currentTo = assignment.effectiveTo
                ? new Date(assignment.effectiveTo).getTime()
                : Number.POSITIVE_INFINITY;
            return currentFrom <= nextTo && nextFrom <= currentTo;
        }) ?? null;
    }
}

const ASSIGNMENT_NOT_FOUND = 'ASSIGNMENT_NOT_FOUND: Không tìm thấy phân công này (có thể đã bị xóa hoặc thuộc tổ chức khác).';

function mapDuplicateKey(err: unknown): unknown {
    if (err && typeof err === 'object' && (err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
        return new ConflictException('ASSIGNMENT_ALREADY_EXISTS: Phân công này đã tồn tại (trùng nhân viên, phòng ban và thời gian).');
    }
    return err;
}

function publicAssignment(item: any) {
    const { _id, organizationId, userId, departmentId, workplaceId, effectiveFrom, effectiveTo, active, createdAt, updatedAt } = item;
    return { _id, organizationId, userId, departmentId, workplaceId, effectiveFrom, effectiveTo, active, createdAt, updatedAt };
}

function effectiveStart(value: string) { return new Date(`${value.slice(0, 10)}T00:00:00.000Z`); }
function dayAfter(value: string) { return new Date(effectiveStart(value).getTime() + 86400000); }
function unionAssignmentWindows(rows: Array<{ effectiveFrom?: string; effectiveTo?: string }>) {
    const starts = rows.map(row => row.effectiveFrom).filter((value): value is string => Boolean(value));
    const ends = rows.map(row => row.effectiveTo);
    return {
        from: starts.length === rows.length ? starts.sort()[0] : undefined,
        to: ends.every(Boolean) ? (ends as string[]).sort().at(-1) : undefined,
    };
}
