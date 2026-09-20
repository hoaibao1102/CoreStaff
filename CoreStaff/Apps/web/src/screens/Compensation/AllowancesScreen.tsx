import { useEffect, useMemo, useState } from 'react';
import { Coins, MoreHorizontal, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/dropdown-menu';
import { getOrganizationAllowances, type OrganizationAllowance } from '@/services/compensation.service';
import { hrErrorMessage } from '@/services/hrService';
import { AllowanceCreateDialog, AllowanceEditDialog } from './AllowanceDialogs';

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

export function AllowancesScreen({ apiBase, canManage = true }: { apiBase: string | null; canManage?: boolean }) {
  const [rows, setRows] = useState<OrganizationAllowance[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<OrganizationAllowance | null>(null);

  useEffect(() => {
    if (!apiBase) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOrganizationAllowances(apiBase)
      .then(data => { if (!cancelled) setRows(data); })
      .catch(err => { if (!cancelled) setError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, revision]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('vi');
    if (!term) return rows;
    return rows.filter(row =>
      `${row.code} ${row.name}`.toLocaleLowerCase('vi').includes(term),
    );
  }, [query, rows]);

  if (!apiBase) return <Alert><AlertDescription>Chưa kết nối được API. Vui lòng tải lại trang.</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Danh mục phụ cấp tổ chức</h1>
          <p className="mt-2 text-sm text-muted-foreground">Quản lý các khoản phụ cấp độc lập hoặc từ danh mục chuẩn (TASK-033).</p>
        </div>
        {canManage && (
          <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />Thêm phụ cấp
          </Button>
        )}
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:p-6">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="allowance-search" className="text-sm font-medium">Tìm theo mã hoặc tên phụ cấp</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input id="allowance-search" className="min-h-11 pl-9" placeholder="Tìm theo mã hoặc tên phụ cấp…" value={query} onChange={e => setQuery(e.target.value)} />
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
            <Coins className="size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Chưa có phụ cấp nào.</h2>
            {query && <p className="text-sm text-muted-foreground">Không tìm thấy phụ cấp phù hợp với từ khóa đang tìm.</p>}
          </div>
        ) : (
          <Table aria-label="Danh sách phụ cấp" className="min-w-[840px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Mã phụ cấp</TableHead>
                <TableHead>Tên phụ cấp</TableHead>
                <TableHead>Mức phụ cấp</TableHead>
                <TableHead>Quy tắc tính</TableHead>
                <TableHead>Hiệu lực từ → đến</TableHead>
                <TableHead>Phiên bản</TableHead>
                <TableHead className="pr-6 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map(row => (
                <TableRow key={row._id}>
                  <TableCell className="pl-6 font-semibold">{row.code}</TableCell>
                  <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatVnd(row.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      {row.taxable && <Badge variant="secondary" className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">Tính PIT</Badge>}
                      {row.insuranceBased && <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Tính BHXH</Badge>}
                      {row.prorated ? (
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Theo ngày công</Badge>
                      ) : (
                        <Badge variant="outline">Cố định</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{formatDate(row.effectiveFrom)}</div>
                    <div className="text-muted-foreground">→ {formatDate(row.effectiveTo)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">v{row.version}</Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 hover:bg-muted font-medium"
                        onClick={() => setEditItem(row)}
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                        Chỉnh sửa
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AllowanceCreateDialog
        apiBase={apiBase}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setRevision(r => r + 1)}
      />

      {editItem && (
        <AllowanceEditDialog
          apiBase={apiBase}
          allowance={editItem}
          open={!!editItem}
          onClose={() => setEditItem(null)}
          onUpdated={() => setRevision(r => r + 1)}
        />
      )}
    </div>
  );
}
