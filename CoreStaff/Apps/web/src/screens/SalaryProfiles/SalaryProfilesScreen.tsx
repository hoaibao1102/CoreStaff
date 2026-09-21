import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Building2,
    CalendarDays,
    CheckCircle2,
    FileText,
    Eye,
    ChevronLeft,
    ChevronRight,
    Hash,
    Search,
    SlidersHorizontal,
    RefreshCw,
    ShieldCheck,
    UserRound,
    WalletCards,
    X,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../../components/avatar';
import { Badge } from '../../components/badge';
import { Button } from '../../components/button';
import { Card, CardContent } from '../../components/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/dialog';
import { Input } from '../../components/input';
import { Separator } from '../../components/separator';
import { Skeleton } from '../../components/skeleton';
import { hrRequest, listEmployees, type Department, type EmployeeProfile } from '../../services/hrService';

/* ───────── Types ───────── */

interface SalaryProfileRow {
    _id: string;
    employeeId: string;
    employeeProfileId: string;
    baseSalary: number;
    insuranceSalary: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    version: number;
    active: boolean;
    currency: string;
    probationJobSalary?: number;
    probationAgreedSalary?: number;
    probationRate?: number;
    organizationAllowanceIds?: string[];
    attendanceBonusPolicyId?: string;
    // Enriched fields (client-side join)
    employeeName?: string;
    employeeCode?: string;
    departmentName?: string;
    positionName?: string;
}

type DataState = 'loading' | 'ready' | 'error' | 'empty';

/* ───────── Helpers ───────── */

const VND = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
    return VND.format(value);
}

function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    try {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
    } catch {
        return '—';
    }
}

function initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'CS';
    if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('vi');
    return (words[0][0] + words[words.length - 1][0]).toLocaleUpperCase('vi');
}

function avatarColor(_name: string): string {
    return 'bg-primary/10 text-primary';
}

/* ───────── Enrich salary profiles with employee data ───────── */

function enrichProfiles(
    profiles: Record<string, unknown>[],
    employees: Map<string, Pick<EmployeeProfile, '_id' | 'fullName' | 'employeeCode' | 'departmentName' | 'positionName'>>,
): SalaryProfileRow[] {
    return profiles.map((p) => {
        const empId = String(p.employeeProfileId ?? p.employeeId ?? '');
        const emp = employees.get(empId);
        return {
            _id: String(p._id ?? ''),
            employeeId: empId,
            employeeProfileId: empId,
            baseSalary: Number(p.baseSalary ?? 0),
            insuranceSalary: Number(p.insuranceSalary ?? 0),
            effectiveFrom: String(p.effectiveFrom ?? ''),
            effectiveTo: p.effectiveTo ? String(p.effectiveTo) : null,
            version: Number(p.version ?? 1),
            active: p.active !== false,
            currency: String(p.currency ?? 'VND'),
            probationJobSalary: p.probationJobSalary ? Number(p.probationJobSalary) : undefined,
            probationAgreedSalary: p.probationAgreedSalary ? Number(p.probationAgreedSalary) : undefined,
            probationRate: p.probationRate ? Number(p.probationRate) : undefined,
            organizationAllowanceIds: Array.isArray(p.organizationAllowanceIds) ? p.organizationAllowanceIds : [],
            attendanceBonusPolicyId: p.attendanceBonusPolicyId ? String(p.attendanceBonusPolicyId) : undefined,
            employeeName: emp?.fullName ?? 'Không rõ',
            employeeCode: emp?.employeeCode ?? '—',
            departmentName: emp?.departmentName ?? '—',
            positionName: emp?.positionName ?? '—',
        };
    });
}

/* ───────── State Banner ───────── */

function StateBanner({ kind, message, onRetry }: { kind: DataState; message?: string; onRetry?: () => void }) {
    if (kind === 'ready') return null;

    const config = {
        loading: { icon: RefreshCw, color: 'text-muted-foreground', bg: 'bg-muted/40' },
        empty: { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted/40' },
        error: { icon: X, color: 'text-destructive', bg: 'bg-destructive/10' },
    } as const;

    const { icon: Icon, color, bg } = config[kind] ?? config.empty;

    return (
        <Card className="rounded-xl border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${bg}`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{message}</p>
                {onRetry && kind === 'error' && (
                    <Button variant="outline" size="sm" onClick={onRetry}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Thử lại
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

/* ───────── Detail Dialog ───────── */

function SalaryDetailDialog({
    profile,
    open,
    onClose,
}: {
    profile: SalaryProfileRow | null;
    open: boolean;
    onClose: () => void;
}) {
    if (!profile) return null;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <WalletCards className="h-5 w-5 text-primary" />
                        Chi tiết hồ sơ lương
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Employee info */}
                    <div className="flex items-start gap-4">
                        <Avatar size="lg" className="h-14 w-14 shrink-0">
                            <AvatarFallback className={`${avatarColor(profile.employeeName ?? '')} text-base font-semibold`}>
                                {initials(profile.employeeName ?? '?')}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold truncate">{profile.employeeName}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Hash className="h-3.5 w-3.5" />
                                    {profile.employeeCode}
                                </span>
                                {profile.departmentName && profile.departmentName !== '—' && (
                                    <span className="flex items-center gap-1.5">
                                        <Building2 className="h-3.5 w-3.5" />
                                        {profile.departmentName}
                                    </span>
                                )}
                            </div>
                        </div>
                        <Badge variant={profile.active ? 'default' : 'secondary'} className="shrink-0">
                            {profile.active ? 'Đang hoạt động' : 'Không hoạt động'}
                        </Badge>
                    </div>

                    <Separator />

                    {/* Salary info */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-card p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lương cơ bản</p>
                            <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(profile.baseSalary)}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lương đóng bảo hiểm</p>
                            <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(profile.insuranceSalary)}</p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-foreground">Thông tin chi tiết</h4>
                        <div className="divide-y divide-border rounded-lg border border-border">
                            {[
                                { label: 'Hiệu lực từ', value: formatDate(profile.effectiveFrom) },
                                { label: 'Hiệu lực đến', value: profile.effectiveTo ? formatDate(profile.effectiveTo) : 'Hiện tại' },
                                { label: 'Tiền tệ', value: profile.currency },
                                ...(profile.positionName && profile.positionName !== '—'
                                    ? [{ label: 'Chức danh', value: profile.positionName }]
                                    : []),
                                ...(profile.probationJobSalary
                                    ? [{ label: 'Lương thử việc', value: formatCurrency(profile.probationJobSalary) }]
                                    : []),
                                ...(profile.probationAgreedSalary
                                    ? [{ label: 'Lương thỏa thuận thử việc', value: formatCurrency(profile.probationAgreedSalary) }]
                                    : []),
                                ...(profile.probationRate
                                    ? [{ label: 'Tỷ lệ thử việc', value: `${Math.round(profile.probationRate * 100)}%` }]
                                    : []),
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
                                    <span className="text-muted-foreground">{label}</span>
                                    <span className="font-medium text-foreground">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Version history note */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-800">
                        <div className="flex items-start gap-2">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p>Lịch sử thay đổi lương được lưu theo phiên bản. Mỗi lần cập nhật, hệ thống sẽ tự động tăng số phiên bản.</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ───────── Main Screen ───────── */

export function SalaryProfilesScreen({ apiBase }: { apiBase: string | null }) {
    /* Data state */
    const [dataState, setDataState] = useState<DataState>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    /* Core data */
    const [profiles, setProfiles] = useState<SalaryProfileRow[]>([]);
    const [employees, setEmployees] = useState<Map<string, Pick<EmployeeProfile, '_id' | 'fullName' | 'employeeCode' | 'departmentName' | 'positionName'>>>(new Map());
    const [departments, setDepartments] = useState<Department[]>([]);

    /* Filters */
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [page, setPage] = useState(1);

    useEffect(() => { setPage(1); }, [searchQuery, departmentFilter, activeFilter]);

    /* Dialog */
    const [selectedProfile, setSelectedProfile] = useState<SalaryProfileRow | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    /* Load data */
    const loadData = useCallback(async () => {
        if (!apiBase) {
            setDataState('error');
            setErrorMessage('Chưa kết nối được API.');
            return;
        }

        setDataState('loading');
        setErrorMessage(null);

        try {
            const [rawProfiles, empList, deptList] = await Promise.allSettled([
                hrRequest<Record<string, unknown>[]>(apiBase, '/api/hr/salary-profiles'),
                listEmployees(apiBase, '', ''),
                hrRequest<Department[]>(apiBase, '/api/hr/departments?active=true'),
            ]);

            let employeeMap = new Map<string, Pick<EmployeeProfile, '_id' | 'fullName' | 'employeeCode' | 'departmentName' | 'positionName'>>();

            /* Employees */
            if (empList.status === 'fulfilled') {
                employeeMap = new Map<string, Pick<EmployeeProfile, '_id' | 'fullName' | 'employeeCode' | 'departmentName' | 'positionName'>>();
                for (const emp of empList.value) {
                    employeeMap.set(emp._id, {
                        _id: emp._id,
                        fullName: emp.fullName ?? 'Không rõ',
                        employeeCode: emp.employeeCode ?? '—',
                        departmentName: emp.departmentName ?? undefined,
                        positionName: emp.positionName ?? undefined,
                    });
                }
                setEmployees(employeeMap);
            }

            /* Salary profiles: join employee, department and position display names. */
            if (rawProfiles.status === 'fulfilled') {
                setProfiles(enrichProfiles(rawProfiles.value, employeeMap));
            } else {
                setErrorMessage(`Không thể tải hồ sơ lương: ${rawProfiles.reason?.message ?? 'Lỗi không xác định'}`);
                setDataState('error');
                return;
            }

            /* Departments */
            if (deptList.status === 'fulfilled') {
                setDepartments(deptList.value);
            }

            setDataState(rawProfiles.value.length > 0 ? 'ready' : 'empty');
        } catch (e) {
            setErrorMessage(e instanceof Error ? e.message : 'Lỗi không xác định');
            setDataState('error');
        }
    }, [apiBase]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    /* Filtered & searched profiles */
    const filteredProfiles = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return profiles.filter((p) => {
            /* Department filter */
            if (departmentFilter && p.departmentName !== departmentFilter) return false;

            /* Active filter */
            if (activeFilter === 'active' && !p.active) return false;
            if (activeFilter === 'inactive' && p.active) return false;

            /* Search query */
            if (q) {
                const matchName = (p.employeeName ?? '').toLowerCase().includes(q);
                const matchCode = (p.employeeCode ?? '').toLowerCase().includes(q);
                if (!matchName && !matchCode) return false;
            }

            return true;
        });
    }, [profiles, searchQuery, departmentFilter, activeFilter]);

    /* Unique departments from employee data */
    const uniqueDepartments = useMemo(() => {
        const depts = new Set<string>();
        for (const emp of employees.values()) {
            if (emp.departmentName && emp.departmentName !== '—') {
                depts.add(emp.departmentName);
            }
        }
        return Array.from(depts).sort();
    }, [employees]);

    /* Stats */
    const stats = useMemo(() => {
        const total = profiles.length;
        const active = profiles.filter((p) => p.active).length;
        const employeesCount = new Set(profiles.map((p) => p.employeeId)).size;
        const avgSalary = active > 0
            ? profiles.reduce((sum, p) => sum + p.baseSalary, 0) / active
            : 0;
        return { total, active, employeesCount, avgSalary };
    }, [profiles]);

    /* Handlers */
    const pages = Math.max(1, Math.ceil(filteredProfiles.length / 10));
    const current = Math.min(page, pages);
    const visibleProfiles = filteredProfiles.slice((current - 1) * 10, current * 10);

    const handleViewDetail = (profile: SalaryProfileRow) => {
        setSelectedProfile(profile);
        setDetailOpen(true);
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setDepartmentFilter('');
        setActiveFilter('all');
    };

    /* No API */
    if (!apiBase) {
        return (
            <StateBanner
                kind="error"
                message="Chưa kết nối được API. Vui lòng kiểm tra cấu hình kết nối."
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                        Hồ sơ lương
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Quản lý mức lương, lương đóng bảo hiểm và lịch sử thay đổi lương của nhân viên.
                    </p>
                </div>
            </div>

            {/* Stats cards */}
            {dataState === 'loading' ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Tổng hồ sơ" value={stats.total.toString()} icon={FileText} />
                    <StatCard label="Đang hoạt động" value={stats.active.toString()} icon={CheckCircle2} tone="text-foreground" />
                    <StatCard label="Nhân viên có hồ sơ" value={stats.employeesCount.toString()} icon={UserRound} />
                    <StatCard label="Lương cơ bản TB" value={formatCurrency(stats.avgSalary)} icon={WalletCards} />
                </div>
            )}

            {/* Filters — same layout and controls as Employee Directory. */}
            <Card>
                <CardContent className="space-y-4 p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                            <h2 className="text-base font-semibold">Bộ lọc</h2>
                        </div>
                        {(searchQuery || departmentFilter || activeFilter !== 'all') && (
                            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                                <X className="mr-1.5 h-3.5 w-3.5" />Xóa bộ lọc
                            </Button>
                        )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
                        <div className="space-y-1.5">
                            <label htmlFor="salary-search" className="text-xs font-medium text-muted-foreground">Tìm nhân viên</label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input id="salary-search" className="h-10 pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Họ tên hoặc mã nhân viên" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="salary-department" className="text-xs font-medium text-muted-foreground">Phòng ban</label>
                            <select id="salary-department" className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                                <option value="">Tất cả phòng ban</option>
                                {uniqueDepartments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="salary-status" className="text-xs font-medium text-muted-foreground">Trạng thái</label>
                            <select id="salary-status" className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                                <option value="all">Tất cả trạng thái</option>
                                <option value="active">Đang hoạt động</option>
                                <option value="inactive">Không hoạt động</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            {dataState === 'loading' ? (
                <LoadingTable />
            ) : dataState === 'error' ? (
                <StateBanner kind={dataState} message={errorMessage ?? 'Lỗi không xác định'} onRetry={loadData} />
            ) : dataState === 'empty' ? (
                <StateBanner kind="empty" message="Chưa có hồ sơ lương nào." />
            ) : filteredProfiles.length === 0 ? (
                <StateBanner kind="empty" message="Không tìm thấy hồ sơ lương nào khớp với bộ lọc." />
            ) : (
                <Card className="overflow-hidden gap-0 py-0">
                    <div className="overflow-x-auto">
                        <table aria-label="Hồ sơ lương" className="w-full caption-bottom text-sm">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mã NV</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Họ tên</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Phòng ban</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Chức danh</th>
                                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Lương cơ bản</th>
                                    <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Lương BH</th>
                                    <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden md:table-cell">Hiệu lực</th>
                                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {visibleProfiles.map((profile) => (
                                    <tr
                                        key={profile._id}
                                        className="hover:bg-muted/50 transition-colors"
                                    >
                                        {/* Employee */}
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                                            {profile.employeeCode}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            {profile.employeeName}
                                        </td>

                                        {/* Department */}
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            {profile.departmentName ?? '—'}
                                        </td>

                                        {/* Position */}
                                        <td className="px-4 py-3 hidden lg:table-cell">
                                            <span className="text-foreground">{profile.positionName ?? '—'}</span>
                                        </td>

                                        {/* Base salary */}
                                        <td className="px-4 py-3 text-right">
                                            <span className="whitespace-nowrap tabular-nums text-foreground">{formatCurrency(profile.baseSalary)}</span>
                                        </td>

                                        {/* Insurance salary */}
                                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                                            <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatCurrency(profile.insuranceSalary)}</span>
                                        </td>

                                        {/* Effective date */}
                                        <td className="px-4 py-3 text-center hidden md:table-cell">
                                            <span className="whitespace-nowrap text-muted-foreground">
                                                {formatDate(profile.effectiveFrom)}
                                            </span>
                                        </td>


                                        {/* Actions */}
                                        <td className="px-4 py-3 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleViewDetail(profile)}
                                                aria-label={`Xem hồ sơ lương ${profile.employeeName ?? profile.employeeCode}`}
                                                title="Xem chi tiết"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-4 sm:px-6">
                        <p className="text-sm text-muted-foreground" role="status">{(current - 1) * 10 + 1}–{Math.min(current * 10, filteredProfiles.length)} / {filteredProfiles.length} hồ sơ</p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="min-h-11 min-w-11" aria-label="Trang trước" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden="true" /></Button>
                            <span className="text-sm">{current} / {pages}</span>
                            <Button variant="outline" className="min-h-11 min-w-11" aria-label="Trang sau" disabled={current === pages} onClick={() => setPage(current + 1)}><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Detail dialog */}
            <SalaryDetailDialog
                profile={selectedProfile}
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
            />
        </div>
    );
}

/* ───────── Sub-components ───────── */

function StatCard({
    label,
    value,
    icon: Icon,
    tone,
}: {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    tone?: string;
}) {
    return (
        <Card size="sm">
            <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
                <div>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone ?? 'text-foreground'}`}>{value}</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
            </CardContent>
        </Card>
    );
}

function LoadingTable() {
    return (
        <Card className="overflow-hidden gap-0 py-0">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="px-4 py-3 text-left font-semibold"><Skeleton className="h-4 w-24" /></th>
                            <th className="px-4 py-3 text-left font-semibold hidden md:table-cell"><Skeleton className="h-4 w-20" /></th>
                            <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell"><Skeleton className="h-4 w-20" /></th>
                            <th className="px-4 py-3 text-right font-semibold"><Skeleton className="h-4 w-20 ml-auto" /></th>
                            <th className="px-4 py-3 text-right font-semibold hidden sm:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></th>
                            <th className="px-4 py-3 text-center font-semibold hidden md:table-cell"><Skeleton className="h-4 w-16 mx-auto" /></th>
                            <th className="px-4 py-3 text-center font-semibold"><Skeleton className="h-4 w-8 mx-auto" /></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}>
                                <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-16" /></div></div></td>
                                <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-24" /></td>
                                <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-28" /></td>
                                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                <td className="px-4 py-3 text-right hidden sm:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                <td className="px-4 py-3 text-center hidden md:table-cell"><Skeleton className="h-4 w-16 mx-auto" /></td>
                                <td className="px-4 py-3 text-center"><Skeleton className="h-8 w-8 rounded-md mx-auto" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
