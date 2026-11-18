import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs';
import { createMyRequest, createOvertimeRequest, getOvertimePreview } from '@/services/manager.service';
import { hrErrorMessage } from '@/services/hrService';
import { overtimeErrorMessage } from '@/services/overtime.service';
import { toast } from '@/components/toast';

/** Today in Vietnam, without shipping a timezone library. */
const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

const yesterday = () => {
  const [y, m, d] = vnToday().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};

export interface OvertimeDraft {
  id: string;
  workDate: string;
  start: string;
  end: string;
  reason: string;
  error?: string;
}

export interface AttendanceDraft {
  id: string;
  workDate: string;
  adjustmentType: 'CHECK_IN' | 'CHECK_OUT';
  time: string;
  reason: string;
  error?: string;
}

/** One day of a reviewed period the employee may file a correction for. */
interface ReviewDay {
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  scheduledObligationMinutes: number;
}

let seq = 0;
const newId = () => `d${++seq}`;

const emptyOvertime = (): OvertimeDraft => ({ id: newId(), workDate: yesterday(), start: '18:00', end: '20:00', reason: '' });

const emptyAttendance = (): AttendanceDraft => ({
  id: newId(), workDate: yesterday(), adjustmentType: 'CHECK_IN', time: '08:00', reason: '',
});

/** The correction the day most likely needs: the missing punch, at the shift clock. */
function draftFromDay(day: ReviewDay): AttendanceDraft {
  return {
    id: newId(),
    workDate: day.workDate.slice(0, 10),
    adjustmentType: day.checkInAt ? 'CHECK_OUT' : 'CHECK_IN',
    time: day.checkInAt ? '17:00' : '08:00',
    reason: '',
  };
}

interface Props {
  apiBase: string;
  /** Days of the reviewed period; days with a missing punch seed one draft each. */
  days: ReviewDay[];
  onClose: () => void;
  /**
   * Work dates successfully filed as corrections, and whether the whole batch
   * went through (the panel stays open on the drafts that still failed).
   */
  onSent: (sentWorkDates: string[], allSent: boolean) => void;
}

const reasonOk = (reason: string) => reason.trim().length >= 10;
const timeOk = (value: string) => /^\d{2}:\d{2}$/.test(value);

/**
 * "Báo sai lệch" right-hand panel: two tabs (OT / thiếu công), each a list of
 * independent requests with its own reason. One POST per draft; failures stay
 * on their draft so the rest of the batch is never hidden.
 */
export function DiscrepancyForm({ apiBase, days, onClose, onSent }: Props) {
  const [overtime, setOvertime] = useState<OvertimeDraft[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDraft[]>(() => {
    const missing = days.filter((day) => day.scheduledObligationMinutes > 0 && (!day.checkInAt || !day.checkOutAt));
    return missing.length ? missing.map(draftFromDay) : [emptyAttendance()];
  });
  const [busy, setBusy] = useState(false);

  const total = overtime.length + attendance.length;
  const canSubmit = !busy && total > 0
    && overtime.every((d) => d.workDate && timeOk(d.start) && timeOk(d.end) && d.start < d.end && reasonOk(d.reason))
    && attendance.every((d) => d.workDate && d.workDate < vnToday() && timeOk(d.time) && reasonOk(d.reason));

  const patchOvertime = (id: string, change: Partial<OvertimeDraft>) =>
    setOvertime(overtime.map((row) => (row.id === id ? { ...row, ...change } : row)));
  const patchAttendance = (id: string, change: Partial<AttendanceDraft>) =>
    setAttendance(attendance.map((row) => (row.id === id ? { ...row, ...change } : row)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const sentAttendance: string[] = [];
    const overtimeErrors: Record<string, string> = {};
    const attendanceErrors: Record<string, string> = {};
    let sentOvertime = 0;

    // Sequential: one day failing must not hide which days went through.
    for (const draft of attendance) {
      try {
        await createMyRequest(apiBase, {
          type: 'ATTENDANCE',
          workDate: draft.workDate,
          reason: draft.reason.trim(),
          adjustmentType: draft.adjustmentType,
          requestedStart: `${draft.workDate}T${draft.time}:00+07:00`,
        });
        sentAttendance.push(draft.workDate);
      } catch (caught) {
        attendanceErrors[draft.id] = hrErrorMessage(caught);
      }
    }

    for (const draft of overtime) {
      const requestedStart = `${draft.workDate}T${draft.start}:00+07:00`;
      const requestedEnd = `${draft.workDate}T${draft.end}:00+07:00`;
      try {
        // The preview is the filing gate: it carries the hash the server
        // re-checks, and the blocked reasons worth showing on this draft only.
        const preview = await getOvertimePreview(apiBase, { workDate: draft.workDate, requestedStart, requestedEnd });
        if (preview.blockedReasons?.length || preview.canFile !== true) {
          overtimeErrors[draft.id] = overtimeErrorMessage(preview.blockedReasons?.[0] ?? 'OVERTIME_ATTENDANCE_INCOMPLETE');
          continue;
        }
        await createOvertimeRequest(apiBase, {
          workDate: draft.workDate, requestedStart, requestedEnd,
          reason: draft.reason.trim(), previewHash: preview.contextHash,
        });
        sentOvertime += 1;
      } catch (caught) {
        overtimeErrors[draft.id] = hrErrorMessage(caught);
      }
    }

    setBusy(false);
    // Keep only the drafts that failed, each with its own message.
    setOvertime(overtime.filter((d) => overtimeErrors[d.id]).map((d) => ({ ...d, error: overtimeErrors[d.id] })));
    setAttendance(attendance.filter((d) => attendanceErrors[d.id]).map((d) => ({ ...d, error: attendanceErrors[d.id] })));

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

    if (sent > 0) onSent(sentAttendance, failed === 0);
  };

  return (
    <form className="flex h-full min-h-0 flex-col" onSubmit={submit} aria-label="Báo sai lệch bảng công">
      <header className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Báo sai lệch bảng công</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Thêm nhiều đơn trong cùng một lần gửi. Mỗi đơn đi tới Quản lý phòng ban kèm lý do riêng.
        </p>
      </header>

      <Tabs defaultValue="attendance" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-3 w-auto">
          <TabsTrigger value="attendance" className="px-3">Báo thiếu công {attendance.length ? `(${attendance.length})` : ''}</TabsTrigger>
          <TabsTrigger value="overtime" className="px-3">Báo OT {overtime.length ? `(${overtime.length})` : ''}</TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <TabsContent value="attendance" className="space-y-3">
            {attendance.length === 0 && <p className="text-sm text-muted-foreground">Không còn đơn nào.</p>}
            {attendance.map((draft) => (
              <div key={draft.id} className="space-y-2 rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Đơn thiếu công</span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Xoá đơn thiếu công" disabled={busy}
                    onClick={() => setAttendance(attendance.filter((d) => d.id !== draft.id))}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-2">
                  <label className="grid gap-1 text-xs font-medium">
                    Ngày
                    <Input type="date" value={draft.workDate} max={yesterday()} disabled={busy}
                      onChange={(e) => patchAttendance(draft.id, { workDate: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid min-w-0 gap-1 text-xs font-medium">
                      Mốc công cần bổ sung
                      <select className="h-8 w-full min-w-0 rounded-lg border bg-background px-2 text-sm" value={draft.adjustmentType}
                        disabled={busy}
                        onChange={(e) => patchAttendance(draft.id, { adjustmentType: e.target.value as AttendanceDraft['adjustmentType'] })}>
                        <option value="CHECK_IN">Thiếu check-in</option>
                        <option value="CHECK_OUT">Thiếu check-out</option>
                      </select>
                    </label>
                    <label className="grid min-w-0 gap-1 text-xs font-medium">
                      Giờ đề nghị
                      <Input type="time" value={draft.time} required disabled={busy}
                        onChange={(e) => patchAttendance(draft.id, { time: e.target.value })} />
                    </label>
                  </div>
                </div>
                <label className="grid gap-1 text-xs font-medium">
                  Lý do đơn này
                  <textarea aria-label="Lý do đơn thiếu công"
                    className="min-h-16 rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={draft.reason} maxLength={1000} required disabled={busy}
                    placeholder="Nhập chi tiết lý do (ít nhất 10 ký tự)…"
                    onChange={(e) => patchAttendance(draft.id, { reason: e.target.value })} />
                </label>
                {draft.error && <p role="alert" className="text-xs text-destructive">{draft.error}</p>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" disabled={busy}
              onClick={() => setAttendance([...attendance, emptyAttendance()])}>
              <Plus data-icon="inline-start" />Thêm đơn thiếu công
            </Button>
          </TabsContent>

          <TabsContent value="overtime" className="space-y-3">
            {overtime.length === 0 && <p className="text-sm text-muted-foreground">Không còn đơn nào.</p>}
            {overtime.map((draft) => (
              <div key={draft.id} className="space-y-2 rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Đơn làm thêm giờ</span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Xoá đơn OT" disabled={busy}
                    onClick={() => setOvertime(overtime.filter((d) => d.id !== draft.id))}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-2">
                  <label className="grid gap-1 text-xs font-medium">
                    Ngày
                    <Input type="date" value={draft.workDate} disabled={busy}
                      onChange={(e) => patchOvertime(draft.id, { workDate: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid min-w-0 gap-1 text-xs font-medium">
                      Bắt đầu
                      <Input type="time" value={draft.start} required disabled={busy}
                        onChange={(e) => patchOvertime(draft.id, { start: e.target.value })} />
                    </label>
                    <label className="grid min-w-0 gap-1 text-xs font-medium">
                      Kết thúc
                      <Input type="time" value={draft.end} required disabled={busy}
                        onChange={(e) => patchOvertime(draft.id, { end: e.target.value })} />
                    </label>
                  </div>
                </div>
                <label className="grid gap-1 text-xs font-medium">
                  Lý do đơn này
                  <textarea aria-label="Lý do đơn OT"
                    className="min-h-16 rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={draft.reason} maxLength={1000} required disabled={busy}
                    placeholder="Nhập chi tiết lý do (ít nhất 10 ký tự)…"
                    onChange={(e) => patchOvertime(draft.id, { reason: e.target.value })} />
                </label>
                {draft.error && <p role="alert" className="text-xs text-destructive">{draft.error}</p>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" disabled={busy}
              onClick={() => setOvertime([...overtime, emptyOvertime()])}>
              <Plus data-icon="inline-start" />Thêm đơn OT
            </Button>
            <p className="text-xs text-muted-foreground">
              Giờ OT phải ngoài ca được phân công. Đơn OT không đánh dấu kỳ công là sai lệch.
            </p>
          </TabsContent>
        </div>

        <footer className="shrink-0 space-y-2 border-t px-4 py-3">
          {!canSubmit && total > 0 && [...overtime, ...attendance].some((d) => d.reason.trim()) && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950">
              <AlertDescription>
                Mỗi đơn cần ngày hợp lệ (trong quá khứ), giờ hợp lệ và lý do ít nhất 10 ký tự.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Đóng</Button>
            <Button type="submit" disabled={!canSubmit}>
              {busy ? 'Đang gửi…' : `Gửi ${total} yêu cầu`}
            </Button>
          </div>
        </footer>
      </Tabs>
    </form>
  );
}
