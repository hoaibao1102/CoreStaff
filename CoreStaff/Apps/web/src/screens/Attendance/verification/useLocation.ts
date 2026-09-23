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
  accuracyMeters?: number,
): Promise<string> {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = addressCache.get(cacheKey);
  if (cached && !cached.startsWith('📍')) return cached;

  // 1. Photon (OpenStreetMap data - Fast, CORS enabled, provides street & district)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const p = data.features?.[0]?.properties;
      if (p) {
        const street = [p.housenumber, p.street || p.name].filter(Boolean).join(' ');
        const district = p.district || p.locality || p.suburb;
        const city = p.city || p.state;
        const parts = [street, district, city].filter(Boolean);
        if (parts.length > 0) {
          const finalAddress = parts.join(', ');
          addressCache.set(cacheKey, finalAddress);
          return finalAddress;
        }
      }
    }
  } catch {
    // Continue to next provider
  }

  // 2. BigDataCloud (Client-side free reverse geocoding - reliable in VN, returns exact administrative units)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const admin: any[] = data.localityInfo?.administrative || [];
      const info: any[] = data.localityInfo?.informative || [];

      const wardObj = admin.find(
        (a) =>
          a.adminLevel === 6 ||
          a.name?.includes('Phường') ||
          a.name?.includes('Xã') ||
          a.name?.includes('Thị trấn')
      );
      const ward = wardObj?.name || data.locality;

      const districtObj =
        info.find(
          (i) =>
            i.name?.startsWith('Thành phố ') ||
            i.name?.startsWith('Quận ') ||
            i.name?.startsWith('Huyện ') ||
            i.name?.startsWith('Thị xã ')
        ) ||
        admin.find(
          (a) =>
            a.adminLevel === 5 ||
            (a.adminLevel !== 4 &&
              (a.name?.includes('Quận') || a.name?.includes('Huyện')))
        );
      const district = districtObj?.name;

      const province = data.city || data.principalSubdivision;

      const parts = [ward, district, province].filter(Boolean);
      const uniqueParts: string[] = [];
      for (const part of parts) {
        if (!uniqueParts.some((p) => p.includes(part) || part.includes(p))) {
          uniqueParts.push(part);
        }
      }

      if (uniqueParts.length > 0) {
        const finalAddress = uniqueParts.join(', ');
        addressCache.set(cacheKey, finalAddress);
        return finalAddress;
      }
    }
  } catch {
    // Continue
  }

  // Fallback if completely offline
  const fallback = typeof accuracyMeters === 'number'
    ? `Vị trí thực địa (±${Math.round(accuracyMeters)}m)`
    : `Vị trí thực địa (Tọa độ: ${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
  return fallback;
}

export function formatCoords(coords: LocationCoords | null): string {
  if (!coords) return '';
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} (±${Math.round(coords.accuracyMeters)}m)`;
}
