import React from 'react';
import { Building2, CalendarClock, LockKeyhole, Users } from 'lucide-react';

const employees = [
  { code: 'EMP-A', name: 'Nguyễn Văn An', department: 'Kinh doanh', shift: '08:00–17:00', status: 'Đang làm việc' },
  { code: 'EMP-C', name: 'Trần Thị Bích Ngọc', department: 'Dự án', shift: '08:00–17:00', status: 'Chờ duyệt Selfie' },
  { code: 'EMP-0199', name: 'Phạm Quốc Hùng', department: 'Kỹ thuật', shift: '08:00–17:00', status: 'Đã hoàn thành' },
];

export const AdminDashboard: React.FC = () => (
  <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
      <div><p className="text-xs font-black text-blue-700">QUẢN TRỊ HỆ THỐNG</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Tổng quan TimeLock</h1><p className="mt-1 text-sm text-slate-500">Quản lý nhân sự, cấu hình chấm công và kỳ công.</p></div>
      <button className="rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-bold text-white">+ Tạo nhân viên</button>
    </div>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[['Nhân viên hoạt động','48',Users,'text-blue-700 bg-blue-50'],['Đã check-in','36',CalendarClock,'text-emerald-700 bg-emerald-50'],['Chờ phê duyệt','05',LockKeyhole,'text-amber-700 bg-amber-50'],['Nơi làm việc','03',Building2,'text-violet-700 bg-violet-50']].map(([label,value,Icon,tone]) => <article key={label as string} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5"/></div><p className="text-sm text-slate-500">{label as string}</p><p className="mt-1 text-3xl font-black">{value as string}</p></article>)}
    </section>
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-black">Nhân viên hôm nay</h2><p className="text-xs text-slate-500">Dữ liệu mẫu phục vụ prototype</p></div><button className="text-sm font-bold text-blue-700">Xem tất cả</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Mã NV','Họ tên','Phòng ban','Ca làm','Trạng thái'].map(x=><th key={x} className="px-5 py-3 font-bold">{x}</th>)}</tr></thead><tbody>{employees.map(e=><tr key={e.code} className="border-t border-slate-100"><td className="px-5 py-4 font-mono font-bold text-blue-800">{e.code}</td><td className="px-5 py-4 font-bold">{e.name}</td><td className="px-5 py-4">{e.department}</td><td className="px-5 py-4">{e.shift}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{e.status}</span></td></tr>)}</tbody></table></div>
    </section>
  </main>
);
