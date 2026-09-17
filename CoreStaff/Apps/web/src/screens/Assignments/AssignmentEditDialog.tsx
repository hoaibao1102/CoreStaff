import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { FormInputField } from '@/components/form/FormInputField';
import { FormSelectField } from '@/components/form/FormSelectField';
import { Skeleton } from '@/components/skeleton';
import { toast } from '@/components/toast';
import { assignmentErrorMessage, getAssignmentById, updateAssignment, type UpdateAssignmentPayload } from '@/services/assignment.service';
import type { Department, EmployeeProfile, Workplace } from '@/services/hrService';

interface AssignmentEditDialogProps {
  apiBase: string;
  assignmentId: string;
  employees: EmployeeProfile[];
  departments: Department[];
  workplaces: Workplace[];
  onClose: () => void;
  onUpdated: () => void;
}

interface AssignmentForm {
  userId: string;
  departmentId: string;
  workplaceId: string;
  effectiveFrom: string;
  effectiveTo: string;
}

type AssignmentFormErrors = Partial<Record<keyof AssignmentForm, string>>;
const EMPTY_FORM: AssignmentForm = { userId: '', departmentId: '', workplaceId: '', effectiveFrom: '', effectiveTo: '' };

function validate(form: AssignmentForm): AssignmentFormErrors {
  const errors: AssignmentFormErrors = {};
  if (!form.userId) errors.userId = 'Vui lòng chọn nhân viên.';
  if (!form.departmentId) errors.departmentId = 'Vui lòng chọn phòng ban.';
  if (!form.effectiveFrom) errors.effectiveFrom = 'Vui lòng chọn ngày bắt đầu.';
  if (!form.effectiveTo) errors.effectiveTo = 'Vui lòng chọn ngày kết thúc.';
  if (form.effectiveFrom && form.effectiveTo && form.effectiveFrom > form.effectiveTo) errors.effectiveTo = 'Ngày bắt đầu không được sau ngày kết thúc.';
  return errors;
}

export function AssignmentEditDialog({ apiBase, assignmentId, employees, departments, workplaces, onClose, onUpdated }: AssignmentEditDialogProps) {
  const [form, setForm] = useState<AssignmentForm>(EMPTY_FORM);
  const [original, setOriginal] = useState<AssignmentForm | null>(null);
  const [errors, setErrors] = useState<AssignmentFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setNotFound(false);
    void getAssignmentById(apiBase, assignmentId).then(data => {
      if (cancelled) return;
      const next = {
        userId: data.userId,
        departmentId: data.departmentId,
        workplaceId: data.workplaceId || '',
        effectiveFrom: data.effectiveFrom.slice(0, 10),
        effectiveTo: data.effectiveTo.slice(0, 10),
      };
      setForm(next);
      setOriginal(next);
      setErrors({});
    }).catch(cause => {
      if (cancelled) return;
      if ((cause as { code?: string } | null)?.code === 'ASSIGNMENT_NOT_FOUND') setNotFound(true);
      else setLoadError(true);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, assignmentId, revision]);

  const patch = useMemo<UpdateAssignmentPayload>(() => {
    if (!original) return {};
    const next: UpdateAssignmentPayload = {};
    if (form.userId !== original.userId) next.userId = form.userId;
    if (form.departmentId !== original.departmentId) next.departmentId = form.departmentId;
    // The API accepts only a Mongo ID for workplaceId; omission preserves an existing value.
    if (form.workplaceId && form.workplaceId !== original.workplaceId) next.workplaceId = form.workplaceId;
    if (form.effectiveFrom !== original.effectiveFrom) next.effectiveFrom = form.effectiveFrom;
    if (form.effectiveTo !== original.effectiveTo) next.effectiveTo = form.effectiveTo;
    return next;
  }, [form, original]);
  const dirty = Object.keys(patch).length > 0;

  function updateField(field: keyof AssignmentForm, value: string) {
    // Removing a workplace is not represented by the current PATCH contract.
    if (field === 'workplaceId' && !value && original?.workplaceId) return;
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !original) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    const firstInvalid = (['userId', 'departmentId', 'effectiveFrom', 'effectiveTo'] as const).find(field => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(`edit-assignment-${firstInvalid}`)?.focus();
      return;
    }
    if (!dirty) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await updateAssignment(apiBase, assignmentId, patch);
      onUpdated();
      onClose();
      toast.success('Cập nhật phân công thành công.');
    } catch (error) {
      toast.error('Không thể cập nhật phân công', assignmentErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const employeeOptions = employees.map(item => ({ value: item.userId, label: item.fullName || item.employeeCode }));
  const departmentOptions = departments.map(item => ({ value: item._id, label: item.name }));
  const workplaceOptions = workplaces.map(item => ({ value: item._id, label: item.name }));

  return <Dialog open onOpenChange={open => { if (!open && !submittingRef.current) onClose(); }}>
    <DialogContent showCloseButton={!submitting} initialFocus={() => document.getElementById('edit-assignment-userId')}>
      <DialogHeader className="border-b border-border pr-16"><DialogTitle>Chỉnh sửa phân công</DialogTitle><DialogDescription>Cập nhật đơn vị công tác và thời gian phân công. Các trường có dấu * là bắt buộc.</DialogDescription></DialogHeader>
      {loading ? <div className="space-y-4 px-6 pb-6" role="status" aria-label="Đang tải thông tin phân công">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-11 w-full" />)}</div>
        : notFound ? <div className="px-6 pb-6"><Alert><AlertDescription>Không tìm thấy phân công.</AlertDescription></Alert></div>
          : loadError ? <div className="px-6 pb-6"><Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-4"><span>Không thể tải thông tin phân công. Vui lòng thử lại.</span><Button variant="outline" className="min-h-11" onClick={() => setRevision(value => value + 1)}>Thử lại</Button></AlertDescription></Alert></div>
            : <form onSubmit={submit} noValidate className="space-y-5 overflow-y-auto px-6 pb-6" aria-busy={submitting}>
              <FormSelectField id="edit-assignment-userId" label="Nhân viên" required value={form.userId} onChange={event => updateField('userId', event.target.value)} options={employeeOptions} placeholder="Chọn nhân viên" disabled={submitting} error={errors.userId} />
              <FormSelectField id="edit-assignment-departmentId" label="Phòng ban" required value={form.departmentId} onChange={event => updateField('departmentId', event.target.value)} options={departmentOptions} placeholder="Chọn phòng ban" disabled={submitting} error={errors.departmentId} />
              <FormSelectField id="edit-assignment-workplaceId" label="Nơi làm việc" value={form.workplaceId} onChange={event => updateField('workplaceId', event.target.value)} options={workplaceOptions} placeholder="Chưa chỉ định" disabled={submitting} error={errors.workplaceId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInputField id="edit-assignment-effectiveFrom" label="Ngày bắt đầu" type="date" required value={form.effectiveFrom} onChange={event => updateField('effectiveFrom', event.target.value)} disabled={submitting} error={errors.effectiveFrom} />
                <FormInputField id="edit-assignment-effectiveTo" label="Ngày kết thúc" type="date" required value={form.effectiveTo} onChange={event => updateField('effectiveTo', event.target.value)} disabled={submitting} error={errors.effectiveTo} min={form.effectiveFrom || undefined} />
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={onClose}>Hủy</Button><Button type="submit" className="min-h-11" disabled={submitting || !dirty}>{submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Button></div>
            </form>}
    </DialogContent>
  </Dialog>;
}
