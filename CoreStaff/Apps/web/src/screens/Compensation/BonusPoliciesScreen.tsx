import { useEffect, useMemo, useState } from 'react';
import { Award, Building2, Globe2, MoreHorizontal, Pencil, Play, Plus, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/dropdown-menu';
import { getAttendanceBonusPolicies, type AttendanceBonusPolicy } from '@/services/compensation.service';
import { getDepartments, hrErrorMessage, type Department } from '@/services/hrService';
import { BonusPolicyCreateDialog, BonusPolicyEditDialog, BonusPolicyPreviewDialog } from './BonusPolicyDialogs';

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

export function BonusPoliciesScreen({ apiBase, canManage = true }: { apiBase: string | null; canManage?: boolean }) {
  const [rows, setRows] = useState<AttendanceBonusPolicy[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<AttendanceBonusPolicy | null>(null);
  const [previewItem, setPreviewItem] = useState<AttendanceBonusPolicy | null>(null);

  useEffect(() => {
    if (!apiBase) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getAttendanceBonusPolicies(apiBase),
      getDepartments(apiBase, true).catch(() => []),
    ])
      .then(([data, depts]) => {
        if (!cancelled) {
          setRows(data);
          setDepartments(depts);
        }
      })
      .catch(err => { if (!cancelled) setError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, revision]);

  const deptMap = useMemo(() => {
    return new Map<string, Department>(departments.map(d => [d._id, d]));
  }, [departments]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('vi');
    if (!term) return rows;
    return rows.filter(row => row.name.toLocaleLowerCase('vi').includes(term));
  }, [query, rows]);

  if (!apiBase) return <Alert><AlertDescription>Chưa kết nối được API. Vui lòng tải lại trang.</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Chính sách thưởng chuyên cần</h1>
          <p className="mt-2 text-sm text-muted-foreground">Cấu hình quy tắc đánh giá chuyên cần có phiên bản (TASK-034).</p>
        </div>
        {canManage && (
          <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />Thêm chính sách
          </Button>
        )}
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:p-6">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="bonus-search" className="text-sm font-medium">Tìm theo tên chính sách</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input id="bonus-search" className="min-h-11 pl-9" placeholder="Tìm tên chính sách thưởng…" value={query} onChange={e => setQuery(e.target.value)} />
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
            <Award className="size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Chưa có chính sách thưởng chuyên cần nào.</h2>
            {query && <p className="text-sm text-muted-foreground">Không tìm thấy chính sách phù hợp với từ khóa đang tìm.</p>}
          </div>
        ) : (
          <Table aria-label="Danh sách chính sách chuyên cần" className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Tên chính sách</TableHead>
                <TableHead>Mức thưởng tối đa</TableHead>
                <TableHead>Phạm vi áp dụng</TableHead>
                <TableHead>Số quy tắc (Tiers)</TableHead>
                <TableHead>Hiệu lực từ → đến</TableHead>
                <TableHead>Phiên bản</TableHead>
                <TableHead className="pr-6 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map(row => {
                const isDeptScope = row.scope === 'DEPARTMENT';
                const deptNames = (row.departmentIds ?? [])
                  .map(id => deptMap.get(id)?.name)
                  .filter(Boolean);

                return (
                  <TableRow key={row._id}>
                    <TableCell className="pl-6 font-semibold text-foreground">{row.name}</TableCell>
                    <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatVnd(row.bonusAmount)}
                    </TableCell>
                    <TableCell>
                      {isDeptScope ? (
                        <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 gap-1 text-[11px]">
                            <Building2 className="size-3 shrink-0" />
                            {deptNames.length > 0 ? deptNames.slice(0, 2).join(', ') : 'Theo phòng ban'}
                            {deptNames.length > 2 && ` +${deptNames.length - 2}`}
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 gap-1 text-[11px]">
                          <Globe2 className="size-3 shrink-0" />
                          Toàn công ty
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {row.tiers?.length ?? 0} mức quy tắc
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{formatDate(row.effectiveFrom)}</div>
                      <div className="text-muted-foreground">→ {formatDate(row.effectiveTo)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">v{row.version}</Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canManage && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 hover:bg-muted font-medium"
                            onClick={() => setEditItem(row)}
                          >
                            <Pencil className="size-3.5 text-muted-foreground" />
                            Chỉnh sửa
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => setPreviewItem(row)}
                        >
                          <Play className="size-3.5" />
                          Dùng thử
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <BonusPolicyCreateDialog
        apiBase={apiBase}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setRevision(r => r + 1)}
      />

      {editItem && (
        <BonusPolicyEditDialog
          apiBase={apiBase}
          policy={editItem}
          open={!!editItem}
          onClose={() => setEditItem(null)}
          onUpdated={() => setRevision(r => r + 1)}
        />
      )}

      {previewItem && (
        <BonusPolicyPreviewDialog
          apiBase={apiBase}
          policy={previewItem}
          open={!!previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
