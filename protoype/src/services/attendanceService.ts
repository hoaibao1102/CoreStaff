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
  AttendanceEvent,
  Workplace,
  AttendanceSignals,
} from '../types';
import { CURRENT_EMPLOYEE, INITIAL_TODAY_ATTENDANCE } from '../data/mockData';
import { loadActiveWorkplace } from './adminService';

/* ------------------------------------------------------------------ *
 * In-memory "server store" for the session only — deliberately NOT
 * persisted (no localStorage). Reloading the page resets today's
 * attendance so the same scenario can be tested check-in/check-out
 * as many times as needed instead of being locked after one run.
 * ------------------------------------------------------------------ */

interface MockDb {
  today: DayAttendance;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

let db: MockDb = { today: clone(INITIAL_TODAY_ATTENDANCE) };

function loadDb(): MockDb {
  return db;
}

function saveDb(next: MockDb): void {
  db = next;
}

const simulateLatency = (ms: number) => new Promise((res) => setTimeout(res, ms));
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

/** "HH:MM" → minutes since midnight, for computing a real elapsed duration. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

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

/**
 * Decide the actual attendance method for a submission — what the backend does;
 * the FE never picks NETWORK/GPS/SELFIE on its own (SRS BR-METHOD-01).
 *
 * `workplace` is the tenant's admin-configured Workplace; thresholds come from
 * it, not from the employee record. `undefined` (no config) ⇒ neither NETWORK
 * nor GPS can be satisfied ⇒ SELFIE evidence.
 */
export function resolveMethod(
  signals: AttendanceSignals,
  workplace: Workplace | undefined,
): MethodType {
  if (signals.workMode === 'OUT_OFFICE') return 'SELFIE';

  // IN_OFFICE — is the observed router one this tenant registered?
  // The !! guard is deliberate: tsconfig has no `strict`, so an
  // `undefined.toUpperCase()` comparison would compile and silently degrade.
  const bssid = signals.observedBssid;
  if (
    !!bssid &&
    workplace?.allowNetworkAttendance &&
    workplace.networks.some((n) => n.active && n.bssid.toUpperCase() === bssid.toUpperCase())
  ) {
    return 'NETWORK';
  }
  if (
    workplace?.allowGpsAttendance &&
    signals.gpsDistance != null &&
    signals.gpsDistance <= workplace.allowedRadiusMeters &&
    (signals.gpsAccuracy == null || signals.gpsAccuracy <= workplace.maximumAccuracyMeters)
  ) {
    return 'GPS';
  }
  // Network and GPS both failed/unavailable → selfie evidence fallback.
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
  params: {
    time: string;
    serverTime: string;
    isCheckIn: boolean;
    signals: AttendanceSignals;
    /** Present unless SELFIE — resolveMethod never returns NETWORK/GPS without it. */
    workplace?: Workplace;
  }
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
      accuracy: randomInt(10, 25),
      selfieUrl: signals.photoUrl,
      approvalStatus: 'PENDING',
    };
  }

  if (method === 'GPS') {
    const wp = requireWorkplace(params.workplace);
    return {
      time,
      serverTime,
      method,
      workplace: wp.name,
      address: `${wp.address} (GPS, cách ${signals.gpsDistance ?? 0}m)`,
      accuracy: signals.gpsAccuracy,
      distanceFromWorkplace: signals.gpsDistance,
      approvalStatus: 'NOT_REQUIRED',
    };
  }

  // NETWORK
  const wp = requireWorkplace(params.workplace);
  const matched = wp.networks.find(
    (n) => n.active && signals.observedBssid && n.bssid.toUpperCase() === signals.observedBssid.toUpperCase(),
  );
  return {
    time,
    serverTime,
    method,
    workplace: wp.name,
    address: `Mạng ${matched?.ssid ?? matched?.name ?? 'văn phòng'} · ${matched?.bssid ?? signals.observedBssid}`,
    approvalStatus: 'NOT_REQUIRED',
  };
}

/** Mirrors SRS NETWORK_NOT_CONFIGURED (409) — unreachable via resolveMethod. */
function requireWorkplace(wp: Workplace | undefined): Workplace {
  if (!wp) throw new AttendanceError('WORKPLACE_NOT_CONFIGURED', 'Tổ chức chưa cấu hình văn phòng / mạng chấm công.');
  return wp;
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

/** @deprecated alias — the shape lives in types.ts as AttendanceSignals. */
export type CheckInParams = AttendanceSignals;

/** POST /api/attendance/check-in */
export async function submitCheckIn(prev: DayAttendance, params: CheckInParams): Promise<DayAttendance> {
  const signals: AttendanceSignals = { ...params };
  const workplace = loadActiveWorkplace();
  const method = resolveMethod(signals, workplace);
  await simulateLatency(800);

  const db = loadDb();
  if (db.today.status === 'CHECKED_IN' || db.today.status === 'COMPLETED') {
    throw new AttendanceError('ALREADY_CHECKED_IN', 'Bạn đã check-in rồi.');
  }
  assertEvidence(method, signals);

  const { time, serverTime } = nowTime();
  const checkIn = buildEvent(method, { time, serverTime, isCheckIn: true, signals, workplace });

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
  const workplace = loadActiveWorkplace();
  const method = resolveMethod(signals, workplace);
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
  const checkOut = buildEvent(method, { time, serverTime, isCheckIn: false, signals, workplace });

  const totalWorkingMinutes = db.today.checkIn
    ? Math.max(0, timeToMinutes(checkOut.time) - timeToMinutes(db.today.checkIn.time))
    : 0;

  const next: DayAttendance = {
    ...db.today,
    status: 'COMPLETED',
    totalWorkingMinutes,
    overallApprovalStatus: method === 'SELFIE' ? 'PENDING' : db.today.overallApprovalStatus,
    checkOut,
    warningNote:
      method === 'SELFIE'
        ? `Check-in và Check-out cách nhau ${(randomInt(15, 250) / 10).toFixed(1)} km (Đã gắn cờ tham khảo cho Approver).`
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