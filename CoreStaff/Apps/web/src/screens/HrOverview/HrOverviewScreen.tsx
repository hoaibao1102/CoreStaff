import { ArrowUpRight, CalendarDays, Clock3, FileCheck2, ShieldCheck, UserRound, Users } from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { AppLink } from '../../components/AppLink';
import { canViewEmployees, canViewProfile } from '../../lib/employee';

export function HrOverviewScreen({ user }: { user: AuthUser }) {
  const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date());
  const shortcuts = [
    { href: '/hr/employees', title: 'Danh bạ nhân viên', description: 'Tìm kiếm nhân viên, tra cứu phòng ban và thông tin công việc trong tổ chức.', icon: Users, visible: canViewEmployees(user), primary: true },
    { href: '/app/profile', title: 'Hồ sơ của tôi', description: 'Xem thông tin tài khoản, hồ sơ cá nhân và phân công công việc của bạn.', icon: UserRound, visible: canViewProfile(user), primary: false },
  ];
  return <div className="space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-700">Không gian nhân sự</p><h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Tổng quan</h1><p className="mt-2 text-sm leading-6 text-slate-500">Xin chào, {user.fullName}. Chúc bạn một ngày làm việc hiệu quả.</p></div>
      <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><CalendarDays size={16} aria-hidden="true" />{date}</span>
    </div>
    <section id="workspace" aria-labelledby="hr-workspace-title" className="space-y-4">
      <div><h2 id="hr-workspace-title" className="text-lg font-semibold text-slate-900">Công việc của bạn</h2><p className="mt-1 text-sm text-slate-500">Truy cập nhanh thông tin nhân sự và hồ sơ cá nhân.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {shortcuts.filter(item => item.visible).map(({ href, title, description, icon: Icon, primary }) => <AppLink key={href} href={href} className={`group flex flex-col rounded-2xl border p-6 transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 sm:p-7 ${primary ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-white'}`}>
          <div className="mb-6 flex items-center justify-between"><span className={`grid size-12 place-items-center rounded-xl ${primary ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon size={23} aria-hidden="true" /></span><ArrowUpRight size={21} aria-hidden="true" className="text-slate-400 transition group-hover:text-blue-700" /></div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p><span className="mt-6 text-sm font-semibold text-blue-700">Mở {title.toLocaleLowerCase('vi-VN')} →</span>
        </AppLink>)}
      </div>
    </section>
    <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section aria-labelledby="hr-planned-title" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 id="hr-planned-title" className="text-base font-semibold text-slate-900">Nghiệp vụ nhân sự</h2><p className="mt-1 text-sm text-slate-500">Các tiện ích sẽ được bổ sung trong thời gian tới.</p>
        <div className="mt-4 divide-y divide-slate-100">{[
          { title: 'Chấm công', text: 'Theo dõi thời gian làm việc của nhân viên.', icon: Clock3 },
          { title: 'Nghỉ phép & phê duyệt', text: 'Quản lý đơn từ và các yêu cầu nhân sự.', icon: FileCheck2 },
        ].map(({ title, text, icon: Icon }) => <div key={title} className="flex items-center gap-3 py-4"><span className="rounded-lg bg-slate-50 p-2.5 text-slate-500"><Icon size={20} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-medium text-slate-800">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">Sắp có</span></div>)}</div>
      </section>
      <aside className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck size={18} className="text-blue-600" aria-hidden="true" />Tài khoản làm việc</div><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all font-medium text-slate-800">{user.email}</dd></div><div className="flex flex-wrap gap-x-10 gap-y-4"><div><dt className="text-xs text-slate-500">Vai trò</dt><dd className="mt-1 font-medium text-slate-800">Nhân sự</dd></div><div><dt className="text-xs text-slate-500">Mã nhân viên</dt><dd className="mt-1 font-medium text-slate-800">{user.employeeCode || 'Chưa có thông tin'}</dd></div></div></dl></aside>
    </div>
  </div>;
}
