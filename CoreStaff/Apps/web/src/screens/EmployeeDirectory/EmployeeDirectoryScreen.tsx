import { useState } from 'react';
import { Building2, Search, Users, UserCheck, UserRound, SlidersHorizontal } from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { Card, CardContent } from '../../components/card';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/table';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { canViewEmployees, directoryPage, employmentStatuses, type DataState, type EmployeeView } from '../../lib/employee';

export function EmployeeDirectoryScreen({ user, state = { status: 'unavailable' } }: {
  user: AuthUser; state?: DataState<EmployeeView[]>;
}) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  if (!canViewEmployees(user) || !user.organizationId) return <EmployeeDataState status="forbidden" />;
  const rows = state.status === 'ready' ? state.data.filter(row => row.organizationId === user.organizationId) : [];
  const result = directoryPage(rows, user.organizationId, query, department, status, page);
  const departments = [...new Set(rows.flatMap(row => row.department ? [row.department] : []))].sort();
  const ready = state.status === 'ready';
  const filtered = !!(query || department || status);
  const stats = [
    { label: 'Tổng nhân viên', value: rows.length, icon: Users },
    { label: 'Đang làm việc', value: rows.filter(row => row.employmentStatus === 'ACTIVE').length, icon: UserCheck },
    { label: 'Thử việc', value: rows.filter(row => row.employmentStatus === 'PROBATION').length, icon: UserRound },
    { label: 'Phòng ban có nhân viên', value: departments.length, icon: Building2 },
  ];
  return <div className="space-y-6">
    <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-700">Quản lý nhân sự</p><h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Danh bạ nhân viên</h1><p className="mt-2 text-sm leading-6 text-slate-500">Tra cứu hồ sơ và thông tin công việc của nhân viên trong tổ chức.</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium leading-5 text-slate-500">{label}</p><Icon size={18} className="shrink-0 text-blue-600" aria-hidden="true" /></div><p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900" aria-label={ready ? undefined : 'Chưa có dữ liệu'}>{ready ? value : '—'}</p></div>)}</div>
    <Card className="rounded-2xl border border-slate-200 py-0 shadow-none ring-0"><CardContent className="space-y-5 px-0" aria-busy={state.status === 'loading'}>
      <div className="space-y-5 border-b border-slate-100 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><SlidersHorizontal size={18} aria-hidden="true" />Danh sách nhân viên</h2>{ready && filtered && <button type="button" className="rounded text-sm font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => { setQuery(''); setDepartment(''); setStatus(''); setPage(1); }}>Xóa bộ lọc</button>}</div>
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
        <label className="space-y-2 text-xs font-medium text-slate-600">Tìm nhân viên<span className="relative block"><Search size={17} className="pointer-events-none absolute left-3 top-3 z-10 text-slate-400" aria-hidden="true" /><Input className="h-10 rounded-lg pl-9 text-sm" value={query} disabled={!ready} placeholder="Họ tên hoặc mã nhân viên" onChange={e => { setQuery(e.target.value); setPage(1); }} /></span></label>
        <label className="space-y-2 text-xs font-medium text-slate-600">Phòng ban<select className="block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50" disabled={!ready} value={department} onChange={e => { setDepartment(e.target.value); setPage(1); }}><option value="">Tất cả phòng ban</option>{departments.map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="space-y-2 text-xs font-medium text-slate-600">Trạng thái<select className="block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50" disabled={!ready} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(employmentStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      </div>
      {ready && <p role="status" className="px-6 text-sm text-slate-500">{result.total} nhân viên</p>}
      <div tabIndex={0} role="region" aria-label="Bảng nhân viên, cuộn ngang để xem thêm" className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
        <Table className="min-w-[800px]" aria-label="Danh bạ nhân viên"><TableHeader className="bg-slate-50"><TableRow>{['Mã nhân viên', 'Họ tên', 'Email', 'Phòng ban', 'Chức danh', 'Trạng thái'].map(label => <TableHead className="h-11 px-5 text-xs font-medium text-slate-500" key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{result.rows.map(row => <TableRow className="hover:bg-blue-50/40" key={row.id}><TableCell className="px-5 py-4 font-medium text-slate-500">{row.employeeCode}</TableCell><TableCell className="px-5 py-4 font-semibold text-slate-900">{row.fullName || 'Chưa có thông tin'}</TableCell><TableCell className="px-5 text-slate-500">{row.email || '—'}</TableCell><TableCell className="px-5">{row.department || '—'}</TableCell><TableCell className="px-5">{row.position || '—'}</TableCell><TableCell className="px-5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${row.employmentStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : row.employmentStatus === 'PROBATION' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{employmentStatuses[row.employmentStatus]}</span></TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      {!ready && <div className="mx-auto max-w-md px-5 pb-10 pt-5 text-center"><span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Users size={26} aria-hidden="true" /></span><EmployeeDataState status={state.status} />{state.status === 'unavailable' && <p className="mt-3 text-sm leading-6 text-slate-500">Danh sách sẽ hiển thị khi dữ liệu nhân viên được cập nhật.</p>}</div>}
      {ready && <>
        {!result.total && <p className="py-8 text-center" role="status">{rows.length ? 'Không tìm thấy nhân viên phù hợp.' : 'Chưa có nhân viên trong tổ chức.'}</p>}
        <nav aria-label="Phân trang nhân viên" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-5">
          <Button variant="outline" disabled={result.current === 1} onClick={() => setPage(result.current - 1)}>Trang trước</Button>
          <span className="text-sm">Trang {result.current} / {result.pages}</span>
          <Button variant="outline" disabled={result.current === result.pages} onClick={() => setPage(result.current + 1)}>Trang sau</Button>
        </nav>
      </>}
    </CardContent></Card>
  </div>;
}
