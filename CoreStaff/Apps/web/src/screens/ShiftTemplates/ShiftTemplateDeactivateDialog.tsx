import { useState } from "react";
import { Alert, AlertDescription } from "@/components/alert";
import { Button } from "@/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { toast } from "@/components/toast";
import {
  deactivateShiftTemplate,
  shiftTemplateErrorMessage,
} from "@/services/shift-template.service";

export function ShiftTemplateDeactivateDialog({
  apiBase,
  templateId,
  open,
  onOpenChange,
  onDeactivated,
}: {
  apiBase: string;
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeactivated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!templateId || busy) return;
    setBusy(true);
    try {
      await deactivateShiftTemplate(apiBase, templateId);
      toast.success("Đã ngưng hoạt động ca làm việc.");
      onOpenChange(false);
      onDeactivated();
    } catch (error) {
      toast.error(
        "Không thể ngưng hoạt động ca làm việc",
        shiftTemplateErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b border-border pr-16">
          <DialogTitle>Ngưng hoạt động ca làm việc?</DialogTitle>
          <DialogDescription>
            Ca làm việc này sẽ được chuyển sang trạng thái ngưng hoạt động.
          </DialogDescription>
        </DialogHeader>
        <Alert className="mx-6 w-auto">
          <AlertDescription>
            Nếu nơi làm việc vẫn đang có nhân viên được phân công, thao tác này
            có thể không thực hiện được.
          </AlertDescription>
        </Alert>
        <div className="mx-6 mb-6 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
          <Button
            className="min-h-11"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            className="min-h-11"
            variant="destructive"
            disabled={busy}
            onClick={confirm}
          >
            {busy ? "Đang xử lý..." : "Ngưng hoạt động"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
