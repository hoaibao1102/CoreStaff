import { useEffect, useState } from 'react';
import { Award, CheckCircle2, ChevronRight, Info, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Input } from '@/components/input';
import {
  confirmKpiInput,
  createKpiInput,
  getApplicableKpiPolicy,
  updateKpiInput,
  type CreateKpiInputPayload,
  type KpiPayrollInput,
  type KpiPolicy,
  type KpiTier,
  type UpdateKpiInputPayload,
} from '@/services/compensation.service';
import { getEmployees, hrErrorMessage, type EmployeeProfile } from '@/services/hrService';

function formatVnd(val?: number): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// ───────── Create KPI Input Dialog ─────────

export function KpiInputCreateDialog({
  apiBase,
  open,
  onClose,
  onCreated,
}: {
  apiBase: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [score, setScore] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  // Policy integration
  const [policy, setPolicy] = useState<KpiPolicy | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [selectedTier, setSelectedTier] = useState<KpiTier | null>(null);
  const [customAmount, setCustomAmount] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingOpts(true);
    setError(null);
    setEmployeeId('');
    setSelectedTier(null);
    setScore('');
    setAmount('');
    setCustomAmount(false);

    // Fetch employees list
    getEmployees(apiBase, {})
      .then(res => setEmployees(res.employees))
      .catch(err => setError(hrErrorMessage(err)))
      .finally(() => setLoadingOpts(false));

    // Pre-fetch general or company-wide KPI policy so tiers are visible immediately
    setLoadingPolicy(true);
    getApplicableKpiPolicy(apiBase)
      .then(pol => setPolicy(pol))
      .catch(() => setPolicy(null))
      .finally(() => setLoadingPolicy(false));
  }, [apiBase, open]);

  // Refine applicable policy when employee changes
  useEffect(() => {
    if (!employeeId) return;
    const emp = employees.find(e => e._id === employeeId);
    if (!emp?.departmentId) return;
    setLoadingPolicy(true);
    getApplicableKpiPolicy(apiBase, emp.departmentId)
      .then(pol => {
        if (pol) {
          setPolicy(pol);
          // If a tier was selected, recalculate with the new policy's base amount
          if (selectedTier) {
            const matchingTier = pol.tiers.find(t => t.name === selectedTier.name) || pol.tiers[0];
            if (matchingTier) {
              setSelectedTier(matchingTier);
              if (!customAmount) {
                setAmount(String(Math.round((pol.baseAmount * matchingTier.percentage) / 100)));
              }
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPolicy(false));
  }, [apiBase, employeeId, employees]);

  // Handle tier click
  const handleSelectTier = (tier: KpiTier) => {
    setSelectedTier(tier);
    if (policy) {
      const calcAmt = Math.round((policy.baseAmount * tier.percentage) / 100);
      setAmount(String(calcAmt));
    }
    if (tier.minScore !== undefined && !score) {
      setScore(String(tier.minScore));
    }
  };

  // Handle score change: auto-match tier if SCORE_RANGE policy
  const handleScoreChange = (newScoreStr: string) => {
    setScore(newScoreStr);
    const num = Number(newScoreStr);
    if (!Number.isNaN(num) && policy && policy.policyType === 'SCORE_RANGE') {
      const matched = policy.tiers.find(
        t =>
          (t.minScore === undefined || num >= t.minScore) &&
          (t.maxScore === undefined || num <= t.maxScore)
      );
      if (matched) {
        setSelectedTier(matched);
        if (!customAmount) {
          setAmount(String(Math.round((policy.baseAmount * matched.percentage) / 100)));
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return setError('Vui lòng chọn nhân viên.');
    if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      return setError('Kỳ lương không hợp lệ (Định dạng YYYY-MM).');
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < 0) return setError('Số tiền KPI không hợp lệ.');

    const scr = score ? Number(score) : undefined;
    if (scr !== undefined && (Number.isNaN(scr) || scr < 0)) {
      return setError('Điểm KPI không hợp lệ.');
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateKpiInputPayload = {
        employeeId,
        period,
        score: scr,
        amount: amt,
        policyId: policy?._id,
        tierName: selectedTier?.name,
        tierPercentage: selectedTier?.percentage,
        baseAmount: policy?.baseAmount,
        source: 'MANUAL',
        note: note.trim() || undefined,
      };
      await createKpiInput(apiBase, payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <Award className="size-5 text-primary" />
            Đánh giá kết quả KPI
          </DialogTitle>
          <DialogDescription className="mt-1">
            Đánh giá xếp loại và định mức tiền thưởng KPI cho nhân viên trong kỳ lương.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 max-h-[calc(85vh-130px)]">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* 1. Chọn nhân viên & Kỳ lương */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Nhân viên <span className="text-red-500">*</span></label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  disabled={loadingOpts || submitting}
                >
                  <option value="">{loadingOpts ? 'Đang tải danh sách nhân viên…' : 'Chọn nhân viên…'}</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.employeeCode} — {emp.fullName || 'Chưa đặt tên'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Kỳ lương (YYYY-MM) <span className="text-red-500">*</span></label>
                <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} disabled={submitting} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Điểm KPI (tùy chọn)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="Nhập điểm (0 – 100)"
                  value={score}
                  onChange={e => handleScoreChange(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* 2. Chính sách KPI & Thang bậc xếp loại */}
            <div className="space-y-2">
              {loadingPolicy ? (
                <div className="p-3 text-xs text-muted-foreground animate-pulse rounded-lg border border-border">
                  Đang tải chính sách KPI áp dụng…
                </div>
              ) : policy ? (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <Sparkles className="size-3.5 text-primary" />
                        Chính sách: {policy.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Định mức chuẩn: <strong>{formatVnd(policy.baseAmount)}</strong>
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[11px]">
                      {policy.scope === 'ALL' ? 'Toàn công ty' : 'Theo phòng ban'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Chọn bậc xếp loại KPI:</span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                      {policy.tiers.map(tier => {
                        const isSelected = selectedTier?.name === tier.name;
                        const tierMoney = Math.round((policy.baseAmount * tier.percentage) / 100);
                        return (
                          <button
                            key={tier.name}
                            type="button"
                            onClick={() => handleSelectTier(tier)}
                            className={`flex flex-col p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                                : 'border-border bg-card hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground truncate">{tier.name}</span>
                              {isSelected && <CheckCircle2 className="size-3.5 text-primary shrink-0" />}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[11px] text-muted-foreground">{tier.percentage}% định mức</span>
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                {formatVnd(tierMoney)}
                              </span>
                            </div>
                            {tier.minScore !== undefined && (
                              <span className="text-[10px] text-muted-foreground mt-0.5">
                                Điểm: {tier.minScore} – {tier.maxScore ?? 100}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-border bg-muted/10 text-xs text-muted-foreground">
                  Không tìm thấy chính sách KPI riêng. Bạn có thể tự nhập số tiền thưởng KPI trực tiếp bên dưới.
                </div>
              )}
            </div>

            {/* 3. Số tiền thưởng KPI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Tiền thưởng KPI (VND) <span className="text-red-500">*</span></label>
                {policy && (
                  <button
                    type="button"
                    onClick={() => setCustomAmount(v => !v)}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    {customAmount ? 'Tính theo bậc tự động' : 'Tự nhập số tiền khác'}
                  </button>
                )}
              </div>
              <Input
                type="number"
                min="0"
                step="50000"
                placeholder="2000000"
                value={amount}
                onChange={e => {
                  setAmount(e.target.value);
                  setCustomAmount(true);
                }}
                disabled={submitting}
              />
              {amount && !Number.isNaN(Number(amount)) && (
                <p className="text-xs text-muted-foreground">
                  Thành tiền: <strong className="text-emerald-600 dark:text-emerald-400">{formatVnd(Number(amount))}</strong>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ghi chú / Nhận xét của người đánh giá</label>
              <Input
                placeholder="Đạt chỉ tiêu doanh số quý, hoàn thành tốt nhiệm vụ..."
                value={note}
                onChange={e => setNote(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Lưu kết quả KPI'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────── Edit KPI Input Dialog ─────────

export function KpiInputEditDialog({
  apiBase,
  kpi,
  open,
  onClose,
  onUpdated,
}: {
  apiBase: string;
  kpi: KpiPayrollInput;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [score, setScore] = useState(String(kpi.score ?? ''));
  const [amount, setAmount] = useState(String(kpi.amount));
  const [note, setNote] = useState(kpi.note ?? '');

  const [policy, setPolicy] = useState<KpiPolicy | null>(null);
  const [selectedTierName, setSelectedTierName] = useState<string | undefined>(kpi.tierName);
  const [selectedTierPercentage, setSelectedTierPercentage] = useState<number | undefined>(kpi.tierPercentage);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScore(String(kpi.score ?? ''));
    setAmount(String(kpi.amount));
    setNote(kpi.note ?? '');
    setSelectedTierName(kpi.tierName);
    setSelectedTierPercentage(kpi.tierPercentage);
    setError(null);

    // Fetch applicable policy if departmentId is available
    if (kpi.departmentId) {
      getApplicableKpiPolicy(apiBase, kpi.departmentId)
        .then(pol => setPolicy(pol))
        .catch(() => setPolicy(null));
    }
  }, [apiBase, kpi, open]);

  const handleSelectTier = (tier: KpiTier) => {
    setSelectedTierName(tier.name);
    setSelectedTierPercentage(tier.percentage);
    if (policy) {
      const calcAmt = Math.round((policy.baseAmount * tier.percentage) / 100);
      setAmount(String(calcAmt));
    }
    if (tier.minScore !== undefined) {
      setScore(String(tier.minScore));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < 0) return setError('Số tiền KPI không hợp lệ.');

    const scr = score ? Number(score) : undefined;
    if (scr !== undefined && (Number.isNaN(scr) || scr < 0)) {
      return setError('Điểm KPI không hợp lệ.');
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: UpdateKpiInputPayload = {
        score: scr,
        amount: amt,
        tierName: selectedTierName,
        tierPercentage: selectedTierPercentage,
        baseAmount: policy?.baseAmount ?? kpi.baseAmount,
        note: note.trim() || undefined,
      };
      await updateKpiInput(apiBase, kpi._id, payload);
      onUpdated();
      onClose();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <Award className="size-5 text-primary" />
            Cập nhật kết quả KPI [{kpi.period}]
          </DialogTitle>
          <DialogDescription className="mt-1">
            Điều chỉnh điểm và mức tiền KPI cho nhân viên <strong>{kpi.employeeCode}</strong> ({kpi.employeeFullName || '—'}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 max-h-[calc(85vh-130px)]">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Kỳ lương</label>
                <Input value={kpi.period} disabled readOnly className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Điểm KPI</label>
                <Input type="number" step="0.1" min="0" max="100" value={score} onChange={e => setScore(e.target.value)} disabled={submitting} />
              </div>
            </div>

            {policy && policy.tiers.length > 0 && (
              <div className="space-y-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                <label className="text-xs font-semibold text-primary block">
                  Thang bậc theo chính sách ({policy.name}):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {policy.tiers.map(t => {
                    const isSelected = selectedTierName === t.name;
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => handleSelectTier(t)}
                        className={`p-2 rounded-lg border text-xs text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                            : 'border-border bg-card text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <div className="truncate">{t.name}</div>
                        <div className="text-[10px] opacity-80">{t.percentage}% định mức</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Số tiền KPI (VND)</label>
              <Input type="number" min="0" step="100000" value={amount} onChange={e => setAmount(e.target.value)} disabled={submitting} />
              {amount && !Number.isNaN(Number(amount)) && (
                <p className="text-xs text-muted-foreground">
                  Thành tiền: <strong className="text-emerald-600 dark:text-emerald-400">{formatVnd(Number(amount))}</strong>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ghi chú</label>
              <Input value={note} onChange={e => setNote(e.target.value)} disabled={submitting} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Cập nhật'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────── Confirm KPI Dialog ─────────

export function KpiInputConfirmDialog({
  apiBase,
  kpi,
  open,
  onClose,
  onConfirmed,
}: {
  apiBase: string;
  kpi: KpiPayrollInput;
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await confirmKpiInput(apiBase, kpi._id);
      onConfirmed();
      onClose();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>Xác nhận khóa dữ liệu KPI kỳ [{kpi.period}]</DialogTitle>
          <DialogDescription className="mt-1">
            Sau khi xác nhận, bản ghi KPI này sẽ được khóa (CONFIRMED) và chính thức được đưa vào PayrollInputSnapshot để tính lương. Dữ liệu sẽ không thể chỉnh sửa thêm.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-2 text-sm text-emerald-900 dark:text-emerald-200">
            <div className="flex justify-between">
              <span className="font-medium">Nhân viên:</span>
              <span>{kpi.employeeCode} — {kpi.employeeFullName || '—'}</span>
            </div>
            {kpi.tierName && (
              <div className="flex justify-between">
                <span className="font-medium">Xếp loại / Bậc:</span>
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  {kpi.tierName} ({kpi.tierPercentage ?? 100}%)
                </span>
              </div>
            )}
            {kpi.score !== undefined && (
              <div className="flex justify-between">
                <span className="font-medium">Điểm đánh giá:</span>
                <span>{kpi.score} / 100 điểm</span>
              </div>
            )}
            <div className="flex justify-between border-t border-emerald-200/60 dark:border-emerald-800/60 pt-1.5">
              <span className="font-medium">Số tiền KPI sẽ khóa:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {formatVnd(kpi.amount)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
          <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={submitting} onClick={handleConfirm}>
            {submitting ? 'Đang khóa…' : 'Đồng ý khóa dữ liệu KPI'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
