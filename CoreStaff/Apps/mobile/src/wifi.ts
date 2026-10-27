/**
 * The Wi-Fi the phone is on, as the OS reports it. `bssid` is the access point's
 * MAC and the only field the server verifies; `ssid` is kept for the audit trail.
 *
 * The native module is loaded defensively: Expo Go has no `react-native-network-info`,
 * and a missing module must degrade to "no Wi-Fi" (the server then falls back to
 * GPS/selfie) instead of crashing the screen.
 */
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

export async function currentWifi(): Promise<{ ssid?: string; bssid?: string }> {
  const module = load();
  if (!module) return {};
  const [ssid, bssid] = await Promise.allSettled([module.getSSID(), module.getBSSID()]);
  return {
    ssid: ssid.status === 'fulfilled' ? clean(ssid.value) : undefined,
    bssid: bssid.status === 'fulfilled' ? clean(bssid.value)?.toLowerCase() : undefined,
  };
}
