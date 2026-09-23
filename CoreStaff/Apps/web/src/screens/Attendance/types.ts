export type AttendanceMethod = 'NETWORK' | 'GPS' | 'SELFIE';

export type AttendanceStatus =
  | 'NOT_CHECKED_IN'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'PENDING_APPROVAL'
  | 'LATE'
  | 'EARLY_LEAVE'
  | 'LOCKED'
  | 'DAY_OFF';

export type AvailableAction = 'CHECK_IN' | 'CHECK_OUT' | 'NONE';

export type EventApprovalStatus = 'AUTO_APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
export type DayApprovalStatus = 'NOT_SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type NetworkStatus =
  | 'CONNECTED_TO_ALLOWED_NETWORK'
  | 'NOT_CONNECTED_TO_ALLOWED_NETWORK'
  | 'NETWORK_NOT_CONFIGURED'
  | 'UNABLE_TO_VERIFY';

export interface WorkplaceInfo {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  maximumAccuracyMeters: number;
}

export interface NetworkVerification {
  method: 'NETWORK';
  status: NetworkStatus;
  canAttend: boolean;
  networkId: string | null;
  networkName: string | null;
  workplaceId: string | null;
  workplaceName: string | null;
}

export interface GpsVerification {
  method: 'GPS';
  workplace: WorkplaceInfo | null;
}

export interface SelfieVerification {
  method: 'SELFIE';
}

export type VerificationContext =
  | NetworkVerification
  | GpsVerification
  | SelfieVerification;

export interface OvertimeInfo {
  requestId: string;
  status: string;
  requestedStart?: string;
  requestedEnd?: string;
  approvedStart?: string;
  approvedEnd?: string;
  reason?: string;
  reviewComment?: string;
  reviewedAt?: string;
  otMinutes?: number;
}

export interface AttendanceEventBase {
  eventId: string;
  recordedAt: string; // ISO string
  method: AttendanceMethod;
  workplaceName?: string | null;
  status?: EventApprovalStatus;
  approvalStatus?: string;
  address?: string;
  accuracy?: number;
  accuracyMeters?: number;
  distanceMeters?: number;
  evidenceUrl?: string | null;
}

export interface NetworkEvent extends AttendanceEventBase {
  method: 'NETWORK';
  networkName: string;
}

export interface GpsEvent extends AttendanceEventBase {
  method: 'GPS';
  distanceMeters?: number;
  accuracyMeters?: number;
}

export interface SelfieLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  address: string | null;
}

export interface SelfieEvent extends AttendanceEventBase {
  method: 'SELFIE';
  capturedAtClient?: string;
  evidence?: { previewUrl: string };
  location?: SelfieLocation;
  approvalStatus?: any;
  rejectionReason?: string | null;
}

export type AttendanceEvent = NetworkEvent | GpsEvent | SelfieEvent;

export interface DayAttendance {
  id: string;
  workDate: string;
  shiftName: string;
  shiftHours: string;
  workplace: string;
  workplaceAddress: string;
  status: AttendanceStatus;
  availableAction: AvailableAction;
  attendanceMethod: AttendanceMethod;
  verificationContext: VerificationContext;
  checkIn?: AttendanceEvent | null;
  checkOut?: AttendanceEvent | null;
  totalWorkingMinutes?: number;
  workingMinutes?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  dayApprovalStatus?: DayApprovalStatus;
  overallApprovalStatus?: string;
  approvalComment?: string | null;
  approvalReviewedAt?: string | null;
  overtime?: OvertimeInfo | null;
}
