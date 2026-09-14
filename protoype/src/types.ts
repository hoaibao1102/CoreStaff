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
  // Radius/accuracy thresholds are NOT here — they belong to the tenant's
  // Workplace (SRS §15.4) and are resolved by resolveMethod(signals, workplace).
}

/* ------------------------------------------------------------------ */
/* Check-in signals — the raw evidence a device reports, plus the      */
/* tenant Workplace the backend validates it against.                  */
/*                                                                     */
/* One shape for the whole app: attendanceService.CheckInParams,       */
/* harness SubmitParams and hooks/useAttendance.SubmitParams are       */
/* aliases of this, so adding a signal is a one-line change.           */
/*                                                                     */
/* No publicIp field on purpose — the backend observes the caller's IP */
/* itself (SRS BR-NET-01: never trust an IP the FE sends).             */
/* ------------------------------------------------------------------ */

export interface MockGpsLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  address: string;
  capturedAtClient: string;
}

export interface SelfieEvidenceResponse {
  source: 'MOCK_BACKEND';
  photoUrl: string;
  location: MockGpsLocation;
}

export interface AttendanceSignals {
  workMode: WorkMode;
  /**
   * BSSID (router MAC) the device's WiFi scan saw, reported to the backend.
   * The backend — not the device — decides whether that BSSID is one of the
   * tenant's registered routers, i.e. whether NETWORK applies.
   */
  observedBssid?: string;
  /** GPS distance/accuracy; undefined when not yet fixed. */
  gpsDistance?: number;
  gpsAccuracy?: number;
  /** Mock backend location attached to a SELFIE submission. */
  location?: MockGpsLocation;
  /** Mock evidence URL selected after the live camera capture gesture. */
  photoUrl?: string;
}

/** A manager's direct report, as shown on the department team roster (no approval action here — see ApproverRequest for that). */
export interface DepartmentTeamMember {
  id: string;
  name: string;
  code: string;
  title: string;
  department: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  approvalStatus: ApprovalStatus;
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

/* ------------------------------------------------------------------ */
/* Platform (SYSTEM_ADMIN) — SRS §3/§4.7/§4.8/§8                       */
/* ------------------------------------------------------------------ */

export interface Organization {
  id: string;
  name: string;
  code: string; // unique platform-wide (organizationCode)
  status: 'ACTIVE' | 'LOCKED';
  createdAt: string;
  userCount: number;
}

/**
 * A registered access point of a Workplace, identified by BSSID (router MAC).
 * SRS §15.4 models allowed networks as `AllowedNetwork.cidrOrIp`; the tenant
 * signs its HQ router instead here — see the BSSID note in the plan / SRS
 * amendment. `ssid` is display-only: SSIDs are not unique and users rename them.
 */
export interface WorkplaceNetwork {
  id: string;
  name: string;
  ssid?: string;
  bssid: string; // "AA:BB:CC:DD:EE:01"
  active: boolean;
}

/**
 * Workplace — SRS §15.4. Owned and configured by SYSTEM_ADMIN for this
 * prototype (deviation from FR-HRCFG-03, which assigns it to HR).
 */
export interface Workplace {
  id: string;
  organizationId: string;
  code: string; // UNIQUE(organizationId, code)
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number; // SRS default 100
  maximumAccuracyMeters: number; // SRS default 80
  allowNetworkAttendance: boolean;
  allowGpsAttendance: boolean;
  allowSelfieFallback: boolean;
  networks: WorkplaceNetwork[];
  active: boolean;
  createdAt: string;
}

/**
 * ShiftTemplate — SRS §6, §15.5. Owned and configured by HR for the tenant
 * (FR-HRCFG). §6.2: a shift starts and ends the same day — no overnight shifts.
 * 08:00–17:00 is seed data, not a hard-coded office hours constant.
 */
export interface ShiftTemplate {
  id: string;
  organizationId: string;
  code: string; // UNIQUE(organizationId, code)
  name: string;
  startTime: string; // "08:00"
  endTime: string; // "17:00" — always after startTime (§6.2)
  breakMinutes: number; // deducted by the backend; no separate break punch (§6.6)
  gracePeriodMinutes: number; // feeds lateMinutes = max(0, checkInAt - (start + grace))
  active: boolean; // referenced shifts are deactivated, never hard-deleted
  createdAt: string;
}

export interface PlatformUserAccount {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  role: 'HR' | 'DEPARTMENT_MANAGER' | 'EMPLOYEE';
  organizationId: string;
  organizationName: string;
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  mustChangePassword: boolean; // true after temp-password provisioning/reset
  lastLoginAt?: string;
}

/* ------------------------------------------------------------------ */
/* HR period closing — SRS §7.4, FR-HR-01..06, FR-ADJ-02               */
/* ------------------------------------------------------------------ */

export type PeriodStatus = 'OPEN' | 'REVIEWING' | 'READY_TO_CLOSE' | 'CLOSED';

export type PeriodBlockerType =
  | 'MISSING_CHECK_IN'
  | 'MISSING_CHECK_OUT'
  | 'PENDING_APPROVAL'
  | 'PENDING_CLARIFICATION';

export interface PeriodBlocker {
  id: string;
  type: PeriodBlockerType;
  employee: { code: string; name: string; department: string };
  date: string;
  note: string;
}

export interface DepartmentConfirmation {
  department: string;
  required: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  employeeCount: number;
}

export interface TimesheetSummary {
  employeeCode: string;
  employeeName: string;
  department: string;
  workingDays: number;
  workingMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
}

export interface AccountingPeriod {
  id: string;
  organizationId: string;
  organizationName: string;
  month: string; // "2026-08"
  label: string; // "Kỳ công Tháng 08/2026"
  status: PeriodStatus;
  version: number; // bumped on close/reopen (period version)
  blockers: PeriodBlocker[];
  confirmations: DepartmentConfirmation[];
  summaries: TimesheetSummary[]; // generated at close (snapshot)
  exportedAt?: string; // wiped on reopen — invalidates old export
  summary: {
    employeeCount: number;
    totalWorkingMinutes: number;
    totalLateMinutes: number;
    totalEarlyLeaveMinutes: number;
    generatedAt?: string;
  };
  auditTrail: AuditLog[];
}

export interface OrganizationStructure {
  organizationId: string;
  organizationName: string;
  departments: string[];
  workplaces: string[];
  shifts: string[];
  employeeCount: number;
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
  | 'A03'
  | 'H01'
  | 'H02'
  | 'S01'
  | 'S02';

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
