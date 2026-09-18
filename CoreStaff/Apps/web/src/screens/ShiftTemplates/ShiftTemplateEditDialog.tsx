import { useEffect, useState } from "react";
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
import { toast } from "@/components/toast";
import {
  getShiftTemplateById,
  updateShiftTemplate,
  shiftTemplateErrorMessage,
  type ShiftTemplate,
} from "@/services/shift-template.service";
import type { Workplace } from "@/services/workplace.service";

type Values = {
  workplaceId: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  gracePeriodMinutes: string;
};
const toValues = (row: ShiftTemplate): Values => ({
  workplaceId: row.workplaceId,
  startTime: row.startTime,
  endTime: row.endTime,
  breakMinutes: String(row.breakMinutes),
  gracePeriodMinutes: String(row.gracePeriodMinutes),
});
function validate(v: Values) {
  if (!v.workplaceId) return "Vui lòng chọn nơi làm việc.";
  if (!v.startTime || !v.endTime || v.startTime >= v.endTime)
    return "Giờ bắt đầu phải trước giờ kết thúc.";
  if (v.breakMinutes === "" || Number(v.breakMinutes) < 0)
    return "Thời gian nghỉ không hợp lệ.";
  if (v.gracePeriodMinutes === "" || Number(v.gracePeriodMinutes) < 0)
    return "Thời gian đi trễ cho phép không hợp lệ.";
  return "";
}

export function ShiftTemplateEditDialog({
  apiBase,
  templateId,
  workplaces,
  open,
  onOpenChange,
  onSaved,
}: {
  apiBase: string;
  templateId: string | null;
  workplaces: Workplace[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState("");
  const [values, setValues] = useState<Values | null>(null),
    [original, setOriginal] = useState<Values | null>(null),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open || !templateId) return;
    setLoading(true);
    void getShiftTemplateById(apiBase, templateId)
      .then((row) => {
        const v = toValues(row);
        setValues(v);
        setOriginal(v);
      })
      .catch((e) =>
        toast.error("Không thể tải ca làm việc", shiftTemplateErrorMessage(e)),
      )
      .finally(() => setLoading(false));
  }, [apiBase, open, templateId]);
  const save = async () => {
    if (!values || !original) return;
    const message = validate(values);
    if (message) {
      setFormError(message);
      toast.warning("Vui lòng kiểm tra thông tin", message);
      return;
    }
    const keys = [
      "workplaceId",
      "startTime",
      "endTime",
      "breakMinutes",
      "gracePeriodMinutes",
    ] as const;
    const payload = Object.fromEntries(
      keys
        .filter((k) => values[k] !== original[k])
        .map((k) => [
          k,
          ["breakMinutes", "gracePeriodMinutes"].includes(k)
            ? Number(values[k])
            : values[k],
        ]),
    );
    setFormError("");
    setSaving(true);
    try {
      await updateShiftTemplate(apiBase, templateId!, payload);
      toast.success("Cập nhật ca làm việc thành công.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(
        "Không thể cập nhật ca làm việc",
        shiftTemplateErrorMessage(e),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b border-border pr-16">
          <DialogTitle>Chỉnh sửa ca làm việc</DialogTitle>
          <DialogDescription>Cập nhật cấu hình ca làm việc.</DialogDescription>
        </DialogHeader>
        {loading || !values ? (
          <p role="status" className="px-6 pb-6 text-muted-foreground">
            Đang tải…
          </p>
        ) : (
          <>
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
                  value={values.workplaceId}
                  onChange={(e) =>
                    setValues({ ...values, workplaceId: e.target.value })
                  }
                  disabled={saving}
                >
                  {workplaces.map((w) => (
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
                  value={values.startTime}
                  onChange={(e) =>
                    setValues({ ...values, startTime: e.target.value })
                  }
                  disabled={saving}
                />
              </FormLabel>
              <FormLabel className="space-y-2 text-sm font-medium">
                <span className="text-foreground">
                  Giờ kết thúc <span className="text-destructive">*</span>
                </span>
                <Input
                  className="min-h-11"
                  type="time"
                  value={values.endTime}
                  onChange={(e) =>
                    setValues({ ...values, endTime: e.target.value })
                  }
                  disabled={saving}
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
                  value={values.breakMinutes}
                  onChange={(e) =>
                    setValues({ ...values, breakMinutes: e.target.value })
                  }
                  disabled={saving}
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
                  value={values.gracePeriodMinutes}
                  onChange={(e) =>
                    setValues({ ...values, gracePeriodMinutes: e.target.value })
                  }
                  disabled={saving}
                />
              </FormLabel>
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
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
