import { useCallback } from 'react';
import { Building2, Plus, ShieldCheck } from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { Card, CardContent } from '../../components/card';
import { Button } from '../../components/button';
import { Badge } from '../../components/badge';
import { Skeleton } from '../../components/skeleton';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { useHrResource } from '../../lib/useHrResource';
import { hrErrorMessage } from '../../services/hrService';
import {
    listOrganizations,
    setOrganizationStatus,
    platformErrorMessage,
    type Organization,
} from '../../services/platformService';
import { toast } from '../../components/toast';
import { OrganizationCreateDialog } from './OrganizationCreateDialog';
import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/table';

const STATUS_LABEL: Record<Organization['status'], string> = {
    ACTIVE: 'Đang hoạt động',
    SUSPENDED: 'Đã tạm ngưng',
};

function formatDate(value?: string): string {
    if (!value || Number.isNaN(Date.parse(value))) return '—';
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

export function PlatformOrganizationsScreen({ user, apiBase }: { user: AuthUser; apiBase: string | null }) {
    const allowed = user.role === 'SYSTEM_ADMIN';
    const [createOpen, setCreateOpen] = useState(false);
    const [suspending, setSuspending] = useState<string | null>(null);

    const loader = useCallback(async () => listOrganizations(apiBase!), [apiBase]);
    const resource = useHrResource(allowed && apiBase ? loader : null);
    const organizations = resource.data ?? [];

    const toggleStatus = useCallback(async (org: Organization) => {
        if (!apiBase || suspending) return;
        setSuspending(org._id);
        try {
            const next = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
            await setOrganizationStatus(apiBase, org._id, next);
            toast.success(
                next === 'SUSPENDED' ? 'Đã tạm ngưng tổ chức' : 'Đã kích hoạt lại tổ chức',
                next === 'SUSPENDED'
                    ? 'Mọi phiên đăng nhập của tổ chức này sẽ bị chấm dứt (AC-SYS-02).'
                    : 'Nhân viên của tổ chức có thể đăng nhập lại bình thường.',
            );
            resource.retry();
        } catch (err) {
            toast.error('Không thể đổi trạng thái', platformErrorMessage(err));
        } finally {
            setSuspending(null);
        }
    }, [apiBase, suspending, resource]);

    if (!allowed) return <EmployeeDataState status="forbidden" />;
    if (!apiBase) return <EmployeeDataState status="unavailable" />;

    const error = resource.error ? hrErrorMessage(resource.error) : null;

    if (error && !resource.loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Organizations</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Quản lý các tổ chức và HR đầu tiên trên nền tảng.
                    </p>
                </div>
                <EmployeeDataState status="error" message={error} onRetry={resource.retry} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Organizations</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Tạo tổ chức và tài khoản HR đầu tiên, theo dõi trạng thái tenant.
                    </p>
                </div>
                <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Tạo tổ chức
                </Button>
            </div>

            {resource.loading ? (
                <Card>
                    <CardContent className="space-y-3 p-4" role="status" aria-label="Đang tải danh sách tổ chức">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
                    </CardContent>
                </Card>
            ) : organizations.length === 0 ? (
                <EmployeeDataState status="empty" description="Chưa có tổ chức nào. Tạo tổ chức đầu tiên để bắt đầu." />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table aria-label="Danh sách tổ chức">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mã</TableHead>
                                    <TableHead>Tên</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>Múi giờ</TableHead>
                                    <TableHead>Ngày tạo</TableHead>
                                    <TableHead className="text-right">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {organizations.map(org => (
                                    <TableRow key={org._id}>
                                        <TableCell className="font-medium">
                                            <span className="inline-flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                                <code>{org.code}</code>
                                            </span>
                                        </TableCell>
                                        <TableCell>{org.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={org.status === 'ACTIVE' ? 'default' : 'destructive'}>
                                                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                                                {STATUS_LABEL[org.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{org.timezone ?? '—'}</TableCell>
                                        <TableCell>{formatDate(org.createdAt)}</TableCell>
                                        <TableCell className="text-right">
                                            {org.status === 'ACTIVE' ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="min-h-9"
                                                    disabled={suspending !== null}
                                                    onClick={() => void toggleStatus(org)}
                                                >
                                                    {suspending === org._id ? 'Đang xử lý…' : 'Tạm ngưng'}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    className="min-h-9"
                                                    disabled={suspending !== null}
                                                    onClick={() => void toggleStatus(org)}
                                                >
                                                    {suspending === org._id ? 'Đang xử lý…' : 'Kích hoạt lại'}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <OrganizationCreateDialog
                apiBase={apiBase}
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={resource.retry}
            />
        </div>
    );
}