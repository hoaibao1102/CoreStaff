/**
 * hrService.ts — Mock API layer for HR period closing (chốt công).
 *
 * SWAP POINT for a real backend: keep signatures, replace bodies with HTTP
 * calls to the ERP timesheet APIs (GET /hr/periods, POST confirm / close /
 * reopen / export).
 *
 * Encodes SRS §11A: FR-HR-03 (dept confirmations), FR-HR-04 (close — the
 * backend RE-CHECKS blockers inside the transaction, the FE never decides),
 * FR-HR-05 (reopen — mandatory reason 10–1000 chars, invalidates the old
 * export snapshot), FR-HR-06 (export from the closed snapshot).
 *
 * State persists to localStorage so reloads keep the ceremony result.
 *
 * Also carries SRS §6 ShiftTemplate config (FR-HRCFG): HR creates/edits the
 * tenant's "ca làm"; the backend computes late/early/working minutes from the
 * schedule snapshot (§6.6), never from hard-coded 08:00/17:00.
 */
import { AccountingPeriod, OrganizationStructure, ShiftTemplate } from '../types';
import { MOCK_PERIODS, MOCK_HR_ORG, MOCK_SHIFT_TEMPLATES, TENANT_ORG_ID } from '../data/mockData';

const STORAGE_KEY = 'tvs-timekeeping-mock-hr-v1';
// Separate key so an existing v1 period blob needs no migration.
const SHIFT_KEY = 'tvs-timekeeping-mock-hr-shifts-v1';
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export class HrError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'HrError';
  }
}

function loadStore(): AccountingPeriod[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AccountingPeriod[];
  } catch {
    /* ignore */
  }
  return MOCK_PERIODS.map((p) => clone(p));
}

function persist(store: AccountingPeriod[]): AccountingPeriod[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
  return store.map((p) => clone(p));
}

const simulateLatency = (ms: number) => new Promise((res) => setTimeout(res, ms));

const nowDisplay = () =>
  new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const HR_ACTOR = 'Phạm Thị Thu Hà (HR)';

function appendAudit(period: AccountingPeriod, action: string, details?: string) {
  period.auditTrail.push({ id: `hr-${Date.now()}-${period.auditTrail.length}`, timestamp: 'Vừa xong', actor: HR_ACTOR, action, details });
}

function findPeriod(store: AccountingPeriod[], id: string): AccountingPeriod {
  const period = store.find((p) => p.id === id);
  if (!period) throw new HrError('PERIOD_NOT_FOUND', 'Không tìm thấy kỳ công.');
  return period;
}

/** GET /api/hr/periods */
export async function fetchPeriods(): Promise<AccountingPeriod[]> {
  await simulateLatency(400);
  return clone(loadStore());
}

/** GET /api/hr/organization (lean structure overview) */
export async function fetchOrgOverview(): Promise<OrganizationStructure> {
  await simulateLatency(200);
  return clone(MOCK_HR_ORG);
}

/**
 * FR-HR-03: a department confirms readiness for the period. A department
 * carrying blockers cannot be confirmed — the blockers must be resolved first.
 */
export async function confirmDepartment(periodId: string, department: string): Promise<AccountingPeriod[]> {
  await simulateLatency(200);
  const store = loadStore();
  const period = findPeriod(store, periodId);
  if (period.status === 'CLOSED') throw new HrError('PERIOD_ALREADY_CLOSED', 'Kỳ đã chốt — không thể thay đổi xác nhận.');

  const hasBlockers = period.blockers.some((b) => b.employee.department === department);
  if (hasBlockers) throw new HrError('DEPARTMENT_NOT_READY', `${department} còn blocker chưa xử lý — không thể xác nhận.`);

  const conf = period.confirmations.find((c) => c.department === department);
  if (!conf) throw new HrError('DEPARTMENT_NOT_FOUND', 'Phòng ban không thuộc kỳ công này.');
  if (conf.confirmedBy) throw new HrError('ALREADY_CONFIRMED', `${department} đã được xác nhận trước đó.`);

  conf.confirmedBy = HR_ACTOR;
  conf.confirmedAt = nowDisplay();
  appendAudit(period, `Xác nhận ${department} đã sẵn sàng cho ${period.label}.`);

  // Backend transition (FE does not decide): all required depts confirmed and
  // no blockers → the period becomes closeable. CLOSED already returned above.
  if (period.blockers.length === 0 && period.confirmations.every((c) => !c.required || c.confirmedBy)) {
    period.status = 'READY_TO_CLOSE';
  }
  return persist(store);
}

/**
 * FR-HR-04 / UC-08: close a period. The service re-checks every precondition
 * in-transaction (mirroring "backend kiểm tra lại toàn bộ blocker"), generates
 * the per-employee TimesheetSummary snapshot, bumps the period version and
 * moves it to CLOSED — after which mutations are blocked.
 */
export async function closePeriod(periodId: string): Promise<AccountingPeriod[]> {
  await simulateLatency(300);
  const store = loadStore();
  const period = findPeriod(store, periodId);

  if (period.status === 'CLOSED') throw new HrError('PERIOD_ALREADY_CLOSED', 'Kỳ công đã được chốt trước đó.');
  if (period.status !== 'READY_TO_CLOSE') throw new HrError('PERIOD_NOT_READY', 'Kỳ chưa ở trạng thái READY_TO_CLOSE.');
  if (period.blockers.length > 0) throw new HrError('PERIOD_NOT_READY', `Còn ${period.blockers.length} blocker chưa xử lý — không thể chốt.`);
  const missing = period.confirmations.filter((c) => c.required && !c.confirmedBy);
  if (missing.length > 0) throw new HrError('DEPARTMENT_NOT_READY', `Phòng ban chưa xác nhận: ${missing.map((m) => m.department).join(', ')}.`);

  // Snapshot: derived from the org structure seed (in production, from
  // AttendanceDay rows). Non-empty so the export step has real rows.
  period.summaries = buildSnapshotSummaries();
  const totals = period.summaries.reduce(
    (acc, s) => ({
      working: acc.working + s.workingMinutes,
      late: acc.late + s.lateMinutes,
      early: acc.early + s.earlyMinutes,
    }),
    { working: 0, late: 0, early: 0 },
  );
  period.summary = {
    employeeCount: period.summaries.length,
    totalWorkingMinutes: totals.working,
    totalLateMinutes: totals.late,
    totalEarlyLeaveMinutes: totals.early,
    generatedAt: nowDisplay(),
  };
  period.status = 'CLOSED';
  period.version += 1;
  appendAudit(period, `Chốt ${period.label} — tạo snapshot tổng hợp cho ${period.summaries.length} hồ sơ (phiên bản kỳ v${period.version}).`);
  return persist(store);
}

/**
 * FR-HR-05 / UC-09: reopen a CLOSED period. Reason mandatory (10–1000 chars).
 * Wipes exportedAt (invalidates the old export snapshot), clears all department
 * confirmations (every dept must re-confirm) and bumps the period version.
 */
export async function reopenPeriod(periodId: string, reason: string): Promise<AccountingPeriod[]> {
  await simulateLatency(250);
  const trimmed = reason.trim();
  if (trimmed.length < 10 || trimmed.length > 1000) {
    throw new HrError('REOPEN_REASON_REQUIRED', 'Lý do mở lại bắt buộc, từ 10 đến 1000 ký tự.');
  }
  const store = loadStore();
  const period = findPeriod(store, periodId);
  if (period.status !== 'CLOSED') throw new HrError('PERIOD_NOT_CLOSED', 'Chỉ kỳ đã chốt mới mở lại được.');

  period.status = 'REVIEWING';
  period.exportedAt = undefined; // invalidates old export snapshot
  period.summaries = [];
  period.confirmations = period.confirmations.map((c) => ({ ...c, confirmedBy: undefined, confirmedAt: undefined }));
  period.version += 1;
  appendAudit(period, `Mở lại ${period.label} (v${period.version}) — snapshot export cũ bị vô hiệu.`, `Lý do: ${trimmed}`);
  return persist(store);
}

/**
 * FR-HR-06: export the closed snapshot as CSV. The export does not recompute
 * anything — it serializes the stored summaries.
 */
export async function exportPeriodSnapshot(periodId: string): Promise<{ period: AccountingPeriod; csv: string }> {
  await simulateLatency(300);
  const store = loadStore();
  const period = findPeriod(store, periodId);
  if (period.status !== 'CLOSED') throw new HrError('EXPORT_NOT_READY', 'Chỉ kỳ đã chốt mới xuất được bảng tổng hợp.');

  const header = 'Ma NV,Ho ten,Phong ban,Ngay cong,Phut lam viec,Phut di tre,Phut ve som';
  const rows = period.summaries.map((s) =>
    [s.employeeCode, s.employeeName, s.department, s.workingDays, s.workingMinutes, s.lateMinutes, s.earlyMinutes].join(','),
  );
  const csv = [header, ...rows].join('\n');

  period.exportedAt = nowDisplay();
  appendAudit(period, `Xuất bảng tổng hợp CSV cho ${period.label} (phiên bản kỳ v${period.version}).`);
  const updated = persist(store).find((p) => p.id === periodId)!;
  return { period: clone(updated), csv };
}

/* ------------------------------------------------------------------ */
/* ShiftTemplate config — SRS §6, FR-HRCFG                              */
/* ------------------------------------------------------------------ */

function loadShifts(): ShiftTemplate[] {
  try {
    const raw = localStorage.getItem(SHIFT_KEY);
    if (raw) return JSON.parse(raw) as ShiftTemplate[];
  } catch {
    /* ignore */
  }
  return MOCK_SHIFT_TEMPLATES.map((s) => clone(s));
}

function persistShifts(shifts: ShiftTemplate[]): ShiftTemplate[] {
  try {
    localStorage.setItem(SHIFT_KEY, JSON.stringify(shifts));
  } catch {
    /* ignore */
  }
  return shifts.map((s) => clone(s));
}

/** "08:00" → minutes since midnight; NaN when malformed. */
const toMinutes = (hhmm: string): number => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return NaN;
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
};

export interface NewShiftInput {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  gracePeriodMinutes: number;
}

/**
 * SRS §6.2: a shift must start and end within the same day — overnight shifts
 * are out of scope — and the break cannot exceed the scheduled span.
 */
function validateShift(input: NewShiftInput, shifts: ShiftTemplate[], editingId?: string): string {
  const start = toMinutes(input.startTime);
  const end = toMinutes(input.endTime);
  if (!input.name.trim()) return 'Tên ca là bắt buộc.';
  if (!input.code.trim()) return 'Mã ca là bắt buộc.';
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Giờ phải theo định dạng HH:MM (00:00–23:59).';
  if (end <= start) return 'Ca phải bắt đầu và kết thúc trong cùng ngày — không hỗ trợ ca qua đêm.';
  if (input.breakMinutes < 0 || input.gracePeriodMinutes < 0) return 'Nghỉ giữa ca và thời gian cho phép vào muộn không được âm.';
  if (input.breakMinutes >= end - start) return 'Nghỉ giữa ca phải ngắn hơn tổng thời lượng ca.';
  const code = input.code.trim().toUpperCase();
  if (shifts.some((s) => s.code === code && s.id !== editingId)) return `Mã ca "${code}" đã tồn tại trong Organization.`;
  return '';
}

/** GET /api/hr/shifts — tenant-scoped (organizationId comes from the session). */
export async function fetchShifts(): Promise<ShiftTemplate[]> {
  await simulateLatency(200);
  return clone(loadShifts().filter((s) => s.organizationId === TENANT_ORG_ID));
}

/**
 * POST /api/hr/shifts — HR creates a ShiftTemplate for the tenant. The new
 * template is what later WorkSchedule rows snapshot from (§6.3).
 */
export async function createShift(input: NewShiftInput): Promise<ShiftTemplate[]> {
  await simulateLatency(250);
  const shifts = loadShifts();
  const message = validateShift(input, shifts);
  if (message) throw new HrError('SHIFT_INVALID', message);
  const created: ShiftTemplate = {
    id: `shift-${Date.now()}`,
    organizationId: TENANT_ORG_ID,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    startTime: input.startTime,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes,
    gracePeriodMinutes: input.gracePeriodMinutes,
    active: true,
    createdAt: nowDisplay(),
  };
  shifts.push(created);
  persistShifts(shifts);
  return clone(shifts.filter((s) => s.organizationId === TENANT_ORG_ID));
}

/**
 * PATCH /api/hr/shifts/:id — edit hours, or deactivate. Referenced templates
 * are never hard-deleted: past WorkSchedule rows keep their own snapshot.
 */
export async function updateShift(id: string, patch: Partial<NewShiftInput> & { active?: boolean }): Promise<ShiftTemplate[]> {
  await simulateLatency(250);
  const shifts = loadShifts();
  const shift = shifts.find((s) => s.id === id);
  if (!shift) throw new HrError('SHIFT_NOT_FOUND', 'Không tìm thấy ca làm việc.');
  const merged = { ...shift, ...patch, code: patch.code ?? shift.code, name: patch.name ?? shift.name };
  const message = validateShift(merged, shifts, id);
  if (message) throw new HrError('SHIFT_INVALID', message);
  Object.assign(shift, merged);
  persistShifts(shifts);
  return clone(shifts.filter((s) => s.organizationId === TENANT_ORG_ID));
}

/** Reset the store to seed data (dev/testing convenience). */
export function resetHrStore(): AccountingPeriod[] {
  return persist(MOCK_PERIODS.map((p) => clone(p)));
}

/** Reset ShiftTemplate store to seed data. */
export function resetShifts(): ShiftTemplate[] {
  return persistShifts(MOCK_SHIFT_TEMPLATES.map((s) => clone(s)));
}

/** Seed rows for the close-time snapshot (production: per-employee query). */
function buildSnapshotSummaries() {
  return MOCK_HR_ORG.departments.slice(0, 3).flatMap((dept, d) =>
    Array.from({ length: 4 }).map((_, i) => ({
      employeeCode: `EMP-${d}${i}`,
      employeeName: `Nhân viên ${dept.replace('Phòng ', '')} ${i + 1}`,
      department: dept,
      workingDays: 22 + ((d + i) % 5),
      workingMinutes: 11200 + (d + i) * 180,
      lateMinutes: (i * 15) % 60,
      earlyMinutes: (d * 10) % 45,
    })),
  );
}
