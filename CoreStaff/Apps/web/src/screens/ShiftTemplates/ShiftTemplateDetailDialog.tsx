import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/skeleton";
import {
  getShiftTemplateById,
  shiftTemplateErrorMessage,
  type ShiftTemplate,
} from "@/services/shift-template.service";
import type { Workplace } from "@/services/workplace.service";

export function ShiftTemplateDetailDialog({
  apiBase,
  templateId,
  workplaces,
  open,
  onOpenChange,
}: {
  apiBase: string;
  templateId: string | null;
  workplaces: Workplace[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [row, setRow] = useState<ShiftTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || !templateId) return;
    setLoading(true);
    setRow(null);
    setError("");
    void getShiftTemplateById(apiBase, templateId)
      .then(setRow)
      .catch((e) =>
        setError(
          (e as { code?: string }).code === "SHIFT_TEMPLATE_NOT_FOUND"
            ? "Không tìm thấy ca làm việc."
            : shiftTemplateErrorMessage(e),
        ),
      )
      .finally(() => setLoading(false));
  }, [apiBase, open, templateId]);
  const workplace =
    row && workplaces.find((item) => item._id === row.workplaceId);
  const details = row
    ? [
        [
          "Nơi làm việc",
          workplace
            ? `${workplace.name} (${workplace.code})`
            : "Không tìm thấy nơi làm việc",
        ],
        ["Giờ bắt đầu", row.startTime],
        ["Giờ kết thúc", row.endTime],
        ["Thời gian nghỉ", `${row.breakMinutes} phút`],
        ["Thời gian đi trễ cho phép", `${row.gracePeriodMinutes} phút`],
        ["Trạng thái", row.active ? "Đang hoạt động" : "Ngưng hoạt động"],
        ...(row.createdAt
          ? [["Ngày tạo", new Date(row.createdAt).toLocaleString("vi-VN")]]
          : []),
        ...(row.updatedAt
          ? [["Ngày cập nhật", new Date(row.updatedAt).toLocaleString("vi-VN")]]
          : []),
      ]
    : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b border-border pr-16">
          <DialogTitle>Chi tiết ca làm việc</DialogTitle>
          <DialogDescription>Thông tin cấu hình ca làm việc.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-3 px-6 pb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="mx-6 mb-6 w-auto">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <dl className="grid gap-5 px-6 pb-2 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-medium">
                  {label === "Trạng thái" ? (
                    <Badge
                      variant="secondary"
                      className={
                        row?.active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                      }
                    >
                      {value}
                    </Badge>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mx-6 mb-6 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
          <Button
            className="min-h-11"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
