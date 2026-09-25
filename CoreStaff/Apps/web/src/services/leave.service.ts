import { hrRequest } from './hrService';

export type LeaveType = 'PAID_LEAVE'|'UNPAID_LEAVE';
export type LeaveStatus = 'PENDING_MANAGER'|'APPROVED'|'REJECTED'|'HR_APPLIED';
export interface LeaveRequest { _id:string; employeeId:string; departmentId:string; startDate:string; endDate:string; leaveType:LeaveType; reason:string; status:LeaveStatus; reviewComment?:string; createdAt?:string; }
export interface EmployeeDayOverride { _id:string; employeeId:string; date:string; type:LeaveType; leaveRequestId:string; reason:string; createdBy:string; createdAt?:string; }
export interface ClassificationRebuildResult { scannedCount:number; updatedCount:number; }
const qs=(x:Record<string,string|undefined>)=>{const q=new URLSearchParams();Object.entries(x).forEach(([k,v])=>v&&q.set(k,v));return q.size?`?${q}`:''};
export const createLeaveRequest=(base:string,payload:{startDate:string;endDate:string;leaveType:LeaveType;reason:string})=>hrRequest<LeaveRequest>(base,'/api/leave-requests',{method:'POST',body:JSON.stringify(payload)});
export const listMyLeaveRequests=(base:string)=>hrRequest<LeaveRequest[]>(base,'/api/leave-requests/mine');
export const getMyLeaveRequest=(base:string,id:string)=>hrRequest<LeaveRequest>(base,`/api/leave-requests/mine/${encodeURIComponent(id)}`);
export const listManagerLeaveRequests=(base:string,status?:LeaveStatus,departmentId?:string)=>hrRequest<LeaveRequest[]>(base,`/api/manager/leave-requests${qs({status,departmentId})}`);
export const approveLeaveRequest=(base:string,id:string)=>hrRequest<LeaveRequest>(base,`/api/manager/leave-requests/${encodeURIComponent(id)}/approve`,{method:'POST'});
export const rejectLeaveRequest=(base:string,id:string,reason:string)=>hrRequest<LeaveRequest>(base,`/api/manager/leave-requests/${encodeURIComponent(id)}/reject`,{method:'POST',body:JSON.stringify({reason})});
export const listHrLeaveRequests=(base:string,status?:LeaveStatus)=>hrRequest<LeaveRequest[]>(base,`/api/hr/leave-requests${qs({status})}`);
export const applyLeaveRequest=(base:string,id:string)=>hrRequest<LeaveRequest>(base,`/api/hr/leave-requests/${encodeURIComponent(id)}/apply`,{method:'POST'});
export const listEmployeeDayOverrides=(base:string,filters:{employeeId?:string;from?:string;to?:string}={})=>hrRequest<EmployeeDayOverride[]>(base,`/api/hr/employee-day-overrides${qs(filters)}`);
export const rebuildDayClassifications=(base:string,payload:{from:string;to:string;employeeId?:string})=>hrRequest<ClassificationRebuildResult>(base,'/api/hr/day-classifications/rebuild',{method:'POST',body:JSON.stringify(payload)});
