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
  getWorkplaceById,
  updateWorkplace,
  workplaceErrorMessage,
  type Workplace,
} from "@/services/workplace.service";

const FIELD_LABELS = {
  code: "Mã nơi làm việc",
  name: "Tên nơi làm việc",
  address: "Địa chỉ",
  latitude: "Vĩ độ",
  longitude: "Kinh độ",
  allowedRadiusMeters: "Bán kính cho phép (m)",
  maximumAccuracyMeters: "Độ chính xác tối đa (m)",
};
type Values = {
  code: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  allowedRadiusMeters: string;
  maximumAccuracyMeters: string;
};
const from = (w: Workplace): Values => ({
  code: w.code,
  name: w.name,
  address: w.address,
  latitude: String(w.latitude),
  longitude: String(w.longitude),
  allowedRadiusMeters: String(w.allowedRadiusMeters),
  maximumAccuracyMeters: String(w.maximumAccuracyMeters),
});
const validate = (v: Values) =>
  !v.code.trim()
    ? "Vui lòng nhập mã nơi làm việc."
    : !v.name.trim()
      ? "Vui lòng nhập tên nơi làm việc."
      : !v.address.trim()
        ? "Vui lòng nhập địa chỉ."
        : Number(v.latitude) < -90 || Number(v.latitude) > 90
          ? "Vĩ độ phải nằm trong khoảng từ -90 đến 90."
          : Number(v.longitude) < -180 || Number(v.longitude) > 180
            ? "Kinh độ phải nằm trong khoảng từ -180 đến 180."
            : Number(v.allowedRadiusMeters) < 100
              ? "Bán kính cho phép tối thiểu là 100 m."
              : Number(v.maximumAccuracyMeters) < 80
                ? "Độ chính xác tối đa phải từ 80 m trở lên."
                : "";
export function WorkplaceEditDialog({
  apiBase,
  workplaceId,
  open,
  onOpenChange,
  onSaved,
}: {
  apiBase: string;
  workplaceId: string | null;
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
    if (!open || !workplaceId) return;
    setLoading(true);
    void getWorkplaceById(apiBase, workplaceId)
      .then((w) => {
        const v = from(w);
        setValues(v);
        setOriginal(v);
      })
      .catch((e) =>
        toast.error("Không thể tải nơi làm việc", workplaceErrorMessage(e)),
      )
      .finally(() => setLoading(false));
  }, [apiBase, workplaceId, open]);
  const save = async () => {
    if (!values || !original) return;
    const message = validate(values);
    if (message) {
      setFormError(message);
      toast.warning("Vui lòng kiểm tra thông tin", message);
      return;
    }
    const keys = [
      "code",
      "name",
      "address",
      "latitude",
      "longitude",
      "allowedRadiusMeters",
      "maximumAccuracyMeters",
    ] as const;
    const payload = Object.fromEntries(
      keys
        .filter((k) => values[k] !== original[k])
        .map((k) => [
          k,
          [
            "latitude",
            "longitude",
            "allowedRadiusMeters",
            "maximumAccuracyMeters",
          ].includes(k)
            ? Number(values[k])
            : values[k].trim(),
        ]),
    );
    setFormError("");
    setSaving(true);
    try {
      await updateWorkplace(apiBase, workplaceId!, payload);
      toast.success("Cập nhật nơi làm việc thành công.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Không thể cập nhật nơi làm việc", workplaceErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b border-border pr-16">
          <DialogTitle>Chỉnh sửa nơi làm việc</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin địa điểm và vùng chấm công.
          </DialogDescription>
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
              {(
                [
                  "code",
                  "name",
                  "address",
                  "latitude",
                  "longitude",
                  "allowedRadiusMeters",
                  "maximumAccuracyMeters",
                ] as const
              ).map((k) => (
                <FormLabel key={k} className="space-y-2 text-sm font-medium">
                  <span className="text-foreground">
                    {FIELD_LABELS[k]}{" "}
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
                      ].includes(k)
                        ? "number"
                        : "text"
                    }
                    value={values[k]}
                    onChange={(e) =>
                      setValues({ ...values, [k]: e.target.value })
                    }
                    disabled={saving}
                  />
                </FormLabel>
              ))}
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
