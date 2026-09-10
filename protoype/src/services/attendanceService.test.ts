import { describe, expect, it } from 'vitest';
import { resolveMethod } from './attendanceService';
import type { AttendanceSignals, Workplace } from '../types';

/** resolveMethod is pure given (signals, workplace) — no store, no localStorage. */
const wp = (over: Partial<Workplace> = {}): Workplace => ({
  id: 'wp-1',
  organizationId: 'org-tvs',
  code: 'TVS-HQ',
  name: 'Văn phòng TVS Quận 8',
  address: '123 đường mẫu, Quận 8, TP.HCM',
  latitude: 10.7512,
  longitude: 106.6974,
  allowedRadiusMeters: 100,
  maximumAccuracyMeters: 80,
  allowNetworkAttendance: true,
  allowGpsAttendance: true,
  allowSelfieFallback: true,
  networks: [{ id: 'net-1', name: 'Mạng văn phòng', ssid: 'TVS_OFFICE_Q8', bssid: 'AA:BB:CC:DD:EE:01', active: true }],
  active: true,
  createdAt: '01/01/2026',
  ...over,
});

const atOffice = (over: Partial<AttendanceSignals> = {}): AttendanceSignals => ({
  workMode: 'IN_OFFICE',
  observedBssid: 'AA:BB:CC:DD:EE:01',
  gpsDistance: 24,
  gpsAccuracy: 16,
  ...over,
});

describe('resolveMethod — backend decides from signals + tenant Workplace', () => {
  it('matching BSSID → NETWORK', () => {
    expect(resolveMethod(atOffice(), wp())).toBe('NETWORK');
  });

  it('BSSID compare is case-insensitive', () => {
    expect(resolveMethod(atOffice({ observedBssid: 'aa:bb:cc:dd:ee:01' }), wp())).toBe('NETWORK');
  });

  it('unknown router falls back to GPS when inside the geofence', () => {
    expect(resolveMethod(atOffice({ observedBssid: 'DE:AD:BE:EF:00:01' }), wp())).toBe('GPS');
  });

  it('missing BSSID never yields NETWORK', () => {
    expect(resolveMethod(atOffice({ observedBssid: undefined }), wp())).toBe('GPS');
  });

  it('inactive network is not accepted', () => {
    const off = wp({ networks: [{ id: 'net-1', name: 'Mạng văn phòng', bssid: 'AA:BB:CC:DD:EE:01', active: false }] });
    expect(resolveMethod(atOffice(), off)).toBe('GPS');
  });

  /** GPS-gate cases must not report the office router — NETWORK wins first. */
  const offNetwork = { observedBssid: 'DE:AD:BE:EF:00:01' };

  it('workplace radius is the gate, not a hardcoded 100m', () => {
    expect(resolveMethod(atOffice({ ...offNetwork, gpsDistance: 60 }), wp({ allowedRadiusMeters: 50 }))).toBe('SELFIE');
  });

  it('GPS accuracy above the workplace maximum is rejected', () => {
    expect(resolveMethod(atOffice({ ...offNetwork, gpsAccuracy: 90 }), wp())).toBe('SELFIE');
  });

  it('tenant without a Workplace → SELFIE (no geofence, no router to match)', () => {
    expect(resolveMethod(atOffice(), undefined)).toBe('SELFIE');
  });

  it('OUT_OFFICE is always SELFIE regardless of network', () => {
    expect(resolveMethod(atOffice({ workMode: 'OUT_OFFICE' }), wp())).toBe('SELFIE');
  });

  it('method toggles on the workplace are honoured', () => {
    expect(resolveMethod(atOffice(), wp({ allowNetworkAttendance: false }))).toBe('GPS');
    expect(resolveMethod(atOffice({ observedBssid: undefined }), wp({ allowGpsAttendance: false }))).toBe('SELFIE');
  });
});
