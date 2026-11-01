import { hrRequest } from './hrService';
import { getOvertimeSchedule, previewOvertime, type OvertimeSchedule, type OvertimePreview as ServerOvertimePreview } from './overtime.service';
/** Additive adapter: V2 is selected ONLY when the preview explicitly advertises enabled=true.
 * Absence of this flag is not tenant cutover. Reconcile response fields with backend before rollout. */
export interface AttendanceConfirmationPreview {
  enabled?: boolean;
  workDate: string;
  canSubmit: boolean;
  blockedReasons: Array<string | { code: string; message?: string }>;
  actionType: 'CHECK_IN' | 'CHECK_OUT' | 'FULL_DAY' | null;
  previewHash?: string;
  contextHash?: string;
  existingPunches?: { checkInAt?: string | null; checkOutAt?: string | null; checkInProvenance?: string; checkOutProvenance?: string };
  proposedChanges?: { checkInAt?: string | null; checkOutAt?: string | null };
  workingMinutes?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  obligation?: { shiftLabel?: string; requiredWorkingIntervals?: Array<{ from: string; to: string }>; breakMinutes?: number; leaveMinutes?: number };
  quota?: { monthKey: string; usedSlots: number; limit: number; remaining: number };
  period?: { status?: string; canMutate?: boolean };
}
type EndpointProvenance = string | { source?: string } | null;
export const confirmationSource = (value?: EndpointProvenance): string =>
  typeof value === 'string' ? value : typeof value?.source === 'string' ? value.source : 'LEGACY_UNKNOWN';
type ConfirmationWire = Omit<AttendanceConfirmationPreview, 'existingPunches'> & {
  existingPunches?: { checkInAt?: string | null; checkOutAt?: string | null; checkInProvenance?: EndpointProvenance; checkOutProvenance?: EndpointProvenance };
  requiredWorkingIntervals?: Array<{ from: string; to: string }>;
  snapshot?: { shift?: { startTime?: string; endTime?: string; breakMinutes?: number } };
  proposedChanges?: AttendanceConfirmationPreview['proposedChanges'] & { calculation?: { workingMinutes?: number; lateMinutes?: number; earlyMinutes?: number } };
};
export function normalizeConfirmationPreview(raw: ConfirmationWire): AttendanceConfirmationPreview {
  return { ...raw, previewHash: raw.previewHash ?? raw.contextHash,
    existingPunches: raw.existingPunches && { ...raw.existingPunches,
      checkInProvenance: confirmationSource(raw.existingPunches.checkInProvenance),
      checkOutProvenance: confirmationSource(raw.existingPunches.checkOutProvenance) },
    obligation: { ...raw.obligation,
      requiredWorkingIntervals: raw.obligation?.requiredWorkingIntervals ?? raw.requiredWorkingIntervals,
      breakMinutes: raw.obligation?.breakMinutes ?? raw.snapshot?.shift?.breakMinutes },
    workingMinutes: raw.workingMinutes ?? raw.proposedChanges?.calculation?.workingMinutes,
    lateMinutes: raw.lateMinutes ?? raw.proposedChanges?.calculation?.lateMinutes,
    earlyMinutes: raw.earlyMinutes ?? raw.proposedChanges?.calculation?.earlyMinutes };
}
export async function getAttendanceConfirmationPreview(base: string, date: string): Promise<AttendanceConfirmationPreview> {
  const raw = await hrRequest<ConfirmationWire>(base, `/api/requests/attendance-confirmation-preview?date=${encodeURIComponent(date)}`, { method: 'GET' });
  return normalizeConfirmationPreview(raw);
}
export const createAttendanceConfirmation = (base: string, payload: { workDate: string; reason: string; previewHash: string }, key: string) => hrRequest<ManagerRequest>(base, '/api/requests', {
  method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ requestKind: 'ATTENDANCE_CONFIRMATION', type: 'ATTENDANCE', workDate: payload.workDate, reason: payload.reason, previewHash: payload.previewHash }),
});
export interface ManagedDepartment { id: string; code: string; name: string }
export interface ManagerContext { managerUserId: string; managedDepartments: ManagedDepartment[]; defaultDepartmentId: string | null; capabilities: string[] }
export type RequestType = 'ATTENDANCE' | 'OVERTIME';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED';

export interface ManagerRequest {
  requestKind?: 'ATTENDANCE_CONFIRMATION';
  source?: string;
  proposedChanges?: { checkInAt?: string | null; checkOutAt?: string | null };
  originalPunches?: { checkInAt?: string | null; checkOutAt?: string | null };
  contextValidity?: { valid: boolean; blockedReasons?: string[] };
  period?: { status?: string; canMutate?: boolean };
  canApprove?: boolean;
  provenance?: { checkIn?: string; checkOut?: string };
  confirmation?: AttendanceConfirmationPreview;
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
    adjustmentSource?: string;
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
export const createMyRequest=(base:string,payload:{type:RequestType;workDate:string;reason:string;requestedStart?:string;requestedEnd?:string;adjustmentType?:'CHECK_IN'|'CHECK_OUT'})=>hrRequest<ManagerRequest>(base,'/api/requests',{method:'POST',body:JSON.stringify(payload)});

/** §30B.2 projection the server attaches to a filing: warnings, never a block. */
export interface LaborViolation{key:string;code:string;severity:'BLOCK'|'WARNING';message:string;usedMinutes:number;limitMinutes:number}
export interface LaborEvaluation{policyVersion:number;legalReference:string;violations:LaborViolation[];approvable:boolean}

/**
 * D39 — OT goes through the dedicated route rather than the generic
 * `/api/requests`: it is the only one that runs the full filing guards and
 * returns the `compliance` projection, and the shape is exactly
 * `CreateOvertimeRequestDto` (the pipe forbids any other field).
 */
export const createOvertimeRequest=(base:string,payload:{workDate:string;requestedStart:string;requestedEnd:string;reason:string;workDescription?:string;retroactiveReason?:string;previewHash?:string})=>hrRequest<ManagerRequest&{compliance?:LaborEvaluation|null;complianceNote?:string}>(base,'/api/overtime',{method:'POST',body:JSON.stringify(payload)});

export type OvertimePreview = ServerOvertimePreview & {
  provenance?: { checkIn?: EndpointProvenance; checkOut?: EndpointProvenance; approvalStatus?: string };
};
export const getOvertimePreview = (base: string, payload: {workDate:string;requestedStart:string;requestedEnd:string}): Promise<OvertimePreview> =>
  previewOvertime(base, {workDate:payload.workDate,requestedStart:payload.requestedStart,requestedEnd:payload.requestedEnd});


/** The shift assigned to the current user on one date, as the guard reads it. */
export type EmployeeSchedule = OvertimeSchedule;
export const getMyScheduleForDate = getOvertimeSchedule;
export function managerRequestKind(request: Pick<ManagerRequest, 'type' | 'requestKind' | 'source' | 'metadata' | 'evidenceId'>) {
  if (request.type === 'OVERTIME') return 'OVERTIME';
  if (request.requestKind === 'ATTENDANCE_CONFIRMATION' || request.source === 'ATTENDANCE_CONFIRMATION' || request.metadata?.adjustmentSource === 'ATTENDANCE_CONFIRMATION') return 'CONFIRMATION';
  if (request.metadata?.adjustmentSource === 'MANUAL_ADJUSTMENT') return 'MANUAL';
  return request.evidenceId || request.metadata?.actionType ? 'SELFIE' : 'MANUAL';
}
export function canApproveConfirmation(request: ManagerRequest) {
  return request.canApprove === true && request.contextValidity?.valid === true && request.period?.canMutate === true;
}
export const managerRequestLabel = (request: ManagerRequest) => ({ OVERTIME: 'Làm thêm giờ (OT)', CONFIRMATION: 'Xác nhận công theo lịch', SELFIE: 'Chấm công Selfie', MANUAL: 'Điều chỉnh công (cũ)' }[managerRequestKind(request)]);
export async function getManagerRequestDetail(base: string, id: string): Promise<ManagerRequest> {
  const raw = await hrRequest<Omit<ManagerRequest, 'confirmation'> & {confirmation?: ConfirmationWire}>(base, `/api/manager/approvals/${encodeURIComponent(id)}`, { method: 'GET' });
  const confirmation = raw.confirmation && normalizeConfirmationPreview(raw.confirmation);
  return { ...raw, confirmation, period: raw.period ?? confirmation?.period };
}
export const decideManagerRequest=(base:string,id:string,action:'approve'|'reject'|'request-clarification',payload:{expectedVersion:number;reason?:string;approvedStart?:string;approvedEnd?:string;operationId?:string},requestKind?:'ATTENDANCE_CONFIRMATION')=>hrRequest<ManagerRequest>(base,`/api/manager/approvals/${encodeURIComponent(id)}/${action}`,{method:'POST',body:JSON.stringify(requestKind === 'ATTENDANCE_CONFIRMATION' ? {expectedVersion:payload.expectedVersion,reason:payload.reason,operationId:payload.operationId} : payload)});
export interface ManagerAssignment{_id:string;managerUserId:string;departmentId:string;effectiveFrom:string;effectiveTo?:string;active:boolean}
export const getManagerAssignments=(base:string)=>hrRequest<ManagerAssignment[]>(base,'/api/hr/manager-assignments',{method:'GET'});
export const getManagerAssignmentCandidates=(base:string)=>hrRequest<{id:string;fullName:string}[]>(base,'/api/hr/manager-assignment-candidates',{method:'GET'});
export const createManagerAssignment=(base:string,p:{managerUserId:string;departmentId:string;effectiveFrom:string;effectiveTo?:string})=>hrRequest<ManagerAssignment>(base,'/api/hr/manager-assignments',{method:'POST',body:JSON.stringify(p)});
export const setManagerAssignmentActive=(base:string,id:string,active:boolean)=>hrRequest<ManagerAssignment>(base,`/api/hr/manager-assignments/${encodeURIComponent(id)}/${active?'activate':'deactivate'}`,{method:'PATCH'});
