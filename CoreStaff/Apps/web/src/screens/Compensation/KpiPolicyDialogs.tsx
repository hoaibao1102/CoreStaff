import { useEffect, useState } from 'react';
import { Plus, Trash2, Building2, Globe2, Sparkles, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Input } from '@/components/input';
import {
  createKpiPolicy,
  updateKpiPolicy,
  type CreateKpiPolicyPayload,
  type KpiPolicy,
  type KpiPolicyType,
  type KpiTier,
} from '@/services/compensation.service';
import { getDepartments, hrErrorMessage, type Department } from '@/services/hrService';

function formatVnd(val?: number): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

const TEMPLATES: Record<KpiPolicyType, { label: string; description: string; defaultTiers: KpiTier[] }> = {
  GRADE: {
    label: 'Thang xếp loại chữ (A / B / C / D)',
    description: 'Phân loại theo cấp độ hoàn thành xuất sắc, tốt, đạt và không đạt.',
    defaultTiers: [
      { order: 1, name: 'Loại A (Xuất sắc)', percentage: 100 },
      { order: 2, name: 'Loại B (Tốt)', percentage: 70 },
      { order: 3, name: 'Loại C (Đạt)', percentage: 50 },
      { order: 4, name: 'Loại D (Không đạt)', percentage: 0 },
    ],
  },
  PASS_FAIL: {
    label: 'Đạt / Chưa đạt (Pass / Fail)',
    description: 'Đánh giá nhị phân 100% hoặc 0% đơn giản, nhanh chóng.',
    defaultTiers: [
      { order: 1, name: 'Đạt yêu cầu', percentage: 100 },
      { order: 2, name: 'Chưa đạt yêu cầu', percentage: 0 },
    ],
  },
  SCORE_RANGE: {
    label: 'Thang điểm số (0 - 100 điểm)',
    description: 'Tính tỷ lệ thưởng linh hoạt theo khoảng điểm đánh giá.',
    defaultTiers: [
      { order: 1, name: 'Từ 90 – 100 điểm', percentage: 100, minScore: 90, maxScore: 100 },
      { order: 2, name: 'Từ 75 – 89.9 điểm', percentage: 80, minScore: 75, maxScore: 89.9 },
      { order: 3, name: 'Từ 60 – 74.9 điểm', percentage: 50, minScore: 60, maxScore: 74.9 },
      { order: 4, name: 'Dưới 60 điểm', percentage: 0, minScore: 0, maxScore: 59.9 },
    ],
  },
};

export function KpiPolicyCreateDialog({
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [policyType, setPolicyType] = useState<KpiPolicyType>('GRADE');
  const [name, setName] = useState('Chính sách KPI theo xếp loại A/B/C/D');
  const [baseAmount, setBaseAmount] = useState('2000000');
  const [scope, setScope] = useState<'ALL' | 'DEPARTMENT'>('ALL');
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [tiers, setTiers] = useState<KpiTier[]>(TEMPLATES.GRADE.defaultTiers);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    getDepartments(apiBase, true)
      .then(setDepartments)
      .catch(err => setError(hrErrorMessage(err)));
  }, [apiBase, open]);

  const handleSelectType = (type: KpiPolicyType) => {
    setPolicyType(type);
    setTiers(TEMPLATES[type].defaultTiers);
    if (!name || Object.values(TEMPLATES).some(t => t.label === name || name.startsWith('Chính sách KPI'))) {
      setName(`Chính sách KPI (${TEMPLATES[type].label})`);
    }
  };

  const handleToggleDepartment = (deptId: string) => {
    setSelectedDepartmentIds(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const handleUpdateTier = (index: number, field: keyof KpiTier, val: any) => {
    setTiers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleAddTier = () => {
    setTiers(prev => [
      ...prev,
      { order: prev.length + 1, name: `Bậc ${prev.length + 1}`, percentage: 0 },
    ]);
  };

  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers(prev => prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, order: i + 1 })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Vui lòng nhập tên chính sách KPI.');
    const amt = Number(baseAmount);
    if (Number.isNaN(amt) || amt < 0) return setError('Số tiền thưởng cơ sở không hợp lệ.');
    if (scope === 'DEPARTMENT' && selectedDepartmentIds.length === 0) {
      return setError('Vui lòng chọn ít nhất một phòng ban áp dụng.');
    }
    if (tiers.length === 0) return setError('Vui lòng cấu hình ít nhất 1 bậc xếp loại.');

    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateKpiPolicyPayload = {
        name: name.trim(),
        policyType,
        baseAmount: amt,
        tiers,
        scope,
        departmentIds: scope === 'DEPARTMENT' ? selectedDepartmentIds : undefined,
        effectiveFrom,
        effectiveTo: effectiveTo ? effectiveTo : undefined,
      };
      await createKpiPolicy(apiBase, payload);
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
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Tạo Chính sách KPI mới
          </DialogTitle>
          <DialogDescription className="mt-1">
            Thiết lập thang bậc xếp loại và định mức tiền thưởng KPI (toàn công ty hoặc theo phòng ban).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 max-h-[calc(85vh-130px)]">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          {/* 1. Chọn kiểu thang bậc */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">1. Chọn kiểu xếp loại KPI</label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {(Object.entries(TEMPLATES) as [KpiPolicyType, typeof TEMPLATES[KpiPolicyType]][]).map(([key, tpl]) => {
                const isSelected = policyType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectType(key)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    <span className="font-semibold text-xs text-foreground flex items-center justify-between">
                      {tpl.label}
                      {isSelected && <CheckCircle2 className="size-4 text-primary" />}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {tpl.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Tên chính sách & Mức tiền cơ sở */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tên chính sách <span className="text-red-500">*</span></label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: KPI Khối Kinh Doanh..." disabled={submitting} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Mức tiền thưởng chuẩn (VND) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="100000"
                value={baseAmount}
                onChange={e => setBaseAmount(e.target.value)}
                placeholder="2000000"
                disabled={submitting}
              />
              <p className="text-[11px] text-muted-foreground">
                Chuẩn: <strong>{formatVnd(Number(baseAmount))}</strong> (100% KPI)
              </p>
            </div>
          </div>

          {/* 3. Phạm vi áp dụng */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">2. Phạm vi áp dụng</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setScope('ALL')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  scope === 'ALL'
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <Globe2 className="size-4" />
                Toàn công ty
              </button>

              <button
                type="button"
                onClick={() => setScope('DEPARTMENT')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  scope === 'DEPARTMENT'
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <Building2 className="size-4" />
                Theo phòng ban cụ thể
              </button>
            </div>

            {scope === 'DEPARTMENT' && (
              <div className="mt-3 p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Chọn các phòng ban áp dụng chính sách này:</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-36 overflow-y-auto">
                  {departments.map(dept => {
                    const checked = selectedDepartmentIds.includes(dept._id);
                    return (
                      <label
                        key={dept._id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border bg-card text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleDepartment(dept._id)}
                          className="rounded border-border"
                        />
                        <span className="truncate">{dept.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Cấu hình thang bậc */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">3. Bảng thang bậc & Tỷ lệ thưởng</label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddTier} className="h-7 text-xs">
                <Plus className="size-3 mr-1" /> Thêm bậc
              </Button>
            </div>

            <div className="space-y-2">
              {tiers.map((t, idx) => {
                const calculatedMoney = Math.round((Number(baseAmount || 0) * t.percentage) / 100);
                return (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-2.5 rounded-xl border border-border bg-card text-xs"
                  >
                    <div className="w-7 text-center font-bold text-muted-foreground shrink-0">
                      #{idx + 1}
                    </div>

                    <div className="flex-1">
                      <Input
                        value={t.name}
                        onChange={e => handleUpdateTier(idx, 'name', e.target.value)}
                        placeholder="Tên bậc..."
                        className="h-8 text-xs font-medium"
                      />
                    </div>

                    {policyType === 'SCORE_RANGE' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={t.minScore ?? ''}
                          onChange={e => handleUpdateTier(idx, 'minScore', e.target.value ? Number(e.target.value) : undefined)}
                          className="h-8 w-16 text-xs text-center"
                        />
                        <span>–</span>
                        <Input
                          type="number"
                          placeholder="Max"
                          value={t.maxScore ?? ''}
                          onChange={e => handleUpdateTier(idx, 'maxScore', e.target.value ? Number(e.target.value) : undefined)}
                          className="h-8 w-16 text-xs text-center"
                        />
                        <span className="text-[10px] text-muted-foreground">điểm</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="200"
                          value={t.percentage}
                          onChange={e => handleUpdateTier(idx, 'percentage', Number(e.target.value))}
                          className="h-8 w-20 text-xs pr-6 text-right font-bold"
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-semibold">%</span>
                      </div>
                    </div>

                    <div className="w-28 text-right font-mono font-bold text-emerald-700 shrink-0">
                      {formatVnd(calculatedMoney)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      disabled={tiers.length <= 1}
                      className="text-muted-foreground hover:text-red-600 disabled:opacity-30 p-1 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Thời gian hiệu lực */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hiệu lực từ ngày <span className="text-red-500">*</span></label>
              <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} disabled={submitting} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hiệu lực đến ngày (tùy chọn)</label>
              <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} disabled={submitting} />
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Đang lưu…' : 'Tạo chính sách KPI'}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);
}
