import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Plus, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../../components/alert';
import { Input } from '../../components/input';
import { createMyRequest, createOvertimeRequest, getMyRequests, getMyScheduleForDate, type EmployeeSchedule, type LaborEvaluation, type ManagerRequest, type RequestType } from '../../services/manager.service';
import { hrErrorMessage } from '../../services/hrService';
import { resolveApiBase } from '../../config/api';
import { Badge } from '../../components/badge';
import { Button } from '../../components/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/dialog';

const attendanceRows = [
  ['18/09/2026', '08:02', '17:05', '8 giờ 03 phút', 'Hoàn thành'],
  ['17/09/2026', '08:11', '17:00', '7 giờ 49 phút', 'Đi muộn'],
  ['16/09/2026', '07:58', '17:02', '8 giờ 04 phút', 'Hoàn thành'],
  ['15/09/2026', '—', '—', '—', 'Nghỉ phép'],
  ['14/09/2026', '08:00', '17:01', '8 giờ 01 phút', 'Hoàn thành'],
];

import { AttendanceHistoryView } from '../Attendance/components/AttendanceHistoryView';
import { toast } from '../../components/toast';
import { getSocket } from '../../services/socket';

export function AttendanceHistoryScreen({ apiBase }: { apiBase?: string | null }) {
  return <AttendanceHistoryView apiBase={apiBase} />;
}

/** `HH:mm` → minutes since midnight; NaN for anything unparseable. */
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

/** Today as the employee sees it (VN), without shipping a timezone library. */
const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** `YYYY-MM-DD` shifted by `days`, in UTC so no DST/local edge can move it. */
const shiftDay = (day: string, days: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** 540 → "9 giờ"; 570 → "9 giờ 30 phút". Same shape as the policy screens use. */
const formatMinutes = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? (m ? `${h} giờ ${m} phút` : `${h} giờ`) : `${m} phút`;
};

export function LeaveOvertimeScreen() {
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<RequestType>('ATTENDANCE');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('20:00');
  const [workDescription, setWorkDescription] = useState('');
  const [retroReason, setRetroReason] = useState('');
  const [schedule, setSchedule] = useState<EmployeeSchedule | null>(null);
  const [compliance, setCompliance] = useState<LaborEvaluation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    resolveApiBase()
      .then((r) => setApiBase(r.base))
      .catch(() => setError('Không thể kết nối API.'));
  }, []);

  useEffect(() => {
    if (apiBase) {
      getMyRequests(apiBase)
        .then(setRows)
        .catch((e) => setError(e instanceof Error ? e.message : 'Không thể tải yêu cầu.'));
    }
  }, [apiBase, rev]);

  useEffect(() => {
    if (!apiBase) return;
    const socket = getSocket(apiBase);
    const onDecision = () => setRev((r) => r + 1);
    // D39 — the server pushes `compliance:warning` for two things an employee
    // owns: minutes that trip a §30B limit, and hours worked outside the shift
    // that were never reported. Both are warnings by design (D38), so the only
    // job here is to make them visible.
    type Warning = {
      reason?: string;
      workDate?: string;
      unreportedOvertimeMinutes?: number;
      violations?: { message: string }[];
    };
    const onWarning = (w: Warning) => {
      if (w?.reason === 'UNREPORTED_OVERTIME' && w.unreportedOvertimeMinutes) {
        toast.warning(
          'Giờ làm ngoài ca chưa được đăng ký',
          `Ngày ${w.workDate ?? ''}: còn ${formatMinutes(w.unreportedOvertimeMinutes)} làm thêm chưa có yêu cầu OT. Nếu đúng, hãy gửi yêu cầu bổ sung.`
        );
        setRev((r) => r + 1);
      } else if (w?.violations?.length) {
        toast.warning('Cảnh báo giới hạn lao động', w.violations.map((v) => v.message).join(' '));
        setRev((r) => r + 1);
      }
    };
    socket.on('request:decided', onDecision);
    socket.on('compliance:warning', onWarning);
    return () => {
      socket.off('request:decided', onDecision);
      socket.off('compliance:warning', onWarning);
    };
  }, [apiBase]);

  // D39 — the OT window may not touch the shift assigned on this date, so the
  // form asks the same resolver the guard uses rather than assuming 08:00–17:00
  // (BR-SHIFT-01: that pair is seed data, not a business constant).
  useEffect(() => {
    if (!apiBase || type !== 'OVERTIME' || !workDate) {
      setSchedule(null);
      return;
    }
    let live = true;
    getMyScheduleForDate(apiBase, workDate)
      .then((s) => live && setSchedule(s))
      .catch(() => live && setSchedule(null));
    return () => {
      live = false;
    };
  }, [apiBase, type, workDate]);

  // Past the 1-day grace window (`RETROACTIVE_GRACE_DAYS`, D38) the server
  // requires `retroactiveReason`, so surface the field before the 409 does:
  // a report is ordinary through the end of the day *after* the work date.
  const graceOver = type === 'OVERTIME' && workDate < shiftDay(vnToday(), -1);

  /** Mirrors `assertOutsideSchedule`: half-open windows share no minute. */
  const encroaches = (() => {
    if (type !== 'OVERTIME' || !schedule?.scheduled) return false;
    const s = toMinutes(start);
    const e = toMinutes(end);
    const ss = toMinutes(schedule.scheduled.startTime);
    const se = toMinutes(schedule.scheduled.endTime);
    return Number.isFinite(s) && Number.isFinite(e) && s < e && s < se && ss < e;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiBase || reason.trim().length < 10) return setError('Lý do phải có ít nhất 10 ký tự.');
    if (type === 'OVERTIME') {
      if (toMinutes(start) >= toMinutes(end)) return setError('Giờ kết thúc phải sau giờ bắt đầu.');
      if (workDescription.trim() && workDescription.trim().length < 3) {
        return setError('Mô tả công việc cần ít nhất 3 ký tự (hoặc để trống).');
      }
      if (encroaches && schedule?.scheduled) {
        return setError(`Giờ tăng ca không được lấn vào ca ${schedule.scheduled.startTime}–${schedule.scheduled.endTime} của ngày này.`);
      }
      if (graceOver && retroReason.trim().length < 10) {
        return setError('Yêu cầu gửi trễ hạn, vui lòng nhập lý do bổ sung (ít nhất 10 ký tự).');
      }
    }
    setBusy(true);
    setError('');
    setCompliance(null);
    try {
      if (type === 'OVERTIME') {
        const created = await createOvertimeRequest(apiBase, {
          workDate,
          requestedStart: `${workDate}T${start}:00`,
          requestedEnd: `${workDate}T${end}:00`,
          reason: reason.trim(),
          workDescription: workDescription.trim() || undefined,
          retroactiveReason: retroReason.trim() || undefined,
        });
        // §30B.2 at filing is projection-only: a warning is shown, never a block.
        setCompliance(created.compliance ?? null);
      } else {
        await createMyRequest(apiBase, { type, workDate, reason: reason.trim() });
      }
      toast.success(
        'Gửi yêu cầu thành công',
        `Yêu cầu ${type === 'OVERTIME' ? 'làm thêm giờ (OT)' : 'điều chỉnh công'} đã được gửi tới Quản lý phòng ban.`
      );
      setShowForm(false);
      setReason('');
      setWorkDescription('');
      setRetroReason('');
      setRev((x) => x + 1);
    } catch (e) {
      const msg = hrErrorMessage(e);
      setError(msg);
      toast.error('Gửi yêu cầu thất bại', msg);
    } finally {
      setBusy(false);
    }
  };

  const pending = rows.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Nghỉ phép & OT</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gửi yêu cầu điều chỉnh công hoặc OT và theo dõi quyết định từ Quản lý phòng ban.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 size-4" /> Tạo yêu cầu
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <Dialog open onOpenChange={(next) => !busy && !next && setShowForm(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader className="border-b pr-16">
              <DialogTitle>Tạo yêu cầu mới</DialogTitle>
              <DialogDescription>Yêu cầu được gửi đến quản lý phòng ban theo dữ liệu phân công của bạn.</DialogDescription>
            </DialogHeader>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
                {error && (
                  <div className="sm:col-span-2">
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </div>
                )}
              <div className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium">Chọn loại yêu cầu</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('OVERTIME')}
                    className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-left text-sm transition-all cursor-pointer ${
                      type === 'OVERTIME'
                        ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950 ring-2 ring-indigo-500/40'
                        : 'border-border bg-card hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <Clock3 className={`size-5 shrink-0 mt-0.5 ${type === 'OVERTIME' ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-semibold text-sm">Làm thêm giờ (OT)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Đăng ký ca làm thêm giờ ngoài ca làm việc</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('ATTENDANCE')}
                    className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-left text-sm transition-all cursor-pointer ${
                      type === 'ATTENDANCE'
                        ? 'border-blue-600 bg-blue-50/70 font-semibold text-blue-950 ring-2 ring-blue-500/40'
                        : 'border-border bg-card hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <CalendarDays className={`size-5 shrink-0 mt-0.5 ${type === 'ATTENDANCE' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-semibold text-sm">Điều chỉnh / Giải trình công</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Báo quên chấm công, sự cố thiết bị hoặc giải trình</p>
                    </div>
                  </button>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                Ngày
                <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
              </label>

              {type === 'OVERTIME' && (
                <>
                  <label className="grid gap-2 text-sm font-medium">
                    Bắt đầu
                    <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Kết thúc
                    <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                  </label>
                </>
              )}

              {type === 'OVERTIME' && (
                <div className="sm:col-span-2 grid gap-2 text-sm">
                  <p className="text-muted-foreground">
                    {!schedule
                      ? 'Đang tải ca được phân công…'
                      : schedule.scheduled
                        ? `Ca được phân công: ${schedule.scheduled.startTime}–${schedule.scheduled.endTime} (nghỉ ${schedule.scheduled.breakMinutes} phút). Giờ OT phải ngoài khung này.`
                        : 'Ngày này không có ca được phân công — khung giờ đăng ký không bị giới hạn.'}
                  </p>
                  {encroaches && schedule?.scheduled ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Khung giờ bạn nhập lấn vào ca {schedule.scheduled.startTime}–{schedule.scheduled.endTime}.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              )}

              <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                Lý do
                <textarea
                  className="min-h-24 rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập chi tiết lý do (ít nhất 10 ký tự)..."
                />
              </label>

              {type === 'OVERTIME' && (
                <>
                  <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                    Mô tả công việc làm thêm giờ
                    <textarea
                      className="min-h-20 rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={workDescription}
                      onChange={(e) => setWorkDescription(e.target.value)}
                      placeholder="VD: Hoàn tất kiểm thử bản vá 2.4 cùng bộ phận hỗ trợ (tùy chọn)"
                    />
                  </label>

                  {graceOver && (
                    <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                      Lý do bổ sung yêu cầu trễ hạn
                      <textarea
                        className="min-h-20 rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={retroReason}
                        onChange={(e) => setRetroReason(e.target.value)}
                        placeholder="Bắt buộc vì ngày này đã quá 1 ngày so với hôm nay (ít nhất 10 ký tự)..."
                      />
                    </label>
                  )}
                </>
              )}

              {compliance?.violations?.length ? (
                <div className="sm:col-span-2 grid gap-2">
                  {compliance.violations.map((v) => (
                    <Alert key={v.code} className={v.severity === 'WARNING' ? 'border-amber-500/60 text-amber-700' : undefined}>
                      <AlertDescription>
                        {v.message} ({formatMinutes(v.usedMinutes)} / hạn mức {formatMinutes(v.limitMinutes)})
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : null}

              </div>
              <div className="flex shrink-0 gap-3 justify-end border-t px-6 py-4">
                <Button type="button" variant="outline" disabled={busy} onClick={() => setShowForm(false)}>
                  Hủy
                </Button>
                <Button disabled={busy} type="submit">
                  {busy ? 'Đang gửi…' : 'Gửi yêu cầu'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['Đang chờ duyệt', `${pending} yêu cầu`, Clock3],
          ['Tổng yêu cầu', `${rows.length} yêu cầu`, CalendarDays],
        ].map(([label, value, Icon]) => (
          <Card key={label as string} className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">{label as string}</p>
                <p className="text-xl font-semibold">{value as string}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>Yêu cầu gần đây</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Chưa có yêu cầu nào.</p>
          ) : (
            rows.map((row) => {
              const isApproved = row.status === 'APPROVED';
              const isRejected = row.status === 'REJECTED';
              const isClarification = row.status === 'CLARIFICATION_REQUESTED';
              const Icon = isApproved ? CheckCircle2 : isRejected ? XCircle : Clock3;

              return (
                <div key={row._id} className="flex items-start gap-3 p-4">
                  <span
                    className={`mt-0.5 rounded-full p-1 ${
                      isApproved
                        ? 'bg-emerald-100 text-emerald-600'
                        : isRejected
                        ? 'bg-rose-100 text-rose-600'
                        : isClarification
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-foreground">
                        {row.type === 'OVERTIME' ? 'Làm thêm giờ (OT)' : 'Chấm công Selfie / Điều chỉnh'}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isApproved
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : isClarification
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {isApproved
                          ? 'Đã duyệt'
                          : isRejected
                          ? 'Từ chối'
                          : isClarification
                          ? 'Cần giải trình'
                          : 'Chờ duyệt'}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ngày {new Date(row.workDate).toLocaleDateString('vi-VN')} · {row.reason}
                    </p>

                    {row.reviewComment && (
                      <div className="mt-2 rounded-lg bg-muted/60 p-2 text-xs">
                        <span className="font-semibold text-foreground">Ý kiến Quản lý:</span>{' '}
                        <span className="italic text-muted-foreground">"{row.reviewComment}"</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
