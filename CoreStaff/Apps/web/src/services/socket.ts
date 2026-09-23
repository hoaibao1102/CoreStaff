import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
let currentTargetKey: string | null = null;

export function getSocket(apiBase?: string | null): Socket {
  let targetOrigin = window.location.origin;
  let socketPath = '/socket.io';

  if (apiBase) {
    try {
      const url = new URL(apiBase, window.location.origin);
      if (url.origin !== window.location.origin) {
        // Direct remote backend URL (e.g. production)
        targetOrigin = url.origin;
        socketPath = '/socket.io';
      } else {
        // Same-origin dev proxy
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
      transports: ['websocket', 'polling'],
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
