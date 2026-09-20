import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/dropdown-menu';
import {
  getKpiInputs,
  getKpiPolicies,
  type KpiPayrollInput,
  type KpiPolicy,
} from '@/services/compensation.service';
import { getEmployees, hrErrorMessage } from '@/services/hrService';
import { KpiInputConfirmDialog, KpiInputCreateDialog, KpiInputEditDialog } from './KpiInputDialogs';
import { KpiPolicyCreateDialog } from './KpiPolicyDialogs';

function formatVnd(val?: number): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

function formatPeriod(periodStr?: string): string {
  if (!periodStr) return '—';
  const parts = periodStr.split('-');
  if (parts.length === 2) {
    return `${parts[1]}-${parts[0]}`; // MM-YYYY e.g. 09-2026
  }
  return periodStr;
}

export function KpiInputsScreen({
  apiBase,
  canManage = true,
  userRole,
}: {
  apiBase: string | null;
  canManage?: boolean;
  userRole?: string;
}) {
  const isManager = userRole === 'DEPARTMENT_MANAGER';
  const isHr = userRole === 'HR' || (!userRole && canManage);

  const [rows, setRows] = useState<KpiPayrollInput[]>([]);
  const [policies, setPolicies] = useState<KpiPolicy[]>([]);
  const [showPolicies, setShowPolicies] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPolicyOpen, setCreatePolicyOpen] = useState(false);
  const [editItem, setEditItem] = useState<KpiPayrollInput | null>(null);
  const [confirmItem, setConfirmItem] = useState<KpiPayrollInput | null>(null);

  useEffect(() => {
    if (!apiBase) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getKpiInputs(apiBase, period),
      getEmployees(apiBase, {}).catch(() => ({ employees: [] })),
      getKpiPolicies(apiBase).catch(() => []),
    ])
      .then(([data, empRes, pols]) => {
        if (cancelled) return;
        const allEmps = Array.isArray(empRes) ? empRes : (empRes?.employees ?? []);
        const empMap = new Map(allEmps.map(e => [e._id, e]));
        const enriched = data.map(item => {
          const emp = empMap.get(item.employeeProfileId);
          return {
            ...item,
            employeeCode: item.employeeCode || emp?.employeeCode || '—',
            employeeFullName: item.employeeFullName || emp?.fullName || 'Chưa cập nhật tên',
          };
        });
        setRows(enriched);
        setPolicies(pols);
      })
      .catch(err => { if (!cancelled) setError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, period, revision]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('vi');
    if (!term) return rows;
    return rows.filter(row =>
      `${row.employeeCode ?? ''} ${row.employeeFullName ?? ''} ${row.tierName ?? ''} ${row.period} ${formatPeriod(row.period)}`
        .toLocaleLowerCase('vi')
        .includes(term),
    );
  }, [query, rows]);

  if (!apiBase) return <Alert><AlertDescription>Chưa kết nối được API. Vui lòng tải lại trang.</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {isManager ? 'Đánh giá KPI phòng ban' : 'KPI đầu vào kỳ lương'}
            </h1>
            {isManager ? (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Trưởng phòng ban
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Nhân sự (HR)
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isManager
              ? 'Đánh giá xếp loại và định mức tiền thưởng KPI cho nhân viên thuộc phòng ban bạn phụ trách.'
              : 'Thiết lập thang bậc KPI, tiếp nhận kết quả đánh giá từ Trưởng phòng và khóa dữ liệu tính lương.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isHr && (
            <Button variant="outline" className="min-h-11 cursor-pointer" onClick={() => setCreatePolicyOpen(true)}>
              <Settings2 aria-hidden="true" className="size-4 mr-1.5" />
              Thiết lập chính sách KPI
            </Button>
          )}

          {(isHr || isManager) && (
            <Button className="min-h-11 cursor-pointer" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" className="size-4 mr-1.5" />
              {isManager ? 'Đánh giá KPI nhân viên' : 'Nhập KPI mới'}
            </Button>
          )}
        </div>
      </div>

      {/* 2. Manager Notice Banner */}
      {isManager && (
        <Alert className="border-blue-200 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-900 text-blue-900 dark:text-blue-200">
          <Users className="size-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-sm font-semibold">Quyền đánh giá của Quản lý phòng ban</AlertTitle>
          <AlertDescription className="text-xs text-blue-800 dark:text-blue-300 mt-1">
            Bạn có thẩm quyền đánh giá kết quả xếp loại KPI cho các nhân sự thuộc phòng ban của mình. Kết quả được lưu ở trạng thái <strong>Bản nháp (Draft)</strong> để bộ phận Nhân sự (HR) rà soát và xác nhận khóa (Confirmed) đưa vào bảng lương kỳ này.
          </AlertDescription>
        </Alert>
      )}

      {/* 3. Quick Policies View Toggle */}
      {policies.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPolicies(!showPolicies)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Chính sách KPI đang có hiệu lực ({policies.length} chính sách)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              {showPolicies ? 'Thu gọn' : 'Xem chi tiết thang bậc'}
              {showPolicies ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </div>
          </button>

          {showPolicies && (
            <div className="border-t border-border p-4 bg-muted/20 grid grid-cols-1 md:grid-cols-2 gap-3">
              {policies.map(pol => (
                <div key={pol._id} className="p-3.5 rounded-lg border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground truncate">{pol.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {pol.scope === 'ALL' ? 'Toàn công ty' : 'Theo phòng ban'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mức chuẩn (100%): <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatVnd(pol.baseAmount)}</strong>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {pol.tiers.map(t => (
                      <span
                        key={t.name}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground border border-border"
                      >
                        {t.name}: <strong>{t.percentage}%</strong> ({formatVnd(Math.round((pol.baseAmount * t.percentage) / 100))})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Filter Toolbar & Table */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:p-6">
          <div className="space-y-2 sm:w-48">
            <label htmlFor="kpi-period" className="text-sm font-medium">Chọn kỳ lương (YYYY-MM)</label>
            <Input id="kpi-period" type="month" className="min-h-11" value={period} onChange={e => setPeriod(e.target.value)} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="kpi-search" className="text-sm font-medium">Tìm theo tên hoặc mã nhân viên</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                id="kpi-search"
                className="min-h-11 pl-9"
                placeholder="Tìm theo mã NV, họ tên, xếp loại…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <Button variant="outline" className="min-h-11 cursor-pointer" disabled={loading} onClick={() => setRevision(r => r + 1)}>
            <RefreshCw aria-hidden="true" className="size-4 mr-1.5" />Làm mới
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
            <Target className="size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Chưa có bản ghi KPI nào cho kỳ {formatPeriod(period)}.</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {query
                ? 'Không tìm thấy bản ghi phù hợp với từ khóa đang tìm kiếm.'
                : isManager
                ? 'Hãy bấm "Đánh giá KPI nhân viên" để bắt đầu xếp loại kết quả cho nhân sự trong phòng ban.'
                : 'Chưa có kết quả đánh giá KPI nào được gửi lên trong kỳ tính lương này.'}
            </p>
          </div>
        ) : (
          <Table aria-label="Danh sách KPI kỳ lương" className="min-w-[880px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nhân viên</TableHead>
                <TableHead>Kỳ lương</TableHead>
                <TableHead>Xếp loại / Điểm</TableHead>
                <TableHead>Số tiền KPI</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Người đánh giá</TableHead>
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
                  <TableCell className="font-medium">{formatPeriod(row.period)}</TableCell>
                  <TableCell>
                    {row.tierName ? (
                      <div className="space-y-0.5">
                        <Badge variant="outline" className="font-semibold text-xs border-primary/40 bg-primary/5 text-primary">
                          <Award className="size-3 mr-1" />
                          {row.tierName} ({row.tierPercentage ?? 100}%)
                        </Badge>
                        {row.score !== undefined && (
                          <div className="text-[11px] text-muted-foreground font-mono">{row.score} / 100 đ</div>
                        )}
                      </div>
                    ) : row.score !== undefined ? (
                      <span className="font-semibold font-mono text-sm">{row.score} / 100 đ</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatVnd(row.amount)}
                    </div>
                    {row.baseAmount && (
                      <div className="text-[11px] text-muted-foreground">
                        Chuẩn: {formatVnd(row.baseAmount)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.status === 'CONFIRMED' ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                        <Lock className="mr-1 size-3" />Đã khóa (Confirmed)
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                        Bản nháp (Draft)
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.evaluatedBy ? 'Trưởng phòng ban' : row.source === 'MANUAL' ? 'Thủ công' : row.source}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="min-h-11 min-w-11" />}>
                        <MoreHorizontal aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.status === 'DRAFT' && (
                          <>
                            <DropdownMenuItem className="min-h-10 px-3 cursor-pointer" onClick={() => setEditItem(row)}>
                              <Pencil className="mr-2 size-4" />Chỉnh sửa đánh giá
                            </DropdownMenuItem>
                            {isHr && (
                              <DropdownMenuItem
                                className="min-h-10 px-3 text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer"
                                onClick={() => setConfirmItem(row)}
                              >
                                <CheckCircle2 className="mr-2 size-4" />Xác nhận khóa dữ liệu
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        {row.status === 'CONFIRMED' && (
                          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                            <Lock className="mr-2 size-3.5" /> Dữ liệu đã khóa vào kỳ lương
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

      {/* Modals & Dialogs */}
      <KpiInputCreateDialog
        apiBase={apiBase}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setRevision(r => r + 1)}
      />

      <KpiPolicyCreateDialog
        apiBase={apiBase}
        open={createPolicyOpen}
        onClose={() => setCreatePolicyOpen(false)}
        onCreated={() => setRevision(r => r + 1)}
      />

      {editItem && (
        <KpiInputEditDialog
          apiBase={apiBase}
          kpi={editItem}
          open={!!editItem}
          onClose={() => setEditItem(null)}
          onUpdated={() => setRevision(r => r + 1)}
        />
      )}

      {confirmItem && (
        <KpiInputConfirmDialog
          apiBase={apiBase}
          kpi={confirmItem}
          open={!!confirmItem}
          onClose={() => setConfirmItem(null)}
          onConfirmed={() => setRevision(r => r + 1)}
        />
      )}
    </div>
  );
}
