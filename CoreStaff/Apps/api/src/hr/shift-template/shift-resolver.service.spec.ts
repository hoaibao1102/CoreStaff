import { ShiftResolverService } from './shift-resolver.service';

function query(rows: any[]) {
  return {
    sort: () => ({ session: () => ({ lean: async () => rows }), lean: async () => rows }),
    session: () => ({ lean: async () => rows }),
    lean: async () => rows,
  };
}

describe('ShiftResolverService deterministic resolution', () => {
  it('propagates session and rejects overlapping effective shifts', async () => {
    const session = { id: 'session' } as any;
    const employees = { findOne: jest.fn(() => ({ select: () => ({ session: () => ({ lean: async () => ({ departmentId: 'd1' }) }) }) })) };
    const shifts = { find: jest.fn(() => query([
      { _id: 's1', scope: 'DEPARTMENT', departmentId: 'd1' },
      { _id: 's2', scope: 'DEPARTMENT', departmentId: 'd1' },
    ])) };
    const service = new ShiftResolverService(shifts as any, employees as any);
    await expect(service.resolveForEmployeeDate('org-1', 'u1', '2026-09-01', session)).rejects.toThrow('OVERLAPPING_EFFECTIVE_SHIFTS');
    expect(employees.findOne).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' });
  });

  it('prefers one department shift over one organization shift', async () => {
    const employees = { findOne: jest.fn(() => ({ select: () => ({ lean: async () => ({ departmentId: 'd1' }) }) })) };
    const shifts = { find: jest.fn(() => query([
      { _id: 'org', scope: 'ORGANIZATION' },
      { _id: 'department', scope: 'DEPARTMENT', departmentId: 'd1' },
    ])) };
    const service = new ShiftResolverService(shifts as any, employees as any);
    await expect(service.resolveForEmployeeDate('org-1', 'u1', '2026-09-01')).resolves.toMatchObject({ _id: 'department' });
  });
});
