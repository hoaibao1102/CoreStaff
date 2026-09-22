import { ForbiddenException } from '@nestjs/common';
import { ManagerScopeService } from './manager-scope.service';

type Row = Record<string, any>;

function queryResult(rows: Row[]) {
  return {
    sort: () => ({ lean: async () => rows }),
    select: () => ({ sort: () => ({ lean: async () => rows }), lean: async () => rows }),
    lean: async () => rows,
  };
}

function buildService(assignments: Row[], departments: Row[] = [], employees: Row[] = []) {
  const assignmentModel = {
    find: jest.fn((filter: Row) => queryResult(assignments.filter(row =>
      String(row.organizationId) === String(filter.organizationId)
      && String(row.managerUserId) === String(filter.managerUserId)
      && row.active === filter.active,
    ))),
  };
  const departmentModel = {
    find: jest.fn((filter: Row) => queryResult(departments.filter(row =>
      String(row.organizationId) === String(filter.organizationId)
      && (filter._id?.$in ?? []).map(String).includes(String(row._id))
      && (filter.active === undefined || row.active === filter.active),
    ))),
  };
  const employeeModel = {
    find: jest.fn((filter: Row) => queryResult(employees.filter(row =>
      String(row.organizationId) === String(filter.organizationId)
      && (filter.departmentId?.$in ?? []).map(String).includes(String(row.departmentId)),
    ))),
  };
  const userModel = {
    find: jest.fn((filter: Row) => queryResult([
      { _id: 'u1', organizationId: filter.organizationId, fullName: 'An' },
      { _id: 'u2', organizationId: filter.organizationId, fullName: 'Bình' },
    ].filter(row => (filter._id?.$in ?? []).map(String).includes(String(row._id))))),
  };
  return new ManagerScopeService(assignmentModel as any, departmentModel as any, employeeModel as any, userModel as any);
}

describe('ManagerScopeService', () => {
  const now = new Date('2026-09-22T06:00:00.000Z');

  it('returns an empty managed department list when no assignment exists', async () => {
    const service = buildService([]);
    await expect(service.getContext('org-1', 'manager-1', now)).resolves.toEqual({
      managerUserId: 'manager-1',
      managedDepartments: [],
      defaultDepartmentId: null,
      capabilities: [],
    });
  });

  it('returns every active department whose assignment is effective now', async () => {
    const service = buildService([
      { organizationId: 'org-1', managerUserId: 'manager-1', departmentId: 'd1', active: true, effectiveFrom: '2026-01-01' },
      { organizationId: 'org-1', managerUserId: 'manager-1', departmentId: 'd2', active: true, effectiveFrom: '2026-09-01', effectiveTo: '2026-12-31' },
      { organizationId: 'org-1', managerUserId: 'manager-1', departmentId: 'expired', active: true, effectiveTo: '2026-09-01' },
      { organizationId: 'org-1', managerUserId: 'manager-1', departmentId: 'future', active: true, effectiveFrom: '2026-10-01' },
      { organizationId: 'org-2', managerUserId: 'manager-1', departmentId: 'other-tenant', active: true },
    ], [
      { _id: 'd1', organizationId: 'org-1', code: 'ENG', name: 'Kỹ thuật', active: true },
      { _id: 'd2', organizationId: 'org-1', code: 'QA', name: 'Kiểm thử', active: true },
    ]);

    await expect(service.getContext('org-1', 'manager-1', now)).resolves.toEqual({
      managerUserId: 'manager-1',
      managedDepartments: [
        { id: 'd1', code: 'ENG', name: 'Kỹ thuật' },
        { id: 'd2', code: 'QA', name: 'Kiểm thử' },
      ],
      defaultDepartmentId: 'd1',
      capabilities: ['manager:employees:read', 'manager:approvals:write', 'manager:kpi:draft'],
    });
  });

  it('rejects a requested department outside the effective managed scope', async () => {
    const service = buildService([
      { organizationId: 'org-1', managerUserId: 'manager-1', departmentId: 'd1', active: true },
    ], [{ _id: 'd1', organizationId: 'org-1', code: 'ENG', name: 'Kỹ thuật', active: true }]);

    await expect(service.requireDepartment('org-1', 'manager-1', 'd2', now))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists only non-sensitive employee fields from managed departments', async () => {
    const service = buildService([
      { organizationId: 'org-1', managerUserId: 'manager-1', departmentId: 'd1', active: true },
    ], [{ _id: 'd1', organizationId: 'org-1', code: 'ENG', name: 'Kỹ thuật', active: true }], [
      { _id: 'p1', organizationId: 'org-1', userId: 'u1', departmentId: 'd1', employeeCode: 'E001', fullName: 'An', positionId: 'pos1', employmentStatus: 'ACTIVE', citizenId: 'secret', bankAccount: 'secret' },
      { _id: 'p2', organizationId: 'org-1', userId: 'u2', departmentId: 'd2', employeeCode: 'E002', fullName: 'Bình', employmentStatus: 'ACTIVE' },
    ]);

    await expect(service.listEmployees('org-1', 'manager-1', undefined, now)).resolves.toEqual([
      { id: 'p1', userId: 'u1', employeeCode: 'E001', fullName: 'An', departmentId: 'd1', positionId: 'pos1', employmentStatus: 'ACTIVE' },
    ]);
  });
});
