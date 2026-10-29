import { hrRequest } from './hrService';

export type LeaveType = 'PAID_LEAVE'|'UNPAID_LEAVE';
export type LeaveStatus = 'PENDING_MANAGER'|'APPROVED'|'REJECTED'|'CANCELLED'|'HR_APPLIED';
export type LeaveDurationType = 'FULL_DAY'|'MORNING_HALF'|'AFTERNOON_HALF'|'CUSTOM_HOURS';
export interface LeaveRequest { _id:string; employeeId:string; departmentId:string; startDate:string; endDate:string; leaveType:LeaveType; durationType?:LeaveDurationType; requestedStart?:string; requestedEnd?:string; calculatedMinutes?:number; leaveEquivalent?:number; approvedLeaveIntervals?:LeaveInterval[];requiredWorkingIntervals?:LeaveInterval[]; reason:string; status:LeaveStatus; reviewedBy?:string; reviewedAt?:string; reviewComment?:string; appliedBy?:string; appliedAt?:string; createdAt?:string; }
export interface LeaveInterval { from:string;to:string }
export interface LeavePreviewDay { date:string;shiftStart:string;shiftEnd:string;breakMinutes:number;breakStart:string;breakEnd:string;requestedStart:string;requestedEnd:string;calculatedMinutes:number;leaveEquivalent:number;approvedLeaveIntervals:LeaveInterval[];requiredWorkingIntervals:LeaveInterval[] }
export interface LeavePreview { durationType:LeaveDurationType;requestedStart?:string;requestedEnd?:string;calculatedMinutes:number;leaveEquivalent:number;days:LeavePreviewDay[] }
export interface EmployeeDayOverride { _id:string; employeeId:string; date:string; type:LeaveType; durationType?:LeaveDurationType;requestedStart?:string;requestedEnd?:string;calculatedMinutes?:number;leaveEquivalent?:number; leaveRequestId:string; reason:string; createdBy:string; createdAt?:string; }
export interface ClassificationRebuildResult { scannedCount:number; updatedCount:number; }
const qs=(x:Record<string,string|undefined>)=>{const q=new URLSearchParams();Object.entries(x).forEach(([k,v])=>v&&q.set(k,v));return q.size?`?${q}`:''};
export const previewLeaveRequest=(base:string,payload:{startDate:string;endDate:string;durationType:LeaveDurationType;requestedStart?:string;requestedEnd?:string})=>hrRequest<LeavePreview>(base,'/api/leave-requests/preview',{method:'POST',body:JSON.stringify(payload)});
export const createLeaveRequest=(base:string,payload:{startDate:string;endDate:string;leaveType:LeaveType;durationType?:LeaveDurationType;requestedStart?:string;requestedEnd?:string;reason:string})=>hrRequest<LeaveRequest>(base,'/api/leave-requests',{method:'POST',body:JSON.stringify(payload)});
export const listMyLeaveRequests=(base:string)=>hrRequest<LeaveRequest[]>(base,'/api/leave-requests/mine');
export const getMyLeaveRequest=(base:string,id:string)=>hrRequest<LeaveRequest>(base,`/api/leave-requests/mine/${encodeURIComponent(id)}`);
export const cancelMyLeaveRequest=(base:string,id:string)=>hrRequest<LeaveRequest>(base,`/api/leave-requests/mine/${encodeURIComponent(id)}/cancel`,{method:'POST'});
export const listManagerLeaveRequests=(base:string,status?:LeaveStatus,departmentId?:string)=>hrRequest<LeaveRequest[]>(base,`/api/manager/leave-requests${qs({status,departmentId})}`);
export const approveLeaveRequest=(base:string,id:string)=>hrRequest<LeaveRequest>(base,`/api/manager/leave-requests/${encodeURIComponent(id)}/approve`,{method:'POST'});
export const rejectLeaveRequest=(base:string,id:string,reason:string)=>hrRequest<LeaveRequest>(base,`/api/manager/leave-requests/${encodeURIComponent(id)}/reject`,{method:'POST',body:JSON.stringify({reason})});
export const listHrLeaveRequests=(base:string,status?:LeaveStatus)=>hrRequest<LeaveRequest[]>(base,`/api/hr/leave-requests${qs({status})}`);
export const applyLeaveRequest=(base:string,id:string)=>hrRequest<LeaveRequest>(base,`/api/hr/leave-requests/${encodeURIComponent(id)}/apply`,{method:'POST'});
export const listEmployeeDayOverrides=(base:string,filters:{employeeId?:string;from?:string;to?:string}={})=>hrRequest<EmployeeDayOverride[]>(base,`/api/hr/employee-day-overrides${qs(filters)}`);
export const rebuildDayClassifications=(base:string,payload:{from:string;to:string;employeeId?:string})=>hrRequest<ClassificationRebuildResult>(base,'/api/hr/day-classifications/rebuild',{method:'POST',body:JSON.stringify(payload)});
