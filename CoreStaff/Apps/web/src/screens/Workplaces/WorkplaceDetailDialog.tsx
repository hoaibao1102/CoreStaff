import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { Alert, AlertDescription } from "@/components/alert";
import { Badge } from "@/components/badge";
import { Skeleton } from "@/components/skeleton";
import {
  getWorkplaceById,
  workplaceErrorMessage,
  type Workplace,
} from "@/services/workplace.service";

export function WorkplaceDetailDialog({
  apiBase,
  workplaceId,
  open,
  onOpenChange,
}: {
  apiBase: string;
  workplaceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [row, setRow] = useState<Workplace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || !workplaceId) return;
    setLoading(true);
    setRow(null);
    setError("");
    void getWorkplaceById(apiBase, workplaceId)
      .then(setRow)
      .catch((e) =>
        setError(
          (e as { code?: string }).code === "WORKPLACE_NOT_FOUND"
            ? "Không tìm thấy nơi làm việc."
            : workplaceErrorMessage(e),
        ),
      )
      .finally(() => setLoading(false));
  }, [apiBase, workplaceId, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b border-border pr-16">
          <DialogTitle>Chi tiết nơi làm việc</DialogTitle>
          <DialogDescription>
            Thông tin địa điểm và vùng chấm công.
          </DialogDescription>
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
        ) : row ? (
          <dl className="grid grid-cols-1 gap-5 px-6 pb-6 sm:grid-cols-2">
            {(
              [
                ["Mã nơi làm việc", row.code],
                ["Tên nơi làm việc", row.name],
                ["Địa chỉ", row.address],
                ["Vĩ độ", row.latitude],
                ["Kinh độ", row.longitude],
                ["Bán kính cho phép", `${row.allowedRadiusMeters} m`],
                ["Độ chính xác tối đa", `${row.maximumAccuracyMeters} m`],
                [
                  "Trạng thái",
                  row.active ? "Đang hoạt động" : "Ngưng hoạt động",
                ],
                ...(row.createdAt
                  ? [
                      [
                        "Ngày tạo",
                        new Date(row.createdAt).toLocaleString("vi-VN"),
                      ],
                    ]
                  : []),
                ...(row.updatedAt
                  ? [
                      [
                        "Ngày cập nhật",
                        new Date(row.updatedAt).toLocaleString("vi-VN"),
                      ],
                    ]
                  : []),
              ] as [string, string | number][]
            ).map(([label, value]) => (
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
