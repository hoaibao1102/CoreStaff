import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/dialog';
import { Button } from '../../../components/button';
import { Input } from '../../../components/input';
import { Badge } from '../../../components/badge';
import { FormLabel } from '../../../components/form/FormLabel';
import { FormError } from '../../../components/form/FormError';
import { toast } from '../../../components/toast';
import { INSURANCE_CONTRIBUTION_TYPE, INSURANCE_CONTRIBUTION_TYPE_LABELS, type InsuranceContributionType } from '../../../lib/types';
import { createInsurancePolicy, hrErrorMessage, type InsurancePolicy, type InsurancePolicyCreateDto } from '../../../services/hrService';

const TYPES: InsuranceContributionType[] = [
  INSURANCE_CONTRIBUTION_TYPE.SOCIAL_INSURANCE,
  INSURANCE_CONTRIBUTION_TYPE.HEALTH_INSURANCE,
  INSURANCE_CONTRIBUTION_TYPE.UNEMPLOYMENT_INSURANCE,
];

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
}

interface TypeRowForm {
  floorAmount: string;
  capAmount: string;
  employerRate: string;
}

type TypeRowsForm = Record<InsuranceContributionType, TypeRowForm>;

const EMPTY_ROWS: TypeRowsForm = {
  SOCIAL_INSURANCE: { floorAmount: '', capAmount: '', employerRate: '' },
  HEALTH_INSURANCE: { floorAmount: '', capAmount: '', employerRate: '' },
  UNEMPLOYMENT_INSURANCE: { floorAmount: '', capAmount: '', employerRate: '' },
};

/* ───────── Create Dialog ───────── */

export function InsurancePolicyCreateDialog(props: {
  apiBase: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [legalReference, setLegalReference] = useState('');
  const [employeeRates, setEmployeeRates] = useState<Record<InsuranceContributionType, string>>({
    SOCIAL_INSURANCE: '8',
    HEALTH_INSURANCE: '1.5',
    UNEMPLOYMENT_INSURANCE: '1',
  });
  const [rows, setRows] = useState<TypeRowsForm>(EMPTY_ROWS);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const reset = () => {
    setEffectiveFrom('');
    setEffectiveTo('');
    setLegalReference('');
    setEmployeeRates({ SOCIAL_INSURANCE: '8', HEALTH_INSURANCE: '1.5', UNEMPLOYMENT_INSURANCE: '1' });
    setRows(EMPTY_ROWS);
    setErrors({});
  };

  useEffect(() => { if (props.open) reset(); }, [props.open]);

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};
    if (!effectiveFrom) next.effectiveFrom = 'Vui lòng chọn ngày hiệu lực.';
    if (effectiveFrom && effectiveTo && effectiveTo <= effectiveFrom) next.effectiveTo = 'Ngày hiệu lực đến phải sau ngày hiệu lực từ.';
    if (!legalReference.trim()) next.legalReference = 'Vui lòng nhập tham chiếu pháp lý.';

    for (const type of TYPES) {
      const rate = Number(employeeRates[type]);
      if (employeeRates[type].trim() === '' || !Number.isFinite(rate) || rate < 0 || rate > 100) {
        next[`employeeRate-${type}`] = 'Tỷ lệ phải từ 0 đến 100%.';
      }
      const row = rows[type];
      const employerRate = Number(row.employerRate);
      if (row.employerRate.trim() === '' || !Number.isFinite(employerRate) || employerRate < 0 || employerRate > 100) {
        next[`employerRate-${type}`] = 'Tỷ lệ doanh nghiệp đóng phải từ 0 đến 100%.';
      }
      if (row.floorAmount.trim() && (!Number.isFinite(Number(row.floorAmount)) || Number(row.floorAmount) < 0)) {
        next[`floor-${type}`] = 'Mức sàn phải là số không âm.';
      }
      if (row.capAmount.trim() && (!Number.isFinite(Number(row.capAmount)) || Number(row.capAmount) < 0)) {
        next[`cap-${type}`] = 'Mức trần phải là số không âm.';
      }
      if (row.floorAmount.trim() && row.capAmount.trim() && Number(row.floorAmount) > Number(row.capAmount)) {
        next[`cap-${type}`] = 'Mức trần phải lớn hơn hoặc bằng mức sàn.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) {
      toast.warning('Vui lòng kiểm tra thông tin', 'Một số trường chưa đầy đủ hoặc chưa đúng.');
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const dto: InsurancePolicyCreateDto = {
        effectiveFrom,
        ...(effectiveTo ? { effectiveTo } : {}),
        legalReference: legalReference.trim(),
        socialInsuranceEmployeeRate: Number(employeeRates.SOCIAL_INSURANCE) / 100,
        healthInsuranceEmployeeRate: Number(employeeRates.HEALTH_INSURANCE) / 100,
        unemploymentInsuranceEmployeeRate: Number(employeeRates.UNEMPLOYMENT_INSURANCE) / 100,
        salaryBaseRules: TYPES.map((type) => ({
          type,
          floorAmount: rows[type].floorAmount.trim() ? Number(rows[type].floorAmount) : null,
        })),
        capRules: TYPES.map((type) => ({
          type,
          capAmount: rows[type].capAmount.trim() ? Number(rows[type].capAmount) : null,
        })),
        employerContributionRates: TYPES.map((type) => ({
          type,
          rate: Number(rows[type].employerRate) / 100,
        })),
      };
      await createInsurancePolicy(props.apiBase, dto);
      toast.success('Tạo chính sách bảo hiểm thành công', 'Chính sách đã được ghi nhận cho giai đoạn hiệu lực mới.');
      props.onOpenChange(false);
      props.onCreated?.();
    } catch (err) {
      toast.error('Không thể tạo chính sách bảo hiểm', hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(next) => {
      if (!submitting) { if (!next) reset(); props.onOpenChange(next); }
    }}>
      <DialogContent className="max-w-3xl gap-0">
        <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
          <DialogTitle className="text-xl font-semibold">Tạo chính sách bảo hiểm</DialogTitle>
          <DialogDescription className="mt-1.5">
            Cấu hình tỷ lệ, mức sàn/trần cho cả 3 khoản BHXH/BHYT/BHTN của một giai đoạn hiệu lực mới. Không sửa được sau khi tạo — chỉ có thể tạo phiên bản mới.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FormLabel htmlFor="inspolicy-from" required>Hiệu lực từ</FormLabel>
                <Input id="inspolicy-from" type="date" className="h-11" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} disabled={submitting} aria-invalid={!!errors.effectiveFrom} />
                <FormError message={errors.effectiveFrom} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="inspolicy-to">Hiệu lực đến (tùy chọn)</FormLabel>
                <Input id="inspolicy-to" type="date" className="h-11" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} disabled={submitting} aria-invalid={!!errors.effectiveTo} />
                <FormError message={errors.effectiveTo} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="inspolicy-legal" required>Tham chiếu pháp lý</FormLabel>
                <Input id="inspolicy-legal" className="h-11" value={legalReference} placeholder="VD: Luật BHXH 41/2024/QH15" onChange={(e) => setLegalReference(e.target.value)} disabled={submitting} aria-invalid={!!errors.legalReference} />
                <FormError message={errors.legalReference} />
              </div>
            </div>

            <div className="space-y-3">
              <FormLabel>Tỷ lệ người lao động đóng (%)</FormLabel>
              <div className="grid gap-4 sm:grid-cols-3">
                {TYPES.map((type) => (
                  <div key={type} className="space-y-1.5">
                    <label htmlFor={`inspolicy-employee-${type}`} className="text-xs font-medium text-muted-foreground">{INSURANCE_CONTRIBUTION_TYPE_LABELS[type]}</label>
                    <Input
                      id={`inspolicy-employee-${type}`}
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="h-11"
                      value={employeeRates[type]}
                      onChange={(e) => setEmployeeRates((p) => ({ ...p, [type]: e.target.value }))}
                      disabled={submitting}
                      aria-invalid={!!errors[`employeeRate-${type}`]}
                    />
                    <FormError message={errors[`employeeRate-${type}`]} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <FormLabel>Mức sàn / trần / tỷ lệ doanh nghiệp đóng theo từng khoản</FormLabel>
              <p className="text-xs text-muted-foreground">Để trống mức sàn/trần nếu chưa có quy định — hệ thống sẽ không áp trần/sàn cho khoản đó.</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Khoản</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mức sàn (VNĐ)</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mức trần (VNĐ)</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">DN đóng (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {TYPES.map((type) => (
                      <tr key={type}>
                        <td className="px-3 py-2 font-medium text-foreground">{INSURANCE_CONTRIBUTION_TYPE_LABELS[type]}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            className="h-10 w-32"
                            value={rows[type].floorAmount}
                            onChange={(e) => setRows((p) => ({ ...p, [type]: { ...p[type], floorAmount: e.target.value } }))}
                            disabled={submitting}
                            aria-invalid={!!errors[`floor-${type}`]}
                          />
                          <FormError message={errors[`floor-${type}`]} />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            className="h-10 w-32"
                            value={rows[type].capAmount}
                            onChange={(e) => setRows((p) => ({ ...p, [type]: { ...p[type], capAmount: e.target.value } }))}
                            disabled={submitting}
                            aria-invalid={!!errors[`cap-${type}`]}
                          />
                          <FormError message={errors[`cap-${type}`]} />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            className="h-10 w-24"
                            value={rows[type].employerRate}
                            onChange={(e) => setRows((p) => ({ ...p, [type]: { ...p[type], employerRate: e.target.value } }))}
                            disabled={submitting}
                            aria-invalid={!!errors[`employerRate-${type}`]}
                          />
                          <FormError message={errors[`employerRate-${type}`]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-popover px-5 py-4">
            <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={() => { reset(); props.onOpenChange(false); }}>
              Hủy
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {submitting ? 'Đang tạo…' : 'Tạo chính sách'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Detail Dialog ───────── */

export function InsurancePolicyDetailDialog({ policy, open, onClose }: { policy: InsurancePolicy | null; open: boolean; onClose: () => void }) {
  if (!policy) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Chi tiết chính sách bảo hiểm
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">Phiên bản v{policy.version}</Badge>
          </div>
          <DialogDescription className="mt-1.5">{policy.legalReference}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Hiệu lực</span>
            <span className="font-medium text-foreground">{formatDate(policy.effectiveFrom)} → {policy.effectiveTo ? formatDate(policy.effectiveTo) : 'Hiện tại'}</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Khoản</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">NLĐ đóng</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">DN đóng</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sàn</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Trần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {TYPES.map((type) => {
                  const employeeRate = type === 'SOCIAL_INSURANCE' ? policy.socialInsuranceEmployeeRate
                    : type === 'HEALTH_INSURANCE' ? policy.healthInsuranceEmployeeRate
                      : policy.unemploymentInsuranceEmployeeRate;
                  const floor = policy.salaryBaseRules.find((r) => r.type === type)?.floorAmount;
                  const cap = policy.capRules.find((r) => r.type === type)?.capAmount;
                  const employerRate = policy.employerContributionRates.find((r) => r.type === type)?.rate;
                  return (
                    <tr key={type}>
                      <td className="px-3 py-2 font-medium text-foreground">{INSURANCE_CONTRIBUTION_TYPE_LABELS[type]}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{(employeeRate * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{employerRate != null ? `${(employerRate * 100).toFixed(2)}%` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{floor != null ? VND.format(floor) : 'Không giới hạn'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{cap != null ? VND.format(cap) : 'Không giới hạn'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed">Chính sách này không thể sửa tại chỗ. Điều chỉnh tỷ lệ/mức trần-sàn = tạo một phiên bản mới với ngày hiệu lực kế tiếp.</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>Đóng</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
