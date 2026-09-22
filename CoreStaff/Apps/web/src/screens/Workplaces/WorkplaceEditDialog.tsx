import { useEffect, useState } from "react";
import { Building2, Compass } from "lucide-react";
import { cn } from "cn";
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
  type WorkplaceType,
} from "@/services/workplace.service";
import {
  AddressAutocomplete,
  type SelectedLocation,
} from "@/components/form/AddressAutocomplete";

type Values = {
  code: string;
  name: string;
  type: WorkplaceType;
  address: string;
  latitude: string;
  longitude: string;
  allowedRadiusMeters: string;
  maximumAccuracyMeters: string;
};

const from = (w: Workplace): Values => ({
  code: w.code,
  name: w.name,
  type: w.type || "IN_OFFICE",
  address: w.address || "",
  latitude: String(w.latitude ?? 0),
  longitude: String(w.longitude ?? 0),
  allowedRadiusMeters: String(w.allowedRadiusMeters || 200),
  maximumAccuracyMeters: String(w.maximumAccuracyMeters || 100),
});

const validate = (v: Values) => {
  if (!v.code.trim()) return "Vui lòng nhập mã nơi làm việc.";
  if (!v.name.trim()) return "Vui lòng nhập tên nơi làm việc.";
  if (v.type !== "OUT_OFFICE") {
    if (!v.address.trim()) return "Vui lòng nhập địa chỉ.";
    if (Number(v.latitude) < -90 || Number(v.latitude) > 90)
      return "Vĩ độ phải nằm trong khoảng từ -90 đến 90.";
    if (Number(v.longitude) < -180 || Number(v.longitude) > 180)
      return "Kinh độ phải nằm trong khoảng từ -180 đến 180.";
    if (Number(v.allowedRadiusMeters) < 100)
      return "Bán kính cho phép tối thiểu là 100 m.";
    if (Number(v.maximumAccuracyMeters) < 80)
      return "Độ chính xác tối đa phải từ 80 m trở lên.";
  }
  return "";
};

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

  const handleLocationSelected = (loc: SelectedLocation) => {
    setValues((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        address: loc.address,
        latitude: String(loc.latitude),
        longitude: String(loc.longitude),
      };
    });
    toast.success(
      "Đã lấy tọa độ GPS từ bản đồ",
      `Vĩ độ: ${loc.latitude} • Kinh độ: ${loc.longitude}`
    );
  };

  const save = async () => {
    if (!values || !original) return;
    const message = validate(values);
    if (message) {
      setFormError(message);
      toast.warning("Vui lòng kiểm tra thông tin", message);
      return;
    }

    const payload: Partial<Workplace> = {
      type: values.type,
    };
    if (values.code.trim() !== original.code) payload.code = values.code.trim();
    if (values.name.trim() !== original.name) payload.name = values.name.trim();
    if (values.address.trim() !== original.address) payload.address = values.address.trim();

    if (values.type === "OUT_OFFICE") {
      payload.latitude = 0;
      payload.longitude = 0;
      payload.allowedRadiusMeters = 0;
      payload.maximumAccuracyMeters = 0;
    } else {
      if (values.latitude !== original.latitude || original.type === "OUT_OFFICE")
        payload.latitude = Number(values.latitude);
      if (values.longitude !== original.longitude || original.type === "OUT_OFFICE")
        payload.longitude = Number(values.longitude);
      if (values.allowedRadiusMeters !== original.allowedRadiusMeters || original.type === "OUT_OFFICE")
        payload.allowedRadiusMeters = Number(values.allowedRadiusMeters);
      if (values.maximumAccuracyMeters !== original.maximumAccuracyMeters || original.type === "OUT_OFFICE")
        payload.maximumAccuracyMeters = Number(values.maximumAccuracyMeters);
    }

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="px-6 pt-2">
              <FormError message={formError} />
            </div>
            <div className="space-y-5 px-6 pb-2">
              {/* Loại nơi làm việc */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Loại nơi làm việc <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1 border border-border">
                  <button
                    type="button"
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
                      values.type !== "OUT_OFFICE"
                        ? "bg-background text-foreground shadow-sm font-semibold border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setValues({ ...values, type: "IN_OFFICE" })}
                  >
                    <Building2 className="size-4 text-blue-600" />
                    <span>Tại văn phòng (IN_OFFICE)</span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
                      values.type === "OUT_OFFICE"
                        ? "bg-background text-foreground shadow-sm font-semibold border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setValues({ ...values, type: "OUT_OFFICE" })}
                  >
                    <Compass className="size-4 text-purple-600" />
                    <span>Lưu động / Ngoại văn phòng (OUT_OFFICE)</span>
                  </button>
                </div>
              </div>

              {/* Thông tin cơ bản */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormLabel className="space-y-1.5 text-sm font-medium">
                  <span className="text-foreground">
                    Mã nơi làm việc <span className="text-destructive">*</span>
                  </span>
                  <Input
                    className="min-h-11"
                    value={values.code}
                    onChange={(e) => setValues({ ...values, code: e.target.value })}
                    disabled={saving}
                  />
                </FormLabel>
                <FormLabel className="space-y-1.5 text-sm font-medium">
                  <span className="text-foreground">
                    Tên nơi làm việc <span className="text-destructive">*</span>
                  </span>
                  <Input
                    className="min-h-11"
                    value={values.name}
                    onChange={(e) => setValues({ ...values, name: e.target.value })}
                    disabled={saving}
                  />
                </FormLabel>
              </div>

              <div className="space-y-1.5 text-sm font-medium">
                <span className="text-foreground">
                  {values.type === "OUT_OFFICE" ? "Địa bàn / Khu vực làm việc" : "Địa chỉ trụ sở"}
                  {values.type !== "OUT_OFFICE" && <span className="text-destructive"> *</span>}
                </span>
                <AddressAutocomplete
                  className="min-h-11"
                  value={values.address}
                  onChange={(addr) => setValues({ ...values, address: addr })}
                  onSelectLocation={handleLocationSelected}
                  placeholder={
                    values.type === "OUT_OFFICE"
                      ? "Ví dụ: Toàn quốc, TP.HCM, Quận 8..."
                      : "Nhập địa chỉ để tìm kiếm và tự động lấy tọa độ GPS..."
                  }
                  disabled={saving}
                />
              </div>

              {/* Geofence GPS — Chỉ hiện khi IN_OFFICE */}
              {values.type !== "OUT_OFFICE" && (
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
                        value={values.latitude}
                        onChange={(e) => setValues({ ...values, latitude: e.target.value })}
                        disabled={saving}
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
                        value={values.longitude}
                        onChange={(e) => setValues({ ...values, longitude: e.target.value })}
                        disabled={saving}
                      />
                    </FormLabel>
                    <FormLabel className="space-y-1.5 text-sm font-medium">
                      <span className="text-foreground">
                        Bán kính cho phép (m) <span className="text-destructive">*</span>
                      </span>
                      <Input
                        className="min-h-11"
                        type="number"
                        value={values.allowedRadiusMeters}
                        onChange={(e) => setValues({ ...values, allowedRadiusMeters: e.target.value })}
                        disabled={saving}
                      />
                    </FormLabel>
                    <FormLabel className="space-y-1.5 text-sm font-medium">
                      <span className="text-foreground">
                        Độ chính xác tối đa (m) <span className="text-destructive">*</span>
                      </span>
                      <Input
                        className="min-h-11"
                        type="number"
                        value={values.maximumAccuracyMeters}
                        onChange={(e) => setValues({ ...values, maximumAccuracyMeters: e.target.value })}
                        disabled={saving}
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
