import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Skeleton } from '@/components/skeleton';
import { getAssignmentById, type Assignment } from '@/services/assignment.service';
import type { Department, EmployeeProfile, Workplace } from '@/services/hrService';

interface AssignmentDetailDialogProps {
  apiBase: string;
  assignmentId: string;
  employees: EmployeeProfile[];
  departments: Department[];
  workplaces: Workplace[];
  refreshKey?: number;
  onClose: () => void;
}

function formatDate(value?: string, includeTime = false): string {
  if (!value) return 'Chưa cập nhật';
  const date = includeTime ? new Date(value) : new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }
    : { dateStyle: 'medium' }).format(date);
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-sm font-medium text-foreground">{children}</dd>
  </div>;
}

export function AssignmentDetailDialog({
  apiBase,
  assignmentId,
  employees,
  departments,
  workplaces,
  refreshKey = 0,
  onClose,
}: AssignmentDetailDialogProps) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setNotFound(false);
    setAssignment(null);
    void getAssignmentById(apiBase, assignmentId)
      .then(data => { if (!cancelled) setAssignment(data); })
      .catch(cause => {
        if (cancelled) return;
        if ((cause as { code?: string } | null)?.code === 'ASSIGNMENT_NOT_FOUND') setNotFound(true);
        else setError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, assignmentId, refreshKey, revision]);

  const employeeNames = useMemo(() => new Map(employees.map(item => [item.userId, item.fullName || item.employeeCode])), [employees]);
  const departmentNames = useMemo(() => new Map(departments.map(item => [item._id, item.name])), [departments]);
  const workplaceNames = useMemo(() => new Map(workplaces.map(item => [item._id, item.name])), [workplaces]);

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent>
      <DialogHeader className="border-b border-border pr-16">
        <DialogTitle>Chi tiết phân công</DialogTitle>
        <DialogDescription>Thông tin đơn vị công tác và thời gian phân công của nhân viên.</DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto px-6 pb-6">
        {loading ? <div className="space-y-4" role="status" aria-label="Đang tải chi tiết phân công">
          <span className="sr-only">Đang tải chi tiết phân công…</span>
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
        </div> : notFound ? <Alert><AlertDescription>Không tìm thấy phân công.</AlertDescription></Alert>
          : error ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-4"><span>Không thể tải chi tiết phân công. Vui lòng thử lại.</span><Button variant="outline" className="min-h-11" onClick={() => setRevision(value => value + 1)}>Thử lại</Button></AlertDescription></Alert>
            : assignment ? <dl className="divide-y divide-border">
              <DetailRow label="Nhân viên">{employeeNames.get(assignment.userId) || 'Chưa có thông tin'}</DetailRow>
              <DetailRow label="Phòng ban">{departmentNames.get(assignment.departmentId) || 'Chưa có thông tin'}</DetailRow>
              <DetailRow label="Nơi làm việc">{assignment.workplaceId ? workplaceNames.get(assignment.workplaceId) || 'Chưa có thông tin' : 'Chưa chỉ định'}</DetailRow>
              <DetailRow label="Ngày bắt đầu">{formatDate(assignment.effectiveFrom)}</DetailRow>
              <DetailRow label="Ngày kết thúc">{formatDate(assignment.effectiveTo)}</DetailRow>
              <DetailRow label="Trạng thái"><Badge variant="secondary" className={assignment.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}>{assignment.active ? 'Đang hoạt động' : 'Ngưng hoạt động'}</Badge></DetailRow>
              <DetailRow label="Ngày tạo">{formatDate(assignment.createdAt, true)}</DetailRow>
              <DetailRow label="Ngày cập nhật">{formatDate(assignment.updatedAt, true)}</DetailRow>
            </dl> : null}
      </div>
    </DialogContent>
  </Dialog>;
}
