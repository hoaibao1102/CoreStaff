import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, MoreHorizontal, Pencil, Plus, RotateCcw, Scale, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/dropdown-menu';
import { FormError } from '@/components/form/FormError';
import { FormLabel } from '@/components/form/FormLabel';
import { Input } from '@/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { toast } from '@/components/toast';
import {
  createWorkCreditPolicy,
  listWorkCreditPolicies,
  policiesErrorMessage,
  updateWorkCreditPolicy,
  type CreateWorkCreditPolicyPayload,
  type UpdateWorkCreditPolicyPayload,
  type WorkCreditPolicy,
} from '@/services/policies.service';
import { WorkCreditSimulationPreview } from './WorkCreditSimulationPreview';
import { parsePercent } from './work-credit-simulation';
import { formatEffectiveRange, PolicyLoadingRows, PolicyStatusBadge } from '../Policies/policies.ui';

type Form = {
  effectiveFrom: string;
  effectiveTo: string;
  halfDayMinimumRatio: string;
  fullDayMinimumRatio: string;
  paidLeaveCreditEnabled: string;
  businessReference: string;
  active: string;
};

const EMPTY: Form = {
  effectiveFrom: '',
  effectiveTo: '',
  halfDayMinimumRatio: '',
  fullDayMinimumRatio: '',
  paidLeaveCreditEnabled: 'true',
  businessReference: '',
  active: 'true',
};

const fromPolicy = (p: WorkCreditPolicy): Form => ({
  effectiveFrom: p.effectiveFrom.slice(0, 10),
  effectiveTo: p.effectiveTo?.slice(0, 10) ?? '',
  halfDayMinimumRatio: String(p.halfDayMinimumRatio * 100),
  fullDayMinimumRatio: String(p.fullDayMinimumRatio * 100),
  paidLeaveCreditEnabled: String(p.paidLeaveCreditEnabled),
  businessReference: p.businessReference ?? '',
  active: String(p.active),
});

const validate = (f: Form) => {
  if (!f.effectiveFrom) return 'Vui lòng chọn ngày hiệu lực.';
  const half = parsePercent(f.halfDayMinimumRatio);
  const full = parsePercent(f.fullDayMinimumRatio);
  if (half === null || full === null) return 'Các ngưỡng phải nằm trong khoảng 0–100%.';
  if (half >= full) return 'Ngưỡng nửa ngày phải nhỏ hơn ngưỡng đủ ngày.';
  if (f.effectiveTo && f.effectiveTo <= f.effectiveFrom) return 'Ngày hết hiệu lực phải sau ngày hiệu lực.';
  return '';
};

const payload = (f: Form): CreateWorkCreditPolicyPayload => ({
  effectiveFrom: f.effectiveFrom,
  ...(f.effectiveTo ? { effectiveTo: f.effectiveTo } : {}),
  halfDayMinimumRatio: Number(f.halfDayMinimumRatio) / 100,
  fullDayMinimumRatio: Number(f.fullDayMinimumRatio) / 100,
  paidLeaveCreditEnabled: f.paidLeaveCreditEnabled === 'true',
  incompleteDayRule: 'BLOCK',
  ...(f.businessReference.trim() ? { businessReference: f.businessReference.trim() } : {}),
  active: f.active === 'true',
});

const diff = (f: Form, p: WorkCreditPolicy): UpdateWorkCreditPolicyPayload => {
  const original = fromPolicy(p);
  const all = payload(f);
  const changed: UpdateWorkCreditPolicyPayload = {};
  (Object.keys(f) as (keyof Form)[]).forEach((k) => {
    if (f[k] !== original[k]) {
      if (k === 'effectiveTo') changed.effectiveTo = f.effectiveTo || undefined;
      else if (k in all) (changed as Record<string, unknown>)[k] = (all as unknown as Record<string, unknown>)[k];
    }
  });
  return changed;
};

function PolicyDialog({
  apiBase,
  policy,
  open,
  onClose,
  onSaved,
}: {
  apiBase: string;
  policy: WorkCreditPolicy | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(false);
  const [undo, setUndo] = useState<{ half: string; full: string; next: string } | null>(null);

  const applyPreset = (full: string) => {
    setUndo({ half: form.halfDayMinimumRatio, full: form.fullDayMinimumRatio, next: full });
    setForm({ ...form, halfDayMinimumRatio: '50', fullDayMinimumRatio: full });
    setReview(false);
  };

  const savingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setForm(policy ? fromPolicy(policy) : EMPTY);
      setError('');
      setUndo(null);
      setReview(false);
    }
  }, [open, policy]);

  const save = async (confirmed = false) => {
    if (savingRef.current) return;
    const message = validate(form);
    if (message) {
      setError(message);
      return;
    }
    if (
      policy &&
      (form.halfDayMinimumRatio !== fromPolicy(policy).halfDayMinimumRatio ||
        form.fullDayMinimumRatio !== fromPolicy(policy).fullDayMinimumRatio) &&
      !confirmed
    ) {
      setReview(true);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      if (policy) {
        const changed = diff(form, policy);
        if (Object.keys(changed).length) await updateWorkCreditPolicy(apiBase, policy._id, changed);
      } else {
        await createWorkCreditPolicy(apiBase, payload(form));
      }
      toast.success(policy ? 'Cập nhật chính sách thành công.' : 'Tạo chính sách thành công.');
      onClose();
      onSaved();
    } catch (e) {
      toast.error('Không thể lưu chính sách', policiesErrorMessage(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const field = (key: keyof Form, label: string, type = 'text') => (
    <div className="space-y-1.5">
      <FormLabel
        htmlFor={`work-credit-policy-${key}`}
        required={key !== 'effectiveTo' && key !== 'businessReference'}
      >
        {label}
      </FormLabel>
      <Input
        id={`work-credit-policy-${key}`}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        aria-invalid={
          key === 'halfDayMinimumRatio' || key === 'fullDayMinimumRatio'
            ? parsePercent(form[key]) === null ||
              (parsePercent(form.halfDayMinimumRatio) ?? 0) >= (parsePercent(form.fullDayMinimumRatio) ?? 0)
            : undefined
        }
        aria-describedby={key === 'halfDayMinimumRatio' || key === 'fullDayMinimumRatio' ? 'threshold-error' : undefined}
        value={form[key]}
        disabled={saving}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="h-10 text-sm shadow-xs"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Scale className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {policy ? 'Chỉnh sửa chính sách quy đổi ngày công' : 'Thêm chính sách quy đổi ngày công'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Ngưỡng được nhập theo phần trăm nghĩa vụ làm việc trong ngày.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Form Error Banner */}
          <div id="threshold-error">
            <FormError message={error || validate(form)} />
          </div>

          {/* Preset Buttons Card */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-900">
              <Sparkles className="size-3.5 text-blue-600 shrink-0" />
              <span>Ví dụ tự chọn — Không phải khuyến nghị pháp lý hoặc chuẩn bắt buộc.</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['100', '85'].map((full) => (
                <Button
                  key={full}
                  type="button"
                  variant="outline"
                  disabled={saving}
                  title="Không phải khuyến nghị pháp lý hoặc chuẩn bắt buộc"
                  onClick={() => applyPreset(full)}
                  className="bg-white hover:bg-blue-50 text-xs font-semibold shadow-2xs h-8 px-3"
                >
                  Ví dụ 50–{full}
                </Button>
              ))}
              {undo && (
                <div className="flex items-center gap-2 text-xs text-slate-700 bg-white/95 border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                  <span>
                    {undo.half}–{undo.full}% → 50–{undo.next}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      setForm({ ...form, halfDayMinimumRatio: undo.half, fullDayMinimumRatio: undo.full });
                      setUndo(null);
                      setReview(false);
                    }}
                    className="h-6 px-1.5 text-xs text-primary font-semibold hover:bg-slate-100"
                  >
                    <RotateCcw className="size-3 mr-1" />
                    Hoàn tác
                  </Button>
                </div>
              )}
            </div>
            {parsePercent(form.halfDayMinimumRatio) === 0 && (
              <p role="note" className="text-xs text-amber-800 font-medium flex items-center gap-1.5 pt-1">
                <AlertCircle className="size-3.5 shrink-0 text-amber-600" />
                Ngưỡng nửa ngày bằng 0: ngày hoàn tất không có phút được ghi nhận vẫn có thể đạt 0.5 đơn vị công.
              </p>
            )}
          </div>

          {/* Form Fields Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {field('effectiveFrom', 'Hiệu lực từ', 'date')}
            {field('effectiveTo', 'Hiệu lực đến', 'date')}
            {field('halfDayMinimumRatio', 'Ngưỡng nửa ngày (%)', 'number')}
            {field('fullDayMinimumRatio', 'Ngưỡng đủ ngày (%)', 'number')}
            {field('businessReference', 'Tham chiếu nghiệp vụ')}
            <div className="space-y-1.5">
              <FormLabel htmlFor="work-credit-policy-paidLeaveCreditEnabled" required>
                Tính phép hưởng lương
              </FormLabel>
              <select
                disabled={saving}
                id="work-credit-policy-paidLeaveCreditEnabled"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all disabled:opacity-50"
                value={form.paidLeaveCreditEnabled}
                onChange={(e) => setForm({ ...form, paidLeaveCreditEnabled: e.target.value })}
              >
                <option value="true">Có</option>
                <option value="false">Không</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FormLabel htmlFor="work-credit-policy-active" required>
                Trạng thái
              </FormLabel>
              <select
                disabled={saving}
                id="work-credit-policy-active"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all disabled:opacity-50"
                value={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.value })}
              >
                <option value="true">Đang hiệu lực</option>
                <option value="false">Ngưng hiệu lực</option>
              </select>
            </div>
          </div>

          {/* Policy Simulation Lab */}
          <WorkCreditSimulationPreview
            originalRules={policy ?? undefined}
            halfPercent={form.halfDayMinimumRatio}
            fullPercent={form.fullDayMinimumRatio}
            paidLeaveCreditEnabled={form.paidLeaveCreditEnabled === 'true'}
            disabled={saving}
          />

          {/* Review Confirmation Alert */}
          {review && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-amber-950 text-sm">
                    Kiểm tra thay đổi ngưỡng: {policy && fromPolicy(policy).halfDayMinimumRatio}–{policy && fromPolicy(policy).fullDayMinimumRatio}% → {form.halfDayMinimumRatio}–{form.fullDayMinimumRatio}%. Chỉ lưu chính sách đã được doanh nghiệp phê duyệt.
                  </p>
                  <p className="text-amber-800">
                    Thay đổi này có thể làm mất hiệu lực xác nhận ở các kỳ công đang mở giao với khoảng hiệu lực; cần kiểm tra lại trước khi chốt.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" disabled={saving || !!validate(form)} onClick={() => void save(true)}>
                  Xác nhận lưu
                </Button>
                <Button size="sm" disabled={saving} variant="outline" onClick={() => setReview(false)}>
                  Quay lại kiểm tra
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t p-4 px-6 bg-slate-50/50">
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={saving || !!validate(form)} onClick={() => void save()}>
            {saving ? 'Đang lưu...' : policy ? 'Lưu thay đổi' : 'Tạo chính sách'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WorkCreditPolicyScreen({ apiBase }: { apiBase: string | null }) {
  const [rows, setRows] = useState<WorkCreditPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<WorkCreditPolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [revision, setRevision] = useState(0);

  const load = useCallback(() => {
    if (!apiBase) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    void listWorkCreditPolicies(apiBase)
      .then(setRows)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [apiBase, revision]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Chính sách quy đổi ngày công</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cấu hình ngưỡng quy đổi thời gian làm việc thành đơn vị công.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Thêm chính sách
        </Button>
      </div>

      <Alert>
        <AlertTriangle className="size-4" />
        <AlertDescription>
          Thay đổi có thể làm mất hiệu lực xác nhận ở các kỳ mở giao với khoảng hiệu lực; cần kiểm tra lại trước chốt. Dữ liệu đã chốt dùng snapshot đã lưu và không tự đổi. Chỉ lưu chính sách đã được doanh nghiệp phê duyệt.
        </AlertDescription>
      </Alert>

      <div className="overflow-hidden rounded-xl border bg-card">
        {failed ? (
          <div className="p-8">Không thể tải danh sách chính sách.</div>
        ) : loading ? (
          <PolicyLoadingRows count={4} />
        ) : !rows.length ? (
          <div className="p-14 text-center">Chưa có chính sách quy đổi ngày công nào.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hiệu lực</TableHead>
                <TableHead>Nửa ngày</TableHead>
                <TableHead>Đủ ngày</TableHead>
                <TableHead>Phép hưởng lương</TableHead>
                <TableHead>Ngày chưa hoàn tất</TableHead>
                <TableHead>Tham chiếu</TableHead>
                <TableHead>Phiên bản</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell>{formatEffectiveRange(row.effectiveFrom, row.effectiveTo)}</TableCell>
                  <TableCell>{row.halfDayMinimumRatio * 100}%</TableCell>
                  <TableCell>{row.fullDayMinimumRatio * 100}%</TableCell>
                  <TableCell>
                    {row.paidLeaveCreditEnabled ? 'Có tính phép hưởng lương' : 'Không tính phép hưởng lương'}
                  </TableCell>
                  <TableCell>Chặn khi chưa hoàn tất</TableCell>
                  <TableCell>{row.businessReference || '—'}</TableCell>
                  <TableCell>v{row.version}</TableCell>
                  <TableCell>
                    <PolicyStatusBadge active={row.active} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" />}
                        aria-label={`Mở thao tác chính sách quy đổi ngày công ${row.businessReference ?? row._id}`}
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setEditing(row)}>
                          <Pencil />
                          Chỉnh sửa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <PolicyDialog
        apiBase={apiBase ?? ''}
        policy={editing}
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => setRevision((v) => v + 1)}
      />
    </div>
  );
}
