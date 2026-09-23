import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Clock3,
  Filter,
  MessageSquareText,
  Users,
  X,
  MapPin,
  ExternalLink,
  Eye,
  Camera,
  Search,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Compass,
  Phone,
  Mail,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs';
import { toast } from '@/components/toast';
import { CompensationScreen } from '../Compensation/CompensationScreen';
import {
  decideManagerRequest,
  getManagerContext,
  getManagerEmployees,
  getManagerRequests,
  type ManagerContext,
  type ManagerEmployee,
  type ManagerRequest,
} from '@/services/manager.service';
import { fetchAddressFromCoords } from '../Attendance/verification/useLocation';
import { getSocket } from '@/services/socket';

function formatDate(v?: string | Date) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(v));
}

function formatTime(v?: string | Date) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(new Date(v));
}

export function ManagerDepartmentScreen({
  apiBase,
  initialTab = 'approvals',
}: {
  apiBase: string | null;
  initialTab?: 'approvals' | 'employees' | 'evaluations';
}) {
  const [ctx, setCtx] = useState<ManagerContext | null>(null);
  const [dept, setDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [socketRev, setSocketRev] = useState<number>(0);

  useEffect(() => {
    if (!apiBase) return;
    setLoading(true);
    getManagerContext(apiBase)
      .then((x) => {
        setCtx(x);
        setDept(x.defaultDepartmentId ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Không thể tải phạm vi quản lý.'))
      .finally(() => setLoading(false));
  }, [apiBase]);

  // Lấy số lượng đơn PENDING để hiển thị badge đỏ
  useEffect(() => {
    if (!apiBase || !dept) return;
    getManagerRequests(apiBase, { departmentId: dept, status: 'PENDING' })
      .then((rows) => setPendingCount(rows.length))
      .catch(() => {});
  }, [apiBase, dept, socketRev]);

  // Lắng nghe sự kiện Real-time qua Socket.io
  useEffect(() => {
    if (!apiBase) return;
    const socket = getSocket(apiBase);

    const registerAndJoin = () => {
      if (ctx?.managerUserId) {
        socket.emit('register:user', { userId: ctx.managerUserId, role: 'DEPARTMENT_MANAGER', departmentId: dept || undefined });
      }
      if (dept) {
        socket.emit('join:department', { departmentId: dept });
      }
    };

    registerAndJoin();
    socket.on('connect', registerAndJoin);

    const onNewRequest = (data: any) => {
      console.log('[ManagerDepartmentScreen] Real-time request:new received:', data);
      toast.info(
        'Yêu cầu mới cần phê duyệt',
        `Nhân viên ${data.employeeName || 'nhân sự'} vừa gửi yêu cầu ${
          data.type === 'ATTENDANCE' ? 'chấm công Selfie' : 'làm thêm giờ (OT)'
        }.`
      );
      setPendingCount((prev) => prev + 1);
      setSocketRev((r) => r + 1);
    };

    const onRequestDecided = (data: any) => {
      console.log('[ManagerDepartmentScreen] Real-time request:decided received:', data);
      setPendingCount((prev) => Math.max(0, prev - 1));
      setSocketRev((r) => r + 1);
    };

    socket.on('request:new', onNewRequest);
    socket.on('request:decided', onRequestDecided);

    return () => {
      socket.off('connect', registerAndJoin);
      socket.off('request:new', onNewRequest);
      socket.off('request:decided', onRequestDecided);
    };
  }, [apiBase, dept, ctx?.managerUserId]);

  if (!apiBase) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Chưa kết nối được API.</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!ctx?.managedDepartments.length) {
    return (
      <Alert>
        <Building2 />
        <AlertTitle>Chưa được phân công phòng ban</AlertTitle>
        <AlertDescription>Liên hệ HR để được gán phạm vi quản lý.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Quản lý Phòng ban</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Phê duyệt chấm công selfie/OT, theo dõi nhân sự và đánh giá KPI thuộc phạm vi bạn quản lý.
          </p>
        </div>
        {ctx.managedDepartments.length > 1 && (
          <label className="grid gap-1 text-sm font-medium">
            Phòng ban
            <select
              className="min-h-11 rounded-lg border bg-background px-3"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              {ctx.managedDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <Tabs defaultValue={initialTab}>
        <TabsList className="sticky top-0 z-10 h-11 w-full md:static md:w-fit">
          <TabsTrigger value="approvals" className="px-4 relative flex items-center gap-2">
            <span>Phê duyệt yêu cầu</span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs animate-pulse">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="employees" className="px-4">
            Nhân sự phòng ban
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="px-4">
            Đánh giá nhân sự
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals">
          <ApprovalTab
            apiBase={apiBase}
            departmentId={dept}
            socketRev={socketRev}
            onPendingCountChange={setPendingCount}
          />
        </TabsContent>

        <TabsContent value="employees">
          <DepartmentEmployeesTab apiBase={apiBase} departmentId={dept} />
        </TabsContent>

        <TabsContent value="evaluations">
          <CompensationScreen
            apiBase={apiBase}
            kind="kpi-inputs"
            userRole="DEPARTMENT_MANAGER"
            departmentId={dept}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 1: PHÊ DUYỆT YÊU CẦU (APPROVALS)
// ─────────────────────────────────────────────────────────────
function ApprovalTab({
  apiBase,
  departmentId,
  socketRev = 0,
  onPendingCountChange,
}: {
  apiBase: string;
  departmentId: string;
  socketRev?: number;
  onPendingCountChange?: (count: number) => void;
}) {
  const [rows, setRows] = useState<ManagerRequest[]>([]);
  const [emps, setEmps] = useState<ManagerEmployee[]>([]);
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ManagerRequest | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let c = false;
    setBusy(true);
    setError('');
    Promise.all([
      getManagerRequests(apiBase, { departmentId, type, status }),
      getManagerEmployees(apiBase, departmentId),
    ])
      .then(([r, e]) => {
        if (!c) {
          setRows(r);
          setEmps(e);
          if (status === 'PENDING') {
            onPendingCountChange?.(r.length);
          }
        }
      })
      .catch((e) => {
        if (!c) setError(e instanceof Error ? e.message : 'Không thể tải yêu cầu.');
      })
      .finally(() => {
        if (!c) setBusy(false);
      });
    return () => {
      c = true;
    };
  }, [apiBase, departmentId, type, status, rev, socketRev]);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    emps.forEach((e) => {
      map.set(e.id, `${e.employeeCode} — ${e.fullName ?? 'Chưa cập nhật'}`);
      if (e.userId) {
        map.set(e.userId, `${e.employeeCode} — ${e.fullName ?? 'Chưa cập nhật'}`);
      }
    });
    return map;
  }, [emps]);

  const getEmployeeLabel = (r: ManagerRequest) => {
    // 1. Kiểm tra từ employeeId populated
    if (r.employeeId && typeof r.employeeId === 'object' && r.employeeId.employeeCode) {
      const name = r.employeeUserId?.fullName || '';
      return `${r.employeeId.employeeCode} — ${name}`;
    }
    // 2. Tìm trong map
    const idKey = typeof r.employeeId === 'string' ? r.employeeId : r.employeeId?._id;
    if (idKey && names.has(idKey)) return names.get(idKey)!;
    const userKey = typeof r.employeeUserId === 'string' ? r.employeeUserId : r.employeeUserId?._id;
    if (userKey && names.has(userKey)) return names.get(userKey)!;
    return 'Nhân viên';
  };

  const shown = rows.filter((r) => {
    const empName = getEmployeeLabel(r);
    return `${empName} ${r.reason}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_180px_200px_auto]">
        <Input
          aria-label="Tìm yêu cầu"
          placeholder="Tìm nhân viên hoặc lý do…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Loại yêu cầu"
          className="min-h-11 rounded-lg border bg-background px-3"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="ALL">Tất cả loại</option>
          <option value="ATTENDANCE">Chấm công Selfie</option>
          <option value="OVERTIME">Làm thêm giờ (OT)</option>
        </select>
        <select
          aria-label="Trạng thái"
          className="min-h-11 rounded-lg border bg-background px-3"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
          <option value="CLARIFICATION_REQUESTED">Cần giải trình</option>
          <option value="ALL">Tất cả</option>
        </select>
        <Button variant="outline" onClick={() => setRev((x) => x + 1)}>
          <Filter className="mr-1.5 size-4" /> Làm mới
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {busy ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Không có yêu cầu phù hợp.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Loại yêu cầu</TableHead>
                  <TableHead>Ngày thực hiện</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="font-medium">{getEmployeeLabel(r)}</TableCell>
                    <TableCell>
                      {r.type === 'OVERTIME' ? (
                        <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50">
                          OT ngoài giờ
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                          <Camera className="mr-1 inline size-3" /> Chấm công Selfie
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(r.workDate)}</TableCell>
                    <TableCell>
                      <Status value={r.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelected(r)}>
                        <Eye className="mr-1 size-3.5" /> Xem xét
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {shown.map((r) => (
              <Card key={r._id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{getEmployeeLabel(r)}</CardTitle>
                    <Status value={r.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">
                    <strong>{r.type === 'OVERTIME' ? 'OT' : 'Công Selfie'}</strong> · {formatDate(r.workDate)}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{r.reason}</p>
                  <Button className="w-full" variant="outline" onClick={() => setSelected(r)}>
                    <Eye className="mr-1 size-3.5" /> Xem xét
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {selected && (
        <DecisionDialog
          apiBase={apiBase}
          request={selected}
          employee={getEmployeeLabel(selected)}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            setRev((x) => x + 1);
          }}
        />
      )}
    </div>
  );
}

function Status({ value }: { value: string }) {
  switch (value) {
    case 'APPROVED':
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Đã duyệt</Badge>;
    case 'REJECTED':
      return <Badge variant="destructive">Từ chối</Badge>;
    case 'CLARIFICATION_REQUESTED':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Cần giải trình</Badge>;
    default:
      return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Chờ duyệt</Badge>;
  }
}

// ─────────────────────────────────────────────────────────────
// MODAL CHI TIẾT & PHÊ DUYỆT (DECISION DIALOG)
// ─────────────────────────────────────────────────────────────
function DecisionDialog({
  apiBase,
  request,
  employee,
  onClose,
  onDone,
}: {
  apiBase: string;
  request: ManagerRequest;
  employee?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const act = async (a: 'approve' | 'reject' | 'request-clarification') => {
    setSending(true);
    setError('');
    try {
      await decideManagerRequest(apiBase, request._id, a, {
        expectedVersion: request.version,
        reason: reason || undefined,
        approvedStart: request.requestedStart,
        approvedEnd: request.requestedEnd,
      });

      if (a === 'approve') {
        toast.success(
          'Phê duyệt thành công',
          `Đã phê duyệt yêu cầu ${request.type === 'OVERTIME' ? 'OT' : 'chấm công'} của ${employee || 'nhân viên'}.`
        );
      } else if (a === 'request-clarification') {
        toast.warning(
          'Đã gửi yêu cầu giải trình',
          `Đã yêu cầu ${employee || 'nhân viên'} bổ sung thêm giải trình.`
        );
      } else {
        toast.error(
          'Đã từ chối yêu cầu',
          `Đã từ chối yêu cầu ${request.type === 'OVERTIME' ? 'OT' : 'chấm công'} của ${employee || 'nhân viên'}.`
        );
      }

      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể xử lý yêu cầu.';
      setError(msg);
      toast.error('Thao tác thất bại', msg);
    } finally {
      setSending(false);
    }
  };

  // Xác định URL ảnh Selfie
  const evidenceId =
    typeof request.evidenceId === 'object' && request.evidenceId?._id
      ? request.evidenceId._id
      : typeof request.evidenceId === 'string'
      ? request.evidenceId
      : null;

  const selfieSrc = evidenceId
    ? `${apiBase}/api/attendance/evidence/${evidenceId}`
    : request.metadata?.selfieUrl || null;

  const lat = request.metadata?.latitude;
  const lng = request.metadata?.longitude;
  const rawAddress = request.metadata?.address;
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  useEffect(() => {
    // If address is raw lat/long coordinates or starts with 📍, resolve it to a human-readable street address
    const isCoordsOnly =
      !rawAddress ||
      rawAddress.startsWith('📍') ||
      rawAddress.toLowerCase().includes('tọa độ') ||
      /^[-+]?[0-9]*\.?[0-9]+,\s*[-+]?[0-9]*\.?[0-9]+$/.test(rawAddress.trim());

    if (lat !== undefined && lng !== undefined && isCoordsOnly) {
      fetchAddressFromCoords(Number(lat), Number(lng)).then((addr) => {
        if (addr && !addr.startsWith('📍') && !addr.includes('Tọa độ:')) {
          setResolvedAddress(addr);
        }
      });
    }
  }, [lat, lng, rawAddress]);

  const displayAddress =
    resolvedAddress ||
    (rawAddress && !rawAddress.startsWith('📍') && !rawAddress.includes('Tọa độ:') ? rawAddress : null);

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="h-dvh max-h-dvh w-screen max-w-none rounded-none sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {request.type === 'OVERTIME' ? (
                <>
                  <Clock3 className="size-5 text-indigo-600" /> Duyệt làm thêm giờ (OT)
                </>
              ) : (
                <>
                  <Camera className="size-5 text-blue-600" /> Duyệt Chấm công Selfie
                </>
              )}
              <span className="font-normal text-muted-foreground">— {employee}</span>
            </DialogTitle>
            <DialogDescription>
              Ngày thực hiện: <strong>{formatDate(request.workDate)}</strong> · Trạng thái:{' '}
              <Status value={request.status} /> · Phiên bản #{request.version}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto p-4 sm:p-6 max-h-[calc(90vh-140px)]">
            {/* Lý do / Ghi chú */}
            <div className="rounded-xl border bg-muted/40 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lý do & Nội dung yêu cầu
              </span>
              <p className="mt-1 text-sm font-medium">{request.reason}</p>
            </div>

            {/* Chi tiết cho luồng CHẤM CÔNG SELFIE */}
            {request.type === 'ATTENDANCE' && (
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Khối Ảnh Selfie */}
                <div className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Camera className="size-4 text-blue-600" /> Bằng chứng ảnh Selfie
                    </span>
                    {selfieSrc && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(selfieSrc)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="size-3" /> Phóng to
                      </button>
                    )}
                  </div>

                  {selfieSrc ? (
                    <div
                      className="group relative cursor-pointer overflow-hidden rounded-lg border bg-black/5 aspect-4/3 flex items-center justify-center"
                      onClick={() => setPreviewImage(selfieSrc)}
                    >
                      <img
                        src={selfieSrc}
                        alt="Ảnh selfie chấm công"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium gap-1">
                        <Eye className="size-4" /> Bấm để xem rõ nét
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
                      <Camera className="size-8 text-slate-300 mb-2" />
                      Không tìm thấy file ảnh selfie
                    </div>
                  )}
                </div>

                {/* Khối Vị trí & Tọa độ thực địa */}
                <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <MapPin className="size-4 text-emerald-600" /> Vị trí chấm công thực địa
                    </span>

                    <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 space-y-1.5 border">
                      <p className="font-medium text-slate-900 leading-snug">
                        {displayAddress || (lat !== undefined && lng !== undefined ? 'Đang nhận diện địa chỉ...' : 'Chưa nhận diện địa chỉ')}
                      </p>
                      {lat !== undefined && lng !== undefined && (
                        <p className="text-slate-500 font-mono text-[11px]">
                          Tọa độ: {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
                        </p>
                      )}
                    </div>
                  </div>

                  {lat !== undefined && lng !== undefined && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition"
                    >
                      <ExternalLink className="size-3.5 text-slate-500" />
                      Mở Google Maps xác thực vị trí
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Chi tiết cho luồng OVERTIME */}
            {request.type === 'OVERTIME' && (
              <div className="rounded-xl border bg-indigo-50/50 p-4 space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                  Khoảng thời gian đề xuất
                </span>
                <p className="text-sm font-medium text-indigo-950 flex items-center gap-2">
                  <Clock3 className="size-4 text-indigo-600" />
                  {request.requestedStart ? new Date(request.requestedStart).toLocaleString('vi-VN') : '—'}
                  {' → '}
                  {request.requestedEnd ? new Date(request.requestedEnd).toLocaleString('vi-VN') : '—'}
                </p>
              </div>
            )}

            {/* Nhận xét / Lý do giải trình khi duyệt hoặc từ chối */}
            <label className="grid gap-2 text-sm font-medium pt-2">
              <span>Ý kiến phản hồi / Lý do giải trình:</span>
              <textarea
                className="min-h-20 rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Bắt buộc nhập ít nhất 10 ký tự khi Từ chối hoặc Yêu cầu giải trình..."
              />
            </label>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {request.status === 'PENDING' && (
            <div className="sticky bottom-0 grid gap-2 border-t bg-background p-4 sm:grid-cols-3">
              <Button
                disabled={sending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                onClick={() => act('approve')}
              >
                <Check className="mr-1.5 size-4" /> Phê duyệt công
              </Button>
              <Button
                disabled={sending || reason.trim().length < 10}
                variant="outline"
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={() => act('request-clarification')}
              >
                <MessageSquareText className="mr-1.5 size-4" /> Yêu cầu giải trình
              </Button>
              <Button
                disabled={sending || reason.trim().length < 10}
                variant="destructive"
                onClick={() => act('reject')}
              >
                <X className="mr-1.5 size-4" /> Từ chối
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal phóng to ảnh selfie */}
      {previewImage && (
        <Dialog open onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-2 bg-black border-none flex flex-col items-center justify-center">
            <div className="relative w-full max-h-[85vh] flex items-center justify-center">
              <img
                src={previewImage}
                alt="Ảnh phóng to"
                className="max-h-[80vh] max-w-full rounded-md object-contain"
              />
            </div>
            <p className="text-white/80 text-xs mt-2">Ảnh chấm công selfie lưu trữ trên hệ thống</p>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 2: TRACKING NHÂN SỰ PHÒNG BAN (MỚI)
// ─────────────────────────────────────────────────────────────
function DepartmentEmployeesTab({ apiBase, departmentId }: { apiBase: string; departmentId: string }) {
  const [employees, setEmployees] = useState<ManagerEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [workplaceFilter, setWorkplaceFilter] = useState('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL');

  const loadData = () => {
    setLoading(true);
    setError('');
    getManagerEmployees(apiBase, departmentId)
      .then((data) => setEmployees(data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Không thể tải danh sách nhân sự.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [apiBase, departmentId]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = employees.length;
    let checkedIn = 0;
    let notCheckedIn = 0;
    let outOffice = 0;
    let pendingApproval = 0;

    employees.forEach((e) => {
      if (e.workplaceType === 'OUT_OFFICE') outOffice++;
      const att = e.todayAttendance;
      if (!att || att.attendanceStatus === 'NOT_CHECKED_IN') {
        notCheckedIn++;
      } else {
        checkedIn++;
      }
      if (att?.overallApprovalStatus === 'PENDING') {
        pendingApproval++;
      }
    });

    return { total, checkedIn, notCheckedIn, outOffice, pendingApproval };
  }, [employees]);

  // Lọc dữ liệu
  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchQuery =
        (e.fullName || '').toLowerCase().includes(query.toLowerCase()) ||
        (e.employeeCode || '').toLowerCase().includes(query.toLowerCase()) ||
        (e.email || '').toLowerCase().includes(query.toLowerCase());

      const matchWorkplace =
        workplaceFilter === 'ALL' ||
        (workplaceFilter === 'OUT_OFFICE' && e.workplaceType === 'OUT_OFFICE') ||
        (workplaceFilter === 'IN_OFFICE' && e.workplaceType !== 'OUT_OFFICE');

      const attStatus = e.todayAttendance?.attendanceStatus || 'NOT_CHECKED_IN';
      const matchAttendance =
        attendanceFilter === 'ALL' ||
        (attendanceFilter === 'CHECKED_IN' && attStatus === 'CHECKED_IN') ||
        (attendanceFilter === 'CHECKED_OUT' && (attStatus === 'CHECKED_OUT' || attStatus === 'COMPLETED')) ||
        (attendanceFilter === 'NOT_CHECKED_IN' && attStatus === 'NOT_CHECKED_IN') ||
        (attendanceFilter === 'PENDING' && e.todayAttendance?.overallApprovalStatus === 'PENDING');

      return matchQuery && matchWorkplace && matchAttendance;
    });
  }, [employees, query, workplaceFilter, attendanceFilter]);

  return (
    <div className="mt-4 space-y-5">
      {/* 4 Cards Thống kê trạng thái trực quan */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tổng nhân sự</p>
              <h3 className="mt-1 text-2xl font-bold text-foreground">{stats.total}</h3>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Đã vào ca hôm nay</p>
              <h3 className="mt-1 text-2xl font-bold text-emerald-600">{stats.checkedIn}</h3>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <UserCheck className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chưa vào ca</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-500">{stats.notCheckedIn}</h3>
            </div>
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500">
              <UserX className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nhân viên Thị trường</p>
              <h3 className="mt-1 text-2xl font-bold text-amber-600">{stats.outOffice}</h3>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <Compass className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bộ lọc và Tìm kiếm */}
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_200px_200px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Tìm nhân viên"
            placeholder="Tìm theo họ tên, mã NV hoặc email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          aria-label="Hình thức làm việc"
          className="min-h-11 rounded-lg border bg-background px-3 text-sm"
          value={workplaceFilter}
          onChange={(e) => setWorkplaceFilter(e.target.value)}
        >
          <option value="ALL">Tất cả hình thức</option>
          <option value="IN_OFFICE">Tại văn phòng</option>
          <option value="OUT_OFFICE">Đi thị trường</option>
        </select>

        <select
          aria-label="Trạng thái chấm công"
          className="min-h-11 rounded-lg border bg-background px-3 text-sm"
          value={attendanceFilter}
          onChange={(e) => setAttendanceFilter(e.target.value)}
        >
          <option value="ALL">Tất cả trạng thái công</option>
          <option value="CHECKED_IN">Đang làm việc</option>
          <option value="CHECKED_OUT">Đã tan ca</option>
          <option value="NOT_CHECKED_IN">Chưa vào ca</option>
          <option value="PENDING">Chờ duyệt selfie</option>
        </select>

        <Button variant="outline" onClick={loadData}>
          <Filter className="mr-1.5 size-4" /> Làm mới
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Không tìm thấy nhân viên nào phù hợp với điều kiện tìm kiếm.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table Desktop */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block shadow-sm">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[280px]">Nhân sự</TableHead>
                  <TableHead>Chức vụ & Liên hệ</TableHead>
                  <TableHead>Nơi làm việc</TableHead>
                  <TableHead>Trạng thái hôm nay</TableHead>
                  <TableHead className="text-right">Giờ Check-in / Out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp) => {
                  const isOutOffice = emp.workplaceType === 'OUT_OFFICE';
                  const att = emp.todayAttendance;
                  const isCheckedIn = att?.attendanceStatus === 'CHECKED_IN';
                  const isCheckedOut = att?.attendanceStatus === 'CHECKED_OUT' || att?.attendanceStatus === 'COMPLETED';
                  const isPending = att?.overallApprovalStatus === 'PENDING';

                  return (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      {/* Cột 1: Thông tin nhân sự */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {emp.avatar ? (
                            <img
                              src={emp.avatar}
                              alt={emp.fullName || ''}
                              className="size-10 rounded-full object-cover border"
                            />
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 text-sm">
                              {(emp.fullName || emp.employeeCode || 'NV').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground leading-tight">
                              {emp.fullName || 'Chưa cập nhật tên'}
                            </p>
                            <span className="font-mono text-xs text-muted-foreground">
                              {emp.employeeCode}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Cột 2: Chức vụ & Liên hệ */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                            <Briefcase className="size-3.5 text-slate-400" />
                            {emp.positionName || 'Chưa phân chức vụ'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {emp.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="size-3" /> {emp.email}
                              </span>
                            )}
                            {emp.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="size-3" /> {emp.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Cột 3: Nơi làm việc */}
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {emp.workplaceName || 'Chưa phân nơi làm'}
                          </p>
                          {isOutOffice ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200">
                              <Compass className="mr-1 size-3" /> Thị trường
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-300">
                              <Building2 className="mr-1 size-3" /> Văn phòng
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Cột 4: Trạng thái công hôm nay */}
                      <TableCell>
                        {isPending ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-amber-500 text-white animate-pulse">
                              <Clock3 className="mr-1 size-3" /> Chờ duyệt selfie
                            </Badge>
                            <p className="text-[11px] text-amber-700 font-medium">Cần quản lý xác nhận</p>
                          </div>
                        ) : isCheckedIn ? (
                          <Badge className="bg-emerald-600 text-white">
                            <CheckCircle2 className="mr-1 size-3" /> Đang làm việc
                          </Badge>
                        ) : isCheckedOut ? (
                          <Badge className="bg-blue-600 text-white">
                            <Check className="mr-1 size-3" /> Đã tan ca
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-slate-500">
                            Chưa vào ca
                          </Badge>
                        )}
                      </TableCell>

                      {/* Cột 5: Giờ Check-in / Out */}
                      <TableCell className="text-right font-mono text-sm">
                        {att?.checkInAt ? (
                          <div className="space-y-0.5">
                            <p className="text-emerald-700 font-medium">
                              Vào: {formatTime(att.checkInAt)}
                            </p>
                            {att.checkOutAt && (
                              <p className="text-blue-700 text-xs">
                                Ra: {formatTime(att.checkOutAt)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Cards Mobile Responsive */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((emp) => {
              const isOutOffice = emp.workplaceType === 'OUT_OFFICE';
              const att = emp.todayAttendance;
              const isCheckedIn = att?.attendanceStatus === 'CHECKED_IN';
              const isCheckedOut = att?.attendanceStatus === 'CHECKED_OUT' || att?.attendanceStatus === 'COMPLETED';
              const isPending = att?.overallApprovalStatus === 'PENDING';

              return (
                <Card key={emp.id} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {emp.avatar ? (
                          <img
                            src={emp.avatar}
                            alt=""
                            className="size-9 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 text-xs">
                            {(emp.fullName || 'NV').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base leading-tight">
                            {emp.fullName || 'Chưa cập nhật'}
                          </CardTitle>
                          <span className="font-mono text-xs text-muted-foreground">
                            {emp.employeeCode}
                          </span>
                        </div>
                      </div>
                      {isPending ? (
                        <Badge className="bg-amber-500 text-white">Chờ duyệt</Badge>
                      ) : isCheckedIn ? (
                        <Badge className="bg-emerald-600 text-white">Đang làm</Badge>
                      ) : isCheckedOut ? (
                        <Badge className="bg-blue-600 text-white">Đã tan</Badge>
                      ) : (
                        <Badge variant="secondary">Chưa vào</Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2 text-xs text-slate-600 pt-0">
                    <div className="flex items-center justify-between border-t pt-2">
                      <span>Chức vụ:</span>
                      <strong className="text-slate-900">{emp.positionName || '—'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Nơi làm việc:</span>
                      <div className="flex items-center gap-1.5">
                        <span>{emp.workplaceName || '—'}</span>
                        {isOutOffice && (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] py-0 px-1.5">
                            Thị trường
                          </Badge>
                        )}
                      </div>
                    </div>
                    {att?.checkInAt && (
                      <div className="flex items-center justify-between font-mono">
                        <span>Thời gian:</span>
                        <span className="text-emerald-700 font-medium">
                          Vào: {formatTime(att.checkInAt)}{' '}
                          {att.checkOutAt && `· Ra: ${formatTime(att.checkOutAt)}`}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
