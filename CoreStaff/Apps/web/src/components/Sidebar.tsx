import {
    Building2,
    BriefcaseBusiness,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    ClipboardList,
    Clock3,
    FileText,
    LayoutDashboard,
    LogOut,
    ShieldAlert,
    ShieldCheck,
    Target,
    UserRound,
    Users,
    WalletCards,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './button';
import { Avatar, AvatarFallback } from './avatar';
import { Badge } from './badge';
import type { AuthUser } from '@/services/auth';
import { AppLink } from './AppLink';
import { roleLabel } from '@/lib/labels';
import { CoreStaffLogo } from './CoreStaffLogo';
import { Tooltip } from './tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';
import { getSocket } from '@/services/socket';
import { getManagerRequests } from '@/services/manager.service';

/* ───────── Types ───────── */

interface NavGroup {
    title: string;
    items: NavItem[];
}

interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    badge?: ReactNode;
}

/* ───────── Role-based menu definitions ───────── */

function getNavGroups(user: AuthUser, pendingCount?: number): NavGroup[] {
    const role = user.role;

    const common: NavItem[] = role === 'EMPLOYEE'
        ? []
        : [{ href: '/overview', label: 'Tổng quan', icon: LayoutDashboard }];
    if (user.organizationId && role !== 'EMPLOYEE') {
        common.push({ href: '/hr/departments', label: 'Phòng ban', icon: Building2 });
    }

    if (role === 'HR') {
        common.push({ href: '/hr/positions', label: 'Chức danh', icon: BriefcaseBusiness });
        return [
            {
                title: 'Quản lý',
                items: [
                    ...common,
                    { href: '/hr/employees', label: 'Danh sách nhân viên', icon: Users },
                    { href: '/hr/contracts', label: 'Hợp đồng lao động', icon: FileText },
                    { href: '/hr/assignments', label: 'Quản lý phân công', icon: ClipboardList },
                    { href: '/hr/workplaces', label: 'Nơi làm việc', icon: Building2 },
                    { href: '/hr/shift-templates', label: 'Ca làm việc', icon: Clock3 },
                    { href: '/hr/salary-profiles', label: 'Hồ sơ lương', icon: WalletCards },
                    { href: '/hr/organization-allowances', label: 'Phụ cấp', icon: WalletCards },
                    { href: '/hr/attendance-bonus-policies', label: 'Thưởng chuyên cần', icon: ClipboardCheck },
                    { href: '/hr/kpi-inputs', label: 'KPI kỳ lương', icon: ClipboardList },
                    { href: '/hr/policies/labor-compliance', label: 'Tuân thủ lao động', icon: ShieldAlert },
                    { href: '/hr/policies/overtime-pay', label: 'Lương tăng ca', icon: WalletCards },
                    { href: '/hr/insurance-profiles', label: 'Hồ sơ bảo hiểm', icon: ShieldCheck },
                    { href: '/hr/policies/insurance', label: 'Chính sách bảo hiểm', icon: ShieldCheck },
                ],
            },
            {
                // Attendance for HR is gated on work assignments that don't exist
                // yet (TASK-024, Sprint 4) — kept out until then so the sidebar
                // matches the routes (§16.2 / AC-HR-SELF-01).
                title: 'Nhân sự',
                items: [
                    { href: '/app/attendance', label: 'Chấm công hôm nay', icon: Clock3 },
                    { href: '/hr/periods', label: 'Chốt kỳ công', icon: ClipboardCheck },
                    { href: '/hr/payroll-runs', label: 'Payroll & Payslip', icon: WalletCards },
                ],
            },
        ];
    }

    if (role === 'SYSTEM_ADMIN') {
        return [
            {
                title: 'Nền tảng',
                items: [
                    ...common,
                    { href: '/platform/organizations', label: 'Organizations', icon: Building2 },
                    { href: '/platform/audit-logs', label: 'Platform audit', icon: ShieldCheck },
                ],
            },
        ];
    }

    const personalItems: NavItem[] = [
        { href: '/app/attendance', label: 'Chấm công hôm nay', icon: Clock3 },
        { href: '/app/attendance/history', label: 'Lịch sử công', icon: CalendarDays },
        { href: '/app/leave', label: 'Nghỉ phép & OT', icon: FileText },
    ];

    if (role === 'DEPARTMENT_MANAGER') {
        return [
            { title: 'Cá nhân', items: personalItems },
            {
                title: 'Quản lý',
                items: [
                    {
                        href: '/manager/department',
                        label: 'Phòng ban',
                        icon: Building2,
                        badge: (pendingCount && pendingCount > 0) ? (
                            <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-xs animate-pulse">
                                {pendingCount > 99 ? '99+' : pendingCount}
                            </span>
                        ) : undefined,
                    },
                ],
            },
        ];
    }

    return [{ title: 'Cá nhân', items: personalItems }];
}

/* ───────── Sidebar Component ───────── */

interface SidebarProps {
    id: string;
    user: AuthUser;
    currentPath: string;
    collapsed: boolean;
    onToggle: () => void;
    onLogout: () => void;
    mobile?: boolean;
    onNavigate?: () => void;
    apiBase?: string | null;
}

export function Sidebar({ id, user, currentPath, collapsed, onToggle, onLogout, mobile = false, onNavigate, apiBase }: SidebarProps) {
    const [pendingCount, setPendingCount] = useState<number>(0);

    useEffect(() => {
        if (user.role !== 'DEPARTMENT_MANAGER') return;
        const socket = getSocket(apiBase);

        getManagerRequests(apiBase || '', { status: 'PENDING' })
            .then((rows) => setPendingCount(rows.length))
            .catch(() => {});

        const onNew = () => setPendingCount((p) => p + 1);
        const onDecided = () => setPendingCount((p) => Math.max(0, p - 1));

        socket.on('request:new', onNew);
        socket.on('request:decided', onDecided);

        return () => {
            socket.off('request:new', onNew);
            socket.off('request:decided', onDecided);
        };
    }, [user.role, user.id, user._id, apiBase]);

    const navGroups = getNavGroups(user, pendingCount);
    const path = currentPath.replace(/\/$/, '') || '/';
    // Prefer the longest match so attendance/history never activates two items.
    const activeHref = navGroups.flatMap(group => group.items)
        .filter(item => path === item.href || path.startsWith(`${item.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href
        ?? (path === '/' || path === '/dashboard' ? '/overview' : undefined);
    const toggleLabel = mobile ? 'Đóng menu' : collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar';
    const initials = user.fullName
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <aside id={id} className="workspace-sidebar" data-collapsed={collapsed}>
            <div className="workspace-sidebar-header">
                <AppLink href="/overview" onClick={onNavigate} aria-label="CoreStaff — Tổng quan" className="workspace-sidebar-brand">
                    <CoreStaffLogo compact={collapsed} />
                </AppLink>
                <Tooltip content={toggleLabel} disabled={mobile}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggle}
                        aria-label={toggleLabel}
                        aria-expanded={mobile ? true : !collapsed}
                        aria-controls={`${id}-navigation`}
                        className="workspace-sidebar-toggle text-muted-foreground"
                    >
                        {mobile ? <X aria-hidden="true" /> : collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
                    </Button>
                </Tooltip>
            </div>
            <nav id={`${id}-navigation`} className="workspace-sidebar-navigation" aria-label="Điều hướng chính">
                {navGroups.map((group) => (
                    <div key={group.title} className="workspace-sidebar-group">
                        <div className="workspace-sidebar-group-heading" aria-hidden={collapsed}>
                            <span className="workspace-sidebar-label">{group.title}</span>
                        </div>
                        {group.items.map((item) => {
                            const active = activeHref === item.href;
                            return (
                                <Tooltip key={item.href} content={item.label} disabled={!collapsed}>
                                    <AppLink
                                        href={item.href}
                                        onClick={onNavigate}
                                        aria-label={item.label}
                                        aria-current={active ? 'page' : undefined}
                                        className="workspace-sidebar-item"
                                    >
                                        <span className="workspace-sidebar-icon relative">
                                            <item.icon size={20} aria-hidden="true" />
                                            {item.badge && collapsed && (
                                                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-600 animate-pulse" />
                                            )}
                                        </span>
                                        <span className="workspace-sidebar-label workspace-sidebar-item-text" aria-hidden={collapsed}>
                                            <span className="truncate">{item.label}</span>
                                            {item.badge && (
                                                <span className="ml-auto flex items-center">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </span>
                                    </AppLink>
                                </Tooltip>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="workspace-sidebar-footer">
                <DropdownMenu>
                    <DropdownMenuTrigger aria-label={`Tài khoản: ${user.fullName} — ${roleLabel(user.role)}`} className="workspace-sidebar-account">
                        <span className="workspace-sidebar-icon">
                            <Avatar className="size-8 shrink-0">
                                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
                            </Avatar>
                        </span>
                        <span className="workspace-sidebar-label workspace-sidebar-account-text" aria-hidden={collapsed}>
                            <span className="block truncate text-sm font-medium text-foreground">{user.fullName}</span>
                            <span className="block truncate text-xs text-muted-foreground">{roleLabel(user.role)}</span>
                        </span>
                        <ChevronDown size={16} aria-hidden="true" className="workspace-sidebar-label mr-3 shrink-0" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side={mobile ? 'top' : 'right'} align="end" sideOffset={12} className="w-60 max-w-[calc(100vw-2rem)]">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="px-3 py-2">
                                <span className="block truncate font-semibold text-foreground">{user.fullName}</span>
                                <span className="block truncate">{roleLabel(user.role)}</span>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem render={<AppLink href="/app/profile" onClick={onNavigate} />} className="min-h-11 px-3">
                                <UserRound aria-hidden="true" /> Hồ sơ của tôi
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => { onNavigate?.(); onLogout(); }} className="min-h-11 px-3">
                                <LogOut aria-hidden="true" /> Đăng xuất
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
