import { ConflictException, NotFoundException } from '@nestjs/common';
import { ManagerAssignmentService } from './manager-assignment.service';

type Row = Record<string, any>;
function q(value: any) { return { lean: async () => value, select: () => ({ lean: async () => value }) }; }
function build(rows: Row[], users: Row[], departments: Row[]) {
  const model = {
    find: jest.fn(() => ({ sort: () => ({ lean: async () => rows }) })),
    findOne: jest.fn((filter: Row) => q(rows.find(r => Object.entries(filter).every(([k,v]) => k === '_id' ? String(r._id) === String(v) : r[k] === v)) ?? null)),
    create: jest.fn(async (doc: Row) => ({ toObject: () => ({ _id: 'new', active: true, ...doc }) })),
    findOneAndUpdate: jest.fn((filter: Row, update: Row) => q((() => { const r=rows.find(x=>String(x._id)===String(filter._id)&&x.organizationId===filter.organizationId); if(!r)return null; Object.assign(r, update.$set); return r; })())),
  };
  const userModel = {
    findOne: jest.fn((filter: Row) => q(users.find(r => String(r._id)===String(filter._id)&&r.organizationId===filter.organizationId&&r.role===filter.role) ?? null)),
    find: jest.fn((filter: Row) => ({ select: () => ({ sort: () => ({ lean: async () => users.filter(r => r.organizationId===filter.organizationId&&r.role===filter.role) }) }) })),
  };
  const departmentModel = { findOne: jest.fn((filter: Row) => q(departments.find(r => String(r._id)===String(filter._id)&&r.organizationId===filter.organizationId) ?? null)) };
  return new ManagerAssignmentService(model as any, userModel as any, departmentModel as any);
}

describe('ManagerAssignmentService', () => {
  it('creates a tenant-scoped manager assignment', async () => {
    const service=build([], [{_id:'m1',organizationId:'o1',role:'DEPARTMENT_MANAGER'}], [{_id:'d1',organizationId:'o1'}]);
    await expect(service.create('o1','hr1',{managerUserId:'m1',departmentId:'d1',effectiveFrom:'2026-09-22'})).resolves.toMatchObject({managerUserId:'m1',departmentId:'d1',createdBy:'hr1',active:true});
  });
  it('rejects a user that is not a department manager in the tenant', async () => {
    const service=build([], [{_id:'m1',organizationId:'o1',role:'EMPLOYEE'}], [{_id:'d1',organizationId:'o1'}]);
    await expect(service.create('o1','hr1',{managerUserId:'m1',departmentId:'d1',effectiveFrom:'2026-09-22'})).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects overlapping active ranges for the same manager and department', async () => {
    const service=build([{_id:'a1',organizationId:'o1',managerUserId:'m1',departmentId:'d1',active:true,effectiveFrom:new Date('2026-01-01'),effectiveTo:new Date('2026-12-31')}], [{_id:'m1',organizationId:'o1',role:'DEPARTMENT_MANAGER'}], [{_id:'d1',organizationId:'o1'}]);
    await expect(service.create('o1','hr1',{managerUserId:'m1',departmentId:'d1',effectiveFrom:'2026-09-22'})).rejects.toBeInstanceOf(ConflictException);
  });
  it('soft deactivates only an assignment in the current tenant', async () => {
    const rows=[{_id:'a1',organizationId:'o1',active:true}]; const service=build(rows,[],[]);
    await expect(service.setActive('o1','a1',false)).resolves.toMatchObject({active:false});
    await expect(service.setActive('o2','a1',false)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only department-manager accounts as assignment candidates', async () => {
    const service=build([], [{_id:'m1',organizationId:'o1',role:'DEPARTMENT_MANAGER',fullName:'Quản lý A'},{_id:'e1',organizationId:'o1',role:'EMPLOYEE',fullName:'Nhân viên'}], []);
    await expect(service.listCandidates('o1')).resolves.toEqual([{id:'m1',fullName:'Quản lý A'}]);
  });
});
