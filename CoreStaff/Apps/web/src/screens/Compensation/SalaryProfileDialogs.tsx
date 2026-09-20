import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/alert';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Input } from '@/components/input';
import {
  createSalaryProfile,
  getAttendanceBonusPolicies,
  getOrganizationAllowances,
  updateSalaryProfile,
  type AttendanceBonusPolicy,
  type CreateSalaryProfilePayload,
  type OrganizationAllowance,
  type SalaryProfile,
  type UpdateSalaryProfilePayload,
} from '@/services/compensation.service';
import { getEmployees, hrErrorMessage, type EmployeeProfile } from '@/services/hrService';

function formatVnd(val?: number): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// ───────── Create Salary Profile Dialog ─────────

export function SalaryProfileCreateDialog({
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
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [allowances, setAllowances] = useState<OrganizationAllowance[]>([]);
  const [bonusPolicies, setBonusPolicies] = useState<AttendanceBonusPolicy[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [insuranceSalary, setInsuranceSalary] = useState('');
  const [isProbation, setIsProbation] = useState(false);
  const [probationJobSalary, setProbationJobSalary] = useState('');
  const [probationAgreedSalary, setProbationAgreedSalary] = useState('');
  const [assignedAllowances, setAssignedAllowances] = useState<Record<string, { enabled: boolean; amount: string }>>({});
  const [bonusPolicyId, setBonusPolicyId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingOpts(true);
    setError(null);
    Promise.all([
      getEmployees(apiBase, {}).then(res => res.employees),
      getOrganizationAllowances(apiBase).catch(() => []),
      getAttendanceBonusPolicies(apiBase).catch(() => []),
    ])
      .then(([empList, allowList, bonusList]) => {
        setEmployees(empList);
        setAllowances(allowList);
        setBonusPolicies(bonusList);
        setAssignedAllowances(prev => {
          const next = { ...prev };
          allowList.forEach(a => {
            if (!next[a._id]) {
              next[a._id] = { enabled: false, amount: a.amount ? String(a.amount) : '' };
            }
          });
          return next;
        });
      })
      .catch(err => setError(hrErrorMessage(err)))
      .finally(() => setLoadingOpts(false));
  }, [apiBase, open]);

  const handleToggleAllowance = (id: string, enabled: boolean, defaultAmt?: number) => {
    setAssignedAllowances(prev => ({
      ...prev,
      [id]: {
        enabled,
        amount: prev[id]?.amount || (defaultAmt ? String(defaultAmt) : ''),
      },
    }));
  };

  const handleAllowanceAmountChange = (id: string, amountStr: string) => {
    setAssignedAllowances(prev => ({
      ...prev,
      [id]: {
        enabled: prev[id]?.enabled ?? true,
        amount: amountStr,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return setError('Vui lòng chọn nhân viên.');
    if (!effectiveFrom) return setError('Vui lòng chọn ngày hiệu lực.');
    const base = Number(baseSalary);
    const ins = Number(insuranceSalary);
    if (Number.isNaN(base) || base < 0) return setError('Lương cơ bản không hợp lệ.');
    if (Number.isNaN(ins) || ins < 0) return setError('Lương bảo hiểm không hợp lệ.');

    let jobSal: number | undefined;
    let agreedSal: number | undefined;
    if (isProbation) {
      jobSal = Number(probationJobSalary);
      agreedSal = Number(probationAgreedSalary);
      if (Number.isNaN(jobSal) || jobSal <= 0) return setError('Lương công việc thử việc không hợp lệ.');
      if (Number.isNaN(agreedSal) || agreedSal <= 0) return setError('Lương thỏa thuận thử việc không hợp lệ.');
    }

    setSubmitting(true);
    setError(null);

    try {
      const enabledList = Object.entries(assignedAllowances)
        .filter(([_, v]) => v.enabled)
        .map(([allowanceId, v]) => ({
          allowanceId,
          amount: Number(v.amount) || 0,
        }));

      const payload: CreateSalaryProfilePayload = {
        employeeId,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        baseSalary: base,
        insuranceSalary: ins,
        probationJobSalary: jobSal,
        probationAgreedSalary: agreedSal,
        organizationAllowanceIds: enabledList.map(x => x.allowanceId),
        allowances: enabledList,
        attendanceBonusPolicyId: bonusPolicyId || undefined,
      };
      await createSalaryProfile(apiBase, payload);
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
          <DialogTitle>Tạo hồ sơ lương mới</DialogTitle>
          <DialogDescription className="mt-1">Cấu hình mức lương, phụ cấp và thưởng chuyên cần có hiệu lực theo thời gian.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 max-h-[calc(85vh-130px)]">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nhân viên <span className="text-red-500">*</span></label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              disabled={loadingOpts || submitting}
            >
              <option value="">{loadingOpts ? 'Đang tải danh sách nhân viên…' : 'Chọn nhân viên…'}</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.employeeCode} — {emp.fullName || 'Chưa đặt tên'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ngày bắt đầu hiệu lực <span className="text-red-500">*</span></label>
              <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ngày kết thúc hiệu lực (tùy chọn)</label>
              <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} disabled={submitting} placeholder="Để trống nếu vô hạn" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Lương cơ bản (VND) <span className="text-red-500">*</span></label>
              <Input type="number" min="0" step="500000" placeholder="15000000" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Lương đóng BHXH (VND) <span className="text-red-500">*</span></label>
              <Input type="number" min="0" step="500000" placeholder="12000000" value={insuranceSalary} onChange={e => setInsuranceSalary(e.target.value)} disabled={submitting} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isProbation" checked={isProbation} onChange={e => setIsProbation(e.target.checked)} className="h-4 w-4 rounded border-input cursor-pointer" disabled={submitting} />
              <label htmlFor="isProbation" className="text-sm font-medium cursor-pointer">Cấu hình lương thử việc (TASK-031)</label>
            </div>
            {isProbation && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Lương công việc (VND)</label>
                  <Input type="number" placeholder="15000000" value={probationJobSalary} onChange={e => setProbationJobSalary(e.target.value)} disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Lương thỏa thuận (VND)</label>
                  <Input type="number" placeholder="12750000" value={probationAgreedSalary} onChange={e => setProbationAgreedSalary(e.target.value)} disabled={submitting} />
                </div>
                {Number(probationJobSalary) > 0 && Number(probationAgreedSalary) > 0 && (
                  <p className="col-span-full text-xs text-muted-foreground">
                    Tỷ lệ thử việc: <strong className="text-foreground">{((Number(probationAgreedSalary) / Number(probationJobSalary)) * 100).toFixed(1)}%</strong> (Yêu cầu tối thiểu theo chính sách: ≥ 85%)
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Phụ cấp áp dụng cho nhân viên</label>
              <span className="text-[11px] text-muted-foreground">Tùy chỉnh số tiền phụ cấp theo nhân viên</span>
            </div>
            {allowances.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có phụ cấp nào trong tổ chức.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border border-border p-2 bg-muted/10">
                {allowances.map(item => {
                  const assignment = assignedAllowances[item._id] || { enabled: false, amount: '' };
                  return (
                    <div
                      key={item._id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md border transition-colors ${
                        assignment.enabled ? 'border-primary/40 bg-background shadow-xs' : 'border-border/60 hover:bg-muted/40'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={assignment.enabled}
                          onChange={e => handleToggleAllowance(item._id, e.target.checked, item.amount)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
                          disabled={submitting}
                        />
                        <div>
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Mã: <code className="font-mono">{item.code}</code>
                            {item.taxable ? ' • Thuế PIT' : ''}
                            {item.insuranceBased ? ' • Đóng BHXH' : ''}
                            {item.prorated ? ' • Tính theo ngày công' : ''}
                          </div>
                        </div>
                      </label>
                      {assignment.enabled && (
                        <div className="flex items-center gap-1.5 pl-6 sm:pl-0 sm:w-48 shrink-0">
                          <Input
                            type="number"
                            min="0"
                            step="50000"
                            placeholder="Số tiền phụ cấp..."
                            value={assignment.amount}
                            onChange={e => handleAllowanceAmountChange(item._id, e.target.value)}
                            disabled={submitting}
                            className="h-8 text-xs font-semibold"
                          />
                          <span className="text-xs text-muted-foreground font-medium">đ</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chính sách thưởng chuyên cần</label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={bonusPolicyId}
              onChange={e => setBonusPolicyId(e.target.value)}
              disabled={loadingOpts || submitting}
            >
              <option value="">Không áp dụng thưởng chuyên cần</option>
              {bonusPolicies.map(pol => (
                <option key={pol._id} value={pol._id}>
                  {pol.name} — Thưởng tối đa {formatVnd(pol.bonusAmount)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Tạo hồ sơ lương'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);
}

// ───────── Edit Salary Profile Dialog ─────────

export function SalaryProfileEditDialog({
  apiBase,
  profile,
  open,
  onClose,
  onUpdated,
}: {
  apiBase: string;
  profile: SalaryProfile;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [allowances, setAllowances] = useState<OrganizationAllowance[]>([]);
  const [bonusPolicies, setBonusPolicies] = useState<AttendanceBonusPolicy[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);

  const [effectiveFrom, setEffectiveFrom] = useState(profile.effectiveFrom ? profile.effectiveFrom.split('T')[0] : '');
  const [effectiveTo, setEffectiveTo] = useState(profile.effectiveTo ? profile.effectiveTo.split('T')[0] : '');
  const [baseSalary, setBaseSalary] = useState(String(profile.baseSalary ?? ''));
  const [insuranceSalary, setInsuranceSalary] = useState(String(profile.insuranceSalary ?? ''));
  const [isProbation, setIsProbation] = useState(!!profile.probationJobSalary);
  const [probationJobSalary, setProbationJobSalary] = useState(String(profile.probationJobSalary ?? ''));
  const [probationAgreedSalary, setProbationAgreedSalary] = useState(String(profile.probationAgreedSalary ?? ''));
  const [assignedAllowances, setAssignedAllowances] = useState<Record<string, { enabled: boolean; amount: string }>>({});
  const [bonusPolicyId, setBonusPolicyId] = useState(profile.attendanceBonusPolicyId ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingOpts(true);
    setError(null);
    Promise.all([
      getOrganizationAllowances(apiBase).catch(() => []),
      getAttendanceBonusPolicies(apiBase).catch(() => []),
    ])
      .then(([allowList, bonusList]) => {
        setAllowances(allowList);
        setBonusPolicies(bonusList);

        const initialMap: Record<string, { enabled: boolean; amount: string }> = {};
        allowList.forEach(a => {
          const existing = profile.allowances?.find(x => x.allowanceId === a._id);
          if (existing) {
            initialMap[a._id] = { enabled: true, amount: String(existing.amount ?? 0) };
          } else if (profile.organizationAllowanceIds?.includes(a._id)) {
            initialMap[a._id] = { enabled: true, amount: a.amount ? String(a.amount) : '0' };
          } else {
            initialMap[a._id] = { enabled: false, amount: a.amount ? String(a.amount) : '' };
          }
        });
        setAssignedAllowances(initialMap);
      })
      .catch(err => setError(hrErrorMessage(err)))
      .finally(() => setLoadingOpts(false));
  }, [apiBase, open, profile]);

  const handleToggleAllowance = (id: string, enabled: boolean, defaultAmt?: number) => {
    setAssignedAllowances(prev => ({
      ...prev,
      [id]: {
        enabled,
        amount: prev[id]?.amount || (defaultAmt ? String(defaultAmt) : ''),
      },
    }));
  };

  const handleAllowanceAmountChange = (id: string, amountStr: string) => {
    setAssignedAllowances(prev => ({
      ...prev,
      [id]: {
        enabled: prev[id]?.enabled ?? true,
        amount: amountStr,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = Number(baseSalary);
    const ins = Number(insuranceSalary);
    if (Number.isNaN(base) || base < 0) return setError('Lương cơ bản không hợp lệ.');
    if (Number.isNaN(ins) || ins < 0) return setError('Lương bảo hiểm không hợp lệ.');

    let jobSal: number | undefined;
    let agreedSal: number | undefined;
    if (isProbation) {
      jobSal = Number(probationJobSalary);
      agreedSal = Number(probationAgreedSalary);
      if (Number.isNaN(jobSal) || jobSal <= 0) return setError('Lương công việc thử việc không hợp lệ.');
      if (Number.isNaN(agreedSal) || agreedSal <= 0) return setError('Lương thỏa thuận thử việc không hợp lệ.');
    }

    setSubmitting(true);
    setError(null);

    try {
      const enabledList = Object.entries(assignedAllowances)
        .filter(([_, v]) => v.enabled)
        .map(([allowanceId, v]) => ({
          allowanceId,
          amount: Number(v.amount) || 0,
        }));

      const payload: UpdateSalaryProfilePayload = {
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo || null,
        baseSalary: base,
        insuranceSalary: ins,
        probationJobSalary: isProbation ? jobSal : undefined,
        probationAgreedSalary: isProbation ? agreedSal : undefined,
        organizationAllowanceIds: enabledList.map(x => x.allowanceId),
        allowances: enabledList,
        attendanceBonusPolicyId: bonusPolicyId || null,
      };
      await updateSalaryProfile(apiBase, profile._id, payload);
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
          <DialogTitle>Chỉnh sửa hồ sơ lương</DialogTitle>
          <DialogDescription className="mt-1">Cập nhật thông tin mức lương v{profile.version} của nhân viên.</DialogDescription>
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
              <label className="text-sm font-medium">Ngày bắt đầu hiệu lực</label>
              <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ngày kết thúc hiệu lực</label>
              <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} disabled={submitting} placeholder="Để trống nếu vô hạn" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Lương cơ bản (VND)</label>
              <Input type="number" min="0" step="500000" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Lương đóng BHXH (VND)</label>
              <Input type="number" min="0" step="500000" value={insuranceSalary} onChange={e => setInsuranceSalary(e.target.value)} disabled={submitting} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="editIsProbation" checked={isProbation} onChange={e => setIsProbation(e.target.checked)} className="h-4 w-4 rounded border-input cursor-pointer" disabled={submitting} />
              <label htmlFor="editIsProbation" className="text-sm font-medium cursor-pointer">Cấu hình lương thử việc</label>
            </div>
            {isProbation && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Lương công việc (VND)</label>
                  <Input type="number" value={probationJobSalary} onChange={e => setProbationJobSalary(e.target.value)} disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Lương thỏa thuận (VND)</label>
                  <Input type="number" value={probationAgreedSalary} onChange={e => setProbationAgreedSalary(e.target.value)} disabled={submitting} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Phụ cấp áp dụng cho nhân viên</label>
              <span className="text-[11px] text-muted-foreground">Tùy chỉnh số tiền phụ cấp theo nhân viên</span>
            </div>
            {allowances.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có phụ cấp nào trong tổ chức.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border border-border p-2 bg-muted/10">
                {allowances.map(item => {
                  const assignment = assignedAllowances[item._id] || { enabled: false, amount: '' };
                  return (
                    <div
                      key={item._id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md border transition-colors ${
                        assignment.enabled ? 'border-primary/40 bg-background shadow-xs' : 'border-border/60 hover:bg-muted/40'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={assignment.enabled}
                          onChange={e => handleToggleAllowance(item._id, e.target.checked, item.amount)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
                          disabled={submitting}
                        />
                        <div>
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Mã: <code className="font-mono">{item.code}</code>
                            {item.taxable ? ' • Thuế PIT' : ''}
                            {item.insuranceBased ? ' • Đóng BHXH' : ''}
                            {item.prorated ? ' • Tính theo ngày công' : ''}
                          </div>
                        </div>
                      </label>
                      {assignment.enabled && (
                        <div className="flex items-center gap-1.5 pl-6 sm:pl-0 sm:w-48 shrink-0">
                          <Input
                            type="number"
                            min="0"
                            step="50000"
                            placeholder="Số tiền phụ cấp..."
                            value={assignment.amount}
                            onChange={e => handleAllowanceAmountChange(item._id, e.target.value)}
                            disabled={submitting}
                            className="h-8 text-xs font-semibold"
                          />
                          <span className="text-xs text-muted-foreground font-medium">đ</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chính sách thưởng chuyên cần</label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={bonusPolicyId}
              onChange={e => setBonusPolicyId(e.target.value)}
              disabled={loadingOpts || submitting}
            >
              <option value="">Không áp dụng thưởng chuyên cần</option>
              {bonusPolicies.map(pol => (
                <option key={pol._id} value={pol._id}>
                  {pol.name} — Thưởng tối đa {formatVnd(pol.bonusAmount)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Cập nhật'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);
}

// ───────── Detail Salary Profile Dialog ─────────

export function SalaryProfileDetailDialog({
  profile,
  open,
  onClose,
}: {
  profile: SalaryProfile;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>Chi tiết hồ sơ lương</DialogTitle>
          <DialogDescription className="mt-1">Mã phiên bản v{profile.version} — Trạng thái: {profile.active ? 'Đang áp dụng' : 'Không còn hiệu lực'}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5 max-h-[calc(85vh-130px)] text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Nhân viên:</span>
            <span className="font-medium">{profile.employeeCode} — {profile.employeeFullName || '—'}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Lương cơ bản:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatVnd(profile.baseSalary)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Lương đóng BHXH:</span>
            <span className="font-medium">{formatVnd(profile.insuranceSalary)}</span>
          </div>
          {profile.probationJobSalary ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 space-y-1.5 border border-amber-200 dark:border-amber-900">
              <div className="flex justify-between font-medium text-amber-900 dark:text-amber-200 text-xs">
                <span>Lương công việc thử việc:</span>
                <span>{formatVnd(profile.probationJobSalary)}</span>
              </div>
              <div className="flex justify-between font-medium text-amber-900 dark:text-amber-200 text-xs">
                <span>Lương thỏa thuận thử việc:</span>
                <span>{formatVnd(profile.probationAgreedSalary)}</span>
              </div>
              <div className="flex justify-between text-xs text-amber-700 dark:text-amber-400 pt-1 border-t border-amber-200/60 dark:border-amber-800">
                <span>Tỷ lệ thử việc:</span>
                <span className="font-bold">{profile.probationRate ? `${(profile.probationRate * 100).toFixed(1)}%` : '—'}</span>
              </div>
            </div>
          ) : null}

          {profile.allowances && profile.allowances.length > 0 ? (
            <div className="border-b pb-2 space-y-1.5">
              <span className="text-muted-foreground text-xs block font-medium">Các khoản phụ cấp được gán ({profile.allowances.length}):</span>
              <div className="space-y-1">
                {profile.allowances.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-muted/40 px-2.5 py-1.5 rounded">
                    <span className="font-medium text-foreground">Phụ cấp #{idx + 1}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatVnd(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Khoảng hiệu lực:</span>
            <span className="font-medium">
              {profile.effectiveFrom ? new Date(profile.effectiveFrom).toLocaleDateString('vi-VN') : '—'} 
              {' → '} 
              {profile.effectiveTo ? new Date(profile.effectiveTo).toLocaleDateString('vi-VN') : 'Vô hạn'}
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Đơn vị tiền tệ:</span>
            <span className="font-medium">{profile.currency} ({profile.roundingRule})</span>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-border px-6 py-3.5 bg-muted/15">
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
