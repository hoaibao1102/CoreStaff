import { useRef, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { FormInputField } from '@/components/form/FormInputField';
import { FormSelectField } from '@/components/form/FormSelectField';
import { toast } from '@/components/toast';
import { assignmentErrorMessage, createAssignment, type CreateAssignmentPayload } from '@/services/assignment.service';
import type { Department, EmployeeProfile, Workplace } from '@/services/hrService';

interface AssignmentCreateDialogProps {
  apiBase: string;
  open: boolean;
  employees: EmployeeProfile[];
  departments: Department[];
  workplaces: Workplace[];
  onClose: () => void;
  onCreated: () => void;
}

interface AssignmentForm {
  userId: string;
  departmentId: string;
  workplaceId: string;
  effectiveFrom: string;
  effectiveTo: string;
}

type AssignmentFormErrors = Partial<Record<keyof AssignmentForm, string>>;

const EMPTY_FORM: AssignmentForm = {
  userId: '',
  departmentId: '',
  workplaceId: '',
  effectiveFrom: '',
  effectiveTo: '',
};

function validate(form: AssignmentForm): AssignmentFormErrors {
  const errors: AssignmentFormErrors = {};
  if (!form.userId) errors.userId = 'Vui lòng chọn nhân viên.';
  if (!form.departmentId) errors.departmentId = 'Vui lòng chọn phòng ban.';
  if (!form.effectiveFrom) errors.effectiveFrom = 'Vui lòng chọn ngày bắt đầu.';
  if (!form.effectiveTo) errors.effectiveTo = 'Vui lòng chọn ngày kết thúc.';
  if (form.effectiveFrom && form.effectiveTo && form.effectiveFrom > form.effectiveTo) {
    errors.effectiveTo = 'Ngày bắt đầu không được sau ngày kết thúc.';
  }
  return errors;
}

export function AssignmentCreateDialog({
  apiBase,
  open,
  employees,
  departments,
  workplaces,
  onClose,
  onCreated,
}: AssignmentCreateDialogProps) {
  const [form, setForm] = useState<AssignmentForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<AssignmentFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function reset() {
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function close() {
    if (submittingRef.current) return;
    reset();
    onClose();
  }

  function updateField(field: keyof AssignmentForm, value: string) {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const nextErrors = validate(form);
    setErrors(nextErrors);
    const firstInvalid = (['userId', 'departmentId', 'effectiveFrom', 'effectiveTo'] as const)
      .find(field => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(`assignment-${firstInvalid}`)?.focus();
      return;
    }

    const payload: CreateAssignmentPayload = {
      userId: form.userId,
      departmentId: form.departmentId,
      ...(form.workplaceId ? { workplaceId: form.workplaceId } : {}),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo,
    };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await createAssignment(apiBase, payload);
      reset();
      onClose();
      onCreated();
      toast.success('Tạo phân công thành công.');
    } catch (error) {
      toast.error('Không thể tạo phân công', assignmentErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const employeeOptions = employees.map(employee => ({
    value: employee.userId,
    label: employee.fullName || employee.employeeCode,
  }));
  const departmentOptions = departments.map(department => ({ value: department._id, label: department.name }));
  const workplaceOptions = workplaces.map(workplace => ({ value: workplace._id, label: workplace.name }));

  return <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) close(); }}>
    <DialogContent showCloseButton={!submitting} initialFocus={() => document.getElementById('assignment-userId')}>
      <DialogHeader className="border-b border-border pr-16">
        <DialogTitle>Tạo phân công</DialogTitle>
        <DialogDescription>Chọn nhân viên, đơn vị công tác và thời gian áp dụng. Các trường có dấu * là bắt buộc.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate className="space-y-5 overflow-y-auto px-6 pb-6" aria-busy={submitting}>
        <FormSelectField id="assignment-userId" label="Nhân viên" required value={form.userId} onChange={event => updateField('userId', event.target.value)} options={employeeOptions} placeholder="Chọn nhân viên" disabled={submitting} error={errors.userId} />
        <FormSelectField id="assignment-departmentId" label="Phòng ban" required value={form.departmentId} onChange={event => updateField('departmentId', event.target.value)} options={departmentOptions} placeholder="Chọn phòng ban" disabled={submitting} error={errors.departmentId} />
        <FormSelectField id="assignment-workplaceId" label="Nơi làm việc" value={form.workplaceId} onChange={event => updateField('workplaceId', event.target.value)} options={workplaceOptions} placeholder="Không chọn nơi làm việc" disabled={submitting} error={errors.workplaceId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInputField id="assignment-effectiveFrom" label="Ngày bắt đầu" type="date" required value={form.effectiveFrom} onChange={event => updateField('effectiveFrom', event.target.value)} disabled={submitting} error={errors.effectiveFrom} />
          <FormInputField id="assignment-effectiveTo" label="Ngày kết thúc" type="date" required value={form.effectiveTo} onChange={event => updateField('effectiveTo', event.target.value)} disabled={submitting} error={errors.effectiveTo} min={form.effectiveFrom || undefined} />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={close}>Hủy</Button>
          <Button type="submit" className="min-h-11" disabled={submitting}>
            {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {submitting ? 'Đang tạo...' : 'Tạo phân công'}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
