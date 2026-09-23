import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Plus, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../../components/alert';
import { Input } from '../../components/input';
import { createMyRequest, getMyRequests, type ManagerRequest, type RequestType } from '../../services/manager.service';
import { resolveApiBase } from '../../config/api';
import { Badge } from '../../components/badge';
import { Button } from '../../components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/card';

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

export function LeaveOvertimeScreen() {
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<RequestType>('ATTENDANCE');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('20:00');
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
    socket.on('request:decided', onDecision);
    return () => {
      socket.off('request:decided', onDecision);
    };
  }, [apiBase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiBase || reason.trim().length < 10) return setError('Lý do phải có ít nhất 10 ký tự.');
    setBusy(true);
    setError('');
    try {
      await createMyRequest(apiBase, {
        type,
        workDate,
        reason: reason.trim(),
        requestedStart: type === 'OVERTIME' ? `${workDate}T${start}:00` : undefined,
        requestedEnd: type === 'OVERTIME' ? `${workDate}T${end}:00` : undefined,
      });
      toast.success(
        'Gửi yêu cầu thành công',
        `Yêu cầu ${type === 'OVERTIME' ? 'làm thêm giờ (OT)' : 'điều chỉnh công'} đã được gửi tới Quản lý phòng ban.`
      );
      setShowForm(false);
      setReason('');
      setRev((x) => x + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể gửi yêu cầu.';
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
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1.5 size-4" /> Tạo yêu cầu
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Tạo yêu cầu mới</CardTitle>
            <CardDescription>
              Yêu cầu được gửi đến quản lý phòng ban theo dữ liệu phân công của bạn.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
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

              <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                Lý do
                <textarea
                  className="min-h-24 rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập chi tiết lý do (ít nhất 10 ký tự)..."
                />
              </label>

              <div className="flex gap-2 sm:col-span-2">
                <Button disabled={busy} type="submit">
                  Gửi yêu cầu
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Hủy
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
