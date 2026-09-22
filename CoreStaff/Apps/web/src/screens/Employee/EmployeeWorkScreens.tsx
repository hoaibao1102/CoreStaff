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

export function AttendanceHistoryScreen() {
  return <AttendanceHistoryView />;
}

export function LeaveOvertimeScreen() {
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<RequestType>('ATTENDANCE');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [start, setStart] = useState('18:00'); const [end, setEnd] = useState('20:00');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [rev, setRev] = useState(0);
  useEffect(() => { resolveApiBase().then(r => setApiBase(r.base)).catch(() => setError('Không thể kết nối API.')); }, []);
  useEffect(() => { if (apiBase) getMyRequests(apiBase).then(setRows).catch(e => setError(e instanceof Error ? e.message : 'Không thể tải yêu cầu.')); }, [apiBase, rev]);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!apiBase || reason.trim().length < 10) return setError('Lý do phải có ít nhất 10 ký tự.'); setBusy(true); setError(''); try { await createMyRequest(apiBase, { type, workDate, reason: reason.trim(), requestedStart: type === 'OVERTIME' ? `${workDate}T${start}:00` : undefined, requestedEnd: type === 'OVERTIME' ? `${workDate}T${end}:00` : undefined }); setShowForm(false); setReason(''); setRev(x => x + 1); } catch (e) { setError(e instanceof Error ? e.message : 'Không thể gửi yêu cầu.'); } finally { setBusy(false); } };
  const pending = rows.filter(r => r.status === 'PENDING').length;
  return <div className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Nghỉ phép & OT</h1><p className="mt-2 text-sm text-muted-foreground">Gửi yêu cầu điều chỉnh công hoặc OT và theo dõi quyết định.</p></div><Button onClick={() => setShowForm(v => !v)}><Plus /> Tạo yêu cầu</Button></div>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}{showForm && <Card><CardHeader><CardTitle>Tạo yêu cầu mới</CardTitle><CardDescription>Yêu cầu được gửi đến quản lý phòng ban theo dữ liệu hồ sơ của bạn.</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><label className="grid gap-2 text-sm font-medium">Loại yêu cầu<select className="min-h-11 rounded-lg border bg-background px-3" value={type} onChange={e => setType(e.target.value as RequestType)}><option value="ATTENDANCE">Điều chỉnh công / giải trình</option><option value="OVERTIME">Làm thêm giờ (OT)</option></select></label><label className="grid gap-2 text-sm font-medium">Ngày<Input type="date" value={workDate} onChange={e => setWorkDate(e.target.value)} /></label>{type === 'OVERTIME' && <><label className="grid gap-2 text-sm font-medium">Bắt đầu<Input type="time" value={start} onChange={e => setStart(e.target.value)} /></label><label className="grid gap-2 text-sm font-medium">Kết thúc<Input type="time" value={end} onChange={e => setEnd(e.target.value)} /></label></>}<label className="grid gap-2 text-sm font-medium sm:col-span-2">Lý do<textarea className="min-h-24 rounded-lg border bg-background p-3" value={reason} onChange={e => setReason(e.target.value)} placeholder="Ít nhất 10 ký tự" /></label><div className="flex gap-2 sm:col-span-2"><Button disabled={busy} type="submit">Gửi yêu cầu</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Hủy</Button></div></form></CardContent></Card>}<div className="grid gap-4 sm:grid-cols-2">{[['Đang chờ duyệt', `${pending} yêu cầu`, Clock3], ['Tổng yêu cầu', `${rows.length} yêu cầu`, CalendarDays]].map(([label, value, Icon]) => <Card key={label as string}><CardContent className="flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon /></span><div><p className="text-sm text-muted-foreground">{label as string}</p><p className="text-xl font-semibold">{value as string}</p></div></CardContent></Card>)}</div><Card><CardHeader className="border-b"><CardTitle>Yêu cầu gần đây</CardTitle></CardHeader><CardContent className="divide-y p-0">{rows.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Chưa có yêu cầu.</p> : rows.map(row => { const Icon = row.status === 'APPROVED' ? CheckCircle2 : row.status === 'REJECTED' ? XCircle : Clock3; const label = row.status === 'PENDING' ? 'Đang chờ duyệt' : row.status === 'APPROVED' ? 'Đã duyệt' : row.status === 'REJECTED' ? 'Từ chối' : 'Cần giải trình'; return <div key={row._id} className="flex items-center gap-3 p-4"><Icon className="size-5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="font-medium">{row.type === 'OVERTIME' ? 'Làm thêm giờ' : 'Điều chỉnh công'}</p><p className="text-sm text-muted-foreground">{new Date(row.workDate).toLocaleDateString('vi-VN')} · {row.reason}</p></div><Badge variant={row.status === 'APPROVED' ? 'default' : 'secondary'}>{label}</Badge></div>; })}</CardContent></Card></div>;
}
