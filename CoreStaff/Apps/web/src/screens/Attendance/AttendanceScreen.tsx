import { useState, useEffect } from 'react';
import {
    Building2,
    Clock,
    Camera,
    Wifi,
    Radar,
    AlertTriangle,
    ChevronLeft,
    CheckCircle2,
    XCircle,
    CalendarDays,
    User,
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { Card, CardContent } from '../../components/card';
import { Button } from '../../components/button';
import { Badge } from '../../components/badge';
import { AppLink } from '../../components/AppLink';
import { Avatar, AvatarFallback } from '../../components/avatar';

/* ───────── Types ───────── */
export type AttendanceStatus =
    | 'NOT_CHECKED_IN'
    | 'CHECKED_IN'
    | 'COMPLETED'
    | 'LATE'
    | 'EARLY_LEAVE'
    | 'LOCKED'
    | 'HOLIDAY';

export type MethodType = 'NETWORK' | 'GPS' | 'SELFIE';

export interface AttendanceEvent {
    time: string;
    method: MethodType;
    workplace: string;
    address: string;
    accuracy?: number;
}

export interface DayAttendance {
    id: string;
    date: string;
    shiftName: string;
    shiftHours: string;
    workplace: string;
    workplaceAddress: string;
    status: AttendanceStatus;
    checkIn?: AttendanceEvent;
    checkOut?: AttendanceEvent;
    totalWorkingMinutes?: number;
}

export interface AttendanceState {
    todayRecord: DayAttendance;
    isSubmitting: boolean;
    lastError: { code: string; message: string } | null;
    method: MethodType;
    workMode: 'IN_OFFICE' | 'OUT_OFFICE';
}

/* ───────── Mock Data ───────── */
const MOCK_TODAY: DayAttendance = {
    id: 'att-today',
    date: new Date().toISOString().split('T')[0],
    shiftName: 'Ca hành chính',
    shiftHours: '08:00 – 17:00',
    workplace: 'Văn phòng TVS Quận 8',
    workplaceAddress: '123 đường mẫu, Quận 8, TP.HCM',
    status: 'NOT_CHECKED_IN',
};

/* ───────── Helpers ───────── */
function getStatusConfig(status: AttendanceStatus) {
    const map: Record<AttendanceStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
        NOT_CHECKED_IN: { label: 'Chưa chấm công', color: 'bg-slate-100 text-slate-600', icon: XCircle },
        CHECKED_IN: { label: 'Đã vào ca', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
        COMPLETED: { label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
        LATE: { label: 'Vào muộn', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
        EARLY_LEAVE: { label: 'Về sớm', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
        LOCKED: { label: 'Đã khóa', color: 'bg-red-100 text-red-700', icon: XCircle },
        HOLIDAY: { label: 'Nghỉ lễ', color: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
    };
    return map[status];
}

function getMethodIcon(method: MethodType) {
    const map: Record<MethodType, typeof Wifi> = {
        NETWORK: Wifi,
        GPS: Radar,
        SELFIE: Camera,
    };
    return map[method];
}

function getMethodLabel(method: MethodType): string {
    const map: Record<MethodType, string> = {
        NETWORK: 'Xác thực mạng WiFi',
        GPS: 'Xác thực GPS',
        SELFIE: 'Xác thực Selfie',
    };
    return map[method];
}

function formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} giờ ${m} phút`;
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(-2)
        .map((n) => n.charAt(0).toUpperCase())
        .join('');
}

/* ───────── Server Clock ───────── */
function ServerClock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
    );
}

/* ───────── Header ───────── */
interface EmployeeAppBarProps {
    userName: string;
    employeeCode: string;
    department: string;
}

function EmployeeAppBar({ userName, employeeCode, department }: EmployeeAppBarProps) {
    return (
        <header className="border-b bg-card">
            <div className="px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarFallback className="bg-primary text-primary-foreground">
                                {getInitials(userName)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-sm font-bold text-foreground tracking-tight">Chấm công</h1>
                            <p className="text-xs text-muted-foreground">TimeLock • Attendance v1.0</p>
                        </div>
                    </div>
                    <ServerClock />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Xin chào, <strong className="text-foreground">{userName}</strong></span>
                    <span>•</span>
                    <span>{employeeCode}</span>
                    <span>•</span>
                    <span>{department}</span>
                </div>
            </div>
        </header>
    );
}

/* ───────── Shift Card ───────── */
interface ShiftCardProps {
    shiftName: string;
    shiftHours: string;
    workplace: string;
    workplaceAddress: string;
}

function ShiftCard({ shiftName, shiftHours, workplace, workplaceAddress }: ShiftCardProps) {
    return (
        <Card>
            <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                        <Clock className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 space-y-2">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Ca làm việc</p>
                            <p className="text-sm font-semibold text-foreground">{shiftName}</p>
                            <p className="text-sm text-muted-foreground">{shiftHours}</p>
                        </div>
                        <div className="flex items-start gap-1.5">
                            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Nơi làm việc</p>
                                <p className="text-sm text-foreground">{workplace}</p>
                                <p className="text-xs text-muted-foreground">{workplaceAddress}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/* ───────── Status Card ───────── */
interface StatusCardProps {
    status: AttendanceStatus;
    checkInTime?: string;
    checkOutTime?: string;
    totalMinutes?: number;
}

function StatusCard({ status, checkInTime, checkOutTime, totalMinutes }: StatusCardProps) {
    const config = getStatusConfig(status);
    const Icon = config.icon;

    return (
        <Card>
            <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Trạng thái hôm nay</p>
                        <div className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${config.color.replace('bg-', 'text-').replace('/10', '')}`} />
                            <p className="text-base font-semibold text-foreground">{config.label}</p>
                        </div>
                        {(checkInTime || checkOutTime) && (
                            <dl className="grid grid-cols-2 gap-4 pt-2">
                                {checkInTime && (
                                    <>
                                        <dt className="text-xs text-muted-foreground">Vào ca</dt>
                                        <dd className="font-mono text-sm font-medium text-foreground">{checkInTime}</dd>
                                    </>
                                )}
                                {checkOutTime && (
                                    <>
                                        <dt className="text-xs text-muted-foreground">Ra ca</dt>
                                        <dd className="font-mono text-sm font-medium text-foreground">{checkOutTime}</dd>
                                    </>
                                )}
                            </dl>
                        )}
                        {totalMinutes !== undefined && (
                            <p className="pt-1 text-sm text-muted-foreground">
                                Tổng cộng: <strong className="text-foreground">{formatMinutes(totalMinutes)}</strong>
                            </p>
                        )}
                    </div>
                    <Badge variant={status === 'COMPLETED' ? 'default' : status === 'NOT_CHECKED_IN' ? 'outline' : 'secondary'}>
                        {config.label}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}

/* ───────── Method Card ───────── */
interface MethodCardProps {
    method: MethodType;
    workMode: 'IN_OFFICE' | 'OUT_OFFICE';
}

function MethodCard({ method, workMode }: MethodCardProps) {
    const Icon = getMethodIcon(method);
    const isOffice = workMode === 'IN_OFFICE';

    return (
        <Card>
            <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary-fixed-dim p-2.5 text-on-primary-fixed bg-primary/20 text-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                            {isOffice ? 'Tại văn phòng' : 'Làm ngoài văn phòng'}
                        </p>
                        <p className="text-xs text-muted-foreground">{getMethodLabel(method)}</p>
                    </div>
                    {method === 'GPS' && (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            GPS hợp lệ · ±16m
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/* ───────── Timeline ───────── */
interface TimelineProps {
    checkIn?: AttendanceEvent;
    checkOut?: AttendanceEvent;
}

function AttendanceTimeline({ checkIn, checkOut }: TimelineProps) {
    const events = [
        { label: 'Vào ca', event: checkIn, side: 'left' as const },
        { label: 'Ra ca', event: checkOut, side: 'right' as const },
    ];

    return (
        <Card>
            <CardContent className="p-4 sm:p-5">
                <p className="mb-4 text-sm font-semibold text-foreground">Lịch sử hôm nay</p>
                <div className="relative space-y-0">
                    {/* Vertical line */}
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border hidden sm:block" />

                    {events.map(({ label, event, side }) => (
                        <div key={label} className={`relative flex items-center gap-4 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
                            {/* Dot */}
                            <div className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${event ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-muted text-muted-foreground'} hidden sm:flex`}>
                                {event ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </div>

                            {/* Content */}
                            <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{label}</p>
                                {event ? (
                                    <div className="mt-1 space-y-0.5">
                                        <p className="font-mono text-sm text-muted-foreground">{event.time}</p>
                                        <p className="text-xs text-muted-foreground">{getMethodLabel(event.method)}</p>
                                        {event.accuracy && <p className="text-xs text-muted-foreground">±{event.accuracy}m</p>}
                                    </div>
                                ) : (
                                    <p className="mt-1 text-xs italic text-muted-foreground/60">Chưa có</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/* ───────── Action Button ───────── */
interface ActionButtonProps {
    actionType: 'CHECK_IN' | 'CHECK_OUT';
    isEnabled: boolean;
    isLoading: boolean;
    method: MethodType;
    onClick: () => void;
}

function ActionButton({ actionType, isEnabled, isLoading, method, onClick }: ActionButtonProps) {
    const isCheckIn = actionType === 'CHECK_IN';
    const Icon = getMethodIcon(method);

    return (
        <div className="space-y-2">
            {!isEnabled && !isLoading && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50/50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Hôm nay bạn đã hoàn thành chấm công.</span>
                </div>
            )}

            <Button
                className={`w-full h-12 text-base font-bold transition-all ${isEnabled && !isLoading
                    ? 'bg-primary hover:bg-primary/80 text-primary-foreground shadow-md'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                disabled={!isEnabled || isLoading}
                onClick={onClick}
            >
                {isLoading ? (
                    <>
                        <Clock className="h-5 w-5 animate-spin" />
                        <span>{isCheckIn ? 'Đang ghi nhận VÀO CA...' : 'Đang ghi nhận RA CA...'}</span>
                    </>
                ) : (
                    <>
                        <Icon className="h-5 w-5" />
                        <span>{isCheckIn ? 'VÀO CA' : 'RA CA'}</span>
                    </>
                )}
            </Button>
        </div>
    );
}

/* ───────── Bottom Navigation ───────── */
type Tab = 'TODAY' | 'HISTORY' | 'PROFILE';

interface BottomNavProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
}

function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    const tabs: { id: Tab; label: string; icon: typeof Clock }[] = [
        { id: 'TODAY', label: 'Hôm nay', icon: Clock },
        { id: 'HISTORY', label: 'Lịch sử', icon: CalendarDays },
        { id: 'PROFILE', label: 'Hồ sơ', icon: User },
    ];

    return (
        <nav className="sticky bottom-0 border-t bg-card" role="tablist" aria-label="Điều hướng chấm công">
            <div className="flex">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        role="tab"
                        aria-selected={activeTab === id}
                        className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${activeTab === id
                            ? 'border-b-2 border-primary text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                        onClick={() => onTabChange(id)}
                    >
                        <Icon className="h-5 w-5" />
                        <span>{label}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
}

/* ───────── Main Screen ───────── */
export function AttendanceScreen({ user }: { user: AuthUser }) {
    const [state, setState] = useState<AttendanceState>({
        todayRecord: MOCK_TODAY,
        isSubmitting: false,
        lastError: null,
        method: 'NETWORK',
        workMode: 'IN_OFFICE',
    });
    const [tab, setTab] = useState<Tab>('TODAY');

    const isCheckIn = state.todayRecord.status === 'NOT_CHECKED_IN';
    const completed = state.todayRecord.status === 'COMPLETED';

    const handleAction = async () => {
        if (state.isSubmitting || completed) return;
        setState((prev) => ({ ...prev, isSubmitting: true, lastError: null }));

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));

        if (isCheckIn) {
            setState((prev) => ({
                ...prev,
                todayRecord: {
                    ...prev.todayRecord,
                    status: 'CHECKED_IN',
                    checkIn: {
                        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                        method: prev.method,
                        workplace: prev.todayRecord.workplace,
                        address: prev.todayRecord.workplaceAddress,
                        accuracy: 16,
                    },
                },
                isSubmitting: false,
            }));
        } else {
            setState((prev) => ({
                ...prev,
                todayRecord: {
                    ...prev.todayRecord,
                    status: 'COMPLETED',
                    checkOut: {
                        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                        method: prev.method,
                        workplace: prev.todayRecord.workplace,
                        address: prev.todayRecord.workplaceAddress,
                        accuracy: 12,
                    },
                    totalWorkingMinutes: 480,
                },
                isSubmitting: false,
            }));
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-background">
            {/* App Bar */}
            <EmployeeAppBar
                userName={user.fullName}
                employeeCode={user.employeeCode || '—'}
                department={user.role === 'HR' ? 'Nhân sự' : user.role === 'DEPARTMENT_MANAGER' ? 'Quản lý' : 'Nhân viên'}
            />

            {/* Back link */}
            <div className="px-4 py-2 sm:px-6">
                <AppLink href="/" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <ChevronLeft className="h-4 w-4" />
                    Tổng quan
                </AppLink>
            </div>

            {/* Content */}
            <main className="flex-1 space-y-4 px-4 pb-20 pt-2 sm:px-6 sm:pb-24">
                {tab === 'TODAY' && (
                    <>
                        <ShiftCard
                            shiftName={state.todayRecord.shiftName}
                            shiftHours={state.todayRecord.shiftHours}
                            workplace={state.todayRecord.workplace}
                            workplaceAddress={state.todayRecord.workplaceAddress}
                        />

                        <StatusCard
                            status={state.todayRecord.status}
                            checkInTime={state.todayRecord.checkIn?.time}
                            checkOutTime={state.todayRecord.checkOut?.time}
                            totalMinutes={state.todayRecord.totalWorkingMinutes}
                        />

                        <MethodCard method={state.method} workMode={state.workMode} />

                        <AttendanceTimeline
                            checkIn={state.todayRecord.checkIn}
                            checkOut={state.todayRecord.checkOut}
                        />

                        {/* Error display */}
                        {state.lastError && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                    <strong>{state.lastError.code}</strong>
                                    <p className="mt-0.5">{state.lastError.message}</p>
                                </div>
                            </div>
                        )}

                        {/* Action button */}
                        {!completed && (
                            <ActionButton
                                actionType={isCheckIn ? 'CHECK_IN' : 'CHECK_OUT'}
                                isEnabled={!completed}
                                isLoading={state.isSubmitting}
                                method={state.method}
                                onClick={handleAction}
                            />
                        )}

                        {completed && (
                            <div className="rounded-lg bg-emerald-50 px-4 py-4 text-center text-sm font-semibold text-emerald-700 border border-emerald-200">
                                ✅ Đã hoàn thành ngày công hôm nay
                            </div>
                        )}
                    </>
                )}

                {tab === 'HISTORY' && (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-3 text-sm text-muted-foreground">Lịch sử chấm công sẽ hiển thị ở đây.</p>
                        </CardContent>
                    </Card>
                )}

                {tab === 'PROFILE' && (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-3 text-sm text-muted-foreground">Thông tin hồ sơ cá nhân.</p>
                        </CardContent>
                    </Card>
                )}
            </main>

            {/* Bottom Nav */}
            <BottomNav activeTab={tab} onTabChange={setTab} />
        </div>
    );
}
