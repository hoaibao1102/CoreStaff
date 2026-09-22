import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ManagerRequestService } from './manager-request.service';

type Row=Record<string,any>;
function build(rows:Row[], managed=['d1']){
 const model={
  create:jest.fn(async(d:Row)=>({toObject:()=>({_id:'new',version:1,status:'PENDING',...d})})),
  find:jest.fn((f:Row)=>({sort:()=>({lean:async()=>rows.filter(r=>r.organizationId===f.organizationId&&(!f.departmentId?.$in||f.departmentId.$in.includes(r.departmentId))&&(!f.type||r.type===f.type)&&(!f.status||r.status===f.status))})})),
  findOne:jest.fn((f:Row)=>({lean:async()=>rows.find(r=>String(r._id)===String(f._id)&&r.organizationId===f.organizationId)??null})),
  findOneAndUpdate:jest.fn((f:Row,u:Row)=>({lean:async()=>{const r=rows.find(x=>String(x._id)===String(f._id)&&x.organizationId===f.organizationId&&x.version===f.version&&x.status===f.status);if(!r)return null;Object.assign(r,u.$set);r.version++;return r;}})),
 };
 const scope={getManagedDepartmentIds:jest.fn(async()=>managed),requireDepartment:jest.fn(async(_o:string,_m:string,d:string)=>{if(!managed.includes(d))throw new ForbiddenException('DEPARTMENT_SCOPE_VIOLATION');})};
 const employees={findOne:jest.fn((f:Row)=>({lean:async()=>f.userId==='manager'?{_id:'pm',userId:'manager',departmentId:'d1'}:{_id:'p1',userId:f.userId,departmentId:'d1'}}))};
 return new ManagerRequestService(model as any,employees as any,scope as any);
}
describe('ManagerRequestService',()=>{
 it('creates an employee overtime request using profile department rather than client scope',async()=>{const s=build([]);await expect(s.createMine('o1','u1',{type:'OVERTIME',workDate:'2026-09-22',reason:'Cần hoàn tất phát hành',requestedStart:'2026-09-22T18:00:00Z',requestedEnd:'2026-09-22T20:00:00Z'})).resolves.toMatchObject({employeeId:'p1',departmentId:'d1',status:'PENDING'});});
 it('lists only requests in managed departments',async()=>{const s=build([{_id:'1',organizationId:'o1',departmentId:'d1',type:'OVERTIME',status:'PENDING'},{_id:'2',organizationId:'o1',departmentId:'d2',type:'OVERTIME',status:'PENDING'}]);await expect(s.listForManager('o1','manager',{})).resolves.toHaveLength(1);});
 it('forbids self approval',async()=>{const s=build([{_id:'1',organizationId:'o1',employeeUserId:'manager',departmentId:'d1',status:'PENDING',version:1}]);await expect(s.decide('o1','manager','1','APPROVED',1)).rejects.toBeInstanceOf(ForbiddenException);});
 it('rejects a stale decision version',async()=>{const s=build([{_id:'1',organizationId:'o1',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:2}]);await expect(s.decide('o1','manager','1','APPROVED',1)).rejects.toBeInstanceOf(ConflictException);});
 it('requires a reason for rejection and clarification',async()=>{const s=build([{_id:'1',organizationId:'o1',employeeUserId:'u1',departmentId:'d1',status:'PENDING',version:1}]);await expect(s.decide('o1','manager','1','REJECTED',1,'ngắn')).rejects.toBeInstanceOf(ConflictException);});
});
