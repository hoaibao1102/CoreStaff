import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/alert";
import { Button } from "@/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import { FormError } from "@/components/form/FormError";
import { FormLabel } from "@/components/form/FormLabel";
import { Input } from "@/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import { toast } from "@/components/toast";
import {
  createOvertimePolicy,
  listOvertimePolicies,
  policiesErrorMessage,
  updateOvertimePolicy,
  type CreateOvertimePolicyPayload,
  type OvertimePayPolicy,
  type UpdateOvertimePolicyPayload,
} from "@/services/policies.service";
import {
  formatEffectiveRange,
  formatRate,
  PolicyLoadingRows,
  PolicyPaginationFooter,
  PolicyStatusBadge,
} from "../Policies/policies.ui";

const PAGE_SIZE = 10;

type Form = Record<keyof CreateOvertimePolicyPayload, string>;

const EMPTY: Form = {
  effectiveFrom: "",
  effectiveTo: "",
  workingDayRate: "",
  weeklyOffRate: "",
  publicHolidayRate: "",
  legalReference: "",
  active: "true",
};

const LABELS: Record<keyof Form, string> = {
  effectiveFrom: "Hiệu lực từ",
  effectiveTo: "Hiệu lực đến (không bắt buộc)",
  workingDayRate: "Hệ số ngày thường (x 1.5)",
  weeklyOffRate: "Hệ số nghỉ tuần (x 2.0)",
  publicHolidayRate: "Hệ số ngày lễ (x 3.0)",
  legalReference: "Tham chiếu pháp lý",
  active: "Trạng thái",
};

const REQUIRED: (keyof Form)[] = [
  "effectiveFrom",
  "workingDayRate",
  "weeklyOffRate",
  "publicHolidayRate",
  "legalReference",
];

function validate(form: Form): string {
  if (!form.effectiveFrom.trim()) return "Vui lòng chọn ngày hiệu lực.";
  if (!form.legalReference.trim()) return "Vui lòng nhập tham chiếu pháp lý.";

  for (const key of ["workingDayRate", "weeklyOffRate", "publicHolidayRate"] as const) {
    const value = Number(form[key]);
    if (form[key].trim() === "" || !Number.isFinite(value) || value < 0)
      return `"${LABELS[key]}" phải là số không âm.`;
  }

  if (form.effectiveTo.trim() && form.effectiveTo.trim() <= form.effectiveFrom.trim())
    return "Ngày hết hiệu lực phải sau ngày hiệu lực.";

  return "";
}

function payloadFrom(form: Form): CreateOvertimePolicyPayload {
  const payload: CreateOvertimePolicyPayload = {
    effectiveFrom: form.effectiveFrom.trim(),
    workingDayRate: Number(form.workingDayRate),
    weeklyOffRate: Number(form.weeklyOffRate),
    publicHolidayRate: Number(form.publicHolidayRate),
    legalReference: form.legalReference.trim(),
    active: form.active !== "false",
  };
  if (form.effectiveTo.trim()) payload.effectiveTo = form.effectiveTo.trim();
  return payload;
}

function fromPolicy(policy: OvertimePayPolicy): Form {
  return {
    effectiveFrom: policy.effectiveFrom.slice(0, 10),
    effectiveTo: policy.effectiveTo ? policy.effectiveTo.slice(0, 10) : "",
    workingDayRate: String(policy.workingDayRate),
    weeklyOffRate: String(policy.weeklyOffRate),
    publicHolidayRate: String(policy.publicHolidayRate),
    legalReference: policy.legalReference,
    active: policy.active ? "true" : "false",
  };
}

function OvertimeDetailDialog({
  policy,
  open,
  onClose,
}: {
  policy: OvertimePayPolicy | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!policy) return null;
  const rates = [
    { label: "Làm thêm ngày thường", value: formatRate(policy.workingDayRate) },
    { label: "Làm thêm ngày nghỉ tuần", value: formatRate(policy.weeklyOffRate) },
    { label: "Làm thêm ngày lễ", value: formatRate(policy.publicHolidayRate) },
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pr-16">
          <DialogTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-primary" aria-hidden="true" />
            Chi tiết chính sách lương tăng ca
          </DialogTitle>
          <DialogDescription>
            Bản v{policy.version} — {policy.legalReference}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 px-6 pb-6 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              Hiệu lực: <strong>{formatEffectiveRange(policy.effectiveFrom, policy.effectiveTo)}</strong>
            </span>
            <PolicyStatusBadge active={policy.active} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {rates.map((row) => (
              <div key={row.label} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{row.value}</p>
              </div>
            ))}
          </div>

          <div className="divide-y divide-border rounded-lg border border-border">
            {[
              { label: "Tham chiếu pháp lý", value: policy.legalReference },
              { label: "Phiên bản", value: `v${policy.version}` },
              {
                label: "Trạng thái",
                value: policy.active ? "Đang hiệu lực" : "Ngưng hiệu lực",
              },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OvertimePolicyDialog({
  policy,
  open,
  isEdit,
  onOpenChange,
  onSaved,
  apiBase,
}: {
  policy: OvertimePayPolicy | null;
  open: boolean;
  isEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  apiBase: string;
}) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(policy ? fromPolicy(policy) : EMPTY);
    setFormError("");
    setSaving(false);
  }, [open, policy]);

  const save = async () => {
    const message = validate(form);
    if (message) {
      setFormError(message);
      toast.warning("Vui lòng kiểm tra thông tin", message);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      if (isEdit && policy) {
        const changed = diffPayload(form, policy);
        if (!Object.keys(changed).length) {
          onOpenChange(false);
          onSaved();
          return;
        }
        await updateOvertimePolicy(apiBase, policy._id, changed);
        toast.success("Cập nhật chính sách thành công.");
      } else {
        await createOvertimePolicy(apiBase, payloadFrom(form));
        toast.success("Tạo chính sách thành công.");
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Không thể lưu chính sách", policiesErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pr-16">
          <DialogTitle>{isEdit ? "Chỉnh sửa chính sách lương tăng ca" : "Thêm chính sách lương tăng ca"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cập nhật hệ số lương tăng ca. Phiên bản sẽ tự tăng khi lưu."
              : "Cấu hình hệ số lương tăng ca theo §30D.2 cho một khoảng thời gian hiệu lực."}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pt-2">
          <FormError message={formError} />
        </div>
        <div className="grid gap-5 px-6 pb-2 sm:grid-cols-2">
          {(Object.keys(EMPTY) as (keyof Form)[])
            .filter((key) => key !== "active")
            .map((key) => (
              <div key={key} className="space-y-2">
                <FormLabel htmlFor={`overtime-policy-${key}`} required={REQUIRED.includes(key)}>
                  {LABELS[key]}
                </FormLabel>
                <Input
                  id={`overtime-policy-${key}`}
                  className="min-h-11"
                  type={
                    key === "effectiveFrom" || key === "effectiveTo"
                      ? "date"
                      : key === "legalReference"
                        ? "text"
                        : "number"
                  }
                  step={key.startsWith("Rate") ? "0.1" : "1"}
                  min="0"
                  placeholder={key === "workingDayRate" ? "1.5" : key === "weeklyOffRate" ? "2" : key === "publicHolidayRate" ? "3" : undefined}
                  value={form[key]}
                  disabled={saving}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          <div className="space-y-2">
            <FormLabel htmlFor="overtime-policy-active" required>
              {LABELS.active}
            </FormLabel>
            <select
              id="overtime-policy-active"
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={form.active}
              disabled={saving}
              onChange={(e) => setForm({ ...form, active: e.target.value })}
            >
              <option value="true">Đang hiệu lực</option>
              <option value="false">Ngưng hiệu lực</option>
            </select>
          </div>
        </div>
        <div className="mx-6 mb-6 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
          <Button
            className="min-h-11"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button className="min-h-11" disabled={saving} onClick={save}>
            {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo chính sách"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Only the fields that actually changed (mirrors WorkplaceEditDialog). */
function diffPayload(
  form: Form,
  policy: OvertimePayPolicy,
): UpdateOvertimePolicyPayload {
  const original = fromPolicy(policy);
  const changed: UpdateOvertimePolicyPayload = {};
  for (const key of Object.keys(EMPTY) as (keyof Form)[]) {
    if (form[key] === original[key]) continue;
    if (key === "active") {
      changed.active = form[key] === "true";
    } else if (key === "effectiveFrom") {
      changed.effectiveFrom = form[key].trim();
    } else if (key === "effectiveTo") {
      changed.effectiveTo = form[key].trim() || undefined;
    } else if (key === "legalReference") {
      changed.legalReference = form[key].trim();
    } else if (key === "workingDayRate" || key === "weeklyOffRate" || key === "publicHolidayRate") {
      (changed as Record<string, unknown>)[key] = Number(form[key]);
    }
  }
  return changed;
}

export function OvertimePayPolicyScreen({ apiBase }: { apiBase: string | null }) {
  const [rows, setRows] = useState<OvertimePayPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<OvertimePayPolicy | null>(null);
  const [detailPolicy, setDetailPolicy] = useState<OvertimePayPolicy | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);

  const load = useCallback(() => {
    if (!apiBase) {
      setError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void listOvertimePolicies(apiBase)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [apiBase, revision]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return rows.filter((row) => {
      if (status === "active" && !row.active) return false;
      if (status === "inactive" && row.active) return false;
      if (!q) return true;
      return `${row.effectiveFrom} ${row.effectiveTo ?? ""} ${row.legalReference} v${row.version}`
        .toLocaleLowerCase("vi")
        .includes(q);
    });
  }, [rows, search, status]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const from = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, total);

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Chính sách lương tăng ca
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hệ số lương tăng ca cho ngày làm việc, ngày nghỉ tuần và ngày lễ
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setEditPolicy(null);
            setCreateOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          Thêm chính sách
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-6">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="overtime-policy-search" className="text-sm font-medium">
              Tìm kiếm chính sách
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-3.5 size-4 text-muted-foreground"
              />
              <Input
                id="overtime-policy-search"
                className="min-h-11 pl-9"
                placeholder="Tìm theo ngày hiệu lực hoặc tham chiếu pháp lý…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2 sm:w-52">
            <label htmlFor="overtime-policy-status" className="text-sm font-medium">
              Trạng thái
            </label>
            <select
              id="overtime-policy-status"
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm sm:w-52"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang hiệu lực</option>
              <option value="inactive">Ngưng hiệu lực</option>
            </select>
          </div>
          {(search || status !== "all") && (
            <Button className="min-h-11" variant="ghost" onClick={resetFilters}>
              <X aria-hidden="true" />
              Xóa bộ lọc
            </Button>
          )}
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
                Không thể tải danh sách chính sách. Vui lòng thử lại.
              </AlertDescription>
            </Alert>
          </div>
        ) : loading ? (
          <PolicyLoadingRows count={5} />
        ) : !rows.length ? (
          <div className="p-14 text-center">Chưa có chính sách lương tăng ca nào.</div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-2 p-14 text-center">
            <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            Không tìm thấy chính sách nào khớp với bộ lọc.
          </div>
        ) : (
          <>
            <Table className="w-full min-w-[980px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Hiệu lực</TableHead>
                  <TableHead>Ngày thường</TableHead>
                  <TableHead>Nghỉ tuần</TableHead>
                  <TableHead>Ngày lễ</TableHead>
                  <TableHead>Tham chiếu pháp lý</TableHead>
                  <TableHead>Phiên bản</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right pr-6">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="pl-6 whitespace-nowrap">
                      {formatEffectiveRange(row.effectiveFrom, row.effectiveTo)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{formatRate(row.workingDayRate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatRate(row.weeklyOffRate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatRate(row.publicHolidayRate)}</TableCell>
                    <TableCell className="max-w-xs whitespace-normal break-words">
                      {row.legalReference}
                    </TableCell>
                    <TableCell>v{row.version}</TableCell>
                    <TableCell>
                      <PolicyStatusBadge active={row.active} />
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
                          aria-label={`Mở thao tác chính sách ${row.legalReference}`}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            className="min-h-10 px-3"
                            onClick={() => setDetailPolicy(row)}
                          >
                            <Eye aria-hidden="true" />
                            Xem chi tiết
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="min-h-10 px-3"
                            onClick={() => {
                              setCreateOpen(false);
                              setEditPolicy(row);
                            }}
                          >
                            <Pencil aria-hidden="true" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PolicyPaginationFooter
              from={from}
              to={to}
              total={total}
              page={current}
              pages={pages}
              onPrev={() => setPage(current - 1)}
              onNext={() => setPage(current + 1)}
            />
          </>
        )}
      </div>

      <OvertimePolicyDialog
        apiBase={apiBase ?? ""}
        policy={editPolicy}
        open={createOpen || editPolicy !== null}
        isEdit={editPolicy !== null}
        onOpenChange={(open) => {
          if (open) return;
          setCreateOpen(false);
          setEditPolicy(null);
        }}
        onSaved={() => setRevision((value) => value + 1)}
      />
      <OvertimeDetailDialog
        policy={detailPolicy}
        open={detailPolicy !== null}
        onClose={() => setDetailPolicy(null)}
      />
    </div>
  );
}