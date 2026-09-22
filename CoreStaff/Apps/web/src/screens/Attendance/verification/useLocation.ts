import { useEffect, useState } from 'react';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export interface LocationState {
  coords: LocationCoords | null;
  error: string | null;
}

function mapGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case 1:
      return 'PERMISSION_DENIED';
    case 2:
      return 'UNAVAILABLE';
    case 3:
      return 'TIMEOUT';
    default:
      return 'ERROR';
  }
}

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    coords: null,
    error: null,
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ coords: null, error: 'UNAVAILABLE' });
      return;
    }

    const onSuccess = (pos: GeolocationPosition) =>
      setState({
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        },
        error: null,
      });

    const onError = (err: GeolocationPositionError) =>
      setState({ coords: null, error: mapGeoError(err) });

    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 5_000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return state;
}

export function getFreshCoords(timeoutMs = 10_000): Promise<LocationCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  });
}

const addressCache = new Map<string, string>();

export async function fetchAddressFromCoords(
  latitude: number,
  longitude: number,
): Promise<string> {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = addressCache.get(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'vi,en',
        },
      },
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address;
        let formatted = '';
        if (addr) {
          const parts = [
            addr.road || addr.pedestrian || addr.suburb,
            addr.quarter || addr.neighbourhood || addr.suburb || addr.ward,
            addr.city_district || addr.district || addr.county,
            addr.city || addr.state,
          ].filter(Boolean);
          if (parts.length > 0) {
            formatted = parts.join(', ');
          }
        }
        const finalAddress = formatted || data.display_name;
        addressCache.set(cacheKey, finalAddress);
        return finalAddress;
      }
    }
  } catch {
    // Network timeout or offline - fallback
  }

  const fallback = `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  addressCache.set(cacheKey, fallback);
  return fallback;
}

export function formatCoords(coords: LocationCoords | null): string {
  if (!coords) return '';
  return `📍 ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} (±${Math.round(coords.accuracyMeters)}m)`;
}
