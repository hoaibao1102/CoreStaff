import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/dialog';
import { Button } from '../../../components/button';
import { Input } from '../../../components/input';
import { Textarea } from '../../../components/textarea';
import { Badge } from '../../../components/badge';
import { FormLabel } from '../../../components/form/FormLabel';
import { FormError } from '../../../components/form/FormError';
import { toast } from '../../../components/toast';
import {
  createEnterpriseInsurancePolicy,
  hrErrorMessage,
  type EnterpriseInsuranceCostBearer,
  type EnterpriseInsurancePolicy,
  type EnterpriseInsurancePolicyCreateDto,
} from '../../../services/hrService';

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

const COST_BEARER_OPTIONS: Array<{ value: EnterpriseInsuranceCostBearer; label: string }> = [
  { value: 'EMPLOYER', label: 'Công ty trả toàn bộ' },
  { value: 'SHARED', label: 'Công ty và nhân viên cùng chia sẻ' },
  { value: 'EMPLOYEE', label: 'Nhân viên tự trả' },
];

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
}

/* ───────── Create Dialog ───────── */

export function EnterpriseInsurancePolicyCreateDialog(props: {
  apiBase: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    effectiveFrom: '',
    effectiveTo: '',
    provider: '',
    policyNumber: '',
    coverageDescription: '',
    premiumPerEmployee: '',
    costBearer: 'EMPLOYER' as EnterpriseInsuranceCostBearer,
    employeeContributionAmount: '',
    note: '',
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const reset = () => {
    setForm({
      effectiveFrom: '',
      effectiveTo: '',
      provider: '',
      policyNumber: '',
      coverageDescription: '',
      premiumPerEmployee: '',
      costBearer: 'EMPLOYER',
      employeeContributionAmount: '',
      note: '',
    });
    setErrors({});
  };

  useEffect(() => { if (props.open) reset(); }, [props.open]);

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};
    if (!form.effectiveFrom) next.effectiveFrom = 'Vui lòng chọn ngày hiệu lực.';
    if (form.effectiveFrom && form.effectiveTo && form.effectiveTo <= form.effectiveFrom) {
      next.effectiveTo = 'Ngày hiệu lực đến phải sau ngày hiệu lực từ.';
    }
    if (!form.provider.trim()) next.provider = 'Vui lòng nhập nhà cung cấp bảo hiểm.';
    if (!form.coverageDescription.trim()) next.coverageDescription = 'Vui lòng mô tả phạm vi bảo hiểm.';
    if (form.premiumPerEmployee.trim() && (!Number.isFinite(Number(form.premiumPerEmployee)) || Number(form.premiumPerEmployee) < 0)) {
      next.premiumPerEmployee = 'Mức phí phải là số không âm.';
    }
    if (form.employeeContributionAmount.trim()) {
      const amount = Number(form.employeeContributionAmount);
      if (!Number.isFinite(amount) || amount < 0) next.employeeContributionAmount = 'Số tiền phải là số không âm.';
      else if (form.costBearer === 'EMPLOYER' && amount > 0) next.employeeContributionAmount = 'Công ty đã chọn tự chi trả toàn bộ — không thể nhập số tiền nhân viên đóng góp.';
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
      const dto: EnterpriseInsurancePolicyCreateDto = {
        effectiveFrom: form.effectiveFrom,
        ...(form.effectiveTo ? { effectiveTo: form.effectiveTo } : {}),
        provider: form.provider.trim(),
        ...(form.policyNumber.trim() ? { policyNumber: form.policyNumber.trim() } : {}),
        coverageDescription: form.coverageDescription.trim(),
        premiumPerEmployee: form.premiumPerEmployee.trim() ? Number(form.premiumPerEmployee) : null,
        costBearer: form.costBearer,
        employeeContributionAmount: form.employeeContributionAmount.trim() ? Number(form.employeeContributionAmount) : null,
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      };
      await createEnterpriseInsurancePolicy(props.apiBase, dto);
      toast.success('Tạo bảo hiểm doanh nghiệp thành công', 'Chính sách đã được ghi nhận cho giai đoạn hiệu lực mới.');
      props.onOpenChange(false);
      props.onCreated?.();
    } catch (err) {
      toast.error('Không thể tạo bảo hiểm doanh nghiệp', hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(next) => {
      if (!submitting) { if (!next) reset(); props.onOpenChange(next); }
    }}>
      <DialogContent className="max-w-2xl gap-0">
        <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
          <DialogTitle className="text-xl font-semibold">Tạo bảo hiểm doanh nghiệp</DialogTitle>
          <DialogDescription className="mt-1.5">
            Bảo hiểm thương mại tự nguyện (tai nạn, sức khỏe…) công ty mua thêm cho nhân viên — khác với BHXH/BHYT/BHTN bắt buộc.
            Mỗi lần cấu hình lại là một giai đoạn hiệu lực mới, không sửa hồ sơ cũ.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FormLabel htmlFor="entins-from" required>Hiệu lực từ</FormLabel>
                <Input id="entins-from" type="date" className="h-11" value={form.effectiveFrom} onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))} disabled={submitting} aria-invalid={!!errors.effectiveFrom} />
                <FormError message={errors.effectiveFrom} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="entins-to">Hiệu lực đến (tùy chọn)</FormLabel>
                <Input id="entins-to" type="date" className="h-11" value={form.effectiveTo} onChange={(e) => setForm((p) => ({ ...p, effectiveTo: e.target.value }))} disabled={submitting} aria-invalid={!!errors.effectiveTo} />
                <FormError message={errors.effectiveTo} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="entins-provider" required>Nhà cung cấp</FormLabel>
                <Input id="entins-provider" className="h-11" placeholder="VD: Bảo Việt, PVI, Manulife…" value={form.provider} onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))} disabled={submitting} aria-invalid={!!errors.provider} />
                <FormError message={errors.provider} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="entins-policy-number">Số hợp đồng (tùy chọn)</FormLabel>
                <Input id="entins-policy-number" className="h-11" value={form.policyNumber} onChange={(e) => setForm((p) => ({ ...p, policyNumber: e.target.value }))} disabled={submitting} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FormLabel htmlFor="entins-coverage" required>Phạm vi bảo hiểm</FormLabel>
              <Textarea
                id="entins-coverage"
                className="min-h-20"
                value={form.coverageDescription}
                maxLength={1000}
                placeholder="VD: Bảo hiểm tai nạn con người 24/24 + chăm sóc sức khỏe cơ bản..."
                onChange={(e) => setForm((p) => ({ ...p, coverageDescription: e.target.value }))}
                disabled={submitting}
                aria-invalid={!!errors.coverageDescription}
              />
              <FormError message={errors.coverageDescription} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FormLabel htmlFor="entins-premium">Mức phí / nhân viên (VNĐ, tùy chọn)</FormLabel>
                <Input id="entins-premium" type="number" min="0" className="h-11" value={form.premiumPerEmployee} onChange={(e) => setForm((p) => ({ ...p, premiumPerEmployee: e.target.value }))} disabled={submitting} aria-invalid={!!errors.premiumPerEmployee} />
                <FormError message={errors.premiumPerEmployee} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="entins-cost-bearer" required>Ai chi trả</FormLabel>
                <select
                  id="entins-cost-bearer"
                  className="block h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  value={form.costBearer}
                  onChange={(e) => setForm((p) => ({ ...p, costBearer: e.target.value as EnterpriseInsuranceCostBearer }))}
                  disabled={submitting}
                >
                  {COST_BEARER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {form.costBearer !== 'EMPLOYER' && (
              <div className="space-y-1.5">
                <FormLabel htmlFor="entins-employee-contribution">Số tiền nhân viên đóng góp (VNĐ)</FormLabel>
                <Input id="entins-employee-contribution" type="number" min="0" className="h-11" value={form.employeeContributionAmount} onChange={(e) => setForm((p) => ({ ...p, employeeContributionAmount: e.target.value }))} disabled={submitting} aria-invalid={!!errors.employeeContributionAmount} />
                <FormError message={errors.employeeContributionAmount} />
              </div>
            )}

            <div className="space-y-1.5">
              <FormLabel htmlFor="entins-note">Ghi chú</FormLabel>
              <Textarea
                id="entins-note"
                className="min-h-20"
                value={form.note}
                maxLength={500}
                placeholder="Ghi chú của HR cho giai đoạn này (tùy chọn)..."
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                disabled={submitting}
              />
              <p className="text-right text-xs text-muted-foreground">{form.note.length}/500</p>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-popover px-5 py-4">
            <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={() => { reset(); props.onOpenChange(false); }}>
              Hủy
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {submitting ? 'Đang tạo…' : 'Tạo bảo hiểm doanh nghiệp'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Detail Dialog ───────── */

export function EnterpriseInsurancePolicyDetailDialog({
  policy,
  open,
  onClose,
}: {
  policy: EnterpriseInsurancePolicy | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!policy) return null;

  const costBearerLabel = COST_BEARER_OPTIONS.find((o) => o.value === policy.costBearer)?.label ?? policy.costBearer;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Chi tiết bảo hiểm doanh nghiệp
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">Phiên bản v{policy.version}</Badge>
          </div>
          <DialogDescription className="mt-1.5">{policy.provider}{policy.policyNumber ? ` — ${policy.policyNumber}` : ''}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6">
          <div className="divide-y divide-border rounded-lg border border-border">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Hiệu lực từ</span>
              <span className="font-medium text-foreground">{formatDate(policy.effectiveFrom)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Hiệu lực đến</span>
              <span className="font-medium text-foreground">{policy.effectiveTo ? formatDate(policy.effectiveTo) : 'Hiện tại'}</span>
            </div>
            <div className="px-4 py-3 text-sm">
              <span className="text-muted-foreground">Phạm vi bảo hiểm</span>
              <p className="mt-1 font-medium text-foreground">{policy.coverageDescription}</p>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Mức phí / nhân viên</span>
              <span className="font-medium text-foreground">{policy.premiumPerEmployee != null ? VND.format(policy.premiumPerEmployee) : 'Chưa xác định'}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Ai chi trả</span>
              <span className="font-medium text-foreground">{costBearerLabel}</span>
            </div>
            {policy.costBearer !== 'EMPLOYER' && (
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">Nhân viên đóng góp</span>
                <span className="font-medium text-foreground">{policy.employeeContributionAmount != null ? VND.format(policy.employeeContributionAmount) : 'Chưa xác định'}</span>
              </div>
            )}
            {policy.note && (
              <div className="px-4 py-3 text-sm">
                <span className="text-muted-foreground">Ghi chú</span>
                <p className="mt-1 font-medium text-foreground">{policy.note}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed">Hồ sơ này không thể sửa tại chỗ. Muốn thay đổi, tạo một hồ sơ mới với ngày hiệu lực kế tiếp — hệ thống tự tăng số phiên bản.</p>
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
