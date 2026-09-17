import { useEffect, useState } from "react";
import {
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
} from "lucide-react";
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
} from "@/services/workplace.service";
import { WorkplaceActivateDialog } from "./WorkplaceActivateDialog";
import { WorkplaceDeactivateDialog } from "./WorkplaceDeactivateDialog";
import { WorkplaceDetailDialog } from "./WorkplaceDetailDialog";
import { WorkplaceEditDialog } from "./WorkplaceEditDialog";

type Form = Record<keyof CreateWorkplacePayload, string>;
const EMPTY: Form = {
  code: "",
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  allowedRadiusMeters: "",
  maximumAccuracyMeters: "",
};
const FIELD_LABELS: Record<keyof Form, string> = {
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
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
    const timer = window.setTimeout(() => {
      void getWorkplaces(apiBase, {
        active: status === "all" ? undefined : status === "active",
        search,
      })
        .then((data) => {
          if (!cancelled)
            setRows(
              data.filter(
                (row) =>
                  !row.organizationId || row.organizationId === organizationId,
              ),
            );
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiBase, organizationId, revision, search, status]);

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
        address: form.address.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        allowedRadiusMeters: Number(form.allowedRadiusMeters),
        maximumAccuracyMeters: Number(form.maximumAccuracyMeters),
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
          <div className="space-y-2 sm:w-52">
            <label htmlFor="workplace-status" className="text-sm font-medium">
              Trạng thái
            </label>
            <select
              id="workplace-status"
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm sm:w-52"
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
                <TableHead>Địa chỉ</TableHead>
                <TableHead>Bán kính cho phép</TableHead>
                <TableHead>Độ chính xác tối đa</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="pl-6 font-medium">{row.code}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal break-words">
                    {row.name}
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal break-words">
                    {row.address}
                  </TableCell>
                  <TableCell>{row.allowedRadiusMeters} m</TableCell>
                  <TableCell>{row.maximumAccuracyMeters} m</TableCell>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader className="border-b border-border pr-16">
            <DialogTitle>Thêm nơi làm việc</DialogTitle>
            <DialogDescription>
              Nhập thông tin địa điểm và vùng chấm công.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6">
            <FormError message={formError} />
          </div>
          <div className="grid gap-5 px-6 pb-2 sm:grid-cols-2">
            {(Object.keys(EMPTY) as (keyof Form)[]).map((key) => (
              <FormLabel className="space-y-2 text-sm font-medium" key={key}>
                <span className="text-foreground">
                  {FIELD_LABELS[key]}{" "}
                  <span className="text-destructive">*</span>
                </span>
                <Input
                  className="min-h-11"
                  type={
                    [
                      "latitude",
                      "longitude",
                      "allowedRadiusMeters",
                      "maximumAccuracyMeters",
                    ].includes(key)
                      ? "number"
                      : "text"
                  }
                  value={form[key]}
                  disabled={creating}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </FormLabel>
            ))}
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
