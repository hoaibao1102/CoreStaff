import { useCallback, useMemo, useState } from 'react';
import { Eye, Plus, Search, ShieldCheck, X } from 'lucide-react';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { useHrResource } from '../../lib/useHrResource';
import { hrErrorMessage, listInsurancePolicies, type InsurancePolicy } from '../../services/hrService';
import {
  formatEffectiveRange,
  PolicyLoadingRows,
  PolicyPaginationFooter,
} from '../Policies/policies.ui';
import { InsurancePolicyCreateDialog, InsurancePolicyDetailDialog } from './components/InsurancePolicyDialogs';

const PAGE_SIZE = 10;

function isEffective(row: InsurancePolicy, now: Date): boolean {
  const from = new Date(row.effectiveFrom);
  const to = row.effectiveTo ? new Date(row.effectiveTo) : null;
  return from <= now && (!to || to > now);
}

export function InsurancePolicyScreen({ apiBase }: { apiBase: string | null }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailPolicy, setDetailPolicy] = useState<InsurancePolicy | null>(null);

  const loader = useCallback(() => listInsurancePolicies(apiBase!), [apiBase]);
  const resource = useHrResource(apiBase ? loader : null);
  const loading = resource.loading;
  const error = resource.error ? hrErrorMessage(resource.error) : null;
  const policies: InsurancePolicy[] = resource.data ?? [];

  const now = useMemo(() => new Date(), []);

  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = policies.filter((p) => !term || `${p.legalReference} v${p.version}`.toLocaleLowerCase('vi').includes(term));
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.max(1, Math.min(page, pages));
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const from = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, total);

  if (!apiBase) return <EmployeeDataState status="unavailable" />;

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Chính sách bảo hiểm</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tỷ lệ đóng, mức sàn/trần BHXH/BHYT/BHTN áp dụng cho toàn tổ chức theo từng giai đoạn hiệu lực.
          </p>
        </div>
        <EmployeeDataState status="error" message={error} onRetry={resource.retry} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Chính sách bảo hiểm</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tỷ lệ đóng, mức sàn/trần BHXH/BHYT/BHTN áp dụng cho toàn tổ chức theo từng giai đoạn hiệu lực.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" />
          Tạo chính sách
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-6">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="inspolicy-search" className="text-sm font-medium">Tìm kiếm chính sách</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                id="inspolicy-search"
                className="min-h-11 pl-9"
                placeholder="Tìm theo tham chiếu pháp lý hoặc phiên bản…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              />
            </div>
          </div>
          {query && (
            <Button className="min-h-11" variant="ghost" onClick={() => { setQuery(''); setPage(1); }}>
              <X aria-hidden="true" />
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {loading ? (
          <PolicyLoadingRows count={5} />
        ) : !policies.length ? (
          <div className="p-14 text-center text-sm text-muted-foreground">Chưa có chính sách bảo hiểm nào.</div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-2 p-14 text-center text-sm text-muted-foreground">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            Không tìm thấy chính sách nào khớp với bộ lọc.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 pl-6 text-left font-medium text-muted-foreground">Hiệu lực</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">BHXH (NLĐ)</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">BHYT (NLĐ)</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">BHTN (NLĐ)</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tham chiếu pháp lý</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Phiên bản</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Trạng thái</th>
                    <th className="px-4 py-3 pr-6 text-center font-medium text-muted-foreground">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row._id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 pl-6 whitespace-nowrap">{formatEffectiveRange(row.effectiveFrom, row.effectiveTo)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{(row.socialInsuranceEmployeeRate * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums">{(row.healthInsuranceEmployeeRate * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums">{(row.unemploymentInsuranceEmployeeRate * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 max-w-xs whitespace-normal break-words">{row.legalReference}</td>
                      <td className="px-4 py-3 text-center">v{row.version}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${isEffective(row, now) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>
                          {isEffective(row, now) ? 'Đang hiệu lực' : 'Ngoài hiệu lực'}
                        </span>
                      </td>
                      <td className="px-4 py-3 pr-6 text-center">
                        <Button variant="ghost" size="sm" onClick={() => setDetailPolicy(row)} aria-label={`Xem chính sách ${row.legalReference}`} title="Xem chi tiết">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PolicyPaginationFooter
              from={from}
              to={to}
              total={total}
              page={current}
              pages={pages}
              onPrev={() => setPage(current - 1)}
              onNext={() => setPage(current + 1)}
            />
          </>
        )}
      </div>

      {apiBase && (
        <>
          <InsurancePolicyCreateDialog
            apiBase={apiBase}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={resource.retry}
          />
          <InsurancePolicyDetailDialog
            policy={detailPolicy}
            open={detailPolicy !== null}
            onClose={() => setDetailPolicy(null)}
          />
        </>
      )}
    </div>
  );
}
