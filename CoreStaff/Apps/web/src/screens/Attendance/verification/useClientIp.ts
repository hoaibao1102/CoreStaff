// Client IP detection (FE-only) using WebRTC ICE candidate trick for office LAN IP.
const CACHE_KEY = 'corestaff-network-ip-v1';

interface CachedIp {
  ip: string | null;
  capturedAt: number;
  source: 'webrtc' | 'cache-fallback';
}

export type ClientIpSource = 'webrtc' | 'cache' | 'unavailable';

export interface ClientIpResult {
  ip: string | null;
  source: ClientIpSource;
}

export async function getClientIp(): Promise<ClientIpResult> {
  const cached = readCache();
  if (cached) {
    return { ip: cached.ip, source: 'cache' };
  }

  if (typeof RTCPeerConnection === 'undefined') {
    return { ip: null, source: 'unavailable' };
  }

  const ips = await collectLocalIpsViaWebRTC();
  const ip = pickRoutableIp(ips);
  writeCache({ ip, capturedAt: Date.now(), source: 'webrtc' });
  return { ip, source: 'webrtc' };
}

export function pickRoutableIp(candidates: readonly string[]): string | null {
  for (const raw of candidates) {
    const ip = raw?.trim();
    if (!ip) continue;
    if (ip === '0.0.0.0' || ip === '127.0.0.1') continue;
    if (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    ) {
      return ip;
    }
  }
  return null;
}

export function parseCandidateIp(line: string): string | null {
  if (!line) return null;
  const parts = line.split(/\s+/);
  const ip = parts[4];
  if (!ip) return null;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  return ip;
}

function collectLocalIpsViaWebRTC(): Promise<string[]> {
  return new Promise<string[]>((resolve) => {
    const ips = new Set<string>();
    let settled = false;
    const finish = (values: string[]) => {
      if (settled) return;
      settled = true;
      try {
        pc.close();
      } catch {
        // ignore
      }
      resolve(values);
    };

    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch {
      resolve([]);
      return;
    }

    pc.onicecandidate = (event) => {
      if (!event || !event.candidate || !event.candidate.candidate) {
        finish(Array.from(ips));
        return;
      }
      const ip = parseCandidateIp(event.candidate.candidate);
      if (ip) ips.add(ip);
    };

    pc.createDataChannel('corestaff-ip-probe');

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish(Array.from(ips)));

    window.setTimeout(() => finish(Array.from(ips)), 1500);
  });
}

function readCache(): CachedIp | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIp;
    if (typeof parsed?.capturedAt !== 'number') return null;
    if (Date.now() - parsed.capturedAt > 30 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(value: CachedIp): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}
