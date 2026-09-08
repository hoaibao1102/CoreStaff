export type MethodType = 'NETWORK' | 'GPS' | 'SELFIE';

/**
 * Work mode — the two business workflows. Replaces the FE-side method choice:
 *  - IN_OFFICE  : working at office → BE picks NETWORK or GPS (fallback SELFIE if both fail)
 *  - OUT_OFFICE : working in the field → SELFIE (photo evidence required)
 */
export type WorkMode = 'IN_OFFICE' | 'OUT_OFFICE';

export type AttendanceStatus =
  | 'NOT_CHECKED_IN'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'LATE'
  | 'EARLY_LEAVE'
  | 'LOCKED'
  | 'HOLIDAY';

export type ApprovalStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLARIFICATION_REQUESTED';

export type VerificationState =
  | 'CHECKING'
  | 'VALID'
  | 'INVALID_NETWORK'
  | 'OUT_OF_GEOFENCE'
  | 'LOW_ACCURACY'
  | 'NO_LOCATION_PERMISSION'
  | 'NO_CAMERA_PERMISSION'
  | 'CAMERA_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNCONFIGURED'
  | 'NETWORK_CHANGED';

export interface AttendanceEvent {
  time: string; // e.g. "08:15"
  serverTime: string; // e.g. "08:15:32 GMT+7"
  method: MethodType;
  workplace: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  accuracy?: number; // meters
  distanceFromWorkplace?: number; // meters
  selfieUrl?: string;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  clarificationRequest?: string;
  clarificationResponse?: string;
  auditNote?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details?: string;
}

export interface DayAttendance {
  id: string;
  date: string; // "2026-08-21"
  formattedDate: string; // "Thứ Sáu, 21/08/2026"
  shiftName: string; // "Ca hành chính"
  shiftHours: string; // "08:00 - 17:00"
  workplace: string; // "Văn phòng TVS Quận 8"
  workplaceAddress: string;
  status: AttendanceStatus;
  overallApprovalStatus: ApprovalStatus;
  checkIn?: AttendanceEvent;
  checkOut?: AttendanceEvent;
  totalWorkingMinutes?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  warningNote?: string;
  auditTrail: AuditLog[];
}

export interface EmployeeProfile {
  name: string;
  code: string;
  department: string;
  title: string;
  workplace: string;
  workplaceAddress: string;
  shift: string;
  shiftHours: string;
  manager: string;
  defaultMethod: MethodType;
  allowedRadius: number; // 100m
  maximumAccuracy: number; // 80m
}

export interface ApproverRequest {
  id: string;
  employee: {
    name: string;
    code: string;
    department: string;
    avatar?: string;
  };
  date: string;
  shiftName: string;
  shiftHours: string;
  method: MethodType;
  eventType: 'CHECK_IN' | 'CHECK_OUT' | 'FULL_DAY';
  reasonNeedApproval: string;
  warning?: string;
  status: ApprovalStatus;
  serverTime: string;
  checkIn?: {
    time: string;
    serverTime: string;
    address: string;
    accuracy: number;
    selfieUrl?: string;
    coordinates?: { lat: number; lng: number };
  };
  checkOut?: {
    time: string;
    serverTime: string;
    address: string;
    accuracy: number;
    selfieUrl?: string;
    coordinates?: { lat: number; lng: number };
  };
  distanceBetweenPointsKm?: number;
  employeeClarification?: string;
  rejectionReason?: string;
  auditTrail: AuditLog[];
}

export type FrameId =
  | 'E01_A'
  | 'E01_B'
  | 'E01_C'
  | 'E02'
  | 'E03'
  | 'E04'
  | 'E05'
  | 'E06'
  | 'E07'
  | 'E08'
  | 'E09'
  | 'E10'
  | 'E11'
  | 'A01'
  | 'A02'
  | 'A03';

export type MainTab =
  | 'PROTOTYPE'
  | 'FRAME_CATALOG'
  | 'SITEMAP'
  | 'USER_FLOWS'
  | 'BUTTON_MATRIX'
  | 'COMPONENT_INVENTORY';

export type EmployeeTab = 'TODAY' | 'HISTORY' | 'PROFILE';

export type ApproverTab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION';

export interface FrameMetadata {
  id: FrameId;
  code: string;
  title: string;
  role: 'EMPLOYEE' | 'APPROVER' | 'SYSTEM';
  category: string;
  goal: string;
  condition: string;
  primaryAction: string;
  nextNavigation: string;
  tags?: string[];
}
