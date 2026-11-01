import { AttendanceConfirmationQuotaSchema } from '../../database/schemas/attendance-confirmation-quota.schema';
import { ManagerRequestSchema } from '../../database/schemas/manager-request.schema';
import { OrganizationSchema } from '../../database/schemas/organization.schema';
import { SCHEMA_REGISTRY } from '../../database/schemas/registry';

describe('confirmation storage contracts',()=>{
 it('declares tenant employee month uniqueness and nonnegative integer quota',()=>{
  expect(AttendanceConfirmationQuotaSchema.indexes()).toContainEqual([{organizationId:1,employeeUserId:1,monthKey:1},expect.objectContaining({unique:true})]);
  expect(AttendanceConfirmationQuotaSchema.path('usedSlots').options.min).toBe(0);
  expect(SCHEMA_REGISTRY.some(row=>row.name==='AttendanceConfirmationQuota')).toBe(true);
 });
 it('only reserves one active confirmation per employee workdate',()=>{
  expect(ManagerRequestSchema.indexes()).toContainEqual([{organizationId:1,employeeUserId:1,workDate:1},expect.objectContaining({unique:true,partialFilterExpression:{source:'ATTENDANCE_CONFIRMATION',confirmationSlotActive:true}})]);
 });
 it('persists creation identity without TTL and leaves tenant cutover off',()=>{
  expect(ManagerRequestSchema.indexes()).toContainEqual([{organizationId:1,employeeUserId:1,confirmationIdempotencyKey:1},expect.objectContaining({unique:true,partialFilterExpression:{source:'ATTENDANCE_CONFIRMATION',confirmationIdempotencyKey:{$type:'string'}}})]);
  expect(OrganizationSchema.path('attendanceOvertimeV2Enabled').options.default).not.toBe(true);
 });
});
