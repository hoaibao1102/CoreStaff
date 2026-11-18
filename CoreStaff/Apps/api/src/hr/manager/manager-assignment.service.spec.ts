import { ConflictException, NotFoundException } from '@nestjs/common';
import { ManagerAssignmentService } from './manager-assignment.service';

type Row = Record<string, any>;
function q(value: any) { return { lean: async () => value, select: () => ({ lean: async () => value }) }; }
function matches(row: Row, filter: Row) {
  return Object.entries(filter).every(([key, value]: [string, any]) => {
    const actual = key === '_id' || key === 'userId' ? String(row[key]) : row[key];
    if (value && typeof value === 'object' && '$in' in value) return value.$in.map(String).includes(String(actual));
    if (value && typeof value === 'object' && '$ne' in value) return String(actual) !== String(value.$ne);
    return actual === (key === '_id' || key === 'userId' ? String(value) : value);
  });
}
function build(rows: Row[], users: Row[], departments: Row[], profiles: Row[] = users.map(user => ({
  organizationId: user.organizationId, userId: user._id, employmentStatus: 'ACTIVE',
}))) {
  const model = {
    // QC 5.1 — list() now populates names.
    find: jest.fn(() => ({ populate: function(this: any) { return this; }, sort: () => ({ populate: function(this: any) { return this; }, session: () => ({ lean: async () => rows }), lean: async () => rows }), lean: async () => rows })),
    db: { startSession: async () => ({ withTransaction: async (fn: any) => fn(), endSession: async () => undefined }), collection: () => ({ updateOne: async () => undefined }) },
    findOne: jest.fn((filter: Row) => q(rows.find(r => matches(r, filter)) ?? null)),
    // QC 5.1 — demotion asks whether another active assignment remains.
    exists: jest.fn(async (filter: Row) => {
      const row = rows.find(r => matches(r, filter) && r.active === true);
      return row ? { _id: row._id } : null;
    }),
    create: jest.fn(async ([doc]: Row[]) => [{ toObject: () => ({ _id: 'new', active: true, ...doc }) }]),
    findOneAndUpdate: jest.fn((filter: Row, update: Row) => q((() => { const r=rows.find(x=>String(x._id)===String(filter._id)&&x.organizationId===filter.organizationId); if(!r)return null; Object.assign(r, update.$set); if(update.$unset) for(const key of Object.keys(update.$unset)) delete r[key]; return r; })())),
  };
  const userModel = {
    findOne: jest.fn((filter: Row) => q(users.find(r => matches(r, filter)) ?? null)),
    find: jest.fn((filter: Row) => ({ select: () => ({ sort: () => ({ lean: async () => users.filter(r => matches(r, filter)) }) }) })),
    updateOne: jest.fn(async (filter: Row, update: Row) => { const user=users.find(r=>matches(r,filter)); if(user) Object.assign(user,update.$set); }),
  };
  const departmentModel = { findOne: jest.fn((filter: Row) => q(departments.find(r => matches(r, filter)) ?? null)) };
  const profileModel = {
    find: jest.fn((filter: Row) => ({ select: () => ({ lean: async () => profiles.filter(r => matches(r, filter)) }) })),
    findOne: jest.fn((filter: Row) => q(profiles.find(r => matches(r, filter)) ?? null)),
  };
  return new ManagerAssignmentService(model as any, userModel as any, departmentModel as any, profileModel as any);
}

describe('ManagerAssignmentService', () => {
  it('creates a tenant-scoped manager assignment', async () => {
    const service=build([], [{_id:'m1',organizationId:'o1',role:'DEPARTMENT_MANAGER',status:'ACTIVE'}], [{_id:'d1',organizationId:'o1'}]);
    await expect(service.create('o1','hr1',{managerUserId:'m1',departmentId:'d1',effectiveFrom:'2026-09-22'})).resolves.toMatchObject({managerUserId:'m1',departmentId:'d1',createdBy:'hr1',active:true});
  });
  it('promotes an eligible employee when assigning them as a department manager', async () => {
    const users=[{_id:'m1',organizationId:'o1',role:'EMPLOYEE',status:'ACTIVE'}];
    const service=build([], users, [{_id:'d1',organizationId:'o1'}]);
    await expect(service.create('o1','hr1',{managerUserId:'m1',departmentId:'d1',effectiveFrom:'2026-09-22'})).resolves.toBeDefined();
    expect(users[0].role).toBe('DEPARTMENT_MANAGER');
  });
  it('rejects a user without an active employee profile', async () => {
    const service=build([], [{_id:'m1',organizationId:'o1',role:'EMPLOYEE',status:'ACTIVE'}], [{_id:'d1',organizationId:'o1'}], []);
    await expect(service.create('o1','hr1',{managerUserId:'m1',departmentId:'d1',effectiveFrom:'2026-09-22'})).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects overlapping active ranges for the same manager and department', async () => {
    const service=build([{_id:'a1',organizationId:'o1',managerUserId:'m1',departmentId:'d1',active:true,effectiveFrom:new Date('2026-01-01'),effectiveTo:new Date('2026-12-31')}], [{_id:'m1',organizationId:'o1',role:'DEPARTMENT_MANAGER',status:'ACTIVE'}], [{_id:'d1',organizationId:'o1'}]);
    await expect(service.create('o1','hr1',{managerUserId:'m1',departmentId:'d1',effectiveFrom:'2026-09-22'})).rejects.toBeInstanceOf(ConflictException);
  });
  it('soft deactivates only an assignment in the current tenant', async () => {
    const rows=[{_id:'a1',organizationId:'o1',active:true}]; const service=build(rows,[],[]);
    await expect(service.setActive('o1','a1',false)).resolves.toMatchObject({active:false});
    await expect(service.setActive('o2','a1',false)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('lists active employees and existing department managers as assignment candidates', async () => {
    const service=build([], [
      {_id:'m1',organizationId:'o1',role:'DEPARTMENT_MANAGER',status:'ACTIVE',fullName:'Quản lý A'},
      {_id:'e1',organizationId:'o1',role:'EMPLOYEE',status:'ACTIVE',fullName:'Nhân viên A'},
      {_id:'h1',organizationId:'o1',role:'HR',status:'ACTIVE',fullName:'HR A'},
    ], []);
    await expect(service.listCandidates('o1')).resolves.toEqual([
      {id:'m1',fullName:'Quản lý A'}, {id:'e1',fullName:'Nhân viên A'},
    ]);
  });
  it('excludes employees on probation from the assignment candidates (QC 5.2)', async () => {
    const users=[
      {_id:'m1',organizationId:'o1',role:'EMPLOYEE',status:'ACTIVE',fullName:'Đang làm'},
      {_id:'m2',organizationId:'o1',role:'EMPLOYEE',status:'ACTIVE',fullName:'Thử việc'},
    ];
    const service=build([], users, [], [
      {organizationId:'o1',userId:'m1',employmentStatus:'ACTIVE'},
      {organizationId:'o1',userId:'m2',employmentStatus:'PROBATION'},
    ]);
    await expect(service.listCandidates('o1')).resolves.toEqual([{id:'m1',fullName:'Đang làm'}]);
  });
  it('demotes a manager back to EMPLOYEE when no active assignment remains (QC 5.1)', async () => {
    const rows=[{_id:'a1',organizationId:'o1',managerUserId:'m1',departmentId:'d1',active:true,effectiveFrom:new Date('2026-01-01')}];
    const users=[{_id:'m1',organizationId:'o1',role:'DEPARTMENT_MANAGER',status:'ACTIVE'}];
    const service=build(rows, users, [{_id:'d1',organizationId:'o1'}]);
    await expect(service.setActive('o1','a1',false)).resolves.toMatchObject({active:false});
    expect(users[0].role).toBe('EMPLOYEE');
  });
  it('keeps the manager role while another active assignment exists (QC 5.1)', async () => {
    const rows=[
      {_id:'a1',organizationId:'o1',managerUserId:'m1',departmentId:'d1',active:true,effectiveFrom:new Date('2026-01-01')},
      {_id:'a2',organizationId:'o1',managerUserId:'m1',departmentId:'d2',active:true,effectiveFrom:new Date('2026-01-01')},
    ];
    const users=[{_id:'m1',organizationId:'o1',role:'DEPARTMENT_MANAGER',status:'ACTIVE'}];
    const service=build(rows, users, [{_id:'d1',organizationId:'o1'},{_id:'d2',organizationId:'o1'}]);
    await service.setActive('o1','a1',false);
    expect(users[0].role).toBe('DEPARTMENT_MANAGER');
  });
  it('clears an open-ended assignment with effectiveTo: null (QC 5.1)', async () => {
    const rows=[{_id:'a1',organizationId:'o1',managerUserId:'m1',departmentId:'d1',active:true,effectiveFrom:new Date('2026-01-01'),effectiveTo:new Date('2026-12-31')}];
    const users=[{_id:'m1',organizationId:'o1',role:'DEPARTMENT_MANAGER',status:'ACTIVE'}];
    const service=build(rows, users, [{_id:'d1',organizationId:'o1'}]);
    await expect(service.update('o1','a1',{effectiveTo:null})).resolves.toBeDefined();
    expect(rows[0].effectiveTo).toBeUndefined();
  });
});
