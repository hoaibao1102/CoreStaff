import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { AttendanceMethod, WorkMode } from '../../database/schemas/enums';
import type { WorkplaceWifiRule } from '../../database/schemas/workplace.schema';
import { HaversineService, type GeoPoint } from './haversine.service';
import { isWifiAllowed } from './wifi-matcher';

export interface WorkplaceVerificationConfig {
  latitude?: number;
  longitude?: number;
  allowedRadiusMeters?: number;
  maximumAccuracyMeters?: number;
  allowWifiAttendance?: boolean;
  allowGpsAttendance?: boolean;
  allowSelfieFallback?: boolean;
  allowedWifiNetworks?: WorkplaceWifiRule[];
}

export interface VerificationInput {
  /** A selfie was uploaded — it always wins. */
  hasFile: boolean;
  /** Check-in: the DTO's workMode. Check-out: the workMode stored on the day. */
  workMode?: WorkMode | null;
  wifiBssid?: string | null;
  location?: { latitude?: number; longitude?: number; accuracyMeters?: number } | null;
  workplace?: WorkplaceVerificationConfig | null;
}

export interface VerificationResult {
  method: AttendanceMethod;
  distanceMeters?: number;
  matchedWifi?: WorkplaceWifiRule;
}

/**
 * FR — which method proves presence, in order: Wi-Fi (BSSID of a configured
 * access point), then GPS inside the workplace geofence, then a selfie the
 * manager approves. Throws the business error the client acts on, so the
 * caller only deals with a successful result.
 *
 * Shared by check-in and check-out: the two used to carry identical copies.
 */
export function resolveVerification(
  input: VerificationInput,
  haversine: HaversineService,
): VerificationResult {
  const { hasFile, workMode, wifiBssid, location, workplace } = input;

  if (hasFile || workMode === WorkMode.OUT_OFFICE) {
    if (!hasFile) throw new BadRequestException('SELFIE_IMAGE_INVALID');
    return { method: AttendanceMethod.SELFIE };
  }

  const matchedWifi = isWifiAllowed(wifiBssid, workplace?.allowedWifiNetworks);
  if (matchedWifi && workplace?.allowWifiAttendance !== false) {
    return { method: AttendanceMethod.NETWORK, matchedWifi };
  }

  const lat = location?.latitude;
  const lng = location?.longitude;
  if (lat == null || lng == null || !workplace?.latitude || !workplace?.longitude) {
    throw new UnprocessableEntityException(
      workplace?.allowSelfieFallback !== false ? 'SELFIE_REQUIRED' : 'NETWORK_NOT_ALLOWED',
    );
  }

  const maxAccuracy = workplace.maximumAccuracyMeters || 80;
  if (location?.accuracyMeters && location.accuracyMeters > maxAccuracy) {
    throw new UnprocessableEntityException('LOW_LOCATION_ACCURACY');
  }

  const point: GeoPoint = { latitude: lat, longitude: lng };
  const geofence = haversine.isInsideGeofence(
    point,
    { latitude: workplace.latitude, longitude: workplace.longitude },
    workplace.allowedRadiusMeters || 100,
  );

  if (geofence.isInside && workplace.allowGpsAttendance !== false) {
    return { method: AttendanceMethod.GPS, distanceMeters: geofence.distanceMeters };
  }

  throw new UnprocessableEntityException(
    workplace.allowSelfieFallback !== false ? 'SELFIE_REQUIRED' : 'OUTSIDE_ALLOWED_AREA',
  );
}
