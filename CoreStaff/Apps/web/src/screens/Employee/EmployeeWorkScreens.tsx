import { useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, FileText, Plus, XCircle } from 'lucide-react';
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

export function AttendanceHistoryScreen() {
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lịch sử chấm công</h1><p className="mt-2 text-sm text-muted-foreground">Theo dõi giờ vào, giờ ra và tổng thời gian làm việc.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      {[['Ngày công', '20/22'], ['Tổng giờ', '160 giờ 24 phút'], ['Đi muộn', '2 lần']].map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>)}
    </div>
    <Card><CardHeader className="border-b"><CardTitle>Tháng 09/2026</CardTitle><CardDescription>Danh sách chấm công của bạn</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-4">Ngày</th><th className="p-4">Vào ca</th><th className="p-4">Ra ca</th><th className="p-4">Tổng giờ</th><th className="p-4">Trạng thái</th></tr></thead><tbody>{attendanceRows.map(row => <tr key={row[0]} className="border-b last:border-0"><td className="p-4 font-medium">{row[0]}</td><td className="p-4">{row[1]}</td><td className="p-4">{row[2]}</td><td className="p-4">{row[3]}</td><td className="p-4"><Badge variant={row[4] === 'Hoàn thành' ? 'default' : 'secondary'}>{row[4]}</Badge></td></tr>)}</tbody></table></CardContent></Card>
  </div>;
}

export function LeaveOvertimeScreen() {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Nghỉ phép & OT</h1><p className="mt-2 text-sm text-muted-foreground">Gửi yêu cầu và theo dõi trạng thái phê duyệt.</p></div><Button onClick={() => setShowForm(value => !value)}><Plus /> Tạo yêu cầu</Button></div>
    {showForm && <Card><CardHeader><CardTitle>Tạo yêu cầu mới</CardTitle><CardDescription>Thông tin sẽ được lưu tạm trên giao diện cho đến khi có API.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Loại yêu cầu<select className="h-10 rounded-lg border bg-background px-3"><option>Nghỉ phép</option><option>Làm thêm giờ (OT)</option></select></label><label className="grid gap-2 text-sm font-medium">Ngày<input type="date" className="h-10 rounded-lg border bg-background px-3" /></label><label className="grid gap-2 text-sm font-medium sm:col-span-2">Lý do<textarea className="min-h-24 rounded-lg border bg-background p-3" placeholder="Nhập lý do..." /></label><div className="flex gap-2 sm:col-span-2"><Button onClick={() => { setSubmitted(true); setShowForm(false); }}>Gửi yêu cầu</Button><Button variant="outline" onClick={() => setShowForm(false)}>Hủy</Button></div></CardContent></Card>}
    {submitted && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Yêu cầu đã được tạo và đang chờ phê duyệt.</div>}
    <div className="grid gap-4 sm:grid-cols-3">{[['Phép năm còn lại', '10 ngày', CalendarDays], ['Đang chờ duyệt', '1 yêu cầu', Clock3], ['OT tháng này', '6 giờ', CheckCircle2]].map(([label, value, Icon]) => <Card key={label as string}><CardContent className="flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon /></span><div><p className="text-sm text-muted-foreground">{label as string}</p><p className="text-xl font-semibold">{value as string}</p></div></CardContent></Card>)}</div>
    <Card><CardHeader className="border-b"><CardTitle>Yêu cầu gần đây</CardTitle></CardHeader><CardContent className="divide-y p-0">{[['Nghỉ phép năm', '19/09/2026 · 1 ngày', 'Đang chờ duyệt', Clock3], ['Làm thêm giờ', '12/09/2026 · 2 giờ', 'Đã duyệt', CheckCircle2], ['Nghỉ phép năm', '05/09/2026 · 1 ngày', 'Từ chối', XCircle]].map(([title, detail, status, Icon]) => <div key={detail as string} className="flex items-center gap-3 p-4"><Icon className="size-5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="font-medium">{title as string}</p><p className="text-sm text-muted-foreground">{detail as string}</p></div><Badge variant={status === 'Đã duyệt' ? 'default' : 'secondary'}>{status as string}</Badge></div>)}</CardContent></Card>
  </div>;
}
