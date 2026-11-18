import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { acquireSerializationLock } from '../../common/serialization-lock';
import { ManagerAssignmentDocument } from '../../database/schemas/manager-assignment.schema';
import { UserDocument } from '../../database/schemas/user.schema';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { CreateManagerAssignmentDto, UpdateManagerAssignmentDto } from './dto/manager-assignment.dto';

@Injectable()
export class ManagerAssignmentService {
  constructor(
    @InjectModel('ManagerAssignment') private readonly assignments: Model<ManagerAssignmentDocument>,
    @InjectModel('User') private readonly users: Model<UserDocument>,
    @InjectModel('Department') private readonly departments: Model<DepartmentDocument>,
    @InjectModel('EmployeeProfile') private readonly employeeProfiles: Model<EmployeeProfileDocument>,
  ) {}

  async list(organizationId: string) {
    // QC 5.1 — name the manager and department here; the panel used to resolve
    // them client-side from separate collections.
    const rows = await this.assignments.find({ organizationId }).sort({ createdAt: -1 })
      .populate('managerUserId', 'fullName')
      .populate('departmentId', 'name code')
      .lean();
    return rows.map((row: any) => ({
      ...row,
      managerName: row.managerUserId?.fullName ?? null,
      departmentName: row.departmentId?.name ?? null,
      managerUserId: String(row.managerUserId?._id ?? row.managerUserId),
      departmentId: String(row.departmentId?._id ?? row.departmentId),
    }));
  }

  /**
   * QC 5.2 — an employee on probation may not be assigned as a department
   * manager. Only ACTIVE employees qualify for a new assignment.
   */
  async listCandidates(organizationId: string, departmentId?: string) {
    const query: Record<string, unknown> = {
      organizationId,
      employmentStatus: 'ACTIVE',
    };
    if (departmentId) {
      query.departmentId = departmentId;
    }
    const profiles = await this.employeeProfiles.find(query).select('userId').lean();
    const userIds = profiles.map(row => row.userId);
    const rows = await this.users.find({
      organizationId,
      _id: { $in: userIds },
      role: { $in: ['EMPLOYEE', 'DEPARTMENT_MANAGER'] },
      status: 'ACTIVE',
    }).select('_id fullName').sort({ fullName: 1 }).lean();
    return rows.map(row => ({ id: String(row._id), fullName: row.fullName }));
  }

  async create(organizationId: string, createdBy: string, dto: CreateManagerAssignmentDto) {
    await this.validateRefs(organizationId, dto.managerUserId, dto.departmentId);
    const from = new Date(dto.effectiveFrom), to = dto.effectiveTo ? new Date(dto.effectiveTo) : undefined;
    if (to && from > to) throw new ConflictException('MANAGER_ASSIGNMENT_DATE_RANGE_INVALID');
    // AUD-H12: overlap check, insert and role projection commit together,
    // serialized per tenant.
    return this.serialized(organizationId, async (session) => {
      if (await this.overlaps(organizationId, dto.managerUserId, dto.departmentId, from, to, undefined, session)) {
        throw new ConflictException('MANAGER_ASSIGNMENT_OVERLAP');
      }
      const [row] = await this.assignments.create(
        [{ ...dto, organizationId, createdBy, effectiveFrom: from, effectiveTo: to }],
        { session },
      );
      await this.users.updateOne(
        { _id: dto.managerUserId, organizationId, role: 'EMPLOYEE' },
        { $set: { role: 'DEPARTMENT_MANAGER' } },
        { session },
      );
      return row.toObject();
    });
  }

  async update(organizationId: string, id: string, dto: UpdateManagerAssignmentDto) {
    const current = await this.assignments.findOne({ _id: id, organizationId }).lean();
    if (!current) throw new NotFoundException('MANAGER_ASSIGNMENT_NOT_FOUND');
    const managerUserId = dto.managerUserId ?? String(current.managerUserId);
    const departmentId = dto.departmentId ?? String(current.departmentId);
    await this.validateRefs(organizationId, managerUserId, departmentId);
    const from = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(current.effectiveFrom);
    const to = dto.effectiveTo === null ? undefined : dto.effectiveTo ? new Date(dto.effectiveTo) : current.effectiveTo ? new Date(current.effectiveTo) : undefined;
    if (to && from > to) throw new ConflictException('MANAGER_ASSIGNMENT_DATE_RANGE_INVALID');
    const patch: Record<string, unknown> = { ...dto, effectiveFrom: from };
    delete patch.effectiveTo;
    // QC 5.1 — `effectiveTo: null` clears an open-ended assignment; omitting it
    // (undefined) leaves the stored end date untouched.
    const unset: Record<string, 1> | undefined = dto.effectiveTo === null ? { effectiveTo: 1 } : undefined;
    if (dto.effectiveTo !== null && to) patch.effectiveTo = to;
    return this.serialized(organizationId, async (session) => {
      if (dto.active !== false && await this.overlaps(organizationId, managerUserId, departmentId, from, to, id, session)) {
        throw new ConflictException('MANAGER_ASSIGNMENT_OVERLAP');
      }
      const update: Record<string, unknown> = { $set: patch };
      if (unset) update.$unset = unset;
      const row = await this.assignments.findOneAndUpdate({ _id: id, organizationId }, update, { new: true, runValidators: true, session }).lean();
      if (!row) throw new NotFoundException('MANAGER_ASSIGNMENT_NOT_FOUND');
      await this.users.updateOne(
        { _id: managerUserId, organizationId, role: 'EMPLOYEE' },
        { $set: { role: 'DEPARTMENT_MANAGER' } },
        { session },
      );
      if (dto.active === false) await this.demoteIfNoLongerManager(organizationId, String(row.managerUserId), String(row._id), session);
      return row;
    });
  }

  /** QC 5.1 — a manager with no remaining active assignment goes back to EMPLOYEE. */
  private async demoteIfNoLongerManager(organizationId: string, managerUserId: string, exceptId: string, session?: ClientSession) {
    // `exists()` takes no session option; the caller's write is already committed
    // in this transaction and the check only guards a role projection.
    const other = await this.assignments.exists({
      organizationId,
      managerUserId,
      active: true,
      _id: { $ne: exceptId },
    });
    if (other) return;
    await this.users.updateOne(
      { _id: managerUserId, organizationId, role: 'DEPARTMENT_MANAGER' },
      { $set: { role: 'EMPLOYEE' } },
      session ? { session } : {},
    );
  }

  private async serialized<T>(organizationId: string, work: (session: ClientSession) => Promise<T>): Promise<T> {
    const db = this.assignments.db;
    const session = await db.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        await acquireSerializationLock(db, `manager-assignment:${organizationId}`, session);
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async setActive(organizationId: string, id: string, active: boolean) {
    // QC 5.1 — deactivation must demote the user, so it joins the serialized
    // transaction instead of writing a bare update.
    return this.serialized(organizationId, async (session) => {
      const row = await this.assignments.findOneAndUpdate({ _id: id, organizationId }, { $set: { active } }, { new: true, session }).lean();
      if (!row) throw new NotFoundException('MANAGER_ASSIGNMENT_NOT_FOUND');
      if (!active) await this.demoteIfNoLongerManager(organizationId, String(row.managerUserId), String(row._id), session);
      return row;
    });
  }

  private async validateRefs(organizationId: string, managerUserId: string, departmentId: string) {
    const [manager, profile, department] = await Promise.all([
      this.users.findOne({
        _id: managerUserId,
        organizationId,
        role: { $in: ['EMPLOYEE', 'DEPARTMENT_MANAGER'] },
        status: 'ACTIVE',
      }).lean(),
      this.employeeProfiles.findOne({
        organizationId,
        userId: managerUserId,
        employmentStatus: { $in: ['PROBATION', 'ACTIVE', 'ON_LEAVE'] },
      }).lean(),
      this.departments.findOne({ _id: departmentId, organizationId }).lean(),
    ]);
    if (!manager || !profile) throw new NotFoundException('DEPARTMENT_MANAGER_NOT_FOUND');
    if (!department) throw new NotFoundException('DEPARTMENT_NOT_FOUND');
  }

  private async overlaps(organizationId: string, managerUserId: string, departmentId: string, from: Date, to?: Date, excludeId?: string, session?: ClientSession) {
    const query = this.assignments.find({ organizationId, managerUserId, departmentId, active: true }).sort({ effectiveFrom: 1 });
    const rows = await (session ? query.session(session) : query).lean();
    const start = from.getTime(), end = to?.getTime() ?? Number.POSITIVE_INFINITY;
    return rows.some(row => String(row._id) !== String(excludeId ?? '')
      && new Date(row.effectiveFrom).getTime() <= end
      && start <= (row.effectiveTo ? new Date(row.effectiveTo).getTime() : Number.POSITIVE_INFINITY));
  }
}
