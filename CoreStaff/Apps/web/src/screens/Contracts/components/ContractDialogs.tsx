import { useState, useEffect, useCallback } from 'react';
import { useRef } from 'react';
import { ArrowLeftRight, FileText, LoaderCircle, Paperclip, RefreshCw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/dialog';
import { Button } from '../../../components/button';
import { Input } from '../../../components/input';
import { Textarea } from '../../../components/textarea';
import { FormLabel } from '../../../components/form/FormLabel';
import { FormError } from '../../../components/form/FormError';
import { Alert, AlertDescription, AlertTitle } from '../../../components/alert';
import { toast } from '../../../components/toast';
import type { ContractCreateDto, EmployeeDocument, EmploymentContract } from '../../../services/hrService';
import { createContract, uploadDocument, listDocuments, downloadDocument, deleteDocument, hrErrorMessage, updateContractStatus } from '../../../services/hrService';
import {
  CONTRACT_STATUS_BADGE,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_TRANSITIONS,
  type ContractType,
  type ContractStatus,
} from '../../../lib/types';

/** Employee option — { _id: profileId, fullName, employeeCode } shape is what
 * ContractsScreen passes in (EmployeeDirectory enriches codes the same way). */
export interface ContractEmployee {
  _id: string;
  fullName?: string | null;
  employeeCode: string;
  organizationId: string;
}

interface SimpleContract extends EmploymentContract {
  employeeFullName?: string | null;
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium text-foreground">
        {value?.trim() || <span className="text-muted-foreground italic">Chưa có</span>}
      </dd>
    </div>
  );
}

/* ───────── Create Contract Dialog ───────── */

export function ContractCreateDialog(props: {
  apiBase: string;
  open: boolean;
  employees: ContractEmployee[];
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    employeeId: string;
    contractType: ContractType | '';
    effectiveDate: string;
    expiryDate: string;
    note: string;
  }>({ employeeId: '', contractType: '', effectiveDate: '', expiryDate: '', note: '' });
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const reset = () => {
    setForm({ employeeId: '', contractType: '', effectiveDate: '', expiryDate: '', note: '' });
    setErrors({});
  };

  // Clear the form when the dialog reopens for a fresh contract.
  useEffect(() => {
    if (props.open) reset();
  }, [props.open]);

  const employeeOptions = props.employees.map((e) => ({ value: e._id, label: `${e.employeeCode} — ${e.fullName ?? ''}` }));
  const typeOptions = Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

  // INDEFINITE_TERM never carries expiryDate (server-enforced CONTRACT_INDEFINITE_TERM_NO_EXPIRY).
  const isIndefinite = form.contractType === 'INDEFINITE_TERM';

  const validate = useCallback((): boolean => {
    const next: Record<string, string | null> = {};
    if (!form.employeeId) next.employeeId = 'Vui lòng chọn nhân viên.';
    if (!form.contractType) next.contractType = 'Vui lòng chọn loại hợp đồng.';
    if (!form.effectiveDate) next.effectiveDate = 'Vui lòng chọn ngày hiệu lực.';
    if (!isIndefinite && form.contractType && !form.expiryDate) next.expiryDate = 'Hợp đồng có thời hạn phải có ngày hết hạn.';
    if (form.effectiveDate && form.expiryDate && form.expiryDate <= form.effectiveDate) {
      next.expiryDate = 'Ngày hết hạn phải sau ngày hiệu lực.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, isIndefinite]);

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
      const dto: ContractCreateDto = {
        employeeId: form.employeeId,
        contractType: form.contractType as ContractType,
        effectiveDate: form.effectiveDate,
        ...(isIndefinite ? {} : { expiryDate: form.expiryDate }),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      };
      await createContract(props.apiBase, dto);
      toast.success('Tạo hợp đồng thành công', 'Hợp đồng đã được tạo ở trạng thái Nháp.');
      props.onOpenChange(false);
      props.onCreated?.();
    } catch (err) {
      toast.error('Không thể tạo hợp đồng', hrErrorMessage(err));
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
          <DialogTitle className="text-xl font-semibold">Tạo hợp đồng lao động</DialogTitle>
          <DialogDescription className="mt-1.5">
            Hợp đồng mới bắt đầu ở trạng thái Nháp — chỉ HR có thể đưa vào hiệu lực.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FormLabel htmlFor="contract-employee" required>Nhân viên</FormLabel>
                <select
                  id="contract-employee"
                  className="block h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  value={form.employeeId}
                  onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))}
                  disabled={submitting}
                  aria-invalid={!!errors.employeeId}
                  style={{ borderColor: errors.employeeId ? 'var(--destructive)' : undefined }}
                >
                  <option value="">Chọn nhân viên</option>
                  {employeeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <FormError message={errors.employeeId} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="contract-type" required>Loại hợp đồng</FormLabel>
                <select
                  id="contract-type"
                  className="block h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  value={form.contractType}
                  onChange={(e) => {
                    const t = e.target.value as ContractType;
                    setForm((p) => ({ ...p, contractType: t, expiryDate: t === 'INDEFINITE_TERM' ? '' : p.expiryDate }));
                  }}
                  disabled={submitting}
                  aria-invalid={!!errors.contractType}
                >
                  <option value="">Chọn loại hợp đồng</option>
                  {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <FormError message={errors.contractType} />
              </div>
              <div className="space-y-1.5">
                <FormLabel htmlFor="contract-effective" required>Ngày hiệu lực</FormLabel>
                <Input
                  id="contract-effective"
                  type="date"
                  className="h-11"
                  value={form.effectiveDate}
                  onChange={(e) => setForm((p) => ({ ...p, effectiveDate: e.target.value }))}
                  disabled={submitting}
                  aria-invalid={!!errors.effectiveDate}
                />
                <FormError message={errors.effectiveDate} />
              </div>
              {!isIndefinite && (
                <div className="space-y-1.5">
                  <FormLabel htmlFor="contract-expiry" required>Ngày hết hạn</FormLabel>
                  <Input
                    id="contract-expiry"
                    type="date"
                    className="h-11"
                    value={form.expiryDate}
                    onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
                    disabled={submitting}
                    aria-invalid={!!errors.expiryDate}
                  />
                  <FormError message={errors.expiryDate} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <FormLabel htmlFor="contract-note">Ghi chú</FormLabel>
              <Textarea
                id="contract-note"
                className="min-h-24"
                value={form.note}
                maxLength={1000}
                placeholder="Nhập ghi chú về hợp đồng (tùy chọn)..."
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                disabled={submitting}
              />
              <p className="text-right text-xs text-muted-foreground">{form.note.length}/1000</p>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-popover px-5 py-4">
            <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={() => { reset(); props.onOpenChange(false); }}>
              Hủy
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {submitting ? 'Đang tạo…' : 'Tạo hợp đồng'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Contract Documents Section ───────── */

interface ContractDocumentsSectionProps {
  apiBase: string;
  profileId: string;
}

/** TASK-029 — docs of one contract, attached to the employee's profile. Upload is
 * multipart (never through hrRequest — that forces application/json), download
 * streams an authenticated blob, HR can delete. */
export function ContractDocumentsSection({ apiBase, profileId }: ContractDocumentsSectionProps) {
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!apiBase) return;
    try {
      setLoading(true);
      setDocs(await listDocuments(apiBase, { employeeId: profileId }));
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, profileId]);

  useEffect(() => { void reload(); }, [reload]);

  const handleFile = async (file: File | undefined) => {
    if (!file || !apiBase || uploading) return;
    setUploading(true);
    try {
      await uploadDocument(apiBase, { employeeProfileId: profileId }, file);
      toast.success('Tải lên thành công', file.name);
      await reload();
    } catch (err) {
      toast.error('Không thể tải lên', hrErrorMessage(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Tài liệu đính kèm</span>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            aria-label="Chọn tệp tài liệu"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Paperclip className="h-4 w-4" aria-hidden="true" />}
            {uploading ? 'Đang tải…' : 'Tải lên tài liệu'}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải tài liệu…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có tài liệu nào.</p>
      ) : (
        <ul className="divide-y divide-border/50 rounded-lg border border-border/60">
          {docs.map((doc) => (
            <li key={doc._id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground hover:underline"
                title={`Tải ${doc.originalName}`}
                onClick={() => void downloadDocument(apiBase, doc._id).catch((err) => toast.error('Không thể tải xuống', hrErrorMessage(err)))}
              >
                {doc.originalName}
              </button>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(doc.sizeBytes / 1024).toFixed(0)} KB
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Xóa ${doc.originalName}`}
                onClick={() => void deleteDocument(apiBase, doc._id).then(reload)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────── Detail Dialog + status change ───────── */

export function ContractDetailDialog(props: {
  apiBase: string;
  contractId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [contract, setContract] = useState<SimpleContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMode, setStatusMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusForm, setStatusForm] = useState<{ newStatus: ContractStatus | ''; effectiveDate: string; expiryDate: string; reason: string }>({
    newStatus: '', effectiveDate: '', expiryDate: '', reason: '',
  });
  const [statusErrors, setStatusErrors] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    if (!props.apiBase) return;
    setLoading(true);
    setError(null);
    try {
      const { getContractById } = await import('../../../services/hrService');
      setContract(await getContractById(props.apiBase, props.contractId));
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [props.apiBase, props.contractId]);

  useEffect(() => { void load(); }, [load]);

  const transitions = contract ? (CONTRACT_STATUS_TRANSITIONS as Record<string, ContractStatus[]>)[contract.status] ?? [] : [];

  const isTermination = statusForm.newStatus === 'TERMINATED';
  const isRenewal = contract?.status === 'EXPIRED' && statusForm.newStatus === 'ACTIVE';

  const validateStatus = (): boolean => {
    const next: Record<string, string | null> = {};
    if (!statusForm.newStatus) next.newStatus = 'Vui lòng chọn trạng thái mới.';
    if ((isTermination || isRenewal) && !statusForm.effectiveDate) {
      next.effectiveDate = isTermination ? 'Chấm dứt cần ngày hiệu lực.' : 'Gia hạn cần ngày hiệu lực mới.';
    }
    if (isRenewal && !statusForm.expiryDate) next.expiryDate = 'Gia hạn cần ngày hết hạn mới.';
    setStatusErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleStatus = async () => {
    if (!contract || !statusForm.newStatus || !validateStatus()) return;
    setSaving(true);
    try {
      const updated = await updateContractStatus(props.apiBase, contract._id, {
        newStatus: statusForm.newStatus,
        ...(isTermination || isRenewal ? { effectiveDate: statusForm.effectiveDate } : {}),
        ...(isRenewal ? { expiryDate: statusForm.expiryDate } : {}),
        ...(statusForm.reason.trim() ? { reason: statusForm.reason.trim() } : {}),
      });
      setContract(updated);
      setStatusMode(false);
      setStatusForm({ newStatus: '', effectiveDate: '', expiryDate: '', reason: '' });
      props.onChanged?.();
      toast.success('Cập nhật trạng thái thành công', 'Trạng thái hợp đồng đã được chuyển.');
    } catch (err) {
      toast.error('Không thể chuyển trạng thái', hrErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) props.onClose(); }}>
      <DialogContent className="group/detail max-h-[90dvh] max-w-4xl gap-0">
        <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
          <DialogTitle className="text-xl font-semibold">Chi tiết hợp đồng</DialogTitle>
          <DialogDescription className="mt-1.5">
            {contract ? `${contract.employeeCode || ''} ${contract.employeeFullName || ''}`.trim() || 'Hợp đồng lao động' : 'Thông tin hợp đồng lao động.'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Đang tải hợp đồng…</p>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={load}>Thử lại</Button>
            </div>
          ) : contract ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${(CONTRACT_STATUS_BADGE as Record<string, string>)[contract.status]}`}>
                  {(CONTRACT_STATUS_LABELS as Record<string, string>)[contract.status]}
                </span>
                {contract.isExpiringSoon && contract.expiryWarningDays != null && (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Sắp hết hạn ({contract.expiryWarningDays} ngày)
                  </span>
                )}
                {transitions.length > 0 && (
                  <Button variant="outline" size="sm" className="ml-auto" onClick={() => { setStatusMode(true); setStatusForm({ newStatus: '', effectiveDate: '', expiryDate: '', reason: '' }); setStatusErrors({}); }}>
                    <ArrowLeftRight className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Chuyển trạng thái
                  </Button>
                )}
              </div>

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FieldRow label="Loại hợp đồng" value={(CONTRACT_TYPE_LABELS as Record<string, string>)[contract.contractType]} />
                <FieldRow label="Ngày hiệu lực" value={new Date(contract.effectiveDate).toLocaleDateString('vi-VN')} />
                <FieldRow label="Ngày hết hạn" value={contract.expiryDate ? new Date(contract.expiryDate).toLocaleDateString('vi-VN') : 'Không thời hạn'} />
                <FieldRow label="Ngày chấm dứt" value={contract.endDate ? new Date(contract.endDate).toLocaleDateString('vi-VN') : null} />
                <FieldRow label="Ghi chú" value={contract.note} />
              </dl>

              {contract.employeeProfileId && (
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <ContractDocumentsSection apiBase={props.apiBase} profileId={contract.employeeProfileId} />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>

      <Dialog open={statusMode} onOpenChange={(open) => { if (!open && !saving) setStatusMode(false); }}>
        <DialogContent className="max-w-[520px] gap-0" showCloseButton={!saving}>
          <DialogHeader className="border-b border-border px-5 py-5 pr-14">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <DialogTitle>Chuyển trạng thái hợp đồng</DialogTitle>
                <DialogDescription className="mt-1.5">
                  {contract ? `Hiện tại: ${(CONTRACT_STATUS_LABELS as Record<string, string>)[contract.status]}` : '—'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="space-y-1.5">
              <FormLabel htmlFor="contract-status-new" required>Trạng thái mới</FormLabel>
              <select
                id="contract-status-new"
                className="block h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                value={statusForm.newStatus}
                onChange={(e) => setStatusForm((p) => ({ ...p, newStatus: e.target.value as ContractStatus }))}
                disabled={saving}
                aria-invalid={!!statusErrors.newStatus}
              >
                <option value="">Chọn trạng thái mới</option>
                {transitions.map((s) => <option key={s} value={s}>{(CONTRACT_STATUS_LABELS as Record<string, string>)[s]}</option>)}
              </select>
              <FormError message={statusErrors.newStatus} />
            </div>

            {(isTermination || isRenewal) && (
              <div className="space-y-1.5">
                <FormLabel htmlFor="contract-status-effective" required>
                  {isTermination ? 'Ngày chấm dứt' : 'Ngày hiệu lực mới'}
                </FormLabel>
                <Input
                  id="contract-status-effective"
                  type="date"
                  className="h-11"
                  value={statusForm.effectiveDate}
                  onChange={(e) => setStatusForm((p) => ({ ...p, effectiveDate: e.target.value }))}
                  disabled={saving}
                  aria-invalid={!!statusErrors.effectiveDate}
                />
                <FormError message={statusErrors.effectiveDate} />
              </div>
            )}
            {isRenewal && (
              <div className="space-y-1.5">
                <FormLabel htmlFor="contract-status-expiry" required>Ngày hết hạn mới</FormLabel>
                <Input
                  id="contract-status-expiry"
                  type="date"
                  className="h-11"
                  value={statusForm.expiryDate}
                  onChange={(e) => setStatusForm((p) => ({ ...p, expiryDate: e.target.value }))}
                  disabled={saving}
                  aria-invalid={!!statusErrors.expiryDate}
                />
                <FormError message={statusErrors.expiryDate} />
              </div>
            )}
            <div className="space-y-1.5">
              <FormLabel htmlFor="contract-status-reason">Lý do</FormLabel>
              <Textarea
                id="contract-status-reason"
                className="min-h-20"
                value={statusForm.reason}
                maxLength={500}
                placeholder="Nhập lý do chuyển trạng thái (tùy chọn)..."
                onChange={(e) => setStatusForm((p) => ({ ...p, reason: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-muted/30 px-6 py-5">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setStatusMode(false)}>Hủy</Button>
            <Button type="button" disabled={saving} onClick={handleStatus}>
              {saving ? 'Đang xử lý…' : 'Xác nhận'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}