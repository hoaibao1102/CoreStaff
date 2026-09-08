/**
 * attendanceService.ts — Mock API layer for attendance operations.
 *
 * This is the SWAP POINT when wiring a real backend. Keep the function
 * signatures + error contract stable; replace the bodies with real `fetch()`
 * calls to the ERP TimeKeeping API.
 *
 * Business model (simplified from the 3-method choice):
 *  - FE sends workMode (IN_OFFICE / OUT_OFFICE) + raw signals (network, GPS).
 *  - BE decides the actual AttendanceMethod (NETWORK | GPS | SELFIE):
 *      IN_OFFICE  → NETWORK (if network ok) or GPS (if in zone) — fallback SELFIE.
 *      OUT_OFFICE → SELFIE (photo evidence required).
 */
import {
  DayAttendance,
  MethodType,
  WorkMode,
  AttendanceEvent,
} from '../types';
import { CURRENT_EMPLOYEE, INITIAL_TODAY_ATTENDANCE } from '../data/mockData';

/* ------------------------------------------------------------------ *
 * Client-side "server store" persisted to localStorage.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = 'tvs-timekeeping-mock-v1';

interface MockDb {
  today: DayAttendance;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    /* fall through */
  }
  return { today: clone(INITIAL_TODAY_ATTENDANCE) };
}

function saveDb(db: MockDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage may be unavailable — fail silently */
  }
}

const simulateLatency = (ms: number) => new Promise((res) => setTimeout(res, ms));

export class AttendanceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AttendanceError';
  }
}

const nowTime = (): { time: string; serverTime: string } => {
  const n = new Date();
  const time = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  const serverTime = `${time}:${String(n.getSeconds()).padStart(2, '0')} GMT+7`;
  return { time, serverTime };
};

/* ------------------------------------------------------------------ *
 * Signals + method resolution (the BE-decision core)
 * ------------------------------------------------------------------ */

export interface AttendanceSignals {
  workMode: WorkMode;
  /** Whether the device is on the company network. */
  networkValid: boolean;
  /** GPS distance/accuracy; undefined when not yet fixed. */
  gpsDistance?: number;
  gpsAccuracy?: number;
  /** Selfie photo (data URL) when the OUT flow captured one. */
  photoUrl?: string;
}

/**
 * Decide the actual attendance method for a submission. This mirrors exactly
 * what the backend does — FE never picks NETWORK/GPS/SELFIE on its own.
 */
export function resolveMethod(signals: AttendanceSignals): MethodType {
  if (signals.workMode === 'OUT_OFFICE') return 'SELFIE';

  // IN_OFFICE
  if (signals.networkValid) return 'NETWORK';
  if (
    signals.gpsDistance != null &&
    signals.gpsDistance <= CURRENT_EMPLOYEE.allowedRadius &&
    (signals.gpsAccuracy == null || signals.gpsAccuracy <= CURRENT_EMPLOYEE.maximumAccuracy)
  ) {
    return 'GPS';
  }
  // Both network and GPS failed → fallback to selfie evidence.
  return 'SELFIE';
}

function assertEvidence(method: MethodType, signals: AttendanceSignals): void {
  if (method === 'SELFIE' && !signals.photoUrl) {
    throw new AttendanceError(
      'SELFIE_REQUIRED',
      'Bằng chứng ảnh selfie là bắt buộc khi chấm công từ xa / khi không thể xác minh mạng & GPS tại văn phòng.'
    );
  }
}

function buildEvent(
  method: MethodType,
  params: { time: string; serverTime: string; isCheckIn: boolean; signals: AttendanceSignals }
): AttendanceEvent {
  const { time, serverTime, isCheckIn, signals } = params;

  if (method === 'SELFIE') {
    return {
      time,
      serverTime,
      method,
      workplace: isCheckIn ? 'Thị trường Quận 7' : 'Thị trường TP. Thủ Đức',
      address: isCheckIn
        ? 'Khu dân cư Him Lam, Phường Tân Hưng, Quận 7, TP.HCM'
        : 'Khu Công nghệ cao, Phường Tân Phú, TP. Thủ Đức, TP.HCM',
      accuracy: isCheckIn ? 18 : 15,
      selfieUrl: signals.photoUrl,
      approvalStatus: 'PENDING',
    };
  }

  if (method === 'GPS') {
    return {
      time,
      serverTime,
      method,
      workplace: CURRENT_EMPLOYEE.workplace,
      address: `123 đường mẫu, Quận 8, TP.HCM (GPS, cách ${signals.gpsDistance ?? 0}m)`,
      accuracy: signals.gpsAccuracy,
      distanceFromWorkplace: signals.gpsDistance,
      approvalStatus: 'NOT_REQUIRED',
    };
  }

  // NETWORK
  return {
    time,
    serverTime,
    method,
    workplace: CURRENT_EMPLOYEE.workplace,
    address: 'Mạng TVS_OFFICE_Q8 (LAN)',
    approvalStatus: 'NOT_REQUIRED',
  };
}

/* ------------------------------------------------------------------ *
 * API (mock)
 * ------------------------------------------------------------------ */

export async function fetchToday(): Promise<DayAttendance> {
  await simulateLatency(400);
  return clone(loadDb().today);
}

export function loadToday(): DayAttendance {
  return clone(loadDb().today);
}

export function resetToday(): DayAttendance {
  const fresh = clone(INITIAL_TODAY_ATTENDANCE);
  const db = loadDb();
  db.today = fresh;
  saveDb(db);
  return clone(fresh);
}

export interface CheckInParams {
  workMode: WorkMode;
  networkValid: boolean;
  gpsDistance?: number;
  gpsAccuracy?: number;
  photoUrl?: string;
}

/** POST /api/attendance/check-in */
export async function submitCheckIn(prev: DayAttendance, params: CheckInParams): Promise<DayAttendance> {
  const signals: AttendanceSignals = { ...params };
  const method = resolveMethod(signals);
  await simulateLatency(800);

  const db = loadDb();
  if (db.today.status === 'CHECKED_IN' || db.today.status === 'COMPLETED') {
    throw new AttendanceError('ALREADY_CHECKED_IN', 'Bạn đã check-in rồi.');
  }
  assertEvidence(method, signals);

  const { time, serverTime } = nowTime();
  const checkIn = buildEvent(method, { time, serverTime, isCheckIn: true, signals });

  const next: DayAttendance = {
    ...db.today,
    status: 'CHECKED_IN',
    overallApprovalStatus: method === 'SELFIE' ? 'PENDING' : db.today.overallApprovalStatus,
    checkIn,
    auditTrail: [
      ...db.today.auditTrail,
      {
        id: `log-${Date.now()}`,
        timestamp: time,
        actor: `${CURRENT_EMPLOYEE.name} (${CURRENT_EMPLOYEE.code})`,
        action:
          method === 'SELFIE'
            ? `Gửi ảnh Selfie Check-in (${signals.workMode}). Đang chờ Cấp trên duyệt.`
            : `Check-in thành công qua ${method} (${signals.workMode}).`,
      },
    ],
  };
  db.today = next;
  saveDb(db);
  return clone(next);
}

/** POST /api/attendance/check-out */
export async function submitCheckOut(prev: DayAttendance, params: CheckInParams): Promise<DayAttendance> {
  const signals: AttendanceSignals = { ...params };
  const method = resolveMethod(signals);
  await simulateLatency(800);

  const db = loadDb();
  if (db.today.status === 'NOT_CHECKED_IN') {
    throw new AttendanceError('INVALID_ATTENDANCE_ACTION', 'Không thể check-out khi chưa check-in (BR-GPS-10).');
  }
  if (db.today.status === 'COMPLETED') {
    throw new AttendanceError('ALREADY_CHECKED_OUT', 'Bạn đã check-out rồi.');
  }
  assertEvidence(method, signals);

  const { time, serverTime } = nowTime();
  const checkOut = buildEvent(method, { time, serverTime, isCheckIn: false, signals });

  const next: DayAttendance = {
    ...db.today,
    status: 'COMPLETED',
    totalWorkingMinutes: 545,
    overallApprovalStatus: method === 'SELFIE' ? 'PENDING' : db.today.overallApprovalStatus,
    checkOut,
    warningNote:
      method === 'SELFIE'
        ? 'Check-in và Check-out cách nhau 18,4 km (Đã gắn cờ tham khảo cho Approver).'
        : db.today.warningNote,
    auditTrail: [
      ...db.today.auditTrail,
      {
        id: `log-${Date.now()}`,
        timestamp: time,
        actor: `${CURRENT_EMPLOYEE.name} (${CURRENT_EMPLOYEE.code})`,
        action:
          method === 'SELFIE'
            ? `Gửi ảnh Selfie Check-out (${signals.workMode}). Đang chờ Cấp trên duyệt.`
            : `Check-out thành công qua ${method} (${signals.workMode}). Hoàn thành ngày công.`,
      },
    ],
  };
  db.today = next;
  saveDb(db);
  return clone(next);
}