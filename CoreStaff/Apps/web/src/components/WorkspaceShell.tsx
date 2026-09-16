import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
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

export function WorkspaceShell({ user, currentPath, onLogout, children }: WorkspaceShellProps) {
    const [collapsed, setCollapsed] = useState(readCollapsedPreference);
    const [mobileOpen, setMobileOpen] = useState(false);
    const desktopContainer = useRef<HTMLDivElement>(null);

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
        // Observe the CSS breakpoint itself, keeping responsive behavior in one place.
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
            <div ref={desktopContainer} className="workspace-sidebar-desktop">
                <Sidebar id="desktop-sidebar" user={user} currentPath={currentPath} collapsed={collapsed}
                    onToggle={() => setCollapsed(value => !value)} onLogout={onLogout} />
            </div>
            <div className="workspace-main">
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
                <main className="min-w-0 flex-1">{children}</main>
            </div>
        </div>
    );
}
