import type { WorkplaceWifiRule } from '../../database/schemas/workplace.schema';

/**
 * Canonical form is lower-case, colon-separated: `aa:bb:cc:dd:ee:ff`.
 * Android and iOS report it that way, but HR may paste either case or dashes.
 */
export function normalizeBssid(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, ':');
}

/**
 * The matched rule, or null. Only `bssid` decides: an SSID is only a name, and
 * anyone can open a hotspot under the office's SSID.
 */
export function isWifiAllowed(
  bssid: string | undefined | null,
  rules: WorkplaceWifiRule[] | undefined | null,
): WorkplaceWifiRule | null {
  if (!bssid || !rules?.length) return null;
  const candidate = normalizeBssid(bssid);
  if (!candidate) return null;
  return rules.find((rule) => rule.active !== false && normalizeBssid(rule.bssid) === candidate) ?? null;
}
