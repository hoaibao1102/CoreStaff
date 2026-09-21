import { useEffect, useRef, useState, useMemo, type FormEvent } from 'react';
import { LoaderCircle, Users } from 'lucide-react';
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
  assignedUserIds: string[]; // userIds đã có phân công nơi làm việc
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

/** Lọc nhân viên: thuộc phòng ban đã chọn VÀ chưa có phân công nơi làm việc */
function filterEligibleEmployees(
  employees: EmployeeProfile[],
  departmentId: string,
  assignedUserIds: Set<string>,
): EmployeeProfile[] {
  if (!departmentId) return [];
  return employees.filter(emp =>
    emp.departmentId === departmentId && !assignedUserIds.has(emp.userId)
  );
}

function validate(form: AssignmentForm): AssignmentFormErrors {
  const errors: AssignmentFormErrors = {};
  if (!form.departmentId) errors.departmentId = 'Vui lòng chọn phòng ban.';
  if (!form.userId) errors.userId = 'Vui lòng chọn nhân viên.';
  if (!form.workplaceId) errors.workplaceId = 'Vui lòng chọn nơi làm việc.';
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
  assignedUserIds,
  onClose,
  onCreated,
}: AssignmentCreateDialogProps) {
  const [form, setForm] = useState<AssignmentForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<AssignmentFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // Tập hợp userIds đã có phân công nơi làm việc
  const assignedSet = useMemo(() => new Set(assignedUserIds), [assignedUserIds]);

  // Lọc nhân viên theo phòng ban và trạng thái phân công
  const eligibleEmployees = useMemo(
    () => filterEligibleEmployees(employees, form.departmentId, assignedSet),
    [employees, form.departmentId, assignedSet],
  );

  // Reset nhân viên khi đổi phòng ban
  useEffect(() => {
    if (open) {
      setForm(current => {
        if (current.departmentId && current.userId) {
          const stillEligible = eligibleEmployees.some(e => e.userId === current.userId);
          if (!stillEligible) {
            return { ...current, userId: '' };
          }
        }
        return current;
      });
    }
  }, [open, form.departmentId, eligibleEmployees]);

  // Load danh sách nhân viên khi mở dialog
  useEffect(() => {
    if (!open) return;
    setLoadingEmployees(true);
    setEmployeeError(null);
    // Data đã được truyền từ parent, chỉ cần reset state
    setTimeout(() => setLoadingEmployees(false), 300);
  }, [open]);

  function reset() {
    setForm(EMPTY_FORM);
    setErrors({});
    setEmployeeError(null);
  }

  function close() {
    if (submittingRef.current) return;
    reset();
    onClose();
  }

  function updateField(field: keyof AssignmentForm, value: string) {
    setForm(current => {
      const next = { ...current, [field]: value };
      // Nếu đổi phòng ban hoặc nơi làm việc, reset nhân viên
      if ((field === 'departmentId' || field === 'workplaceId') && current.userId) {
        const newDeptId = field === 'departmentId' ? value : current.departmentId;
        const stillEligible = filterEligibleEmployees(employees, newDeptId, assignedSet).
          some(e => e.userId === current.userId);
        if (!stillEligible) {
          next.userId = '';
        }
      }
      return next;
    });
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const nextErrors = validate(form);
    setErrors(nextErrors);
    const firstInvalid = (['departmentId', 'userId', 'workplaceId', 'effectiveFrom', 'effectiveTo'] as const)
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

  const departmentOptions = departments.map(department => ({ value: department._id, label: department.name }));
  const workplaceOptions = workplaces.map(workplace => ({ value: workplace._id, label: workplace.name }));
  const employeeOptions = eligibleEmployees.map(employee => ({
    value: employee.userId,
    label: employee.fullName || employee.employeeCode,
  }));

  const hasEligibleEmployees = eligibleEmployees.length > 0;
  const canSubmit = form.departmentId && form.userId && form.workplaceId && form.effectiveFrom && form.effectiveTo && !submitting;

  return <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) close(); }}>
    <DialogContent showCloseButton={!submitting} initialFocus={() => document.getElementById('assignment-departmentId')}>
      <DialogHeader className="border-b border-border pr-16">
        <DialogTitle>Tạo phân công</DialogTitle>
        <DialogDescription>Chọn phòng ban, nhân viên và nơi làm việc để tạo phân công mới. Các trường có dấu * là bắt buộc.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate className="space-y-5 overflow-y-auto px-6 pb-6" aria-busy={submitting}>
        {/* Phòng ban */}
        <FormSelectField
          id="assignment-departmentId"
          label="Phòng ban"
          required
          value={form.departmentId}
          onChange={event => updateField('departmentId', event.target.value)}
          options={departmentOptions}
          placeholder="Chọn phòng ban"
          disabled={submitting}
          error={errors.departmentId}
        />

        {/* Nhân viên - chỉ hiện sau khi chọn phòng ban */}
        <div>
          {!form.departmentId ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nhân viên <span className="text-destructive">*</span></label>
              <div className="block min-h-11 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                Vui lòng chọn phòng ban trước
              </div>
            </div>
          ) : loadingEmployees ? (
            <div className="space-y-1.5">
              <label htmlFor="assignment-userId" className="text-sm font-medium">
                Nhân viên <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                <LoaderCircle className="animate-spin size-4 motion-reduce:animate-none" aria-hidden="true" />
                <span className="text-muted-foreground">Đang tải danh sách nhân viên...</span>
              </div>
            </div>
          ) : employeeError ? (
            <div className="space-y-1.5">
              <label htmlFor="assignment-userId" className="text-sm font-medium">
                Nhân viên <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2 min-h-11 w-full rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <span>{employeeError}</span>
              </div>
              <Button type="button" variant="ghost" size="sm" className="min-h-8 text-xs" onClick={() => { setLoadingEmployees(true); setEmployeeError(null); setTimeout(() => setLoadingEmployees(false), 300); }}>Thử lại</Button>
            </div>
          ) : !hasEligibleEmployees ? (
            <div className="space-y-1.5">
              <label htmlFor="assignment-userId" className="text-sm font-medium">
                Nhân viên <span className="text-destructive">*</span>
              </label>
              <div className="flex flex-col items-center justify-center gap-2 min-h-11 w-full rounded-lg border border-input bg-muted px-3 py-4 text-center">
                <Users className="size-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Không còn nhân viên chưa được phân công trong phòng ban này.</p>
              </div>
            </div>
          ) : (
            <FormSelectField
              id="assignment-userId"
              label="Nhân viên"
              required
              value={form.userId}
              onChange={event => updateField('userId', event.target.value)}
              options={employeeOptions}
              placeholder="Chọn nhân viên"
              disabled={submitting}
              error={errors.userId}
            />
          )}
        </div>

        {/* Nơi làm việc */}
        <FormSelectField
          id="assignment-workplaceId"
          label="Nơi làm việc"
          required
          value={form.workplaceId}
          onChange={event => updateField('workplaceId', event.target.value)}
          options={workplaceOptions}
          placeholder="Chọn nơi làm việc"
          disabled={submitting}
          error={errors.workplaceId}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormInputField id="assignment-effectiveFrom" label="Ngày bắt đầu" type="date" required value={form.effectiveFrom} onChange={event => updateField('effectiveFrom', event.target.value)} disabled={submitting} error={errors.effectiveFrom} />
          <FormInputField id="assignment-effectiveTo" label="Ngày kết thúc" type="date" required value={form.effectiveTo} onChange={event => updateField('effectiveTo', event.target.value)} disabled={submitting} error={errors.effectiveTo} min={form.effectiveFrom || undefined} />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={close}>Hủy</Button>
          <Button type="submit" className="min-h-11" disabled={!canSubmit}>
            {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {submitting ? 'Đang tạo...' : !canSubmit ? 'Chưa đủ thông tin' : 'Tạo phân công'}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
