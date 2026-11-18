import { useEffect, useState } from 'react';
import { Plus, Power, PowerOff, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Skeleton } from '@/components/skeleton';
import { getDepartments, type Department } from '@/services/hrService';
import {
  createManagerAssignment,
  getManagerAssignmentCandidates,
  getManagerAssignments,
  setManagerAssignmentActive,
  type ManagerAssignment,
} from '@/services/manager.service';
import { formatVN } from '@/lib/datetime';

export function ManagerAssignmentsPanel({ apiBase }: { apiBase: string }) {
  const [rows, setRows] = useState<ManagerAssignment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    setLoading(true);
    // QC 5.1 — the list now carries manager/department names from the server.
    Promise.all([
      getManagerAssignments(apiBase),
      getDepartments(apiBase),
    ])
      .then(([a, d]) => {
        setRows(a);
        setDepartments(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Không thể tải phân công quản lý.'))
      .finally(() => setLoading(false));
  }, [apiBase, rev]);

  const toggle = async (r: ManagerAssignment) => {
    try {
      await setManagerAssignmentActive(apiBase, r._id, !r.active);
      setRev((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error && e.message.includes('DEPARTMENT_ALREADY_HAS_MANAGER')
        ? 'Phòng ban này đang có quản lý khác. Hãy ngưng phân công của quản lý cũ trước.'
        : e instanceof Error ? e.message : 'Không thể đổi trạng thái.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Phân công quản lý phòng ban</h2>
          <p className="text-sm text-muted-foreground">
            Gán một quản lý vào một hoặc nhiều phòng ban theo thời gian hiệu lực.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Gán quản lý
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Users className="mx-auto mb-2" />
            Chưa có phân công quản lý.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <Card key={r._id}>
              <CardHeader>
                <div className="flex justify-between gap-2">
                  <CardTitle className="text-base">{r.managerName ?? 'Quản lý'}</CardTitle>
                  <Badge variant={r.active ? 'default' : 'secondary'}>
                    {r.active ? 'Hiệu lực' : 'Ngưng'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <strong>Phòng ban:</strong> {r.departmentName ?? r.departmentId}
                </p>
                <p className="text-muted-foreground">
                  {formatVN(r.effectiveFrom)} →{' '}
                  {r.effectiveTo ? formatVN(r.effectiveTo) : 'Không thời hạn'}
                </p>
                <Button className="w-full" variant="outline" onClick={() => toggle(r)}>
                  {r.active ? (
                    <>
                      <PowerOff className="mr-1.5 h-4 w-4" />
                      Ngưng phân công
                    </>
                  ) : (
                    <>
                      <Power className="mr-1.5 h-4 w-4" />
                      Kích hoạt
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <CreateDialog
          apiBase={apiBase}
          departments={departments}
          managedBy={new Map(rows.filter((r) => r.active).map((r) => [r.departmentId, r.managerName ?? 'quản lý khác']))}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            setRev((x) => x + 1);
          }}
        />
      )}
    </div>
  );
}

function CreateDialog({
  apiBase,
  departments,
  managedBy,
  onClose,
  onDone,
}: {
  apiBase: string;
  departments: Department[];
  managedBy: Map<string, string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [department, setDepartment] = useState('');
  const [manager, setManager] = useState('');
  const [candidates, setCandidates] = useState<{ id: string; fullName: string }[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const currentManager = department ? managedBy.get(department) : undefined;

  // Khi chọn phòng ban mới tải danh sách nhân viên thuộc phòng ban đó
  useEffect(() => {
    if (!department || currentManager) {
      setCandidates([]);
      setManager('');
      return;
    }
    let cancelled = false;
    setLoadingCandidates(true);
    setManager('');
    setError('');
    getManagerAssignmentCandidates(apiBase, department)
      .then((data) => {
        if (!cancelled) setCandidates(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Không thể tải danh sách nhân viên.');
      })
      .finally(() => {
        if (!cancelled) setLoadingCandidates(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiBase, department, currentManager]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department) return setError('Vui lòng chọn phòng ban.');
    if (currentManager) return setError('Phòng ban đang có quản lý. Hãy ngưng phân công cũ trước.');
    if (!manager) return setError('Vui lòng chọn quản lý.');
    setBusy(true);
    try {
      await createManagerAssignment(apiBase, {
        managerUserId: manager,
        departmentId: department,
        effectiveFrom: from,
        effectiveTo: to || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error && e.message.includes('DEPARTMENT_ALREADY_HAS_MANAGER')
        ? 'Phòng ban này đang có quản lý khác. Hãy ngưng phân công của quản lý cũ trước.'
        : e instanceof Error ? e.message : 'Không thể tạo phân công.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="border-b border-border p-6 pr-16 shrink-0">
          <DialogTitle>Gán quản lý phòng ban</DialogTitle>
          <DialogDescription className="mt-1">
            Phân công có hiệu lực theo khoảng ngày và không ghi đè lịch sử.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col flex-1 overflow-hidden" onSubmit={submit}>
          <div className="space-y-4 overflow-y-auto p-6">
            {/* 1. Chọn phòng ban trước */}
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Phòng ban <span className="text-destructive">*</span></span>
              <select
                className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setError('');
                }}
              >
                <option value="">Chọn phòng ban</option>
                {departments
                  .filter((x) => x.active)
                  .map((x) => {
                    const mgr = managedBy.get(x._id);
                    return (
                      <option key={x._id} value={x._id}>
                        {x.code} — {x.name}{mgr ? ' (Đang có quản lý)' : ''}
                      </option>
                    );
                  })}
              </select>
            </label>

            {currentManager && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
                <p className="font-semibold">Phòng ban này đang do {currentManager} quản lý.</p>
                <p className="mt-1 text-muted-foreground">
                  Để gán quản lý mới, vui lòng đóng hộp thoại này và bấm <strong>Ngưng phân công</strong> của {currentManager} trước.
                </p>
              </div>
            )}

            {/* 2. Sau đó mới hiển thị danh sách quản lý thuộc phòng ban đó */}
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Quản lý <span className="text-destructive">*</span></span>
              <select
                className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={manager}
                disabled={!department || !!currentManager || loadingCandidates}
                onChange={(e) => {
                  setManager(e.target.value);
                  setError('');
                }}
              >
                {!department ? (
                  <option value="">Vui lòng chọn phòng ban trước</option>
                ) : currentManager ? (
                  <option value="">Phòng ban đã có quản lý</option>
                ) : loadingCandidates ? (
                  <option value="">Đang tải danh sách nhân viên...</option>
                ) : candidates.length === 0 ? (
                  <option value="">Phòng ban chưa có nhân viên chính thức phù hợp</option>
                ) : (
                  <>
                    <option value="">Chọn quản lý</option>
                    {candidates.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.fullName}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                <span>Từ ngày <span className="text-destructive">*</span></span>
                <input
                  className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  type="date"
                  value={from}
                  disabled={!!currentManager}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Đến ngày
                <input
                  className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  type="date"
                  value={to}
                  disabled={!!currentManager}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/20 p-4 px-6">
            <Button type="button" variant="outline" className="min-h-10" onClick={onClose}>
              Hủy
            </Button>
            <Button
              className="min-h-10"
              disabled={busy || !department || !manager || !!currentManager || loadingCandidates}
              type="submit"
            >
              {busy ? 'Đang lưu...' : 'Gán quản lý'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
