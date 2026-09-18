import type { WorkplaceInfo } from '../types';
import { haversineMeters } from './distance';
import type { LocationCoords } from './useLocation';

export interface GpsVerificationResult {
  canAttend: boolean;
  distanceMeters: number | null;
  accuracyAcceptable: boolean;
}

export function useGpsVerification(
  workplace: WorkplaceInfo | null,
  location: LocationCoords | null,
): GpsVerificationResult {
  if (!workplace || !location) {
    return {
      canAttend: false,
      distanceMeters: null,
      accuracyAcceptable: false,
    };
  }

  const distanceMeters = haversineMeters(
    workplace.latitude,
    workplace.longitude,
    location.latitude,
    location.longitude,
  );

  const inside = distanceMeters <= workplace.allowedRadiusMeters;
  const accuracyAcceptable =
    location.accuracyMeters <= workplace.maximumAccuracyMeters;

  return {
    canAttend: inside && accuracyAcceptable,
    distanceMeters,
    accuracyAcceptable,
  };
}
