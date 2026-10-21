import { io, type Socket } from 'socket.io-client';

export type EmployeeRealtimeEvent =
  | 'request:decided'
  | 'attendance:changed'
  | 'leave:changed'
  | 'payslip:released'
  | 'compliance:warning';

const EMPLOYEE_EVENTS: EmployeeRealtimeEvent[] = [
  'request:decided',
  'attendance:changed',
  'leave:changed',
  'payslip:released',
  'compliance:warning',
];

export function subscribeEmployeeRealtime(base: string, onChange: (event: EmployeeRealtimeEvent) => void): () => void {
  const parsed = new URL(base);
  const socketPath = parsed.pathname.includes('/local-api') ? '/local-api/socket.io' : '/socket.io';
  let socket: Socket | null = io(`${parsed.origin}/events`, {
    path: socketPath,
    withCredentials: true,
    // Polling performs an authenticated HTTP handshake with React Native's
    // cookie jar before upgrading to WebSocket on Android/iOS.
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  });

  const listeners = EMPLOYEE_EVENTS.map((event) => {
    const listener = () => onChange(event);
    socket?.on(event, listener);
    return { event, listener };
  });

  return () => {
    if (!socket) return;
    listeners.forEach(({ event, listener }) => socket?.off(event, listener));
    socket.disconnect();
    socket = null;
  };
}
