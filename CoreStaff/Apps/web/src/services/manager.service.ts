import { hrRequest } from './hrService';
export interface ManagedDepartment { id: string; code: string; name: string }
export interface ManagerContext { managerUserId: string; managedDepartments: ManagedDepartment[]; defaultDepartmentId: string | null; capabilities: string[] }
export type RequestType = 'ATTENDANCE' | 'OVERTIME';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED';

export interface ManagerRequest {
  _id: string;
  employeeId: any;
  employeeUserId: any;
  departmentId: string;
  type: RequestType;
  workDate: string;
  reason: string;
  requestedStart?: string;
  requestedEnd?: string;
  approvedStart?: string;
  approvedEnd?: string;
  status: RequestStatus;
  reviewComment?: string;
  /** OT filing detail (D38/D39) — what the work actually was, and any late-report reason. */
  workDescription?: string;
  isRetroactive?: boolean;
  retroactiveReason?: string;
  version: number;
  createdAt?: string;
  attendanceDayId?: string;
  evidenceId?: any;
  metadata?: {
    address?: string;
    latitude?: number;
    longitude?: number;
    workMode?: string;
    selfieUrl?: string;
    actionType?: string;
    [key: string]: any;
  };
  /** §30B.2 — attached to an approval response whose minutes trip a limit. */
  compliance?: LaborEvaluation;
}

export interface TodayAttendance {
  workDate: string;
  attendanceStatus: string;
  overallApprovalStatus: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  workMode?: string | null;
}

export interface ManagerEmployee {
  id: string;
  userId: string;
  employeeCode: string;
  fullName?: string | null;
  avatar?: string | null;
  email?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  positionName?: string | null;
  workplaceId?: string | null;
  workplaceName?: string | null;
  workplaceType?: string | null;
  employmentStatus: string;
  todayAttendance?: TodayAttendance | null;
}
export const getManagerContext=(base:string)=>hrRequest<ManagerContext>(base,'/api/manager/context',{method:'GET'});
export const getManagerEmployees=(base:string,departmentId?:string)=>hrRequest<ManagerEmployee[]>(base,`/api/manager/employees${departmentId?`?departmentId=${encodeURIComponent(departmentId)}`:''}`,{method:'GET'});
export async function getManagerRequests(base:string,params:{departmentId?:string;type?:string;status?:string}){const q=new URLSearchParams();Object.entries(params).forEach(([k,v])=>{if(v)q.set(k,v)});return hrRequest<ManagerRequest[]>(base,`/api/manager/approvals${q.size?`?${q}`:''}`,{method:'GET'});}
export const getMyRequests=(base:string)=>hrRequest<ManagerRequest[]>(base,'/api/requests/mine',{method:'GET'});
export const createMyRequest=(base:string,payload:{type:RequestType;workDate:string;reason:string;requestedStart?:string;requestedEnd?:string})=>hrRequest<ManagerRequest>(base,'/api/requests',{method:'POST',body:JSON.stringify(payload)});

/** §30B.2 projection the server attaches to a filing: warnings, never a block. */
export interface LaborViolation{key:string;code:string;severity:'BLOCK'|'WARNING';message:string;usedMinutes:number;limitMinutes:number}
export interface LaborEvaluation{policyVersion:number;legalReference:string;violations:LaborViolation[];approvable:boolean}

/**
 * D39 — OT goes through the dedicated route rather than the generic
 * `/api/requests`: it is the only one that runs the full filing guards and
 * returns the `compliance` projection, and the shape is exactly
 * `CreateOvertimeRequestDto` (the pipe forbids any other field).
 */
export const createOvertimeRequest=(base:string,payload:{workDate:string;requestedStart:string;requestedEnd:string;reason:string;workDescription?:string;retroactiveReason?:string})=>hrRequest<ManagerRequest&{compliance?:LaborEvaluation|null;complianceNote?:string}>(base,'/api/overtime',{method:'POST',body:JSON.stringify(payload)});

/** The shift assigned to the current user on one date, as the guard reads it. */
export interface EmployeeSchedule{workDate:string;scheduled:{startTime:string;endTime:string;breakMinutes:number;from:string;to:string}|null;calendarType:string|null;overrideType:string|null;overtimeType:string}
export const getMyScheduleForDate=(base:string,date:string)=>hrRequest<EmployeeSchedule>(base,`/api/overtime/schedule?date=${encodeURIComponent(date)}`,{method:'GET'});
export const decideManagerRequest=(base:string,id:string,action:'approve'|'reject'|'request-clarification',payload:{expectedVersion:number;reason?:string;approvedStart?:string;approvedEnd?:string})=>hrRequest<ManagerRequest>(base,`/api/manager/approvals/${encodeURIComponent(id)}/${action}`,{method:'POST',body:JSON.stringify(payload)});
export interface ManagerAssignment{_id:string;managerUserId:string;departmentId:string;effectiveFrom:string;effectiveTo?:string;active:boolean}
export const getManagerAssignments=(base:string)=>hrRequest<ManagerAssignment[]>(base,'/api/hr/manager-assignments',{method:'GET'});
export const getManagerAssignmentCandidates=(base:string)=>hrRequest<{id:string;fullName:string}[]>(base,'/api/hr/manager-assignment-candidates',{method:'GET'});
export const createManagerAssignment=(base:string,p:{managerUserId:string;departmentId:string;effectiveFrom:string;effectiveTo?:string})=>hrRequest<ManagerAssignment>(base,'/api/hr/manager-assignments',{method:'POST',body:JSON.stringify(p)});
export const setManagerAssignmentActive=(base:string,id:string,active:boolean)=>hrRequest<ManagerAssignment>(base,`/api/hr/manager-assignments/${encodeURIComponent(id)}/${active?'activate':'deactivate'}`,{method:'PATCH'});
