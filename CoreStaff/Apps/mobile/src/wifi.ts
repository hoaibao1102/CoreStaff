/**
 * The Wi-Fi the phone is on, as the OS reports it. `bssid` is the access point's
 * MAC and the only field the server verifies; `ssid` is kept for the audit trail.
 *
 * The native module is loaded defensively: Expo Go has no `react-native-network-info`,
 * and a missing module must degrade to "no Wi-Fi" (the server then falls back to
 * GPS/selfie) instead of crashing the screen.
 */
import * as Location from 'expo-location';

type NetworkInfoModule = { getSSID(): Promise<string | null>; getBSSID(): Promise<string | null> };

let native: NetworkInfoModule | null | undefined;

function load(): NetworkInfoModule | null {
  if (native !== undefined) return native;
  try {
    native = (require('react-native-network-info') as { NetworkInfo: NetworkInfoModule }).NetworkInfo ?? null;
  } catch {
    native = null;
  }
  return native;
}

/** Android wraps the SSID in quotes and reports `<unknown ssid>` without permission. */
function clean(value: string | null | undefined): string | undefined {
  const text = value?.trim().replace(/^"|"$/g, '');
  if (!text || text === '<unknown ssid>' || text === '00:00:00:00:00:00') return undefined;
  return text;
}

/**
 * Android 10+ hides the SSID/BSSID unless the app holds the location permission,
 * so it must be requested before reading, not only at the GPS step.
 */
async function ensureLocationPermission(): Promise<boolean> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return true;
    return (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function currentWifi(): Promise<{ ssid?: string; bssid?: string }> {
  const module = load();
  if (!module) return {};
  await ensureLocationPermission();
  const [ssid, bssid] = await Promise.allSettled([module.getSSID(), module.getBSSID()]);
  return {
    ssid: ssid.status === 'fulfilled' ? clean(ssid.value) : undefined,
    bssid: bssid.status === 'fulfilled' ? clean(bssid.value)?.toLowerCase() : undefined,
  };
}

export type WifiDiagnostics = { moduleLoaded: boolean; permission: boolean; servicesEnabled: boolean; ssid?: string; bssid?: string };

/** Debug only: what the phone can actually read, and why a field is empty. */
export async function wifiDiagnostics(): Promise<WifiDiagnostics> {
  const moduleLoaded = load() !== null;
  const permission = await ensureLocationPermission();
  let servicesEnabled = true;
  try { servicesEnabled = await Location.hasServicesEnabledAsync(); } catch { /* unknown */ }
  const wifi = await currentWifi();
  return { moduleLoaded, permission, servicesEnabled, ...wifi };
}
