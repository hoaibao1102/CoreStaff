import { useEffect, useState } from 'react';
import { Plus, Trash2, Play, CheckCircle2, XCircle, Building2, Globe2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Input } from '@/components/input';
import {
  cloneAttendanceBonusPolicy,
  createAttendanceBonusPolicy,
  getAttendanceBonusTemplates,
  previewAttendanceBonus,
  updateAttendanceBonusPolicy,
  type AttendanceBonusPolicy,
  type AttendanceBonusTemplate,
  type BonusCondition,
  type BonusMetric,
  type BonusOperator,
  type BonusPreviewResult,
  type BonusTier,
  type CreateBonusPolicyPayload,
  type UpdateBonusPolicyPayload,
} from '@/services/compensation.service';
import { getDepartments, hrErrorMessage, type Department } from '@/services/hrService';

function formatVnd(val?: number): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

const METRIC_LABELS: Record<BonusMetric, { label: string; unit: string }> = {
  LATE_COUNT: { label: 'Số lần đi trễ', unit: 'lần' },
  LATE_MINUTES: { label: 'Số phút đi trễ', unit: 'phút' },
  EARLY_COUNT: { label: 'Số lần về sớm', unit: 'lần' },
  EARLY_MINUTES: { label: 'Số phút về sớm', unit: 'phút' },
  ABSENT_DAYS: { label: 'Số ngày vắng mặt', unit: 'ngày' },
  INCOMPLETE_DAYS: { label: 'Số ngày chưa hoàn thành công', unit: 'ngày' },
};

const OPERATOR_LABELS: Record<BonusOperator, string> = {
  EQ: '= (Bằng)',
  LT: '< (Nhỏ hơn)',
  LTE: '<= (Nhỏ hơn hoặc bằng)',
  GT: '> (Lớn hơn)',
  GTE: '>= (Lớn hơn hoặc bằng)',
};

// ───────── Create/Clone Policy Dialog ─────────

export function BonusPolicyCreateDialog({
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
  const [templates, setTemplates] = useState<AttendanceBonusTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mode, setMode] = useState<'clone' | 'custom'>('clone');

  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [bonusAmount, setBonusAmount] = useState('1000000');
  const [scope, setScope] = useState<'ALL' | 'DEPARTMENT'>('ALL');
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');

  const [tiers, setTiers] = useState<BonusTier[]>([
    {
      order: 1,
      percentage: 100,
      conditions: [{ metric: 'LATE_COUNT', operator: 'EQ', value: 0 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }],
    },
    {
      order: 2,
      percentage: 70,
      conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 2 }, { metric: 'ABSENT_DAYS', operator: 'EQ', value: 0 }],
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    Promise.all([
      getAttendanceBonusTemplates(apiBase),
      getDepartments(apiBase, true).catch(() => []),
    ])
      .then(([tpls, depts]) => {
        setTemplates(tpls);
        setDepartments(depts);
        if (tpls.length > 0 && !templateId) setTemplateId(tpls[0]._id);
      })
      .catch(err => setError(hrErrorMessage(err)));
  }, [apiBase, open]);

  const toggleDepartment = (deptId: string) => {
    setSelectedDepartmentIds(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId],
    );
  };

  const addTier = () => {
    setTiers(prev => [
      ...prev,
      {
        order: prev.length + 1,
        percentage: 50,
        conditions: [{ metric: 'LATE_COUNT', operator: 'LTE', value: 4 }],
      },
    ]);
  };

  const removeTier = (index: number) => {
    setTiers(prev => prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, order: i + 1 })));
  };

  const updateTierPercentage = (index: number, val: number) => {
    setTiers(prev => prev.map((t, i) => (i === index ? { ...t, percentage: Number(val) || 0 } : t)));
  };

  const addCondition = (tierIndex: number) => {
    setTiers(prev =>
      prev.map((t, i) =>
        i === tierIndex
          ? { ...t, conditions: [...t.conditions, { metric: 'LATE_COUNT', operator: 'EQ', value: 0 }] }
          : t,
      ),
    );
  };

  const removeCondition = (tierIndex: number, condIndex: number) => {
    setTiers(prev =>
      prev.map((t, i) =>
        i === tierIndex
          ? { ...t, conditions: t.conditions.filter((_, ci) => ci !== condIndex) }
          : t,
      ),
    );
  };

  const updateCondition = (tierIndex: number, condIndex: number, field: keyof BonusCondition, val: unknown) => {
    setTiers(prev =>
      prev.map((t, i) =>
        i === tierIndex
          ? {
              ...t,
              conditions: t.conditions.map((c, ci) => (ci === condIndex ? { ...c, [field]: field === 'value' ? Number(val) || 0 : val } : c)),
            }
          : t,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Vui lòng nhập tên chính sách.');
    const amt = Number(bonusAmount);
    if (Number.isNaN(amt) || amt < 0) return setError('Số tiền thưởng không hợp lệ.');
    if (!effectiveFrom) return setError('Vui lòng chọn ngày hiệu lực.');
    if (scope === 'DEPARTMENT' && selectedDepartmentIds.length === 0) {
      return setError('Vui lòng chọn ít nhất một phòng ban áp dụng chính sách này.');
    }

    // Clean tiers to ensure pure numbers
    const cleanTiers: BonusTier[] = tiers.map((t, idx) => ({
      order: idx + 1,
      percentage: Number(t.percentage) || 0,
      conditions: t.conditions.map(c => ({
        metric: c.metric,
        operator: c.operator,
        value: Number(c.value) || 0,
      })),
    }));

    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'clone' && templateId) {
        await cloneAttendanceBonusPolicy(apiBase, templateId, {
          name: name.trim(),
          bonusAmount: amt,
          scope,
          departmentIds: scope === 'DEPARTMENT' ? selectedDepartmentIds : [],
          effectiveFrom,
          effectiveTo: effectiveTo || null,
        });
      } else {
        const payload: CreateBonusPolicyPayload = {
          name: name.trim(),
          bonusAmount: amt,
          scope,
          departmentIds: scope === 'DEPARTMENT' ? selectedDepartmentIds : [],
          tiers: cleanTiers,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
        };
        await createAttendanceBonusPolicy(apiBase, payload);
      }
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>Tạo chính sách thưởng chuyên cần</DialogTitle>
          <DialogDescription className="mt-1">Cấu hình điều kiện và mức thưởng cho chuyên cần theo phiên bản (TASK-034).</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 max-h-[calc(85vh-130px)]">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex rounded-lg border border-border p-1 bg-muted/30 text-xs font-medium">
              <button
                type="button"
                className={`flex-1 py-1.5 rounded-md transition-colors ${mode === 'clone' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setMode('clone')}
              >
                Clone từ Template chuẩn
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 rounded-md transition-colors ${mode === 'custom' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setMode('custom')}
              >
                Tự định nghĩa quy tắc
              </button>
            </div>

            {mode === 'clone' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Chọn template mẫu <span className="text-red-500">*</span></label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Chọn template mẫu…</option>
                  {templates.map(tpl => (
                    <option key={tpl._id} value={tpl._id}>
                      [{tpl.code}] {tpl.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tên chính sách <span className="text-red-500">*</span></label>
                <Input placeholder="VD: Thưởng chuyên cần tháng 09/2026" value={name} onChange={e => setName(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mức thưởng chuẩn (VND) <span className="text-red-500">*</span></label>
                <Input type="number" min="0" step="100000" placeholder="1000000" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} disabled={submitting} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày bắt đầu hiệu lực <span className="text-red-500">*</span></label>
                <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày kết thúc (tùy chọn)</label>
                <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} disabled={submitting} placeholder="Để trống nếu vô hạn" />
              </div>
            </div>

            {/* Scope selection */}
            <div className="space-y-2.5 rounded-lg border border-border p-3.5 bg-muted/20">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                <Building2 className="size-4 text-primary" />
                Phạm vi áp dụng chính sách <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    scope === 'ALL'
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                  onClick={() => setScope('ALL')}
                  disabled={submitting}
                >
                  <Globe2 className="mt-0.5 size-5 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Toàn công ty</div>
                    <div className="text-xs text-muted-foreground">Tất cả nhân sự đều áp dụng chung quy tắc thưởng này.</div>
                  </div>
                </button>

                <button
                  type="button"
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    scope === 'DEPARTMENT'
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                  onClick={() => setScope('DEPARTMENT')}
                  disabled={submitting}
                >
                  <Building2 className="mt-0.5 size-5 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Theo phòng ban</div>
                    <div className="text-xs text-muted-foreground">Chỉ áp dụng cho các phòng ban được chọn dưới đây.</div>
                  </div>
                </button>
              </div>

              {scope === 'DEPARTMENT' && (
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Chọn các phòng ban áp dụng ({selectedDepartmentIds.length}/{departments.length}):
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onClick={() => setSelectedDepartmentIds(departments.map(d => d._id))}
                      >
                        Chọn tất cả
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2 text-muted-foreground"
                        onClick={() => setSelectedDepartmentIds([])}
                      >
                        Bỏ chọn
                      </Button>
                    </div>
                  </div>

                  {departments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Không có phòng ban nào trong hệ thống.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                      {departments.map(dept => {
                        const isChecked = selectedDepartmentIds.includes(dept._id);
                        return (
                          <label
                            key={dept._id}
                            className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer select-none transition-colors ${
                              isChecked
                                ? 'border-primary bg-primary/10 font-medium text-foreground'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                              checked={isChecked}
                              onChange={() => toggleDepartment(dept._id)}
                            />
                            <span className="truncate">
                              <span className="font-semibold text-primary mr-1">[{dept.code}]</span>
                              {dept.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {mode === 'custom' && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Các mức thưởng (Tiers)</span>
                  <Button type="button" size="sm" variant="outline" onClick={addTier}>
                    <Plus className="mr-1 size-3.5" />Thêm mức thưởng
                  </Button>
                </div>

                {tiers.map((tier, tIdx) => (
                  <div key={tIdx} className="space-y-2 rounded-lg border border-border bg-background p-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">Bậc #{tIdx + 1}</span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={tier.percentage}
                            onChange={e => updateTierPercentage(tIdx, Number(e.target.value))}
                            className="h-7 w-16 text-xs text-right font-semibold"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-1">
                            ({formatVnd((Number(bonusAmount || 0) * tier.percentage) / 100)})
                          </span>
                        </div>
                      </div>
                      {tiers.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeTier(tIdx)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground font-medium">Điều kiện (Tất cả phải thỏa mãn):</span>
                    {tier.conditions.map((cond, cIdx) => (
                      <div key={cIdx} className="flex flex-wrap items-center gap-2">
                        <select
                          className="h-8 w-44 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          value={cond.metric}
                          onChange={e => updateCondition(tIdx, cIdx, 'metric', e.target.value as BonusMetric)}
                          disabled={submitting}
                        >
                          {Object.entries(METRIC_LABELS).map(([k, item]) => (
                            <option key={k} value={k}>{item.label}</option>
                          ))}
                        </select>

                        <select
                          className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          value={cond.operator}
                          onChange={e => updateCondition(tIdx, cIdx, 'operator', e.target.value as BonusOperator)}
                          disabled={submitting}
                        >
                          {Object.entries(OPERATOR_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>

                        <Input
                          type="number"
                          className="h-8 w-20 text-xs"
                          value={cond.value}
                          onChange={e => updateCondition(tIdx, cIdx, 'value', Number(e.target.value))}
                        />

                        {tier.conditions.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeCondition(tIdx, cIdx)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px] text-primary" onClick={() => addCondition(tIdx)}>
                      + Thêm điều kiện
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Tạo chính sách'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);
}

// ───────── Preview / Test Simulator Dialog ─────────

export function BonusPolicyPreviewDialog({
  apiBase,
  policy,
  open,
  onClose,
}: {
  apiBase: string;
  policy: AttendanceBonusPolicy;
  open: boolean;
  onClose: () => void;
}) {
  const [metrics, setMetrics] = useState<Record<BonusMetric, number>>({
    LATE_COUNT: 0,
    LATE_MINUTES: 0,
    EARLY_COUNT: 0,
    EARLY_MINUTES: 0,
    ABSENT_DAYS: 0,
    INCOMPLETE_DAYS: 0,
  });

  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<BonusPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMetricChange = (k: BonusMetric, val: number) => {
    setMetrics(prev => ({ ...prev, [k]: Math.max(0, val) }));
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setError(null);
    try {
      const res = await previewAttendanceBonus(apiBase, {
        policyId: policy._id,
        metrics,
      });
      setResult(res);
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (open) void handleSimulate();
  }, [open, policy._id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-5 text-primary" />
            Dùng thử quy tắc [{policy.name}]
          </DialogTitle>
          <DialogDescription className="mt-1">
            Nhập số liệu chấm công giả định trong tháng để kiểm tra mức % và tiền thưởng theo quy tắc thời gian thực.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 max-h-[calc(85vh-130px)]">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 rounded-lg border border-border p-3.5 bg-muted/20">
            {Object.entries(METRIC_LABELS).map(([key, item]) => (
              <div key={key} className="space-y-1 rounded-md border border-border/60 bg-card p-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground">{item.label}</label>
                  <span className="text-[10px] text-primary/80 font-semibold">({item.unit})</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  className="h-8 text-xs font-semibold"
                  value={metrics[key as BonusMetric]}
                  onChange={e => handleMetricChange(key as BonusMetric, Number(e.target.value))}
                />
              </div>
            ))}
          </div>

          <Button type="button" className="w-full" disabled={simulating} onClick={handleSimulate}>
            <Play className="mr-1.5 size-4" />
            {simulating ? 'Đang kiểm tra quy tắc…' : 'Tính thử kết quả ngay'}
          </Button>

          {result && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kết quả đánh giá</span>
                {result.matchedOrder !== null ? (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                    Đạt Mức #{result.matchedOrder} ({result.percentage}%)
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-semibold">
                    Không đạt mức thưởng nào (0%)
                  </Badge>
                )}
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">Số tiền thưởng thực nhận:</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatVnd(result.amount)}
                </span>
              </div>

              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-semibold text-muted-foreground">Nhật ký đánh giá từng mức thưởng (Execution Trace):</span>
                <div className="rounded-md bg-muted p-2.5 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto">
                  {result.trace.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {result.matchedOrder !== null ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="size-3.5 text-red-500 shrink-0" />
                      )}
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border px-6 py-3.5 bg-muted/15">
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────── Edit Bonus Policy Dialog ─────────

export function BonusPolicyEditDialog({
  apiBase,
  policy,
  open,
  onClose,
  onUpdated,
}: {
  apiBase: string;
  policy: AttendanceBonusPolicy;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState(policy.name);
  const [bonusAmount, setBonusAmount] = useState(String(policy.bonusAmount));
  const [scope, setScope] = useState<'ALL' | 'DEPARTMENT'>(policy.scope ?? 'ALL');
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(policy.departmentIds ?? []);
  const [effectiveFrom, setEffectiveFrom] = useState(policy.effectiveFrom ? policy.effectiveFrom.split('T')[0] : '');
  const [effectiveTo, setEffectiveTo] = useState(policy.effectiveTo ? policy.effectiveTo.split('T')[0] : '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(policy.name);
    setBonusAmount(String(policy.bonusAmount));
    setScope(policy.scope ?? 'ALL');
    setSelectedDepartmentIds(policy.departmentIds ?? []);
    setEffectiveFrom(policy.effectiveFrom ? policy.effectiveFrom.split('T')[0] : '');
    setEffectiveTo(policy.effectiveTo ? policy.effectiveTo.split('T')[0] : '');
    setError(null);
    getDepartments(apiBase, true).then(setDepartments).catch(() => []);
  }, [apiBase, open, policy]);

  const handleToggleDepartment = (deptId: string) => {
    setSelectedDepartmentIds(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Vui lòng nhập tên chính sách.');
    const amt = Number(bonusAmount);
    if (Number.isNaN(amt) || amt < 0) return setError('Số tiền thưởng không hợp lệ.');
    if (!effectiveFrom) return setError('Vui lòng chọn ngày hiệu lực.');
    if (scope === 'DEPARTMENT' && selectedDepartmentIds.length === 0) {
      return setError('Vui lòng chọn ít nhất một phòng ban áp dụng chính sách này.');
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: UpdateBonusPolicyPayload = {
        name: name.trim(),
        bonusAmount: amt,
        scope,
        departmentIds: scope === 'DEPARTMENT' ? selectedDepartmentIds : [],
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo || null,
      };
      await updateAttendanceBonusPolicy(apiBase, policy._id, payload);
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <div className="flex items-center gap-2">
            <DialogTitle>Chỉnh sửa chính sách thưởng chuyên cần</DialogTitle>
            <Badge variant="outline">v{policy.version}</Badge>
          </div>
          <DialogDescription className="mt-1">Cập nhật phạm vi và mức thưởng của chính sách.</DialogDescription>
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
                <label className="text-sm font-medium">Tên chính sách <span className="text-red-500">*</span></label>
                <Input value={name} onChange={e => setName(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mức thưởng tối đa (VND) <span className="text-red-500">*</span></label>
                <Input type="number" min="0" step="100000" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} disabled={submitting} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày bắt đầu hiệu lực <span className="text-red-500">*</span></label>
                <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày kết thúc (tùy chọn)</label>
                <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} disabled={submitting} placeholder="Để trống nếu vô hạn" />
              </div>
            </div>

            <div className="space-y-2.5 rounded-lg border border-border p-3.5 bg-muted/20">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                <Building2 className="size-4 text-primary" />
                Phạm vi áp dụng chính sách <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    scope === 'ALL'
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                  onClick={() => setScope('ALL')}
                  disabled={submitting}
                >
                  <Globe2 className="mt-0.5 size-5 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Toàn công ty</div>
                    <div className="text-xs text-muted-foreground">Tất cả nhân sự đều áp dụng chung quy tắc thưởng này.</div>
                  </div>
                </button>

                <button
                  type="button"
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    scope === 'DEPARTMENT'
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                  onClick={() => setScope('DEPARTMENT')}
                  disabled={submitting}
                >
                  <Building2 className="mt-0.5 size-5 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Theo phòng ban</div>
                    <div className="text-xs text-muted-foreground">Chỉ áp dụng cho các phòng ban được chọn dưới đây.</div>
                  </div>
                </button>
              </div>

              {scope === 'DEPARTMENT' && (
                <div className="pt-2 border-t border-border mt-3 space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Chọn phòng ban áp dụng:</span>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {departments.map(d => (
                      <label key={d._id} className="flex items-center gap-2 text-xs p-1.5 rounded border border-border bg-card hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDepartmentIds.includes(d._id)}
                          onChange={() => handleToggleDepartment(d._id)}
                          className="rounded border-input text-primary"
                          disabled={submitting}
                        />
                        <span className="truncate font-medium">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Cập nhật chính sách'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
