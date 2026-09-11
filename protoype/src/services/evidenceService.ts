import type { SelfieEvidenceResponse } from '../types';

export const MOCK_SELFIE_EVIDENCE: Record<'CHECK_IN' | 'CHECK_OUT', Omit<SelfieEvidenceResponse, 'location'> & {
  location: Omit<SelfieEvidenceResponse['location'], 'capturedAtClient'>;
}> = {
  CHECK_IN: {
    source: 'MOCK_BACKEND',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    location: {
      latitude: 10.7483,
      longitude: 106.6974,
      accuracyMeters: 18,
      address: 'Khu dân cư Him Lam, Phường Tân Hưng, Quận 7, TP.HCM',
    },
  },
  CHECK_OUT: {
    source: 'MOCK_BACKEND',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    location: {
      latitude: 10.8524,
      longitude: 106.7928,
      accuracyMeters: 15,
      address: 'Khu Công nghệ cao, Phường Tân Phú, TP. Thủ Đức, TP.HCM',
    },
  },
};

const simulateLatency = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simulates the response returned after a backend accepts a live camera capture.
 * The browser camera remains real; the persisted evidence photo/GPS are stable
 * mock data so the approver demo is deterministic.
 */
export async function getMockSelfieEvidence(
  mode: 'CHECK_IN' | 'CHECK_OUT',
): Promise<SelfieEvidenceResponse> {
  await simulateLatency(250);
  const seed = MOCK_SELFIE_EVIDENCE[mode];
  return {
    ...seed,
    location: {
      ...seed.location,
      capturedAtClient: new Date().toISOString(),
    },
  };
}
