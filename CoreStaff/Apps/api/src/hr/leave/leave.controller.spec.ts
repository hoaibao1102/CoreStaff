import { ROLES_KEY } from '../../common/rbac.decorator';
import { HrLeaveController, ManagerLeaveController } from './leave.controller';

describe('LeaveRequest controller role ownership', () => {
  it('reserves approve and reject endpoints for department managers', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ManagerLeaveController)).toEqual(['DEPARTMENT_MANAGER']);
    expect(typeof ManagerLeaveController.prototype.approve).toBe('function');
    expect(typeof ManagerLeaveController.prototype.reject).toBe('function');
  });

  it('gives HR application duties but no approval or rejection handlers', () => {
    expect(Reflect.getMetadata(ROLES_KEY, HrLeaveController)).toEqual(['HR']);
    expect(typeof HrLeaveController.prototype.apply).toBe('function');
    expect((HrLeaveController.prototype as any).approve).toBeUndefined();
    expect((HrLeaveController.prototype as any).reject).toBeUndefined();
  });
});
