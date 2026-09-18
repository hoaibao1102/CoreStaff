import { useEffect, useMemo, useState } from "react";
import { Clock3, Plus, RefreshCw } from "lucide-react";
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
import { getWorkplaces, type Workplace } from "@/services/workplace.service";
import {
  createShiftTemplate,
  getShiftTemplates,
  shiftTemplateErrorMessage,
  type ShiftTemplate,
} from "@/services/shift-template.service";
import { ShiftTemplateRowActions } from "./ShiftTemplateRowActions";

type Form = {
  workplaceId: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  gracePeriodMinutes: string;
};
const EMPTY: Form = {
  workplaceId: "",
  startTime: "",
  endTime: "",
  breakMinutes: "60",
  gracePeriodMinutes: "5",
};

function errorFor(form: Form) {
  if (!form.workplaceId) return "Vui lòng chọn nơi làm việc.";
  if (!form.startTime) return "Vui lòng nhập giờ bắt đầu.";
  if (!form.endTime) return "Vui lòng nhập giờ kết thúc.";
  if (form.startTime >= form.endTime)
    return "Giờ bắt đầu phải trước giờ kết thúc.";
  if (form.breakMinutes === "" || Number(form.breakMinutes) < 0)
    return "Thời gian nghỉ không hợp lệ.";
  if (form.gracePeriodMinutes === "" || Number(form.gracePeriodMinutes) < 0)
    return "Thời gian đi trễ cho phép không hợp lệ.";
  return "";
}

export function ShiftTemplateScreen({
  apiBase,
  organizationId,
}: {
  apiBase: string;
  organizationId: string;
}) {
  const [formError, setFormError] = useState("");
  const [rows, setRows] = useState<ShiftTemplate[]>([]),
    [workplaces, setWorkplaces] = useState<Workplace[]>([]),
    [workplaceId, setWorkplaceId] = useState(""),
    [status, setStatus] = useState<"all" | "active" | "inactive">("all"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0),
    [open, setOpen] = useState(false),
    [creating, setCreating] = useState(false),
    [form, setForm] = useState<Form>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void Promise.all([
      getShiftTemplates(apiBase, {
        ...(workplaceId ? { workplaceId } : {}),
        active: status === "all" ? undefined : status === "active",
      }),
      getWorkplaces(apiBase),
    ])
      .then(([shiftRows, workplaceRows]) => {
        if (cancelled) return;
        setRows(shiftRows);
        setWorkplaces(
          workplaceRows.filter(
            (item) =>
              !item.organizationId || item.organizationId === organizationId,
          ),
        );
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
  }, [apiBase, organizationId, revision, status, workplaceId]);
  const names = useMemo(
    () => new Map(workplaces.map((item) => [item._id, item.name])),
    [workplaces],
  );
  const create = async () => {
    const message = errorFor(form);
    if (message) {
      setFormError(message);
      toast.warning("Vui lòng kiểm tra thông tin", message);
      return;
    }
    setFormError("");
    setCreating(true);
    try {
      await createShiftTemplate(apiBase, {
        workplaceId: form.workplaceId,
        startTime: form.startTime,
        endTime: form.endTime,
        breakMinutes: Number(form.breakMinutes),
        gracePeriodMinutes: Number(form.gracePeriodMinutes),
      });
      toast.success("Tạo ca làm việc thành công.");
      setOpen(false);
      setForm({ ...EMPTY });
      setRevision((value) => value + 1);
    } catch (e) {
      toast.error("Không thể tạo ca làm việc", shiftTemplateErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Quản lý ca làm việc
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Quản lý cấu hình ca làm việc theo từng nơi làm việc
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setForm({ ...EMPTY });
            setFormError("");
            setOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          Tạo ca làm việc
        </Button>
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-6">
          <div className="flex-1">
            <label htmlFor="shift-workplace" className="text-sm font-medium">
              Nơi làm việc
            </label>
            <select
              id="shift-workplace"
              className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={workplaceId}
              onChange={(e) => setWorkplaceId(e.target.value)}
            >
              <option value="">Tất cả nơi làm việc</option>
              {workplaces.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.code} – {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="shift-status" className="text-sm font-medium">
              Trạng thái
            </label>
            <select
              id="shift-status"
              className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm sm:w-52"
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
            onClick={() => setRevision((v) => v + 1)}
          >
            <RefreshCw aria-hidden="true" />
            Làm mới
          </Button>
        </div>
        {error ? (
          <div className="p-6">
            <Alert variant="destructive" className="mx-6 mb-6 w-auto">
              <AlertDescription>
                Không thể tải danh sách ca làm việc. Vui lòng thử lại.
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
          <div className="p-14 text-center">
            <Clock3 className="mx-auto mb-3 size-10 text-muted-foreground" />
            Chưa có ca làm việc phù hợp.
          </div>
        ) : (
          <Table className="w-full min-w-[920px] text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nơi làm việc</TableHead>
                <TableHead>Giờ bắt đầu</TableHead>
                <TableHead>Giờ kết thúc</TableHead>
                <TableHead>Thời gian nghỉ</TableHead>
                <TableHead>Thời gian đi trễ cho phép</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="pl-6 font-medium">
                    {names.get(r.workplaceId) || "Không tìm thấy nơi làm việc"}
                  </TableCell>
                  <TableCell>{r.startTime}</TableCell>
                  <TableCell>{r.endTime}</TableCell>
                  <TableCell>{r.breakMinutes} phút</TableCell>
                  <TableCell>{r.gracePeriodMinutes} phút</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        r?.active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                      }
                    >
                      {r.active ? "Đang hoạt động" : "Ngưng hoạt động"}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <ShiftTemplateRowActions
                      apiBase={apiBase}
                      row={r}
                      workplaces={workplaces}
                      onChanged={() => setRevision((value) => value + 1)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Dialog open={open} onOpenChange={(next) => !creating && setOpen(next)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="border-b border-border pr-16">
            <DialogTitle>Tạo ca làm việc</DialogTitle>
            <DialogDescription>
              Cấu hình ca làm việc cho một nơi làm việc đang hoạt động.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6">
            <FormError message={formError} />
          </div>
          <div className="grid gap-5 px-6 pb-2 sm:grid-cols-2">
            <FormLabel className="space-y-2 text-sm font-medium sm:col-span-2">
              <span className="text-foreground">
                Nơi làm việc <span className="text-destructive">*</span>
              </span>
              <select
                className="min-h-11 w-full rounded-lg border bg-background px-3"
                value={form.workplaceId}
                onChange={(e) =>
                  setForm({ ...form, workplaceId: e.target.value })
                }
                disabled={creating}
              >
                <option value="">Chọn nơi làm việc</option>
                {workplaces
                  .filter((w) => w.active)
                  .map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.code} – {w.name}
                    </option>
                  ))}
              </select>
            </FormLabel>
            <FormLabel className="space-y-2 text-sm font-medium">
              <span className="text-foreground">
                Giờ bắt đầu <span className="text-destructive">*</span>
              </span>
              <Input
                className="min-h-11"
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
                disabled={creating}
              />
            </FormLabel>
            <FormLabel className="space-y-2 text-sm font-medium">
              <span className="text-foreground">
                Giờ kết thúc <span className="text-destructive">*</span>
              </span>
              <Input
                className="min-h-11"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                disabled={creating}
              />
            </FormLabel>
            <FormLabel className="space-y-2 text-sm font-medium">
              <span className="text-foreground">
                Thời gian nghỉ (phút){" "}
                <span className="text-destructive">*</span>
              </span>
              <Input
                className="min-h-11"
                type="number"
                min="0"
                value={form.breakMinutes}
                onChange={(e) =>
                  setForm({ ...form, breakMinutes: e.target.value })
                }
                disabled={creating}
              />
            </FormLabel>
            <FormLabel className="space-y-2 text-sm font-medium">
              <span className="text-foreground">
                Thời gian đi trễ cho phép (phút){" "}
                <span className="text-destructive">*</span>
              </span>
              <Input
                className="min-h-11"
                type="number"
                min="0"
                value={form.gracePeriodMinutes}
                onChange={(e) =>
                  setForm({ ...form, gracePeriodMinutes: e.target.value })
                }
                disabled={creating}
              />
            </FormLabel>
          </div>
          <div className="mx-6 mb-6 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
            <Button
              className="min-h-11"
              variant="outline"
              disabled={creating}
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <Button className="min-h-11" disabled={creating} onClick={create}>
              {creating ? "Đang tạo..." : "Tạo ca làm việc"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
