import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ManagerAssignmentDocument } from '../../database/schemas/manager-assignment.schema';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { UserDocument } from '../../database/schemas/user.schema';

const MANAGER_CAPABILITIES = [
  'manager:employees:read',
  'manager:approvals:write',
  'manager:kpi:draft',
] as const;

@Injectable()
export class ManagerScopeService {
  constructor(
    @InjectModel('ManagerAssignment') private readonly assignments: Model<ManagerAssignmentDocument>,
    @InjectModel('Department') private readonly departments: Model<DepartmentDocument>,
    @InjectModel('EmployeeProfile') private readonly employees: Model<EmployeeProfileDocument>,
    @InjectModel('User') private readonly users: Model<UserDocument>,
  ) {}

  async getManagedDepartmentIds(organizationId: string, managerUserId: string, now = new Date()): Promise<string[]> {
    const rows = await this.assignments.find({ organizationId, managerUserId, active: true }).sort({ effectiveFrom: 1 }).lean();
    return [...new Set(rows
      .filter(row => (!row.effectiveFrom || new Date(row.effectiveFrom) <= now)
        && (!row.effectiveTo || new Date(row.effectiveTo) >= now))
      .map(row => String(row.departmentId)))];
  }

  async getContext(organizationId: string, managerUserId: string, now = new Date()) {
    const ids = await this.getManagedDepartmentIds(organizationId, managerUserId, now);
    if (!ids.length) {
      return { managerUserId, managedDepartments: [], defaultDepartmentId: null, capabilities: [] };
    }
    const rows = await this.departments.find({ organizationId, _id: { $in: ids }, active: true }).sort({ name: 1 }).lean();
    const managedDepartments = rows.map(row => ({ id: String(row._id), code: row.code, name: row.name }));
    return {
      managerUserId,
      managedDepartments,
      defaultDepartmentId: managedDepartments[0]?.id ?? null,
      capabilities: [...MANAGER_CAPABILITIES],
    };
  }

  async requireDepartment(organizationId: string, managerUserId: string, departmentId: string, now = new Date()): Promise<void> {
    const ids = await this.getManagedDepartmentIds(organizationId, managerUserId, now);
    if (!ids.includes(String(departmentId))) throw new ForbiddenException('DEPARTMENT_SCOPE_VIOLATION');
  }

  async listEmployees(organizationId: string, managerUserId: string, departmentId?: string, now = new Date()) {
    const ids = await this.getManagedDepartmentIds(organizationId, managerUserId, now);
    if (departmentId) {
      await this.requireDepartment(organizationId, managerUserId, departmentId, now);
    }
    const scope = departmentId ? [departmentId] : ids;
    if (!scope.length) return [];
    const rows = await this.employees.find({ organizationId, departmentId: { $in: scope } }).sort({ employeeCode: 1 }).lean();
    const userIds = rows.map(row => row.userId);
    const users = await this.users.find({ organizationId, _id: { $in: userIds } }).select('_id fullName').lean();
    const names = new Map(users.map(user => [String(user._id), user.fullName]));
    return rows.map(row => ({
      id: String(row._id),
      userId: String(row.userId),
      employeeCode: row.employeeCode,
      fullName: names.get(String(row.userId)) ?? null,
      departmentId: row.departmentId ? String(row.departmentId) : null,
      positionId: row.positionId ? String(row.positionId) : null,
      employmentStatus: row.employmentStatus,
    }));
  }
}
