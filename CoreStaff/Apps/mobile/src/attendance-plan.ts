/**
 * Which evidence steps the device may attempt for an in-office punch.
 *
 * Mirrors the server's `resolveVerification` (api/attendance-verification.ts):
 * each `allow*` flag defaults to enabled and is only disabled by an explicit
 * `false`. A step that is disabled must not be attempted, so the app never asks
 * for a permission (location, camera) the workplace policy forbids.
 */
export interface AttendanceAssignmentFlags {
  allowWifiAttendance?: boolean;
  allowGpsAttendance?: boolean;
  allowSelfieFallback?: boolean;
  hasWifiNetworks?: boolean;
}

export interface AttendanceEvidencePlan {
  wifi: boolean;
  gps: boolean;
  selfie: boolean;
}

export function planAttendanceEvidence(assignment: AttendanceAssignmentFlags): AttendanceEvidencePlan {
  return {
    wifi: assignment.allowWifiAttendance !== false && assignment.hasWifiNetworks !== false,
    gps: assignment.allowGpsAttendance !== false,
    selfie: assignment.allowSelfieFallback !== false,
  };
}
