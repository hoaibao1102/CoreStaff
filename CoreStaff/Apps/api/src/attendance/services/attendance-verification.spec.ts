import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { AttendanceMethod, WorkMode } from '../../database/schemas/enums';
import { resolveVerification, type VerificationInput } from './attendance-verification';
import { HaversineService } from './haversine.service';

const OFFICE = {
  latitude: 10.7769,
  longitude: 106.7009,
  allowedRadiusMeters: 200,
  maximumAccuracyMeters: 100,
  allowWifiAttendance: true,
  allowGpsAttendance: true,
  allowSelfieFallback: true,
  allowedWifiNetworks: [{ ssid: 'Office', bssid: 'aa:bb:cc:11:22:33', active: true }],
};
const INSIDE = { latitude: 10.7769, longitude: 106.7009, accuracyMeters: 10 };
const FAR = { latitude: 10.88791, longitude: 106.7717033, accuracyMeters: 10 };

describe('resolveVerification', () => {
  const haversine = new HaversineService();
  const run = (input: Partial<VerificationInput>) =>
    resolveVerification({ hasFile: false, workMode: WorkMode.IN_OFFICE, workplace: OFFICE, ...input }, haversine);

  it('a selfie always wins', () => {
    expect(run({ hasFile: true, wifiBssid: 'aa:bb:cc:11:22:33', location: INSIDE }).method).toBe(AttendanceMethod.SELFIE);
  });

  it('OUT_OFFICE without a file is rejected', () => {
    expect(() => run({ workMode: WorkMode.OUT_OFFICE })).toThrow(BadRequestException);
  });

  it('a matching BSSID needs nothing else', () => {
    const result = run({ wifiBssid: 'AA-BB-CC-11-22-33' });
    expect(result.method).toBe(AttendanceMethod.NETWORK);
    expect(result.distanceMeters).toBeUndefined();
  });

  it('falls back to SELFIE_REQUIRED when no evidence at all', () => {
    expect(() => run({})).toThrow(UnprocessableEntityException);
    expect(() => run({})).toThrow('SELFIE_REQUIRED');
  });

  it('accepts GPS inside the geofence', () => {
    const result = run({ wifiBssid: 'ff:ff:ff:ff:ff:ff', location: INSIDE });
    expect(result.method).toBe(AttendanceMethod.GPS);
    expect(result.distanceMeters).toBeLessThan(1);
  });

  it('requires a selfie when GPS is outside the geofence', () => {
    expect(() => run({ location: FAR })).toThrow('SELFIE_REQUIRED');
  });

  it('reports poor accuracy before checking the geofence', () => {
    expect(() => run({ location: { ...INSIDE, accuracyMeters: 500 } })).toThrow('LOW_LOCATION_ACCURACY');
  });

  it('ignores Wi-Fi when the workplace disallows it', () => {
    const result = resolveVerification(
      { hasFile: false, workMode: WorkMode.IN_OFFICE, wifiBssid: 'aa:bb:cc:11:22:33', location: INSIDE, workplace: { ...OFFICE, allowWifiAttendance: false } },
      haversine,
    );
    expect(result.method).toBe(AttendanceMethod.GPS);
  });
});
