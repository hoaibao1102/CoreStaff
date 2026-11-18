import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, FileText, Filter, RefreshCw, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Input } from '@/components/input';
import { formatInstantDateTimeVN } from '@/lib/datetime';
import { hrErrorMessage } from '@/services/hrService';
import { getPlatformAuditLogs, listOrganizations, type Organization, type PlatformAuditLogItem } from '@/services/platformService';
import {
  PLATFORM_AUDIT_ACTION_META,
  PLATFORM_AUDIT_TONE_CLASS,
  describePlatformAudit,
  platformAuditActionLabel,
  platformAuditTargetLabel,
} from './platformAuditPresentation';

const PAGE_SIZE = 20;
const SELECT_CLASS = 'h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500';

function ActionBadge({ action }: { action: string }) {
  const tone = PLATFORM_AUDIT_ACTION_META[action]?.tone ?? 'neutral';
  return <Badge variant="secondary" className={PLATFORM_AUDIT_TONE_CLASS[tone]}>{platformAuditActionLabel(action)}</Badge>;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  return outcome === 'FAILED'
    ? <Badge variant="secondary" className={PLATFORM_AUDIT_TONE_CLASS.danger}>Thất bại</Badge>
    : <Badge variant="secondary" className={PLATFORM_AUDIT_TONE_CLASS.success}>Thành công</Badge>;
}

/**
 * Platform audit (SYSTEM_ADMIN): who created, suspended or re-opened a tenant,
 * who minted the first HR, and every sign-in / lockout / password event on an
 * admin account. Read-only — there is no way to edit or delete a row here.
 */
export function PlatformAuditScreen({ apiBase }: { apiBase: string }) {
  const [items, setItems] = useState<PlatformAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>(Object.keys(PLATFORM_AUDIT_ACTION_META));
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlatformAuditLogItem | null>(null);

  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  // Typing in the search box waits a moment before it hits the API.
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    void listOrganizations(apiBase).then(rows => { if (!cancelled) setOrganizations(rows); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [apiBase]);

  const dateRangeInvalid = Boolean(from && to && to < from);

  const load = useCallback(async (isCancelled: () => boolean) => {
    if (dateRangeInvalid) { setItems([]); setTotal(0); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await getPlatformAuditLogs(apiBase, { action, outcome, organizationId, from, to, q: query, page, limit: PAGE_SIZE });
      if (isCancelled()) return;
      setItems(result.items);
      setTotal(result.total);
      if (result.actions.length) setActions(result.actions);
    } catch (cause) {
      if (!isCancelled()) setError(hrErrorMessage(cause));
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, [apiBase, action, outcome, organizationId, from, to, query, page, dateRangeInvalid]);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => { cancelled = true; };
  }, [load, revision]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter = Boolean(action || outcome || organizationId || from || to || query);
  const resetFilters = () => { setAction(''); setOutcome(''); setOrganizationId(''); setFrom(''); setTo(''); setSearch(''); setQuery(''); setPage(1); };
  const onFilter = (apply: () => void) => { apply(); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <ShieldCheck className="size-7 text-blue-600" aria-hidden="true" />
            Nhật ký hệ thống
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Ghi lại thao tác của System Admin trên nền tảng (tạo, khóa, mở lại tổ chức; cấp HR đầu tiên) và các sự kiện bảo mật của tài khoản admin
            (đăng nhập, đăng nhập sai, khóa tài khoản, đổi mật khẩu). Chỉ xem, không thể sửa hay xóa. Hoạt động nghiệp vụ bên trong từng công ty nằm ở nhật ký của HR công ty đó.
          </p>
        </div>
        <Button variant="outline" className="min-h-10 self-start" onClick={() => setRevision(value => value + 1)} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />Làm mới
        </Button>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Filter className="size-3.5" aria-hidden="true" />Bộ lọc</div>
          <div className="text-xs font-medium text-muted-foreground">Tổng cộng: <strong className="text-foreground">{total}</strong> sự kiện</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5 text-xs font-medium">
            <span>Sự kiện</span>
            <select className={`${SELECT_CLASS} w-full`} value={action} onChange={event => onFilter(() => setAction(event.target.value))}>
              <option value="">Tất cả sự kiện</option>
              {actions.map(key => <option key={key} value={key}>{platformAuditActionLabel(key)}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            <span>Kết quả</span>
            <select className={`${SELECT_CLASS} w-full`} value={outcome} onChange={event => onFilter(() => setOutcome(event.target.value))}>
              <option value="">Tất cả</option>
              <option value="SUCCEEDED">Thành công</option>
              <option value="FAILED">Thất bại</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            <span>Tổ chức</span>
            <select className={`${SELECT_CLASS} w-full`} value={organizationId} onChange={event => onFilter(() => setOrganizationId(event.target.value))}>
              <option value="">Tất cả tổ chức</option>
              {organizations.map(org => <option key={org._id} value={org._id}>{org.code} — {org.name}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            <span>Tìm kiếm</span>
            <Input className="h-9 text-xs" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên, email hoặc đối tượng…" maxLength={100} />
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            <span>Từ ngày</span>
            <Input className="h-9 text-xs" type="date" value={from} max={to || undefined} onChange={event => onFilter(() => setFrom(event.target.value))} />
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            <span>Đến ngày</span>
            <Input className="h-9 text-xs" type="date" value={to} min={from || undefined} onChange={event => onFilter(() => setTo(event.target.value))} />
          </label>
          {hasFilter && (
            <div className="flex items-end">
              <Button variant="outline" size="sm" className="min-h-9" onClick={resetFilters}><X aria-hidden="true" />Xóa bộ lọc</Button>
            </div>
          )}
        </div>
        {dateRangeInvalid && <p role="alert" className="text-xs text-destructive">Ngày kết thúc không được trước ngày bắt đầu.</p>}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Không tải được nhật ký hệ thống: {error}</span>
          <Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>Thử lại</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Người thực hiện</th>
                <th className="px-4 py-3">Sự kiện</th>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3">Kết quả</th>
                <th className="px-4 py-3">Chi tiết</th>
                <th className="px-4 py-3">Địa chỉ IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground"><RefreshCw className="mx-auto mb-2 size-6 animate-spin text-blue-600" aria-hidden="true" />Đang tải nhật ký hệ thống…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground"><FileText className="mx-auto mb-2 size-8 text-slate-300" aria-hidden="true" />{hasFilter ? 'Không có sự kiện nào phù hợp với bộ lọc.' : 'Chưa có sự kiện nào được ghi lại.'}</td></tr>
              ) : items.map(item => (
                <tr key={item._id} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => setSelected(item)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') setSelected(item); }}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-600 dark:text-slate-300">{formatInstantDateTimeVN(item.occurredAt)}</td>
                  <td className="px-4 py-3"><div className="font-medium text-foreground">{item.actorNameSnapshot || 'Không xác định'}</div><div className="text-muted-foreground">{item.actorEmailSnapshot || ''}</div></td>
                  <td className="px-4 py-3"><ActionBadge action={item.action} /></td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{platformAuditTargetLabel(item)}</td>
                  <td className="px-4 py-3"><OutcomeBadge outcome={item.outcome} /></td>
                  <td className="max-w-xs px-4 py-3 text-muted-foreground"><span className="line-clamp-2" title={describePlatformAudit(item)}>{describePlatformAudit(item)}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{item.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border bg-muted/20 p-4">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}>Trang trước</Button>
            <span className="text-xs text-muted-foreground">Trang {page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage(value => value + 1)}>Trang sau</Button>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={next => { if (!next) setSelected(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="border-b pr-16">
            <DialogTitle className="flex items-center gap-2">{selected?.outcome === 'FAILED' ? <ShieldAlert className="size-5 text-amber-600" aria-hidden="true" /> : <ShieldCheck className="size-5 text-blue-600" aria-hidden="true" />}{selected ? platformAuditActionLabel(selected.action) : ''}</DialogTitle>
            <DialogDescription>Chi tiết sự kiện kiểm toán. Mật khẩu và mã xác thực không bao giờ được lưu trong nhật ký.</DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="grid gap-x-6 gap-y-4 px-6 pb-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Thời gian</dt><dd className="mt-1 font-medium">{formatInstantDateTimeVN(selected.occurredAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Kết quả</dt><dd className="mt-1"><OutcomeBadge outcome={selected.outcome} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Người thực hiện</dt><dd className="mt-1">{selected.actorNameSnapshot || 'Không xác định'}<span className="block text-muted-foreground">{selected.actorEmailSnapshot} {selected.actorRoleSnapshot ? `· ${selected.actorRoleSnapshot}` : ''}</span></dd></div>
              <div><dt className="text-xs text-muted-foreground">Đối tượng</dt><dd className="mt-1">{platformAuditTargetLabel(selected)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Mô tả</dt><dd className="mt-1">{describePlatformAudit(selected)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Địa chỉ IP</dt><dd className="mt-1 font-mono">{selected.ip || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Nguồn</dt><dd className="mt-1">{selected.source === 'SEED' ? 'Dữ liệu demo' : 'API'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Trình duyệt / thiết bị</dt><dd className="mt-1 break-words text-muted-foreground">{selected.userAgent || '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Mã sự kiện</dt><dd className="mt-1 break-all font-mono text-xs text-muted-foreground">{selected.eventId}</dd></div>
            </dl>
          )}
          <div className="mx-6 mb-6 mt-4 flex justify-end border-t pt-5"><Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
