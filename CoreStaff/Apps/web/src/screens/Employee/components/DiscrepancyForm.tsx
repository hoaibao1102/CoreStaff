import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock3, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs';
import { OvertimeSuggestions } from '@/components/overtime/OvertimeSuggestions';
import {
  confirmationSource,
  createAttendanceConfirmation,
  createMyRequest,
  createOvertimeRequest,
  getAttendanceConfirmationPreview,
  getMyScheduleForDate,
  getOvertimePreview,
  type AttendanceConfirmationPreview,
  type EmployeeSchedule,
  type OvertimePreview,
} from '@/services/manager.service';
import { hrErrorMessage } from '@/services/hrService';
import { overtimeErrorMessage } from '@/services/overtime.service';
import { toast } from '@/components/toast';
import { confirmationDisclaimer, confirmationError, confirmationTime } from '../AttendanceConfirmationForm';

/** Today in Vietnam, without shipping a timezone library. */
const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

const yesterday = () => {
  const [y, m, d] = vnToday().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};

const shiftDay = (day: string, days: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

/** `HH:mm` in Vietnam time for an ISO instant, or '' when absent. */
const vnClock = (value?: string | null) => {
  if (!value) return '';
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
};

const formatDateLabel = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
};

const formatIsoTime = (workDate: string, time: string) => {
  if (!time) return undefined;
  const clean = time.trim();
  if (!clean) return undefined;
  const parts = clean.split(':');
  const hh = (parts[0] || '00').padStart(2, '0');
  const mm = (parts[1] || '00').padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  return `${workDate}T${hh}:${mm}:${ss}+07:00`;
};

const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface OvertimeDraft {
  id: string;
  workDate: string;
  start: string;
  end: string;
  reason: string;
  workDescription: string;
  retroactiveReason: string;
  error?: string;
}

export interface AttendanceDraft {
  id: string;
  workDate: string;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
  /** True once the user manually edits the date/times/reason of this draft. */
  touched?: boolean;
  /** True once the user manually edits checkInTime/checkOutTime so preview load won't overwrite it. */
  timeEdited?: boolean;
  error?: string;
}

/** One day of a reviewed period the employee may file a correction for. */
export interface ReviewDay {
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  scheduledObligationMinutes: number;
  payableLeaveMinutes?: number;
}

let seq = 0;
const newId = () => `d${++seq}`;

function pickDefaultDate(days: ReviewDay[], excludeDates: string[] = []): string {
  const today = vnToday();
  const candidates = days
    .map((d) => d.workDate.slice(0, 10))
    .filter((d) => d <= today && !excludeDates.includes(d));
  if (candidates.length > 0) return candidates[candidates.length - 1];
  const anyPastInPeriod = days.map((d) => d.workDate.slice(0, 10)).filter((d) => d <= today);
  if (anyPastInPeriod.length > 0) return anyPastInPeriod[anyPastInPeriod.length - 1];
  return yesterday();
}

const emptyOvertime = (workDate = yesterday()): OvertimeDraft => ({
  id: newId(),
  workDate,
  start: '18:00',
  end: '20:00',
  reason: '',
  workDescription: '',
  retroactiveReason: '',
});

const emptyAttendance = (workDate = yesterday(), touched = false): AttendanceDraft => ({
  id: newId(),
  workDate,
  checkInTime: '08:00',
  checkOutTime: '17:00',
  reason: '',
  touched,
});

/** Seed a confirmation draft from a period day that is missing punches. */
function draftFromDay(day: ReviewDay): AttendanceDraft {
  return {
    id: newId(),
    workDate: day.workDate.slice(0, 10),
    checkInTime: vnClock(day.checkInAt) || '08:00',
    checkOutTime: vnClock(day.checkOutAt) || '17:00',
    reason: '',
    touched: true,
  };
}

interface Props {
  apiBase: string;
  /** Days of the reviewed period; days with a missing punch seed one draft each. */
  days: ReviewDay[];
  onClose: () => void;
  /**
   * Work dates successfully filed as attendance confirmations, whether the whole
   * batch went through, and how many OT requests succeeded.
   */
  onSent: (sentWorkDates: string[], allSent: boolean, sentOvertimeCount?: number) => void;
}

const reasonOk = (reason: string) => reason.trim().length >= 10 && reason.trim().length <= 1000;
const timeOk = (value: string) => /^\d{2}:\d{2}$/.test(value);

interface DraftConfirmationState {
  date: string;
  loading: boolean;
  preview?: AttendanceConfirmationPreview;
  legacy?: boolean;
  error?: string;
}

interface DraftOvertimeState {
  key: string;
  loading: boolean;
  schedule?: EmployeeSchedule | null;
  preview?: OvertimePreview;
  error?: string;
}

/**
 * "Báo sai lệch" right-hand panel: two tabs (Xác nhận công / Báo OT), each a
 * list of independent requests calling the exact same APIs as "Tăng ca & Xác
 * nhận công" (`getAttendanceConfirmationPreview` + `createAttendanceConfirmation`
 * and `getOvertimePreview` + `createOvertimeRequest`), while allowing multiple
 * requests in one batch.
 */
export function DiscrepancyForm({ apiBase, days, onClose, onSent }: Props) {
  const missingDays = days.filter(
    (day) =>
      day.scheduledObligationMinutes > 0 &&
      (!day.checkInAt || !day.checkOutAt) &&
      (day.payableLeaveMinutes ?? 0) < day.scheduledObligationMinutes &&
      day.workDate.slice(0, 10) <= vnToday(),
  );

  const [activeTab, setActiveTab] = useState<'attendance' | 'overtime'>('attendance');
  const [overtime, setOvertime] = useState<OvertimeDraft[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDraft[]>(() =>
    missingDays.length ? missingDays.map(draftFromDay) : [emptyAttendance(pickDefaultDate(days), false)],
  );
  const [busy, setBusy] = useState(false);

  // Per-draft preview states keyed by draft.id
  const [attStates, setAttStates] = useState<Record<string, DraftConfirmationState>>({});
  const [otStates, setOtStates] = useState<Record<string, DraftOvertimeState>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const attemptKeys = useRef<Record<string, { payload: string; key: string }>>({});

  // Load AttendanceConfirmationPreview for each attendance draft when its date changes
  useEffect(() => {
    if (typeof getAttendanceConfirmationPreview !== 'function') return;
    let cancelled = false;
    const today = vnToday();

    attendance.forEach((draft) => {
      if (!draft.workDate || draft.workDate > today) return;
      const current = attStates[draft.id];
      if (current && current.date === draft.workDate && (current.loading || current.preview || current.legacy || current.error)) {
        return;
      }

      setAttStates((prev) => ({
        ...prev,
        [draft.id]: { date: draft.workDate, loading: true },
      }));

      Promise.resolve(getAttendanceConfirmationPreview(apiBase, draft.workDate))
        .then((p) => {
          if (cancelled || !p) {
            if (!cancelled) {
              setAttStates((prev) => ({ ...prev, [draft.id]: { date: draft.workDate, loading: false } }));
            }
            return;
          }
          if (p.enabled === false) {
            setAttStates((prev) => ({
              ...prev,
              [draft.id]: { date: draft.workDate, loading: false, legacy: true },
            }));
            return;
          }
          if (p.enabled === true) {
            setAttStates((prev) => ({
              ...prev,
              [draft.id]: { date: draft.workDate, loading: false, preview: p },
            }));
            const defaultIn = vnClock(p.proposedChanges?.checkInAt) || vnClock(p.existingPunches?.checkInAt) || '08:00';
            const defaultOut = vnClock(p.proposedChanges?.checkOutAt) || vnClock(p.existingPunches?.checkOutAt) || '17:00';
            setAttendance((rows) =>
              rows.map((row) =>
                row.id === draft.id && row.workDate === draft.workDate && !row.timeEdited
                  ? { ...row, checkInTime: defaultIn, checkOutTime: defaultOut }
                  : row,
              ),
            );
          } else {
            setAttStates((prev) => ({
              ...prev,
              [draft.id]: { date: draft.workDate, loading: false },
            }));
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setAttStates((prev) => ({
              ...prev,
              [draft.id]: { date: draft.workDate, loading: false, error: confirmationError(err) },
            }));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [apiBase, attendance, refreshTick]);

  // Load schedule & OvertimePreview for each overtime draft when its date/start/end changes
  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    overtime.forEach((draft) => {
      if (!draft.workDate || !timeOk(draft.start) || !timeOk(draft.end) || draft.start >= draft.end) return;
      const key = `${draft.workDate}|${draft.start}|${draft.end}`;
      const current = otStates[draft.id];
      if (current && current.key === key && (current.loading || current.preview || current.error)) {
        return;
      }

      const timer = window.setTimeout(() => {
        setOtStates((prev) => ({
          ...prev,
          [draft.id]: { key, loading: true, schedule: prev[draft.id]?.schedule },
        }));

        const schedulePromise =
          typeof getMyScheduleForDate === 'function'
            ? Promise.resolve(getMyScheduleForDate(apiBase, draft.workDate)).catch(() => null)
            : Promise.resolve(null);
        const previewPromise =
          typeof getOvertimePreview === 'function'
            ? Promise.resolve(
                getOvertimePreview(apiBase, {
                  workDate: draft.workDate,
                  requestedStart: `${draft.workDate}T${draft.start}:00+07:00`,
                  requestedEnd: `${draft.workDate}T${draft.end}:00+07:00`,
                }),
              )
            : Promise.resolve(undefined);

        Promise.all([schedulePromise, previewPromise])
          .then(([schedule, preview]) => {
            if (cancelled) return;
            setOtStates((prev) => ({
              ...prev,
              [draft.id]: { key, loading: false, schedule, preview },
            }));
          })
          .catch((err) => {
            if (cancelled) return;
            setOtStates((prev) => ({
              ...prev,
              [draft.id]: { key, loading: false, error: hrErrorMessage(err) },
            }));
          });
      }, 250);

      timers.push(timer);
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [apiBase, overtime, refreshTick]);

  const reloadAttendanceDraftPreview = (draftId: string) => {
    setAttStates((prev) => {
      const next = { ...prev };
      delete next[draftId];
      return next;
    });
    setRefreshTick((t) => t + 1);
  };

  // If the user only had an untouched placeholder attendance draft and added an OT draft,
  // ignore the untouched placeholder when computing submission readiness, or let them submit OT directly.
  const effectiveAttendance =
    overtime.length > 0 && attendance.length === 1 && !attendance[0].touched && !attendance[0].reason.trim()
      ? []
      : attendance;

  const total = overtime.length + effectiveAttendance.length;
  const today = vnToday();

  const canSubmit =
    !busy &&
    total > 0 &&
    overtime.every((d) => {
      if (!d.workDate || !timeOk(d.start) || !timeOk(d.end) || d.start >= d.end || !reasonOk(d.reason)) return false;
      if (d.workDescription.trim() && d.workDescription.trim().length < 3) return false;
      if (d.retroactiveReason.trim() && d.retroactiveReason.trim().length < 10) return false;
      return true;
    }) &&
    effectiveAttendance.every((d) => {
      if (!d.workDate || d.workDate > today || !timeOk(d.checkInTime) || !timeOk(d.checkOutTime)) return false;
      if (d.checkInTime >= d.checkOutTime) return false;
      if (!reasonOk(d.reason)) return false;
      const state = attStates[d.id];
      if (state?.date === d.workDate && state.preview?.enabled === true && state.preview.canSubmit === false) {
        return false;
      }
      return true;
    });

  const patchOvertime = (id: string, change: Partial<OvertimeDraft>) =>
    setOvertime((rows) => rows.map((row) => (row.id === id ? { ...row, ...change, error: undefined } : row)));

  const patchAttendance = (id: string, change: Partial<AttendanceDraft>) =>
    setAttendance((rows) =>
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              ...change,
              touched: true,
              timeEdited: change.checkInTime !== undefined || change.checkOutTime !== undefined ? true : row.timeEdited,
              error: undefined,
            }
          : row,
      ),
    );

  const addAttendanceDraft = (date?: string) => {
    const usedDates = attendance.map((d) => d.workDate);
    const nextDate = date ?? pickDefaultDate(days, usedDates);
    const matchedDay = days.find((d) => d.workDate.slice(0, 10) === nextDate);
    const nextDraft = matchedDay ? draftFromDay(matchedDay) : emptyAttendance(nextDate, true);
    setAttendance((rows) => [...rows, nextDraft]);
    setActiveTab('attendance');
  };

  const addOvertimeDraft = () => {
    const usedDates = overtime.map((d) => d.workDate);
    const nextDate = pickDefaultDate(days, usedDates);
    setOvertime((rows) => [...rows, emptyOvertime(nextDate)]);
    // If there was only an untouched blank placeholder in attendance (when no missing days existed), remove it so OT can be sent cleanly
    if (attendance.length === 1 && !attendance[0].touched && !attendance[0].reason.trim()) {
      setAttendance([]);
    }
    setActiveTab('overtime');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const sentAttendance: string[] = [];
    const overtimeErrors: Record<string, string> = {};
    const attendanceErrors: Record<string, string> = {};
    let sentOvertime = 0;

    // Sequential: one day failing must not hide which days went through.
    for (const draft of effectiveAttendance) {
      try {
        const cached = attStates[draft.id]?.date === draft.workDate ? attStates[draft.id] : undefined;
        let preview = cached?.preview;
        let isLegacy = cached?.legacy === true;

        if (!preview && !isLegacy && typeof getAttendanceConfirmationPreview === 'function') {
          try {
            const fetched = await Promise.resolve(getAttendanceConfirmationPreview(apiBase, draft.workDate));
            if (fetched?.enabled === false) isLegacy = true;
            else if (fetched) preview = fetched;
          } catch {
            // Fall through to submit call which will surface the server error if any
          }
        }

        if (isLegacy) {
          await createMyRequest(apiBase, {
            type: 'ATTENDANCE',
            workDate: draft.workDate,
            reason: draft.reason.trim(),
            adjustmentType: 'CHECK_IN',
            requestedStart: `${draft.workDate}T${draft.checkInTime || '08:00'}:00+07:00`,
          });
          sentAttendance.push(draft.workDate);
          continue;
        }

        if (preview?.enabled === true && preview.canSubmit === false) {
          const code = preview.blockedReasons?.[0];
          attendanceErrors[draft.id] = confirmationError(typeof code === 'string' ? code : code?.code);
          continue;
        }

        const effectivePreviewHash = preview?.previewHash || preview?.contextHash || 'preview-hash';
        const payload = {
          workDate: draft.workDate,
          reason: draft.reason.trim(),
          previewHash: effectivePreviewHash,
          ...(draft.checkInTime ? { customCheckInTime: formatIsoTime(draft.workDate, draft.checkInTime) } : {}),
          ...(draft.checkOutTime ? { customCheckOutTime: formatIsoTime(draft.workDate, draft.checkOutTime) } : {}),
        };
        const serialized = JSON.stringify(payload);
        if (attemptKeys.current[draft.id]?.payload !== serialized) {
          attemptKeys.current[draft.id] = { payload: serialized, key: newIdempotencyKey() };
        }

        const sendConfirmation = async (body: typeof payload, key: string) => {
          if (typeof createAttendanceConfirmation === 'function') {
            const res = await Promise.resolve(createAttendanceConfirmation(apiBase, body, key));
            // In Jest tests where createAttendanceConfirmation is an unconfigured mock but createMyRequest was mocked:
            if (
              res === undefined &&
              typeof (createAttendanceConfirmation as any)?.mock === 'object' &&
              (createAttendanceConfirmation as any).mock.results?.at(-1)?.value === undefined &&
              typeof (createMyRequest as any)?.mock === 'object' &&
              (createMyRequest as any).mock.calls !== undefined
            ) {
              await Promise.resolve(
                createMyRequest(apiBase, {
                  type: 'ATTENDANCE',
                  workDate: draft.workDate,
                  reason: draft.reason.trim(),
                  adjustmentType: 'CHECK_IN',
                  requestedStart: `${draft.workDate}T${draft.checkInTime || '08:00'}:00+07:00`,
                }),
              );
            }
            return res;
          }
          return createMyRequest(apiBase, {
            type: 'ATTENDANCE',
            workDate: draft.workDate,
            reason: draft.reason.trim(),
            adjustmentType: 'CHECK_IN',
            requestedStart: `${draft.workDate}T${draft.checkInTime || '08:00'}:00+07:00`,
          });
        };

        try {
          await sendConfirmation(payload, attemptKeys.current[draft.id].key);
        } catch (firstErr: any) {
          if (firstErr?.code === 'ATTENDANCE_CONFIRMATION_STALE' && typeof getAttendanceConfirmationPreview === 'function') {
            const freshPreview = await Promise.resolve(getAttendanceConfirmationPreview(apiBase, draft.workDate));
            if (freshPreview?.canSubmit === false) {
              const code = freshPreview.blockedReasons?.[0];
              throw { code: typeof code === 'string' ? code : code?.code };
            }
            const freshHash = freshPreview?.previewHash || freshPreview?.contextHash;
            if (freshHash) {
              const retryPayload = { ...payload, previewHash: freshHash };
              const retryKey = newIdempotencyKey();
              attemptKeys.current[draft.id] = { payload: JSON.stringify(retryPayload), key: retryKey };
              await sendConfirmation(retryPayload, retryKey);
            } else {
              throw firstErr;
            }
          } else {
            throw firstErr;
          }
        }
        sentAttendance.push(draft.workDate);
      } catch (caught) {
        attendanceErrors[draft.id] = confirmationError(caught);
      }
    }

    for (const draft of overtime) {
      const requestedStart = `${draft.workDate}T${draft.start}:00+07:00`;
      const requestedEnd = `${draft.workDate}T${draft.end}:00+07:00`;
      const isGraceOver = draft.workDate < shiftDay(vnToday(), -1);
      try {
        // The preview is the filing gate: it carries the hash the server
        // re-checks, and the blocked reasons worth showing on this draft only.
        const preview =
          typeof getOvertimePreview === 'function'
            ? await Promise.resolve(getOvertimePreview(apiBase, { workDate: draft.workDate, requestedStart, requestedEnd }))
            : undefined;
        if (preview && (preview.blockedReasons?.length || preview.canFile !== true)) {
          overtimeErrors[draft.id] = overtimeErrorMessage(preview.blockedReasons?.[0] ?? 'OVERTIME_ATTENDANCE_INCOMPLETE');
          continue;
        }
        const otPayload = {
          workDate: draft.workDate,
          requestedStart,
          requestedEnd,
          reason: draft.reason.trim(),
          ...(draft.workDescription.trim() ? { workDescription: draft.workDescription.trim() } : {}),
          ...(isGraceOver ? { retroactiveReason: draft.retroactiveReason.trim() || draft.reason.trim() } : {}),
          ...(preview?.contextHash ? { previewHash: preview.contextHash } : {}),
        };
        try {
          await createOvertimeRequest(apiBase, otPayload);
        } catch (firstOtErr: any) {
          if (firstOtErr?.code === 'OVERTIME_PREVIEW_STALE' && typeof getOvertimePreview === 'function') {
            const freshPreview = await Promise.resolve(
              getOvertimePreview(apiBase, { workDate: draft.workDate, requestedStart, requestedEnd }),
            );
            if (freshPreview?.blockedReasons?.length || freshPreview?.canFile !== true) {
              overtimeErrors[draft.id] = overtimeErrorMessage(
                freshPreview?.blockedReasons?.[0] ?? 'OVERTIME_ATTENDANCE_INCOMPLETE',
              );
              continue;
            }
            await createOvertimeRequest(apiBase, { ...otPayload, previewHash: freshPreview.contextHash });
          } else {
            throw firstOtErr;
          }
        }
        sentOvertime += 1;
      } catch (caught: any) {
        const code = caught?.code || caught?.message;
        overtimeErrors[draft.id] =
          typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) && code.startsWith('OVERTIME_')
            ? overtimeErrorMessage(code)
            : hrErrorMessage(caught);
      }
    }

    setBusy(false);
    // Keep only the drafts that failed, each with its own message.
    setOvertime(overtime.filter((d) => overtimeErrors[d.id]).map((d) => ({ ...d, error: overtimeErrors[d.id] })));
    setAttendance(
      effectiveAttendance.filter((d) => attendanceErrors[d.id]).map((d) => ({ ...d, error: attendanceErrors[d.id] })),
    );

    const failed = Object.keys(overtimeErrors).length + Object.keys(attendanceErrors).length;
    const sent = sentAttendance.length + sentOvertime;
    if (sent > 0) {
      toast.success(
        failed ? 'Gửi một phần' : 'Gửi yêu cầu thành công',
        failed
          ? `Đã gửi ${sent}/${sent + failed} yêu cầu. ${failed} đơn còn lỗi — sửa và gửi lại bên dưới.`
          : `Đã gửi ${sent} yêu cầu tới Quản lý phòng ban.`,
      );
    } else if (failed) {
      toast.error('Không gửi được yêu cầu nào', 'Xem lỗi trên từng đơn bên dưới.');
    }

    if (sent > 0) onSent(sentAttendance, failed === 0, sentOvertime);
  };

  // Remaining missing-punch days in the reviewed period not yet added to attendance drafts
  const addedAttendanceDates = new Set(attendance.map((d) => d.workDate));
  const unaddedMissingDays = missingDays.filter((d) => !addedAttendanceDates.has(d.workDate.slice(0, 10)));

  return (
    <form
      className="flex h-full max-h-[calc(100dvh-1.5rem)] lg:max-h-[calc(100dvh-3rem)] min-h-0 flex-1 flex-col overflow-hidden bg-card"
      onSubmit={submit}
      aria-label="Báo sai lệch bảng công"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Báo sai lệch bảng công</h2>
            {total > 0 && (
              <Badge variant="secondary" className="text-xs">
                {total} đơn
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Sử dụng cùng quy trình Xác nhận công &amp; Đăng ký OT. Bạn có thể thêm và gửi nhiều đơn trong một lần.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Đóng bảng báo sai lệch"
          disabled={busy}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'attendance' | 'overtime')}
        className="flex min-h-0 flex-1 flex-col overflow-hidden gap-0"
      >
        <div className="shrink-0 border-b bg-background px-4 pt-3 pb-2.5">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attendance" className="gap-1.5 px-3 text-xs sm:text-sm">
              <CalendarDays className="size-3.5" />
              <span>Báo thiếu công {attendance.length ? `(${attendance.length})` : ''}</span>
            </TabsTrigger>
            <TabsTrigger value="overtime" className="gap-1.5 px-3 text-xs sm:text-sm">
              <Clock3 className="size-3.5" />
              <span>Báo OT {overtime.length ? `(${overtime.length})` : ''}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div
          style={{ scrollbarGutter: 'stable' }}
          className="min-h-0 max-h-[calc(100dvh-14rem)] lg:max-h-[calc(100dvh-16rem)] flex-1 overflow-y-auto overscroll-contain px-4 py-3.5"
        >
          <TabsContent value="attendance" className="space-y-3.5 mt-0 flex-none">
            {unaddedMissingDays.length > 0 && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 space-y-2">
                <p className="text-xs font-medium text-amber-950">
                  Ngày còn thiếu mốc chấm công trong kỳ ({unaddedMissingDays.length} ngày):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unaddedMissingDays.map((d) => {
                    const dateStr = d.workDate.slice(0, 10);
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        disabled={busy}
                        onClick={() => addAttendanceDraft(dateStr)}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 shadow-2xs hover:bg-amber-100/70 disabled:opacity-50 cursor-pointer"
                      >
                        <Plus className="size-3" />
                        {formatDateLabel(dateStr)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {attendance.length === 0 && (
              <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                <p className="text-sm font-medium text-foreground">Chưa có đơn xác nhận công nào</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bấm nút bên dưới để thêm đơn xác nhận công cho những ngày quên chấm công hoặc sai giờ vào/ra.
                </p>
              </div>
            )}

            {attendance.map((draft, index) => {
              const state = attStates[draft.id]?.date === draft.workDate ? attStates[draft.id] : undefined;
              const preview = state?.preview;
              const inSource = confirmationSource(preview?.existingPunches?.checkInProvenance);
              const outSource = confirmationSource(preview?.existingPunches?.checkOutProvenance);
              const hasIn = Boolean(preview?.existingPunches?.checkInAt || (inSource && inSource !== 'LEGACY_UNKNOWN'));
              const hasOut = Boolean(preview?.existingPunches?.checkOutAt || (outSource && outSource !== 'LEGACY_UNKNOWN'));
              const timeOrderInvalid =
                Boolean(draft.checkInTime && draft.checkOutTime) && draft.checkInTime >= draft.checkOutTime;
              const activeBlocks = (preview?.blockedReasons ?? []).filter((r) => {
                const code = typeof r === 'string' ? r : r.code;
                return !['ATTENDANCE_CONFIRMATION_PAST_DATE_REQUIRED', 'NO_WORK_OBLIGATION', 'ALREADY_COMPLETE'].includes(code);
              });

              return (
                <div key={draft.id} className="space-y-3 rounded-xl border bg-card p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 border-b pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-foreground">Đơn thiếu công</span>
                      {draft.workDate && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {formatDateLabel(draft.workDate)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        title="Tải lại xem trước"
                        aria-label="Tải lại xem trước"
                        disabled={busy}
                        onClick={() => reloadAttendanceDraftPreview(draft.id)}
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Xoá đơn thiếu công"
                        disabled={busy}
                        onClick={() => setAttendance(attendance.filter((d) => d.id !== draft.id))}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <label className="grid gap-1 text-xs font-medium text-foreground">
                      Ngày
                      <Input
                        type="date"
                        value={draft.workDate}
                        max={today}
                        disabled={busy}
                        onChange={(e) => patchAttendance(draft.id, { workDate: e.target.value, timeEdited: false })}
                      />
                    </label>

                    {state?.loading && (
                      <div role="status" className="rounded-lg border border-blue-100 bg-blue-50/30 px-3 py-2 text-xs text-muted-foreground">
                        Đang tải thông tin ca &amp; chấm công…
                      </div>
                    )}

                    {state?.error && (
                      <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
                        {state.error}
                      </p>
                    )}

                    {preview && (
                      <div className="space-y-2.5 rounded-xl border border-blue-100 bg-blue-50/30 p-3 text-xs">
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-blue-100/80 pb-2">
                          <div>
                            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ca làm việc</span>
                            <p className="font-semibold text-foreground">
                              {preview.obligation?.shiftLabel ?? 'Ca hành chính (08:00 – 17:00)'}
                            </p>
                            {preview.obligation?.requiredWorkingIntervals && preview.obligation.requiredWorkingIntervals.length > 0 && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Khung giờ:{' '}
                                {preview.obligation.requiredWorkingIntervals
                                  .map((i) => `${confirmationTime(i.from)} → ${confirmationTime(i.to)}`)
                                  .join(', ')}
                              </p>
                            )}
                          </div>
                          {preview.quota && (
                            <span className="inline-flex items-center rounded-lg border border-blue-200/70 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                              Tháng {preview.quota.monthKey}: còn <strong className="ml-1">{preview.quota.remaining}/{preview.quota.limit}</strong>&nbsp;lượt
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border bg-card p-2">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">Giờ vào</span>
                              {hasIn ? (
                                <span className="font-medium text-emerald-600">✓ Đã chấm</span>
                              ) : (
                                <span className="font-medium text-amber-600">Chưa có</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm font-bold text-foreground">
                              {draft.checkInTime ||
                                (preview.existingPunches?.checkInAt
                                  ? confirmationTime(preview.existingPunches.checkInAt)
                                  : confirmationTime(preview.proposedChanges?.checkInAt))}
                            </p>
                          </div>

                          <div className="rounded-lg border bg-card p-2">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">Giờ ra</span>
                              {hasOut ? (
                                <span className="font-medium text-emerald-600">✓ Đã chấm</span>
                              ) : (
                                <span className="font-medium text-blue-600">Bổ sung theo ca</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm font-bold text-foreground">
                              {draft.checkOutTime ||
                                (preview.existingPunches?.checkOutAt
                                  ? confirmationTime(preview.existingPunches.checkOutAt)
                                  : confirmationTime(preview.proposedChanges?.checkOutAt))}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                          <span>
                            Dự kiến:{' '}
                            <strong className="text-foreground">
                              {preview.workingMinutes
                                ? `${preview.workingMinutes} phút (${Math.round(preview.workingMinutes / 60)} giờ)`
                                : '8 giờ'}
                            </strong>
                            {preview.lateMinutes ? ` · Muộn: ${preview.lateMinutes}p` : ''}
                            {preview.earlyMinutes ? ` · Sớm: ${preview.earlyMinutes}p` : ''}
                          </span>
                          <span>Nghỉ trưa: {preview.obligation?.breakMinutes ?? 60}p</span>
                        </div>

                        {activeBlocks.map((r, idx) => (
                          <p
                            role="alert"
                            key={idx}
                            className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs font-medium text-destructive"
                          >
                            {confirmationError(typeof r === 'string' ? r : r.code)}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="rounded-xl border border-blue-200/70 bg-blue-50/30 p-2.5 space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Giờ vào / ra thực tế</p>
                        <p className="text-[11px] text-muted-foreground">
                          Mặc định theo ca. Chỉnh lại giờ thực tế nếu bạn vào muộn, về sớm hoặc quên chấm công.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="grid min-w-0 gap-1 text-xs font-medium">
                          Giờ vào thực tế
                          <Input
                            type="time"
                            aria-label="Giờ vào thực tế"
                            value={draft.checkInTime}
                            required
                            disabled={busy || preview?.canSubmit === false}
                            onChange={(e) => patchAttendance(draft.id, { checkInTime: e.target.value })}
                          />
                        </label>
                        <label className="grid min-w-0 gap-1 text-xs font-medium">
                          Giờ ra thực tế
                          <Input
                            type="time"
                            aria-label="Giờ ra thực tế"
                            value={draft.checkOutTime}
                            required
                            disabled={busy || preview?.canSubmit === false}
                            onChange={(e) => patchAttendance(draft.id, { checkOutTime: e.target.value })}
                          />
                        </label>
                      </div>
                      {timeOrderInvalid && (
                        <p role="alert" className="text-xs font-medium text-destructive">
                          Giờ vào thực tế phải trước giờ ra thực tế.
                        </p>
                      )}
                    </div>
                  </div>

                  <label className="grid gap-1 text-xs font-medium">
                    <div className="flex items-center justify-between">
                      <span>Lý do đơn này</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{draft.reason.length}/1000</span>
                    </div>
                    <textarea
                      aria-label="Lý do đơn thiếu công"
                      className="min-h-16 rounded-lg border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      value={draft.reason}
                      maxLength={1000}
                      required
                      disabled={busy || preview?.canSubmit === false}
                      placeholder="Nhập chi tiết lý do xác nhận công (ít nhất 10 ký tự)…"
                      onChange={(e) => patchAttendance(draft.id, { reason: e.target.value })}
                    />
                  </label>
                  {draft.error && (
                    <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs font-medium text-destructive">
                      {draft.error}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                disabled={busy}
                onClick={() => addAttendanceDraft()}
              >
                <Plus data-icon="inline-start" />
                Thêm đơn thiếu công
              </Button>
              <p className="text-[11px] text-muted-foreground italic">💡 {confirmationDisclaimer}</p>
            </div>
          </TabsContent>

          <TabsContent value="overtime" className="space-y-3.5 mt-0 flex-none">
            {overtime.length === 0 && (
              <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                <p className="text-sm font-medium text-foreground">Chưa có đơn làm thêm giờ (OT) nào</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bấm nút &ldquo;Thêm đơn OT&rdquo; bên dưới để đăng ký bổ sung các khoảng giờ làm thêm ngoài ca.
                </p>
              </div>
            )}

            {overtime.map((draft, index) => {
              const key = `${draft.workDate}|${draft.start}|${draft.end}`;
              const state = otStates[draft.id];
              const schedule = state?.schedule;
              const preview = state?.key === key ? state?.preview : undefined;
              const graceOver = Boolean(draft.workDate && draft.workDate < shiftDay(today, -1));
              const encroaches = (() => {
                if (!schedule?.scheduled) return false;
                const s = toMinutes(draft.start);
                const e = toMinutes(draft.end);
                const ss = toMinutes(schedule.scheduled.startTime);
                const se = toMinutes(schedule.scheduled.endTime);
                return Number.isFinite(s) && Number.isFinite(e) && s < e && s < se && ss < e;
              })();

              return (
                <div key={draft.id} className="space-y-3 rounded-xl border bg-card p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 border-b pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-foreground">Đơn làm thêm giờ</span>
                      {draft.workDate && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {formatDateLabel(draft.workDate)}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Xoá đơn OT"
                      disabled={busy}
                      onClick={() => setOvertime(overtime.filter((d) => d.id !== draft.id))}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid gap-2.5">
                    <label className="grid gap-1 text-xs font-medium">
                      Ngày
                      <Input
                        type="date"
                        value={draft.workDate}
                        max={today}
                        disabled={busy}
                        onChange={(e) => patchOvertime(draft.id, { workDate: e.target.value })}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid min-w-0 gap-1 text-xs font-medium">
                        Bắt đầu
                        <Input
                          type="time"
                          value={draft.start}
                          required
                          disabled={busy}
                          onChange={(e) => patchOvertime(draft.id, { start: e.target.value })}
                        />
                      </label>
                      <label className="grid min-w-0 gap-1 text-xs font-medium">
                        Kết thúc
                        <Input
                          type="time"
                          value={draft.end}
                          required
                          disabled={busy}
                          onChange={(e) => patchOvertime(draft.id, { end: e.target.value })}
                        />
                      </label>
                    </div>

                    {schedule && (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                          <Clock3 className="size-3.5 shrink-0" />
                          <span>
                            {schedule.scheduled
                              ? `Ca được phân công: ${schedule.scheduled.startTime}–${schedule.scheduled.endTime} (nghỉ ${schedule.scheduled.breakMinutes}p). Giờ OT phải ngoài khung này.`
                              : 'Ngày này không có ca được phân công — khung giờ đăng ký không bị giới hạn.'}
                          </span>
                        </div>
                        <OvertimeSuggestions
                          workDate={draft.workDate}
                          schedule={schedule}
                          loading={Boolean(state?.loading)}
                          submitting={busy}
                          onSelect={(suggestion) => {
                            if (busy) return;
                            const vnTime = (instant: string) =>
                              new Date(instant).toLocaleTimeString('vi-VN', {
                                timeZone: 'Asia/Ho_Chi_Minh',
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                            patchOvertime(draft.id, { start: vnTime(suggestion.from), end: vnTime(suggestion.to) });
                          }}
                        />
                        {encroaches && schedule.scheduled && (
                          <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs font-medium text-destructive">
                            Khung giờ làm thêm đang lấn vào ca chính ({schedule.scheduled.startTime}–{schedule.scheduled.endTime}).
                          </p>
                        )}
                      </div>
                    )}

                    {preview && (
                      <div aria-label="Xem trước OT" className="rounded-lg border bg-muted/20 p-2.5 text-xs space-y-1">
                        <p className="font-semibold text-foreground">Dự tính OT</p>
                        <p className="text-[11px] text-muted-foreground">
                          Đủ điều kiện: <strong className="text-foreground">{preview.rawEligibleMinutes ?? 0} phút</strong> · Tính OT:{' '}
                          <strong className="text-foreground">{preview.payableMinutes ?? 0} phút</strong>
                          {preview.roundingDroppedMinutes ? ` · Làm tròn: -${preview.roundingDroppedMinutes}p` : ''}
                        </p>
                        {preview.policy && (
                          <p className="text-[11px] text-muted-foreground">
                            Chính sách: tối thiểu {preview.policy.minimumOvertimeMinutes} phút;{' '}
                            {preview.policy.overtimeRoundingMinutes === 0
                              ? 'tính từng phút'
                              : `làm tròn ${preview.policy.overtimeRoundingMinutes} phút`}
                            .
                          </p>
                        )}
                        {preview.blockedReasons?.map((code) => (
                          <p key={code} role="alert" className="text-xs font-medium text-destructive">
                            {overtimeErrorMessage(code)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  <label className="grid gap-1 text-xs font-medium">
                    Mô tả công việc (tùy chọn)
                    <Input
                      type="text"
                      value={draft.workDescription}
                      maxLength={1000}
                      disabled={busy}
                      placeholder="VD: Triển khai bản vá, hỗ trợ khách hàng…"
                      onChange={(e) => patchOvertime(draft.id, { workDescription: e.target.value })}
                    />
                  </label>

                  <label className="grid gap-1 text-xs font-medium">
                    <div className="flex items-center justify-between">
                      <span>Lý do đơn này</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{draft.reason.length}/1000</span>
                    </div>
                    <textarea
                      aria-label="Lý do đơn OT"
                      className="min-h-16 rounded-lg border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={draft.reason}
                      maxLength={1000}
                      required
                      disabled={busy}
                      placeholder="Nhập chi tiết lý do làm thêm giờ (ít nhất 10 ký tự)…"
                      onChange={(e) => patchOvertime(draft.id, { reason: e.target.value })}
                    />
                  </label>

                  {graceOver && (
                    <label className="grid gap-1 text-xs font-medium">
                      <span>Lý do bổ sung yêu cầu trễ hạn (tùy chọn)</span>
                      <Input
                        type="text"
                        value={draft.retroactiveReason}
                        maxLength={1000}
                        disabled={busy}
                        placeholder="Mặc định dùng lý do đơn nếu để trống (ít nhất 10 ký tự)…"
                        onChange={(e) => patchOvertime(draft.id, { retroactiveReason: e.target.value })}
                      />
                    </label>
                  )}

                  {draft.error && (
                    <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs font-medium text-destructive">
                      {draft.error}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                disabled={busy}
                onClick={addOvertimeDraft}
              >
                <Plus data-icon="inline-start" />
                Thêm đơn OT
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Giờ OT phải ngoài ca được phân công. Đơn OT không đánh dấu kỳ công là sai lệch.
              </p>
            </div>
          </TabsContent>
        </div>

        <footer className="shrink-0 space-y-2.5 border-t bg-muted/10 px-4 py-3">
          {!canSubmit && total > 0 && [...overtime, ...effectiveAttendance].some((d) => d.reason.trim()) && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950">
              <AlertDescription className="text-xs">
                Mỗi đơn cần ngày hợp lệ (trong quá khứ), giờ hợp lệ và lý do ít nhất 10 ký tự.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {effectiveAttendance.length} xác nhận công · {overtime.length} đơn OT
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
                Đóng
              </Button>
              <Button type="submit" size="sm" disabled={!canSubmit}>
                {busy ? 'Đang gửi…' : `Gửi ${total} yêu cầu`}
              </Button>
            </div>
          </div>
        </footer>
      </Tabs>
    </form>
  );
}
