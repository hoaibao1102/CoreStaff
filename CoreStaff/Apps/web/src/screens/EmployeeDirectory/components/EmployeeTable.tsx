import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../../../components/card';
import { Button } from '../../../components/button';
import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_STATUS_BADGE } from '../../../lib/types';

interface EmployeeTableProps {
    rows: any[];
    total: number;
    current: number;
    pages: number;
    onNavigate: (page: number) => void;
    onViewDetail: (id: string) => void;
}

export function EmployeeTable({ rows, total, current, pages, onNavigate, onViewDetail }: EmployeeTableProps) {
    return (
        <Card>
            <CardContent className="p-0">
                {/* Header bar */}
                <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
                    <p className="text-sm text-muted-foreground">{total} nhân viên</p>
                    {/* Pagination */}
                    {pages > 1 && (
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="icon-sm"
                                disabled={current <= 1}
                                aria-label="Trang trước"
                                onClick={() => onNavigate(current - 1)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="min-w-[3rem] text-center text-sm text-muted-foreground">
                                {current} / {pages}
                            </span>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                disabled={current >= pages}
                                aria-label="Trang sau"
                                onClick={() => onNavigate(current + 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table aria-label="Danh bạ nhân viên" className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b bg-muted/30">
                                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-4">
                                    Mã NV
                                </th>
                                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">
                                    Họ tên
                                </th>
                                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden md:table-cell">
                                    Email
                                </th>
                                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">
                                    Phòng ban
                                </th>
                                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">
                                    Chức danh
                                </th>
                                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">
                                    Trạng thái
                                </th>
                                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">
                                    Hành động
                                </th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                                        Không tìm thấy nhân viên phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr key={row._id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                            {row.employeeCode}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            {row.fullName || 'Chưa có thông tin'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                                            {row.email || '—'}
                                        </td>
                                        <td className="px-4 py-3 hidden lg:table-cell">
                                            {row.departmentName || '—'}
                                        </td>
                                        <td className="px-4 py-3 hidden lg:table-cell">
                                            {row.positionName || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${(EMPLOYMENT_STATUS_BADGE as Record<string, string>)[row.employmentStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                                                {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[row.employmentStatus]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onViewDetail(row._id)}
                                                aria-label={`Xem hồ sơ ${row.fullName || row.employeeCode}`}
                                                title="Xem chi tiết"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
