import { useEffect, useMemo, useState } from 'react';
import { Eye, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Wallet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/dropdown-menu';
import { listSalaryProfiles, type SalaryProfile } from '@/services/compensation.service';
import { hrErrorMessage } from '@/services/hrService';
import { SalaryProfileCreateDialog, SalaryProfileDetailDialog, SalaryProfileEditDialog } from './SalaryProfileDialogs';

function formatVnd(val?: number): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

function formatDate(iso?: string | null): string {
  if (!iso) return 'Vô hạn';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
}

export function SalaryProfilesScreen({ apiBase, canManage = true }: { apiBase: string | null; canManage?: boolean }) {
  const [rows, setRows] = useState<SalaryProfile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<SalaryProfile | null>(null);
  const [editItem, setEditItem] = useState<SalaryProfile | null>(null);

  useEffect(() => {
    if (!apiBase) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listSalaryProfiles(apiBase)
      .then(data => { if (!cancelled) setRows(data); })
      .catch(err => { if (!cancelled) setError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, revision]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('vi');
    if (!term) return rows;
    return rows.filter(row =>
      `${row.employeeCode ?? ''} ${row.employeeFullName ?? ''}`.toLocaleLowerCase('vi').includes(term),
    );
  }, [query, rows]);

  if (!apiBase) return <Alert><AlertDescription>Chưa kết nối được API. Vui lòng tải lại trang.</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Hồ sơ lương nhân viên</h1>
          <p className="mt-2 text-sm text-muted-foreground">Quản lý mức lương cơ bản, lương bảo hiểm và hiệu lực theo thời gian (TASK-031/032).</p>
        </div>
        {canManage && (
          <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />Thêm hồ sơ lương
          </Button>
        )}
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:p-6">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="salary-search" className="text-sm font-medium">Tìm theo tên hoặc mã nhân viên</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input id="salary-search" className="min-h-11 pl-9" placeholder="Tìm theo mã NV hoặc họ tên…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" className="min-h-11" disabled={loading} onClick={() => setRevision(r => r + 1)}>
            <RefreshCw aria-hidden="true" />Làm mới
          </Button>
        </div>

        {error ? (
          <div className="p-4 sm:p-6">
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
                <span>{error}</span>
                <Button variant="outline" className="min-h-11" onClick={() => setRevision(r => r + 1)}>Thử lại</Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : loading ? (
          <div className="space-y-4 p-4 sm:p-6" role="status">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Wallet className="size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Chưa có hồ sơ lương nào.</h2>
            {query && <p className="text-sm text-muted-foreground">Không tìm thấy bản ghi phù hợp với từ khóa đang tìm.</p>}
          </div>
        ) : (
          <Table aria-label="Danh sách hồ sơ lương" className="min-w-[840px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nhân viên</TableHead>
                <TableHead>Lương cơ bản</TableHead>
                <TableHead>Lương BHXH</TableHead>
                <TableHead>Thử việc</TableHead>
                <TableHead>Hiệu lực từ → đến</TableHead>
                <TableHead>Phiên bản</TableHead>
                <TableHead className="pr-6 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map(row => (
                <TableRow key={row._id}>
                  <TableCell className="pl-6 font-medium">
                    <div>
                      <div className="text-foreground font-semibold">{row.employeeCode || '—'}</div>
                      <div className="text-xs text-muted-foreground">{row.employeeFullName || 'Chưa cập nhật tên'}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatVnd(row.baseSalary)}
                  </TableCell>
                  <TableCell>{formatVnd(row.insuranceSalary)}</TableCell>
                  <TableCell>
                    {row.probationJobSalary ? (
                      <div className="space-y-0.5">
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Thử việc {row.probationRate ? `${(row.probationRate * 100).toFixed(0)}%` : ''}
                        </Badge>
                        <div className="text-[11px] text-muted-foreground">{formatVnd(row.probationAgreedSalary)}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Chính thức</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{formatDate(row.effectiveFrom)}</div>
                    <div className="text-muted-foreground">→ {formatDate(row.effectiveTo)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">v{row.version}</Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="min-h-11 min-w-11" />}>
                        <MoreHorizontal aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="min-h-10 px-3" onClick={() => setDetailItem(row)}>
                          <Eye className="mr-2 size-4" />Xem chi tiết
                        </DropdownMenuItem>
                        {canManage && (
                          <DropdownMenuItem className="min-h-10 px-3" onClick={() => setEditItem(row)}>
                            <Pencil className="mr-2 size-4" />Chỉnh sửa
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <SalaryProfileCreateDialog
        apiBase={apiBase}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setRevision(r => r + 1)}
      />

      {detailItem && (
        <SalaryProfileDetailDialog
          profile={detailItem}
          open={!!detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}

      {editItem && (
        <SalaryProfileEditDialog
          apiBase={apiBase}
          profile={editItem}
          open={!!editItem}
          onClose={() => setEditItem(null)}
          onUpdated={() => setRevision(r => r + 1)}
        />
      )}
    </div>
  );
}
