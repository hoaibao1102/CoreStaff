import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ManagerAssignmentDocument } from '../../database/schemas/manager-assignment.schema';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { UserDocument } from '../../database/schemas/user.schema';
import { PositionDocument } from '../../database/schemas/position.schema';
import { WorkplaceDocument } from '../../database/schemas/workplace.schema';
import { AttendanceDayDocument } from '../../database/schemas/attendance-day.schema';
import { EmployeeAssignmentDocument } from '../../database/schemas/assignment.schema';

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
    @InjectModel('Position') private readonly positions: Model<PositionDocument>,
    @InjectModel('Workplace') private readonly workplaces: Model<WorkplaceDocument>,
    @InjectModel('AttendanceDay') private readonly attendanceDays: Model<AttendanceDayDocument>,
    @InjectModel('Assignment') private readonly employeeAssignments: Model<EmployeeAssignmentDocument>,
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

    // 1. Lấy tất cả phân công nhân sự (assignments) đang active trong phòng ban thuộc scope
    const activeAssignments = await this.employeeAssignments
      .find({
        organizationId,
        departmentId: { $in: scope },
        active: true,
      })
      .lean();

    const assignedUserIds = activeAssignments.map(a => String(a.userId));
    const assignmentMap = new Map(activeAssignments.map(a => [String(a.userId), a]));

    // 2. Tìm profiles: bao gồm các nhân viên được phân công vào scope hoặc profile có departmentId trong scope
    const rows = await this.employees
      .find({
        organizationId,
        $or: [
          { departmentId: { $in: scope } },
          { userId: { $in: assignedUserIds } },
        ],
      })
      .sort({ employeeCode: 1 })
      .lean();

    const userIds = rows.map(row => row.userId);
    const positionIds = rows.map(row => row.positionId).filter(Boolean);

    // Gom workplaceIds ưu tiên từ assignment, sau đó fallback về profile
    const workplaceIds: string[] = [];
    rows.forEach(row => {
      const asg = assignmentMap.get(String(row.userId));
      const wpId = asg?.workplaceId ?? row.workplaceId;
      if (wpId) workplaceIds.push(String(wpId));
    });

    // Truy vấn song song users, positions, workplaces và attendance ngày hôm nay
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const [users, positions, workplaces, attendanceDays] = await Promise.all([
      this.users.find({ organizationId, _id: { $in: userIds } }).select('_id fullName email phone avatarUrl').lean(),
      this.positions.find({ organizationId, _id: { $in: positionIds } }).select('_id name code').lean(),
      this.workplaces.find({ organizationId, _id: { $in: workplaceIds } }).select('_id name code type').lean(),
      this.attendanceDays.find({ organizationId, employeeId: { $in: userIds }, workDate: today }).lean(),
    ]);

    const userMap = new Map(users.map(u => [String(u._id), u]));
    const posMap = new Map(positions.map(p => [String(p._id), p]));
    const wpMap = new Map(workplaces.map(w => [String(w._id), w]));
    const attMap = new Map(attendanceDays.map(a => [String(a.employeeId), a]));

    const result = [];
    for (const row of rows) {
      const u = userMap.get(String(row.userId));
      // Bỏ qua bản ghi mồ côi nếu user không còn tồn tại trong hệ thống
      if (!u) continue;

      const asg = assignmentMap.get(String(row.userId));
      const effectiveWorkplaceId = asg?.workplaceId ?? row.workplaceId;
      const effectiveDepartmentId = asg?.departmentId ?? row.departmentId;

      const pos = row.positionId ? posMap.get(String(row.positionId)) : undefined;
      const wp = effectiveWorkplaceId ? wpMap.get(String(effectiveWorkplaceId)) : undefined;
      const att = attMap.get(String(row.userId));

      result.push({
        id: String(row._id),
        userId: String(row.userId),
        employeeCode: row.employeeCode,
        fullName: u?.fullName ?? null,
        avatar: u?.avatarUrl ?? null,
        email: u?.email || row.email || null,
        phone: u?.phone || row.phone || null,
        departmentId: effectiveDepartmentId ? String(effectiveDepartmentId) : null,
        positionId: row.positionId ? String(row.positionId) : null,
        positionName: pos?.name ?? null,
        workplaceId: effectiveWorkplaceId ? String(effectiveWorkplaceId) : null,
        workplaceName: wp?.name ?? null,
        workplaceType: wp?.type ?? null,
        employmentStatus: row.employmentStatus,
        todayAttendance: att ? {
          workDate: att.workDate,
          attendanceStatus: att.attendanceStatus,
          overallApprovalStatus: att.overallApprovalStatus,
          checkInAt: att.checkInAt ?? null,
          checkOutAt: att.checkOutAt ?? null,
          workMode: att.workMode ?? null,
        } : null,
      });
    }

    return result;
  }
}

