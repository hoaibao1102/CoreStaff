import { useEffect, useMemo, useState } from 'react';
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

export function ManagerAssignmentsPanel({ apiBase }: { apiBase: string }) {
  const [rows, setRows] = useState<ManagerAssignment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<{ id: string; fullName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getManagerAssignments(apiBase),
      getManagerAssignmentCandidates(apiBase),
      getDepartments(apiBase),
    ])
      .then(([a, m, d]) => {
        setRows(a);
        setManagers(m);
        setDepartments(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Không thể tải phân công quản lý.'))
      .finally(() => setLoading(false));
  }, [apiBase, rev]);

  const mn = useMemo(() => new Map(managers.map((x) => [x.id, x.fullName])), [managers]);
  const dn = useMemo(() => new Map(departments.map((x) => [x._id, x.name])), [departments]);

  const toggle = async (r: ManagerAssignment) => {
    try {
      await setManagerAssignmentActive(apiBase, r._id, !r.active);
      setRev((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể đổi trạng thái.');
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
                  <CardTitle className="text-base">{mn.get(r.managerUserId) ?? 'Quản lý'}</CardTitle>
                  <Badge variant={r.active ? 'default' : 'secondary'}>
                    {r.active ? 'Hiệu lực' : 'Ngưng'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <strong>Phòng ban:</strong> {dn.get(r.departmentId) ?? r.departmentId}
                </p>
                <p className="text-muted-foreground">
                  {new Date(r.effectiveFrom).toLocaleDateString('vi-VN')} →{' '}
                  {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString('vi-VN') : 'Không thời hạn'}
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
  onClose,
  onDone,
}: {
  apiBase: string;
  departments: Department[];
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

  // Khi chọn phòng ban mới tải danh sách nhân viên thuộc phòng ban đó
  useEffect(() => {
    if (!department) {
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
  }, [apiBase, department]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department) return setError('Vui lòng chọn phòng ban.');
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
      setError(e instanceof Error ? e.message : 'Không thể tạo phân công.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gán quản lý phòng ban</DialogTitle>
          <DialogDescription>
            Phân công có hiệu lực theo khoảng ngày và không ghi đè lịch sử.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 p-6" onSubmit={submit}>
          {/* 1. Chọn phòng ban trước */}
          <label className="grid gap-2 text-sm font-medium">
            Phòng ban
            <select
              className="min-h-11 rounded-lg border bg-background px-3"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setError('');
              }}
            >
              <option value="">Chọn phòng ban</option>
              {departments
                .filter((x) => x.active)
                .map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.code} — {x.name}
                  </option>
                ))}
            </select>
          </label>

          {/* 2. Sau đó mới hiển thị danh sách quản lý thuộc phòng ban đó */}
          <label className="grid gap-2 text-sm font-medium">
            Quản lý
            <select
              className="min-h-11 rounded-lg border bg-background px-3 disabled:opacity-50"
              value={manager}
              disabled={!department || loadingCandidates}
              onChange={(e) => {
                setManager(e.target.value);
                setError('');
              }}
            >
              {!department ? (
                <option value="">Vui lòng chọn phòng ban trước</option>
              ) : loadingCandidates ? (
                <option value="">Đang tải danh sách nhân viên...</option>
              ) : candidates.length === 0 ? (
                <option value="">Phòng ban chưa có nhân viên phù hợp</option>
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
            <label className="grid gap-2 text-sm font-medium">
              Từ ngày
              <input
                className="min-h-11 rounded-lg border bg-background px-3"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Đến ngày
              <input
                className="min-h-11 rounded-lg border bg-background px-3"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button disabled={busy || !department || !manager || loadingCandidates} type="submit">
              {busy ? 'Đang tạo...' : 'Tạo phân công'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
