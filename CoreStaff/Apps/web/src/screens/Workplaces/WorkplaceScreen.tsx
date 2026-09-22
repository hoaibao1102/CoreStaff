import { useEffect, useState } from "react";
import {
  Building2,
  Compass,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "cn";
import { Alert, AlertDescription } from "@/components/alert";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { FormLabel } from "@/components/form/FormLabel";
import { FormError } from "@/components/form/FormError";
import { Input } from "@/components/input";
import {
  AddressAutocomplete,
  type SelectedLocation,
} from "@/components/form/AddressAutocomplete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import { Skeleton } from "@/components/skeleton";
import { toast } from "@/components/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import {
  createWorkplace,
  getWorkplaces,
  workplaceErrorMessage,
  type CreateWorkplacePayload,
  type Workplace,
  type WorkplaceType,
} from "@/services/workplace.service";
import { getAssignments } from "@/services/assignment.service";
import { WorkplaceActivateDialog } from "./WorkplaceActivateDialog";
import { WorkplaceDeactivateDialog } from "./WorkplaceDeactivateDialog";
import { WorkplaceDetailDialog } from "./WorkplaceDetailDialog";
import { WorkplaceEditDialog } from "./WorkplaceEditDialog";

type Form = {
  code: string;
  name: string;
  type: WorkplaceType;
  address: string;
  latitude: string;
  longitude: string;
  allowedRadiusMeters: string;
  maximumAccuracyMeters: string;
};

const EMPTY: Form = {
  code: "",
  name: "",
  type: "IN_OFFICE",
  address: "",
  latitude: "",
  longitude: "",
  allowedRadiusMeters: "200",
  maximumAccuracyMeters: "100",
};

const FIELD_LABELS: Record<string, string> = {
  code: "Mã nơi làm việc",
  name: "Tên nơi làm việc",
  address: "Địa chỉ",
  latitude: "Vĩ độ",
  longitude: "Kinh độ",
  allowedRadiusMeters: "Bán kính cho phép (m)",
  maximumAccuracyMeters: "Độ chính xác tối đa (m)",
};

function validate(form: Form) {
  if (!form.code.trim()) return "Vui lòng nhập mã nơi làm việc.";
  if (!form.name.trim()) return "Vui lòng nhập tên nơi làm việc.";

  if (form.type !== "OUT_OFFICE") {
    if (!form.address.trim()) return "Vui lòng nhập địa chỉ.";
    if (
      form.latitude === "" ||
      Number(form.latitude) < -90 ||
      Number(form.latitude) > 90
    )
      return "Vĩ độ phải nằm trong khoảng từ -90 đến 90.";
    if (
      form.longitude === "" ||
      Number(form.longitude) < -180 ||
      Number(form.longitude) > 180
    )
      return "Kinh độ phải nằm trong khoảng từ -180 đến 180.";
    if (form.allowedRadiusMeters === "" || Number(form.allowedRadiusMeters) < 100)
      return "Bán kính cho phép tối thiểu là 100 m.";
    if (
      form.maximumAccuracyMeters === "" ||
      Number(form.maximumAccuracyMeters) < 80
    )
      return "Độ chính xác tối đa phải từ 80 m trở lên.";
  }
  return "";
}

export function WorkplaceScreen({
  apiBase,
  organizationId,
}: {
  apiBase: string;
  organizationId: string;
}) {
  const [formError, setFormError] = useState("");
  const [rows, setRows] = useState<Workplace[]>([]);
  const [assignedEmployeeCounts, setAssignedEmployeeCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "IN_OFFICE" | "OUT_OFFICE">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [activateId, setActivateId] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void getWorkplaces(apiBase, {
      active: status === "all" ? undefined : status === "active",
      search: search.trim() || undefined,
    })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, status, search, revision]);

  useEffect(() => {
    let cancelled = false;
    void getAssignments(apiBase, { active: true })
      .then((assignments) => {
        if (cancelled) return;
        const employeesByWorkplace = new Map<string, Set<string>>();
        assignments.forEach((assignment) => {
          if (!assignment.workplaceId) return;
          const employees = employeesByWorkplace.get(assignment.workplaceId) ?? new Set<string>();
          employees.add(assignment.userId);
          employeesByWorkplace.set(assignment.workplaceId, employees);
        });
        setAssignedEmployeeCounts(
          Object.fromEntries([...employeesByWorkplace].map(([workplaceId, employees]) => [workplaceId, employees.size])),
        );
      })
      .catch(() => {
        if (!cancelled) setAssignedEmployeeCounts({});
      });
    return () => { cancelled = true; };
  }, [apiBase, revision]);

  const handleLocationSelected = (loc: SelectedLocation) => {
    setForm((prev) => ({
      ...prev,
      address: loc.address,
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
    }));
    toast.success(
      "Đã lấy tọa độ GPS từ bản đồ",
      `Vĩ độ: ${loc.latitude} • Kinh độ: ${loc.longitude}`
    );
  };

  const create = async () => {
    const message = validate(form);
    if (message) {
      setFormError(message);
      toast.warning("Vui lòng kiểm tra thông tin", message);
      return;
    }
    setFormError("");
    setCreating(true);
    try {
      await createWorkplace(apiBase, {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim() || undefined,
        latitude: form.type === "OUT_OFFICE" ? 0 : Number(form.latitude),
        longitude: form.type === "OUT_OFFICE" ? 0 : Number(form.longitude),
        allowedRadiusMeters: form.type === "OUT_OFFICE" ? 0 : Number(form.allowedRadiusMeters),
        maximumAccuracyMeters: form.type === "OUT_OFFICE" ? 0 : Number(form.maximumAccuracyMeters),
      });
      toast.success("Tạo nơi làm việc thành công.");
      setCreateOpen(false);
      setForm(EMPTY);
      setRevision((value) => value + 1);
    } catch (e) {
      toast.error("Không thể tạo nơi làm việc", workplaceErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Quản lý nơi làm việc
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Quản lý các địa điểm làm việc và vùng chấm công
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setForm(EMPTY);
            setFormError("");
            setCreateOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          Thêm nơi làm việc
        </Button>
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-6">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="workplace-search" className="text-sm font-medium">
              Tìm kiếm nơi làm việc
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-3.5 size-4 text-muted-foreground"
              />
              <Input
                id="workplace-search"
                className="min-h-11 pl-9"
                placeholder="Tìm theo mã, tên hoặc địa chỉ…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2 sm:w-48">
            <label htmlFor="workplace-type" className="text-sm font-medium">
              Loại nơi làm việc
            </label>
            <select
              id="workplace-type"
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            >
              <option value="all">Tất cả loại</option>
              <option value="IN_OFFICE">Tại văn phòng</option>
              <option value="OUT_OFFICE">Lưu động / Remote</option>
            </select>
          </div>
          <div className="space-y-2 sm:w-48">
            <label htmlFor="workplace-status" className="text-sm font-medium">
              Trạng thái
            </label>
            <select
              id="workplace-status"
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngưng hoạt động</option>
            </select>
          </div>
          <Button
            className="min-h-11"
            variant="outline"
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" />
            Làm mới
          </Button>
        </div>
        {error ? (
          <div className="p-6">
            <Alert variant="destructive" className="mx-6 mb-6 w-auto">
              <AlertDescription>
                Không thể tải danh sách nơi làm việc. Vui lòng thử lại.
              </AlertDescription>
            </Alert>
          </div>
        ) : loading ? (
          <div
            className="space-y-4 p-4 sm:p-6"
            role="status"
            aria-label="Đang tải danh sách"
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="p-14 text-center">Chưa có nơi làm việc phù hợp.</div>
        ) : (
          <Table className="w-full min-w-[980px] text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Mã</TableHead>
                <TableHead>Tên nơi làm việc</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Nhân viên đã phân công</TableHead>
                <TableHead>Địa chỉ / Phạm vi</TableHead>
                <TableHead>Bán kính cho phép</TableHead>
                <TableHead>Độ chính xác tối đa</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows
                .filter((row) => typeFilter === "all" || (row.type || "IN_OFFICE") === typeFilter)
                .map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="pl-6 font-medium">{row.code}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal break-words font-medium">
                    {row.name}
                  </TableCell>
                  <TableCell>
                    {row.type === 'OUT_OFFICE' ? (
                      <Badge variant="secondary" className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 gap-1 font-medium">
                        <Compass className="size-3" />
                        Lưu động
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 gap-1 font-medium">
                        <Building2 className="size-3" />
                        Văn phòng
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">{assignedEmployeeCounts[row._id] ?? 0}</span>
                    <span className="ml-1 text-muted-foreground">nhân viên</span>
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal break-words">
                    {row.address || <span className="text-muted-foreground italic">Không cố định</span>}
                  </TableCell>
                  <TableCell>
                    {row.type === 'OUT_OFFICE' ? (
                      <span className="text-xs text-muted-foreground italic">Selfie thực địa</span>
                    ) : (
                      `${row.allowedRadiusMeters} m`
                    )}
                  </TableCell>
                  <TableCell>
                    {row.type === 'OUT_OFFICE' ? (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    ) : (
                      `${row.maximumAccuracyMeters} m`
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        row?.active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                      }
                    >
                      {row.active ? "Đang hoạt động" : "Ngưng hoạt động"}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-11 min-w-11"
                          />
                        }
                        aria-label={`Mở thao tác nơi làm việc ${row.name}`}
                      >
                        <MoreHorizontal aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          className="min-h-10 px-3"
                          onClick={() => setDetailId(row._id)}
                        >
                          <Eye aria-hidden="true" />
                          Xem chi tiết
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="min-h-10 px-3"
                          onClick={() => setEditId(row._id)}
                        >
                          <Pencil aria-hidden="true" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        {row.active ? (
                          <DropdownMenuItem
                            variant="destructive"
                            className="min-h-10 px-3"
                            onClick={() => setDeactivateId(row._id)}
                          >
                            <PowerOff aria-hidden="true" />
                            Ngưng hoạt động
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="min-h-10 px-3 text-primary"
                            onClick={() => setActivateId(row._id)}
                          >
                            <Power aria-hidden="true" />
                            Kích hoạt lại
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Dialog
        open={createOpen}
        onOpenChange={(next) => !creating && setCreateOpen(next)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-border pr-16">
            <DialogTitle>Thêm nơi làm việc</DialogTitle>
            <DialogDescription>
              Cấu hình địa điểm làm việc và phương thức chấm công tương ứng.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pt-2">
            <FormError message={formError} />
          </div>

          <div className="space-y-5 px-6 pb-2">
            {/* Loại nơi làm việc Selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Loại nơi làm việc <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1 border border-border">
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
                    form.type !== "OUT_OFFICE"
                      ? "bg-background text-foreground shadow-sm font-semibold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setForm({ ...form, type: "IN_OFFICE" })}
                >
                  <Building2 className="size-4 text-blue-600" />
                  <span>Tại văn phòng (IN_OFFICE)</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
                    form.type === "OUT_OFFICE"
                      ? "bg-background text-foreground shadow-sm font-semibold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setForm({ ...form, type: "OUT_OFFICE" })}
                >
                  <Compass className="size-4 text-purple-600" />
                  <span>Lưu động / Ngoại văn phòng (OUT_OFFICE)</span>
                </button>
              </div>
            </div>

            {form.type === "OUT_OFFICE" && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20 p-3.5 text-xs text-purple-800 dark:text-purple-300 flex items-start gap-2">
                <Compass className="size-4 shrink-0 mt-0.5 text-purple-600" />
                <div>
                  <p className="font-semibold">Chế độ chấm công lưu động (OUT_OFFICE):</p>
                  <p className="mt-0.5">
                    Dành cho nhân viên kinh doanh, kỹ thuật công trình, tài xế hoặc làm việc từ xa. Khi nhân viên đăng nhập hoặc vào trang chấm công, hệ thống sẽ tự động chuyển thẳng tới phương thức <b>Chụp ảnh Selfie camera</b> để xác thực khuôn mặt và vị trí thực tế mà không giới hạn bán kính văn phòng.
                  </p>
                </div>
              </div>
            )}

            {/* Thông tin cơ bản */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormLabel className="space-y-1.5 text-sm font-medium">
                <span className="text-foreground">
                  Mã nơi làm việc <span className="text-destructive">*</span>
                </span>
                <Input
                  className="min-h-11"
                  placeholder="Ví dụ: VP-Q1, SL-HCM..."
                  value={form.code}
                  disabled={creating}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </FormLabel>
              <FormLabel className="space-y-1.5 text-sm font-medium">
                <span className="text-foreground">
                  Tên nơi làm việc <span className="text-destructive">*</span>
                </span>
                <Input
                  className="min-h-11"
                  placeholder={form.type === "OUT_OFFICE" ? "Ví dụ: Đội kinh doanh miền Nam" : "Ví dụ: Trụ sở chính Quận 1"}
                  value={form.name}
                  disabled={creating}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormLabel>
            </div>

            <div className="space-y-1.5 text-sm font-medium">
              <span className="text-foreground">
                {form.type === "OUT_OFFICE" ? "Địa bàn / Khu vực làm việc" : "Địa chỉ trụ sở"}
                {form.type !== "OUT_OFFICE" && <span className="text-destructive"> *</span>}
              </span>
              <AddressAutocomplete
                className="min-h-11"
                placeholder={
                  form.type === "OUT_OFFICE"
                    ? "Ví dụ: Toàn quốc, TP.HCM và các tỉnh lân cận, hoặc Remote"
                    : "Nhập địa chỉ để tìm kiếm và tự động lấy tọa độ GPS..."
                }
                value={form.address}
                disabled={creating}
                onChange={(addr) => setForm({ ...form, address: addr })}
                onSelectLocation={handleLocationSelected}
              />
            </div>

            {/* Vùng Geofence GPS — Chỉ hiện khi IN_OFFICE */}
            {form.type !== "OUT_OFFICE" && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Tọa độ GPS & Bán kính Geofence</span>
                  </div>
                  <span className="text-xs text-primary">
                    ✓ Tự động điền khi chọn địa chỉ ở trên
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormLabel className="space-y-1.5 text-sm font-medium">
                    <span className="text-foreground">
                      Vĩ độ (Latitude) <span className="text-destructive">*</span>
                    </span>
                    <Input
                      className="min-h-11"
                      type="number"
                      step="any"
                      placeholder="Ví dụ: 10.762622"
                      value={form.latitude}
                      disabled={creating}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    />
                  </FormLabel>
                  <FormLabel className="space-y-1.5 text-sm font-medium">
                    <span className="text-foreground">
                      Kinh độ (Longitude) <span className="text-destructive">*</span>
                    </span>
                    <Input
                      className="min-h-11"
                      type="number"
                      step="any"
                      placeholder="Ví dụ: 106.660247"
                      value={form.longitude}
                      disabled={creating}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    />
                  </FormLabel>
                  <FormLabel className="space-y-1.5 text-sm font-medium">
                    <span className="text-foreground">
                      Bán kính cho phép (m) <span className="text-destructive">*</span>
                    </span>
                    <Input
                      className="min-h-11"
                      type="number"
                      placeholder="Tối thiểu 100m (mặc định 200m)"
                      value={form.allowedRadiusMeters}
                      disabled={creating}
                      onChange={(e) => setForm({ ...form, allowedRadiusMeters: e.target.value })}
                    />
                  </FormLabel>
                  <FormLabel className="space-y-1.5 text-sm font-medium">
                    <span className="text-foreground">
                      Độ chính xác tối đa (m) <span className="text-destructive">*</span>
                    </span>
                    <Input
                      className="min-h-11"
                      type="number"
                      placeholder="Tối thiểu 80m (mặc định 100m)"
                      value={form.maximumAccuracyMeters}
                      disabled={creating}
                      onChange={(e) => setForm({ ...form, maximumAccuracyMeters: e.target.value })}
                    />
                  </FormLabel>
                </div>
              </div>
            )}
          </div>

          <div className="mx-6 mb-6 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
            <Button
              className="min-h-11"
              variant="outline"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button className="min-h-11" disabled={creating} onClick={create}>
              {creating ? "Đang tạo..." : "Tạo nơi làm việc"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <WorkplaceActivateDialog
        apiBase={apiBase}
        workplaceId={activateId}
        open={activateId !== null}
        onOpenChange={(open) => {
          if (!open) setActivateId(null);
        }}
        onActivated={() => setRevision((value) => value + 1)}
      />
      <WorkplaceDeactivateDialog
        apiBase={apiBase}
        workplaceId={deactivateId}
        open={deactivateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateId(null);
        }}
        onDeactivated={() => setRevision((value) => value + 1)}
      />
      <WorkplaceDetailDialog
        apiBase={apiBase}
        workplaceId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      />
      <WorkplaceEditDialog
        apiBase={apiBase}
        workplaceId={editId}
        open={editId !== null}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
        onSaved={() => setRevision((value) => value + 1)}
      />
    </div>
  );
}
