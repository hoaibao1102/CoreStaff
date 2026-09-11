import { describe, expect, it } from 'vitest';
import { getMockSelfieEvidence } from './evidenceService';

describe('mock selfie evidence response', () => {
  it('returns check-in mock image and GPS payload', async () => {
    const evidence = await getMockSelfieEvidence('CHECK_IN');

    expect(evidence.source).toBe('MOCK_BACKEND');
    expect(evidence.photoUrl).toContain('photo-1534528741775');
    expect(evidence.location).toMatchObject({
      latitude: 10.7483,
      longitude: 106.6974,
      accuracyMeters: 18,
      address: 'Khu dân cư Him Lam, Phường Tân Hưng, Quận 7, TP.HCM',
    });
    expect(evidence.location.capturedAtClient).toMatch(/T/);
  });

  it('returns a distinct check-out mock image and GPS payload', async () => {
    const checkIn = await getMockSelfieEvidence('CHECK_IN');
    const checkOut = await getMockSelfieEvidence('CHECK_OUT');

    expect(checkOut.photoUrl).not.toBe(checkIn.photoUrl);
    expect(checkOut.location.latitude).toBe(10.8524);
    expect(checkOut.location.longitude).toBe(106.7928);
    expect(checkOut.location.accuracyMeters).toBe(15);
  });

  it('returns a fresh response so callers cannot mutate the seed', async () => {
    const first = await getMockSelfieEvidence('CHECK_IN');
    first.location.address = 'changed';

    const second = await getMockSelfieEvidence('CHECK_IN');
    expect(second.location.address).toBe('Khu dân cư Him Lam, Phường Tân Hưng, Quận 7, TP.HCM');
  });
});
