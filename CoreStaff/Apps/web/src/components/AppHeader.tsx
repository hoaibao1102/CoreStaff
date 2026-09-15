import { LayoutDashboard, LogOut, Users, UserRound } from 'lucide-react';
import { AuthUser } from '@/services/auth';
import { CoreStaffLogo } from './CoreStaffLogo';
import { AppLink } from './AppLink';

interface AppHeaderProps {
  roleLabel: string;
  user: AuthUser;
  onLogout: () => void;
}

export function AppHeader({ roleLabel, user, onLogout }: AppHeaderProps) {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const links = [
    { href: '/overview', label: 'Tổng quan', icon: LayoutDashboard, visible: true },
    { href: '/hr/employees', label: 'Nhân viên', icon: Users, visible: user.role === 'HR' && !!user.organizationId },
    { href: '/app/profile', label: 'Hồ sơ của tôi', icon: UserRound, visible: true },
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <AppLink href="/overview" aria-label="CoreStaff — Tổng quan" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"><CoreStaffLogo /></AppLink>
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <span className="hidden flex-col text-right sm:flex">
            <strong className="max-w-48 truncate text-sm text-[#111827]">{user.fullName}</strong>
            <small className="text-xs text-[#6b7280]">{roleLabel}</small>
          </span>
          <button type="button" onClick={onLogout} aria-label="Đăng xuất" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"><LogOut size={16} aria-hidden="true" /><span className="hidden md:inline">Đăng xuất</span></button>
        </div>
      </div>
      <nav aria-label="Điều hướng chính" className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {links.filter(link => link.visible).map(({ href, label, icon: Icon }) => {
          const active = path === href || (href === '/overview' && (path === '/' || path === '/dashboard'));
          return <AppLink key={href} href={href} aria-current={active ? 'page' : undefined} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-blue-600 ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-900'}`}><Icon size={17} aria-hidden="true" />{label}</AppLink>;
        })}
      </nav>
    </header>
  );
}
