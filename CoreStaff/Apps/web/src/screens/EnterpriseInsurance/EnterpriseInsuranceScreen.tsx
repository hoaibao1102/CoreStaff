import { useCallback, useMemo, useState } from 'react';
import { CalendarOff, Eye, Plus, Search, ShieldCheck, X } from 'lucide-react';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { CloseEffectiveRecordDialog } from '../../components/CloseEffectiveRecordDialog';
import { useHrResource } from '../../lib/useHrResource';
import { closeEnterpriseInsurancePolicy, hrErrorMessage, listEnterpriseInsurancePolicies, type EnterpriseInsurancePolicy } from '../../services/hrService';
import {
  formatEffectiveRange,
  PolicyLoadingRows,
  PolicyPaginationFooter,
} from '../Policies/policies.ui';
import { EnterpriseInsurancePolicyCreateDialog, EnterpriseInsurancePolicyDetailDialog } from './components/EnterpriseInsuranceDialogs';

const PAGE_SIZE = 10;

const COST_BEARER_LABELS: Record<string, string> = {
  EMPLOYER: 'Công ty trả toàn bộ',
  SHARED: 'Chia sẻ',
  EMPLOYEE: 'Nhân viên tự trả',
};

function isEffective(row: EnterpriseInsurancePolicy, now: Date): boolean {
  const from = new Date(row.effectiveFrom);
  const to = row.effectiveTo ? new Date(row.effectiveTo) : null;
  return from <= now && (!to || to > now);
}

export function EnterpriseInsuranceScreen({ apiBase }: { apiBase: string | null }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailPolicy, setDetailPolicy] = useState<EnterpriseInsurancePolicy | null>(null);
  const [closingPolicy, setClosingPolicy] = useState<EnterpriseInsurancePolicy | null>(null);

  const loader = useCallback(() => listEnterpriseInsurancePolicies(apiBase!), [apiBase]);
  const resource = useHrResource(apiBase ? loader : null);
  const loading = resource.loading;
  const error = resource.error ? hrErrorMessage(resource.error) : null;
  const policies: EnterpriseInsurancePolicy[] = resource.data ?? [];

  const now = useMemo(() => new Date(), []);

  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = policies.filter((p) => !term || `${p.provider} ${p.coverageDescription} v${p.version}`.toLocaleLowerCase('vi').includes(term));
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Bảo hiểm doanh nghiệp</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Bảo hiểm thương mại tự nguyện (tai nạn, sức khỏe…) công ty mua thêm cho nhân viên — khác với BHXH/BHYT/BHTN bắt buộc.
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Bảo hiểm doanh nghiệp</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Bảo hiểm thương mại tự nguyện (tai nạn, sức khỏe…) công ty mua thêm cho nhân viên, ngoài 3 khoản BHXH/BHYT/BHTN bắt buộc. Không có mức đóng cố định theo luật — do công ty tự thỏa thuận với nhà cung cấp.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" />
          Tạo bảo hiểm doanh nghiệp
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-6">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="entins-search" className="text-sm font-medium">Tìm kiếm</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                id="entins-search"
                className="min-h-11 pl-9"
                placeholder="Tìm theo nhà cung cấp, phạm vi bảo hiểm hoặc phiên bản…"
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
          <div className="p-14 text-center text-sm text-muted-foreground">Chưa có bảo hiểm doanh nghiệp nào.</div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-2 p-14 text-center text-sm text-muted-foreground">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            Không tìm thấy bảo hiểm nào khớp với bộ lọc.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 pl-6 text-left font-medium text-muted-foreground">Hiệu lực</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nhà cung cấp</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phạm vi</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ai chi trả</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Phiên bản</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Trạng thái</th>
                    <th className="px-4 py-3 pr-6 text-center font-medium text-muted-foreground">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row._id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 pl-6 whitespace-nowrap">{formatEffectiveRange(row.effectiveFrom, row.effectiveTo)}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.provider}</td>
                      <td className="px-4 py-3 max-w-xs whitespace-normal break-words">{row.coverageDescription}</td>
                      <td className="px-4 py-3">{COST_BEARER_LABELS[row.costBearer] ?? row.costBearer}</td>
                      <td className="px-4 py-3 text-center">v{row.version}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${isEffective(row, now) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>
                          {isEffective(row, now) ? 'Đang hiệu lực' : 'Ngoài hiệu lực'}
                        </span>
                      </td>
                      <td className="px-4 py-3 pr-6 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailPolicy(row)} aria-label={`Xem bảo hiểm doanh nghiệp ${row.provider}`} title="Xem chi tiết">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!row.effectiveTo && (
                            <Button variant="ghost" size="sm" onClick={() => setClosingPolicy(row)} aria-label={`Kết thúc hiệu lực bảo hiểm doanh nghiệp ${row.provider}`} title="Kết thúc hiệu lực (để tạo phiên bản mới)">
                              <CalendarOff className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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
          <EnterpriseInsurancePolicyCreateDialog
            apiBase={apiBase}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={resource.retry}
          />
          <EnterpriseInsurancePolicyDetailDialog
            policy={detailPolicy}
            open={detailPolicy !== null}
            onClose={() => setDetailPolicy(null)}
          />
          {closingPolicy && (
            <CloseEffectiveRecordDialog
              open={closingPolicy !== null}
              title="Kết thúc hiệu lực bảo hiểm doanh nghiệp"
              description={`Đóng giai đoạn hiệu lực hiện tại của "${closingPolicy.provider}" — sau đó có thể tạo bảo hiểm doanh nghiệp mới kế tiếp.`}
              effectiveFrom={closingPolicy.effectiveFrom}
              onOpenChange={(open) => { if (!open) setClosingPolicy(null); }}
              onConfirm={(effectiveTo) => closeEnterpriseInsurancePolicy(apiBase, closingPolicy._id, effectiveTo)}
              onClosed={resource.retry}
            />
          )}
        </>
      )}
    </div>
  );
}
