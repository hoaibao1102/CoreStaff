import { ArrowUpRight, CalendarDays, Clock3, FileCheck2, FileText, ShieldCheck, UserRound, Users } from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { AppLink } from '../../components/AppLink';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { canViewEmployees, canViewProfile } from '../../lib/employee';
import { roleLabel } from '../../lib/labels';

/* ───────── Shortcut Card ───────── */

function ShortcutCard({
  href,
  title,
  description,
  icon: Icon,
  primary,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  primary: boolean;
}) {
  return (
    <AppLink
      href={href}
      className={`group flex flex-col rounded-xl border p-6 transition hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-7 ${primary
          ? 'border-primary/30 bg-primary/5'
          : 'border-border bg-card'
        }`}
    >
      <div className="mb-6 flex items-center justify-between">
        <span
          className={`grid size-12 place-items-center rounded-lg ${primary
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
            }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowUpRight
          className={`h-5 w-5 transition group-hover:text-primary ${primary ? 'text-primary/60' : 'text-muted-foreground'
            }`}
          aria-hidden="true"
        />
      </div>
      <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      <span className="mt-6 text-sm font-semibold text-primary">
        Mở {title.toLocaleLowerCase('vi-VN')} →
      </span>
    </AppLink>
  );
}

/* ───────── Main Screen ───────── */

export function HrOverviewScreen({ user }: { user: AuthUser }) {
  const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date());
  const shortcuts = [
    { href: '/hr/employees', title: 'Danh bạ nhân viên', description: 'Tìm kiếm nhân viên, tra cứu phòng ban và thông tin công việc trong tổ chức.', icon: Users, visible: canViewEmployees(user), primary: true },
    { href: '/hr/contracts', title: 'Hợp đồng lao động', description: 'Tạo hợp đồng, theo dõi hiệu lực và cảnh báo sắp hết hạn.', icon: FileText, visible: canViewEmployees(user), primary: false },
    { href: '/app/profile', title: 'Hồ sơ của tôi', description: 'Xem thông tin tài khoản, hồ sơ cá nhân và phân công công việc của bạn.', icon: UserRound, visible: canViewProfile(user), primary: false },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header — follows Design Master D */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Tổng quan
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Xin chào, {user.fullName}. Chúc bạn một ngày làm việc hiệu quả.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {date}
        </span>
      </div>

      {/* Quick Actions */}
      <section aria-labelledby="workspace-title" className="space-y-4">
        <div>
          <h2 id="workspace-title" className="text-lg font-semibold text-foreground">
            Công việc của bạn
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Truy cập nhanh thông tin nhân sự và hồ sơ cá nhân.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {shortcuts.filter(item => item.visible).map(({ href, title, description, icon: Icon, primary }) => (
            <ShortcutCard
              key={href}
              href={href}
              title={title}
              description={description}
              icon={Icon}
              primary={primary}
            />
          ))}
        </div>
      </section>

      {/* Bottom Grid: Business Tasks + Account Info */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Business Tasks */}
        <section aria-labelledby="tasks-title" className="rounded-xl border border-border bg-card shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Nghiệp vụ nhân sự
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Các tiện ích sẽ được bổ sung trong thời gian tới.
            </p>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/50">
              {[
                { title: 'Chấm công', text: 'Theo dõi thời gian làm việc của nhân viên.', icon: Clock3 },
                { title: 'Nghỉ phép & phê duyệt', text: 'Quản lý đơn từ và các yêu cầu nhân sự.', icon: FileCheck2 },
              ].map(({ title, text, icon: Icon }) => (
                <div key={title} className="flex items-center gap-3 py-4">
                  <span className="rounded-lg bg-muted p-2.5 text-muted-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-foreground">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    Sắp có
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </section>

        {/* Account Info Sidebar */}
        <aside className="rounded-xl border border-border bg-card p-6 shadow-none">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Tài khoản làm việc
          </div>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="mt-1 break-all font-medium text-foreground">{user.email}</dd>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="text-xs text-muted-foreground">Vai trò</dt>
                <dd className="mt-1 font-medium text-foreground">{roleLabel(user.role)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Mã nhân viên</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {user.employeeCode || 'Chưa có thông tin'}
                </dd>
              </div>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

