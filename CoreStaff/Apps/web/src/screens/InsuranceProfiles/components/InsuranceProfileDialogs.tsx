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
import { createInsuranceProfile, hrErrorMessage, type InsuranceProfile, type InsuranceProfileCreateDto } from '../../../services/hrService';

export interface InsuranceEmployeeOption {
  _id: string;
  fullName?: string | null;
  employeeCode: string;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
}

/* ───────── Create Dialog ───────── */

export function InsuranceProfileCreateDialog(props: {
  apiBase: string;
  open: boolean;
  employees: InsuranceEmployeeOption[];
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    effectiveFrom: '',
    effectiveTo: '',
    participatesSocialInsurance: true,
    participatesHealthInsurance: true,
    participatesUnemploymentInsurance: true,
    note: '',
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const reset = () => {
    setForm({
      employeeId: '',
      effectiveFrom: '',
      effectiveTo: '',
      participatesSocialInsurance: true,
      participatesHealthInsurance: true,
      participatesUnemploymentInsurance: true,
      note: '',
    });
    setErrors({});
  };

  useEffect(() => { if (props.open) reset(); }, [props.open]);

  const employeeOptions = props.employees.map((e) => ({ value: e._id, label: `${e.employeeCode} — ${e.fullName ?? ''}` }));

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};
    if (!form.employeeId) next.employeeId = 'Vui lòng chọn nhân viên.';
    if (!form.effectiveFrom) next.effectiveFrom = 'Vui lòng chọn ngày hiệu lực.';
    if (form.effectiveFrom && form.effectiveTo && form.effectiveTo <= form.effectiveFrom) {
      next.effectiveTo = 'Ngày hiệu lực đến phải sau ngày hiệu lực từ.';
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
      const dto: InsuranceProfileCreateDto = {
        employeeId: form.employeeId,
        effectiveFrom: form.effectiveFrom,
        ...(form.effectiveTo ? { effectiveTo: form.effectiveTo } : {}),
        participatesSocialInsurance: form.participatesSocialInsurance,
        participatesHealthInsurance: form.participatesHealthInsurance,
        participatesUnemploymentInsurance: form.participatesUnemploymentInsurance,
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      };
      await createInsuranceProfile(props.apiBase, dto);
      toast.success('Tạo hồ sơ bảo hiểm thành công', 'Hồ sơ tham gia bảo hiểm đã được ghi nhận.');
      props.onOpenChange(false);
      props.onCreated?.();
    } catch (err) {
      toast.error('Không thể tạo hồ sơ bảo hiểm', hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const checkboxRow = (
    key: 'participatesSocialInsurance' | 'participatesHealthInsurance' | 'participatesUnemploymentInsurance',
    label: string,
    hint: string,
  ) => {
    const checked = form[key];
    return (
      <label className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer select-none transition-colors ${checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-muted/40'}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
          disabled={submitting}
        />
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </label>
    );
  };

  return (
    <Dialog open={props.open} onOpenChange={(next) => {
      if (!submitting) { if (!next) reset(); props.onOpenChange(next); }
    }}>
      <DialogContent className="max-w-2xl gap-0">
        <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
          <DialogTitle className="text-xl font-semibold">Tạo hồ sơ tham gia bảo hiểm</DialogTitle>
          <DialogDescription className="mt-1.5">
            Mỗi lần cấu hình lại là một giai đoạn hiệu lực mới — không sửa hồ sơ cũ.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <FormLabel htmlFor="insprofile-employee" required>Nhân viên</FormLabel>
                <select
                  id="insprofile-employee"
                  className="block h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  value={form.employeeId}
                  onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))}
                  disabled={submitting}
                  aria-invalid={!!errors.employeeId}
                >
                  <option value="">Chọn nhân viên</option>
                  {employeeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <FormError message={errors.employeeId} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="insprofile-from" required>Hiệu lực từ</FormLabel>
                <Input
                  id="insprofile-from"
                  type="date"
                  className="h-11"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
                  disabled={submitting}
                  aria-invalid={!!errors.effectiveFrom}
                />
                <FormError message={errors.effectiveFrom} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="insprofile-to">Hiệu lực đến (tùy chọn)</FormLabel>
                <Input
                  id="insprofile-to"
                  type="date"
                  className="h-11"
                  value={form.effectiveTo}
                  onChange={(e) => setForm((p) => ({ ...p, effectiveTo: e.target.value }))}
                  disabled={submitting}
                  aria-invalid={!!errors.effectiveTo}
                />
                <FormError message={errors.effectiveTo} />
              </div>
            </div>

            <div className="space-y-2">
              <FormLabel>Tham gia bảo hiểm</FormLabel>
              {checkboxRow('participatesSocialInsurance', 'BHXH — Bảo hiểm xã hội', 'Bỏ chọn nếu nhân viên không tham gia BHXH bắt buộc trong giai đoạn này.')}
              {checkboxRow('participatesHealthInsurance', 'BHYT — Bảo hiểm y tế', 'Bỏ chọn nếu nhân viên không tham gia BHYT bắt buộc trong giai đoạn này.')}
              {checkboxRow('participatesUnemploymentInsurance', 'BHTN — Bảo hiểm thất nghiệp', 'Bỏ chọn nếu nhân viên không tham gia BHTN bắt buộc trong giai đoạn này.')}
            </div>

            <div className="space-y-1.5">
              <FormLabel htmlFor="insprofile-note">Ghi chú</FormLabel>
              <Textarea
                id="insprofile-note"
                className="min-h-20"
                value={form.note}
                maxLength={500}
                placeholder="Lý do HR, đặc biệt khi bỏ chọn một khoản tham gia (tùy chọn)..."
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
              {submitting ? 'Đang tạo…' : 'Tạo hồ sơ'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Detail Dialog ───────── */

export function InsuranceProfileDetailDialog({
  profile,
  employeeLabel,
  open,
  onClose,
}: {
  profile: InsuranceProfile | null;
  employeeLabel?: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!profile) return null;

  const rows = [
    { label: 'BHXH — Bảo hiểm xã hội', value: profile.participatesSocialInsurance },
    { label: 'BHYT — Bảo hiểm y tế', value: profile.participatesHealthInsurance },
    { label: 'BHTN — Bảo hiểm thất nghiệp', value: profile.participatesUnemploymentInsurance },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Chi tiết hồ sơ tham gia bảo hiểm
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">Phiên bản v{profile.version}</Badge>
          </div>
          {employeeLabel && <DialogDescription className="mt-1.5">{employeeLabel}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6">
          <div className="divide-y divide-border rounded-lg border border-border">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <Badge variant="secondary" className={row.value ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}>
                  {row.value ? 'Có tham gia' : 'Không tham gia'}
                </Badge>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Hiệu lực từ</span>
              <span className="font-medium text-foreground">{formatDate(profile.effectiveFrom)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Hiệu lực đến</span>
              <span className="font-medium text-foreground">{profile.effectiveTo ? formatDate(profile.effectiveTo) : 'Hiện tại'}</span>
            </div>
            {profile.note && (
              <div className="px-4 py-3 text-sm">
                <span className="text-muted-foreground">Ghi chú</span>
                <p className="mt-1 font-medium text-foreground">{profile.note}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed">Hồ sơ này không thể sửa tại chỗ. Muốn thay đổi mức tham gia, tạo một hồ sơ mới với ngày hiệu lực kế tiếp — hệ thống tự tăng số phiên bản.</p>
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
