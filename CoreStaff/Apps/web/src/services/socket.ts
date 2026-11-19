import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
let currentTargetKey: string | null = null;

export function getSocket(apiBase?: string | null): Socket {
  let targetOrigin = window.location.origin;
  let socketPath = '/socket.io';
  const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  // In development, connect Socket.IO straight to Nest instead of tunnelling
  // the long-lived WebSocket through Vite. Nest watch restarts legitimately
  // reset open sockets; bypassing the proxy prevents noisy `ws proxy error:
  // ECONNRESET` logs while Socket.IO performs its normal reconnection. Keep the
  // browser hostname (localhost vs 127.0.0.1) so the first-party sid cookie is
  // still sent, and only replace the dev-server port with the API port.
  if (isLocalDevelopment) {
    targetOrigin = `${window.location.protocol}//${window.location.hostname}:3000`;
  }

  if (apiBase) {
    try {
      const url = new URL(apiBase, window.location.origin);
      if (isLocalDevelopment && url.origin === window.location.origin) {
        socketPath = '/socket.io';
      } else if (url.origin !== window.location.origin) {
        // Explicit legacy/direct backend; cookie policy remains the backend's.
        targetOrigin = url.origin;
        socketPath = '/socket.io';
      } else {
        // Same-origin proxy (Vite or production HTTP rewrite).
        targetOrigin = window.location.origin;
        if (url.pathname.includes('/local-api')) {
          socketPath = '/local-api/socket.io';
        } else {
          socketPath = '/socket.io';
        }
      }
    } catch {
      targetOrigin = window.location.origin;
    }
  }

  // Vercel rewrites proxy HTTP requests, not a WebSocket server. Polling stays
  // first-party so the HttpOnly sid cookie authenticates /events unchanged.
  // Keep direct Nest development/legacy transports outside this proxy path.
  const sameOriginProxy = !isLocalDevelopment && targetOrigin === window.location.origin;
  const targetKey = `${targetOrigin}:${socketPath}`;

  if (socketInstance && currentTargetKey === targetKey && socketInstance.connected) {
    return socketInstance;
  }

  if (socketInstance && currentTargetKey !== targetKey) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  if (!socketInstance) {
    currentTargetKey = targetKey;
    socketInstance = io(`${targetOrigin}/events`, {
      path: socketPath,
      withCredentials: true,
      transports: sameOriginProxy ? ['polling'] : ['websocket', 'polling'],
      upgrade: !sameOriginProxy,
      // The production rewrite matches /socket.io exactly, not /socket.io/.
      addTrailingSlash: !sameOriginProxy,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected successfully to /events namespace (id:', socketInstance?.id, ')');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
    });
  }

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentTargetKey = null;
  }
}
