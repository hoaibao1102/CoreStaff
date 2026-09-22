import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../../../components/card';
import { Button } from '../../../components/button';
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_BADGE,
  CONTRACT_TYPE_LABELS,
} from '../../../lib/types';

interface ContractTableProps {
  rows: any[];
  total: number;
  current: number;
  pages: number;
  onNavigate: (page: number) => void;
  onViewDetail: (id: string) => void;
}

/** Columns: Mã NV — Họ tên — Loại hợp đồng — Ngày hiệu lực — Hết hạn — Trạng thái.
 * Expiring-soon (TASK-030) is derived on-read by the backend. */
export function ContractTable({ rows, total, current, pages, onNavigate, onViewDetail }: ContractTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <p className="text-sm text-muted-foreground">{total} hợp đồng</p>
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

        <div className="overflow-x-auto">
          <table aria-label="Danh sách hợp đồng lao động" className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b bg-muted/30">
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">Mã NV</th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">Họ tên</th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden md:table-cell">Loại hợp đồng</th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">Hiệu lực</th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">Hết hạn</th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">Trạng thái</th>
                <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">Hành động</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Không tìm thấy hợp đồng phù hợp.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row._id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.employeeCode || '—'}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{row.employeeFullName || row.employeeCode || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {(CONTRACT_TYPE_LABELS as Record<string, string>)[row.contractType] ?? row.contractType}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">{new Date(row.effectiveDate).toLocaleDateString('vi-VN')}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{row.expiryDate ? new Date(row.expiryDate).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${(CONTRACT_STATUS_BADGE as Record<string, string>)[row.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {(CONTRACT_STATUS_LABELS as Record<string, string>)[row.status]}
                      </span>
                      {!row.isExpired && row.isExpiringSoon && (
                        <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-400">
                          Sắp hết hạn ({row.expiryWarningDays} ngày)
                        </span>
                      )}
                      {row.isExpired && (
                        <span className="mt-1 block text-xs font-medium text-red-700 dark:text-red-400">
                          Quá ngày hết hạn — chưa cập nhật trạng thái
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetail(row._id)}
                        aria-label={`Xem hợp đồng ${row.employeeFullName || row.employeeCode || row._id}`}
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