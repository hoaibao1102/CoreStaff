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
    href?: string;
    label: string;
    icon: LucideIcon;
    badge?: ReactNode;
    children?: NavItem[];
}

/* ───────── Role-based menu definitions ───────── */

function getNavGroups(user: AuthUser, pendingCount?: number): NavGroup[] {
    const role = user.role;

    const common: NavItem[] = role === 'EMPLOYEE'
        ? []
        : [{ href: '/overview', label: 'Tổng quan', icon: LayoutDashboard }];
    if (user.organizationId && role !== 'EMPLOYEE' && role !== 'HR') {
        common.push({ href: '/hr/departments', label: 'Phòng ban', icon: Building2 });
    }

    if (role === 'HR') {
        return [
            {
                title: 'Quản lý',
                items: [
                    ...common,
                    { label: 'Cơ cấu tổ chức', icon: Building2, children: [
                        { href: '/hr/departments', label: 'Phòng ban', icon: Building2 },
                        { href: '/hr/positions', label: 'Chức danh', icon: BriefcaseBusiness },
                        { href: '/hr/workplaces', label: 'Nơi làm việc', icon: Building2 },
                    ]},
                    { label: 'Nhân sự', icon: Users, children: [
                        { href: '/hr/employees', label: 'Danh sách nhân viên', icon: Users },
                        { href: '/hr/contracts', label: 'Hợp đồng lao động', icon: FileText },
                        { href: '/hr/assignments', label: 'Phân công nhân sự', icon: ClipboardList },
                    ]},
                    { label: 'Lịch & nghỉ phép', icon: CalendarDays, children: [
                        { href: '/hr/shift-templates', label: 'Ca làm việc', icon: Clock3 },
                        { href: '/hr/calendar', label: 'Lịch tổ chức', icon: CalendarDays },
                        { href: '/hr/leave-requests', label: 'Áp dụng nghỉ phép', icon: FileText },
                    ]},
                    { label: 'Lương & đãi ngộ', icon: WalletCards, children: [
                        { href: '/hr/salary-profiles', label: 'Hồ sơ lương', icon: WalletCards },
                        { href: '/hr/organization-allowances', label: 'Phụ cấp', icon: WalletCards },
                        { href: '/hr/attendance-bonus-policies', label: 'Thưởng chuyên cần', icon: ClipboardCheck },
                        { href: '/hr/kpi-inputs', label: 'KPI kỳ lương', icon: Target },
                        { href: '/hr/payroll-runs', label: 'Payroll & Payslip', icon: WalletCards },
                    ]},
                    { label: 'Chính sách & bảo hiểm', icon: ShieldCheck, children: [
                        { href: '/hr/policies/labor-compliance', label: 'Tuân thủ lao động', icon: ShieldAlert },
                        { href: '/hr/policies/overtime-pay', label: 'Chính sách lương tăng ca', icon: Clock3 },
                        { href: '/hr/insurance-profiles', label: 'Hồ sơ bảo hiểm', icon: ShieldCheck },
                        { href: '/hr/policies/insurance', label: 'Chính sách bảo hiểm', icon: ShieldCheck },
                    ]},
                ],
            },
            {
                // Attendance for HR is gated on work assignments that don't exist
                // yet (TASK-024, Sprint 4) — kept out until then so the sidebar
                // matches the routes (§16.2 / AC-HR-SELF-01).
                title: 'Nhân sự',
                items: [
                    { label: 'Cá nhân của tôi', icon: UserRound, children: [
                        { href: '/app/attendance', label: 'Chấm công hôm nay', icon: Clock3 },
                        { href: '/app/leave', label: 'Nghỉ phép của tôi', icon: FileText },
                    ]},
                    { href: '/hr/periods', label: 'Chốt kỳ công', icon: ClipboardCheck },
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
            { title: 'Cá nhân', items: [{ label: 'Công việc của tôi', icon: UserRound, children: personalItems }] },
            {
                title: 'Quản lý',
                items: [
                    {
                        label: 'Phòng ban của tôi',
                        icon: Building2,
                        badge: (pendingCount && pendingCount > 0) ? (
                            <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-xs animate-pulse">
                                {pendingCount > 99 ? '99+' : pendingCount}
                            </span>
                        ) : undefined,
                        children: [
                            { href: '/manager/department', label: 'Phòng ban tổng quan', icon: Building2 },
                            { href: '/manager/leave-requests', label: 'Duyệt nghỉ phép', icon: FileText },
                        ],
                    },
                ],
            },
        ];
    }

    return [{ title: 'Cá nhân', items: [{ label: 'Công việc của tôi', icon: UserRound, children: personalItems }] }];
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
    const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());

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
    const leafItems = navGroups.flatMap(group => group.items.flatMap(item => item.children ?? [item]));
    const activeHref = leafItems
        .filter(item => item.href && (path === item.href || path.startsWith(`${item.href}/`)))
        .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0]?.href
        ?? (path === '/' || path === '/dashboard' ? '/overview' : undefined);
    useEffect(() => {
        const activeParents = navGroups.flatMap(group => group.items)
            .filter(item => item.children?.some(child => child.href === activeHref))
            .map(item => item.label);
        if (activeParents.length) setOpenMenus(previous => new Set([...previous, ...activeParents]));
    }, [activeHref, user.role]);
    const toggleMenu = (label: string) => setOpenMenus(previous => {
        const next = new Set(previous);
        if (next.has(label)) next.delete(label); else next.add(label);
        return next;
    });
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
                            if (item.children?.length) {
                                const open = openMenus.has(item.label);
                                const childActive = item.children.some(child => child.href === activeHref);
                                return <div key={item.label} className="workspace-sidebar-tree">
                                    <Tooltip content={item.label} disabled={!collapsed}>
                                        <button type="button" className="workspace-sidebar-item workspace-sidebar-parent" aria-label={item.label} aria-expanded={open} onClick={()=>toggleMenu(item.label)} data-active={childActive||undefined}>
                                            <span className="workspace-sidebar-icon relative"><item.icon size={20} aria-hidden="true"/>{item.badge&&collapsed&&<span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-red-600 animate-pulse"/>}</span>
                                            <span className="workspace-sidebar-label workspace-sidebar-item-text" aria-hidden={collapsed}><span className="truncate">{item.label}</span>{item.badge&&<span className="ml-auto flex items-center">{item.badge}</span>}<ChevronDown size={16} className={`ml-auto shrink-0 transition-transform ${open?'rotate-180':''}`} aria-hidden="true"/></span>
                                        </button>
                                    </Tooltip>
                                    <div className="workspace-sidebar-children" hidden={!open}>
                                        {item.children.map(child=>{
                                            const active=activeHref===child.href;
                                            return <Tooltip key={child.href} content={child.label} disabled={!collapsed}><AppLink href={child.href!} onClick={onNavigate} aria-label={child.label} aria-current={active?'page':undefined} className="workspace-sidebar-item workspace-sidebar-child"><span className="workspace-sidebar-icon"><child.icon size={17} aria-hidden="true"/></span><span className="workspace-sidebar-label workspace-sidebar-item-text" aria-hidden={collapsed}><span className="truncate">{child.label}</span>{child.badge}</span></AppLink></Tooltip>
                                        })}
                                    </div>
                                </div>;
                            }
                            const active = activeHref === item.href;
                            return (
                                <Tooltip key={item.href} content={item.label} disabled={!collapsed}>
                                    <AppLink
                                        href={item.href!}
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
