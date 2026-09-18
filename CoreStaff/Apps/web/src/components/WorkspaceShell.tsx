import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, Fingerprint, Clock, User } from 'lucide-react';
import { Button } from './button';
import { Sidebar } from './Sidebar';
import { AppLink, navigationEvent } from './AppLink';
import { CoreStaffLogo } from './CoreStaffLogo';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from './sheet';
import type { AuthUser } from '@/services/auth';

interface WorkspaceShellProps {
    user: AuthUser;
    currentPath: string;
    onLogout: () => void;
    children: ReactNode;
}

const SIDEBAR_PREFERENCE_KEY = 'corestaff:sidebar-collapsed';

function readCollapsedPreference() {
    try {
        return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === 'true';
    } catch {
        return false;
    }
}

interface MobileBottomNavProps {
    currentPath: string;
}

function MobileBottomNav({ currentPath }: MobileBottomNavProps) {
    const tabs = [
        { href: '/app/attendance', label: 'Chấm công', icon: Fingerprint },
        { href: '/app/attendance/history', label: 'Lịch sử', icon: Clock },
        { href: '/app/profile', label: 'Cá nhân', icon: User },
    ];

    const path = currentPath.replace(/\/$/, '') || '/';

    return (
        <nav
            aria-label="Thanh điều hướng nhân viên"
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[64px] border-t border-slate-100 bg-white/95 backdrop-blur-md flex items-center justify-around px-4 shadow-[0_-3px_16px_rgba(0,0,0,0.05)]"
        >
            {tabs.map(({ href, label, icon: Icon }) => {
                const isActive = path === href || (href !== '/app/attendance' && path.startsWith(href));
                return (
                    <AppLink
                        key={href}
                        href={href}
                        className="flex flex-col items-center justify-center flex-1 transition-all"
                    >
                        {isActive ? (
                            <div className="flex flex-col items-center justify-center rounded-full bg-[#3ae39f] px-5 py-1.5 shadow-xs transition-transform active:scale-95">
                                <Icon className="size-5 text-slate-950 stroke-[2.5]" />
                                <span className="text-[10px] font-bold text-slate-950 mt-0.5 leading-tight">{label}</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-1 text-slate-400 hover:text-slate-600 transition-colors">
                                <Icon className="size-5" />
                                <span className="text-[10px] font-medium mt-0.5 leading-tight">{label}</span>
                            </div>
                        )}
                    </AppLink>
                );
            })}
        </nav>
    );
}

export function WorkspaceShell({ user, currentPath, onLogout, children }: WorkspaceShellProps) {
    const [collapsed, setCollapsed] = useState(readCollapsedPreference);
    const [mobileOpen, setMobileOpen] = useState(false);
    const desktopContainer = useRef<HTMLDivElement>(null);
    const isEmployee = user.role === 'EMPLOYEE';

    useEffect(() => {
        try {
            window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(collapsed));
        } catch {
            // Navigation remains usable when browser storage is unavailable.
        }
    }, [collapsed]);

    useEffect(() => { setMobileOpen(false); }, [currentPath]);

    useEffect(() => {
        const closeDrawer = () => setMobileOpen(false);
        const observer = new ResizeObserver(() => {
            if (desktopContainer.current && desktopContainer.current.getBoundingClientRect().width > 0) closeDrawer();
        });
        if (desktopContainer.current) observer.observe(desktopContainer.current);
        window.addEventListener(navigationEvent, closeDrawer);
        window.addEventListener('popstate', closeDrawer);
        return () => {
            observer.disconnect();
            window.removeEventListener(navigationEvent, closeDrawer);
            window.removeEventListener('popstate', closeDrawer);
        };
    }, []);

    return (
        <div className="workspace-shell" data-collapsed={collapsed}>
            {/* Desktop Sidebar */}
            <div ref={desktopContainer} className="workspace-sidebar-desktop">
                <Sidebar id="desktop-sidebar" user={user} currentPath={currentPath} collapsed={collapsed}
                    onToggle={() => setCollapsed(value => !value)} onLogout={onLogout} />
            </div>

            {/* Main Application Area */}
            <div className="workspace-main">
                {/* For non-employee (HR, Admin): show standard header + mobile sidebar drawer */}
                {!isEmployee ? (
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <header className="workspace-mobile-header">
                            <SheetTrigger render={<Button variant="ghost" size="icon" className="size-11 transition-colors" />} aria-label="Mở menu">
                                <Menu size={20} aria-hidden="true" />
                            </SheetTrigger>
                            <AppLink href="/overview" aria-label="CoreStaff — Tổng quan" className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
                                <CoreStaffLogo />
                            </AppLink>
                        </header>
                        <SheetContent side="left" showCloseButton={false} className="workspace-mobile-drawer">
                            <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
                            <SheetDescription className="sr-only">Điều hướng và tài khoản CoreStaff</SheetDescription>
                            <Sidebar id="mobile-sidebar" user={user} currentPath={currentPath} collapsed={false} mobile
                                onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} onLogout={onLogout} />
                        </SheetContent>
                    </Sheet>
                ) : null}

                {/* Main Content Area */}
                <main className={`min-w-0 flex-1 ${isEmployee ? 'pb-[68px] md:pb-0' : ''}`}>{children}</main>

                {/* For Employee on mobile: native-like Bottom Tab Bar */}
                {isEmployee && <MobileBottomNav currentPath={currentPath} />}
            </div>
        </div>
    );
}
