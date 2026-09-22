import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ManagerAssignmentDocument } from '../../database/schemas/manager-assignment.schema';
import { UserDocument } from '../../database/schemas/user.schema';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { CreateManagerAssignmentDto, UpdateManagerAssignmentDto } from './dto/manager-assignment.dto';

@Injectable()
export class ManagerAssignmentService {
  constructor(
    @InjectModel('ManagerAssignment') private readonly assignments: Model<ManagerAssignmentDocument>,
    @InjectModel('User') private readonly users: Model<UserDocument>,
    @InjectModel('Department') private readonly departments: Model<DepartmentDocument>,
  ) {}

  async list(organizationId: string) {
    return this.assignments.find({ organizationId }).sort({ createdAt: -1 }).lean();
  }

  async listCandidates(organizationId: string) {
    const rows = await this.users.find({ organizationId, role: 'DEPARTMENT_MANAGER' }).select('_id fullName').sort({ fullName: 1 }).lean();
    return rows.map(row => ({ id: String(row._id), fullName: row.fullName }));
  }

  async create(organizationId: string, createdBy: string, dto: CreateManagerAssignmentDto) {
    await this.validateRefs(organizationId, dto.managerUserId, dto.departmentId);
    const from = new Date(dto.effectiveFrom), to = dto.effectiveTo ? new Date(dto.effectiveTo) : undefined;
    if (to && from > to) throw new ConflictException('MANAGER_ASSIGNMENT_DATE_RANGE_INVALID');
    if (await this.overlaps(organizationId, dto.managerUserId, dto.departmentId, from, to)) {
      throw new ConflictException('MANAGER_ASSIGNMENT_OVERLAP');
    }
    const row = await this.assignments.create({ ...dto, organizationId, createdBy, effectiveFrom: from, effectiveTo: to });
    return row.toObject();
  }

  async update(organizationId: string, id: string, dto: UpdateManagerAssignmentDto) {
    const current = await this.assignments.findOne({ _id: id, organizationId }).lean();
    if (!current) throw new NotFoundException('MANAGER_ASSIGNMENT_NOT_FOUND');
    const managerUserId = dto.managerUserId ?? String(current.managerUserId);
    const departmentId = dto.departmentId ?? String(current.departmentId);
    await this.validateRefs(organizationId, managerUserId, departmentId);
    const from = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(current.effectiveFrom);
    const to = dto.effectiveTo ? new Date(dto.effectiveTo) : current.effectiveTo ? new Date(current.effectiveTo) : undefined;
    if (to && from > to) throw new ConflictException('MANAGER_ASSIGNMENT_DATE_RANGE_INVALID');
    if (dto.active !== false && await this.overlaps(organizationId, managerUserId, departmentId, from, to, id)) {
      throw new ConflictException('MANAGER_ASSIGNMENT_OVERLAP');
    }
    const patch: Record<string, unknown> = { ...dto, effectiveFrom: from, effectiveTo: to };
    const row = await this.assignments.findOneAndUpdate({ _id: id, organizationId }, { $set: patch }, { new: true, runValidators: true }).lean();
    if (!row) throw new NotFoundException('MANAGER_ASSIGNMENT_NOT_FOUND');
    return row;
  }

  async setActive(organizationId: string, id: string, active: boolean) {
    const row = await this.assignments.findOneAndUpdate({ _id: id, organizationId }, { $set: { active } }, { new: true }).lean();
    if (!row) throw new NotFoundException('MANAGER_ASSIGNMENT_NOT_FOUND');
    return row;
  }

  private async validateRefs(organizationId: string, managerUserId: string, departmentId: string) {
    const [manager, department] = await Promise.all([
      this.users.findOne({ _id: managerUserId, organizationId, role: 'DEPARTMENT_MANAGER' }).lean(),
      this.departments.findOne({ _id: departmentId, organizationId }).lean(),
    ]);
    if (!manager) throw new NotFoundException('DEPARTMENT_MANAGER_NOT_FOUND');
    if (!department) throw new NotFoundException('DEPARTMENT_NOT_FOUND');
  }

  private async overlaps(organizationId: string, managerUserId: string, departmentId: string, from: Date, to?: Date, excludeId?: string) {
    const rows = await this.assignments.find({ organizationId, managerUserId, departmentId, active: true }).sort({ effectiveFrom: 1 }).lean();
    const start = from.getTime(), end = to?.getTime() ?? Number.POSITIVE_INFINITY;
    return rows.some(row => String(row._id) !== String(excludeId ?? '')
      && new Date(row.effectiveFrom).getTime() <= end
      && start <= (row.effectiveTo ? new Date(row.effectiveTo).getTime() : Number.POSITIVE_INFINITY));
  }
}
