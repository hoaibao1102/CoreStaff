import { useState } from "react";
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
  activateShiftTemplate,
  shiftTemplateErrorMessage,
} from "@/services/shift-template.service";

export function ShiftTemplateActivateDialog({
  apiBase,
  templateId,
  open,
  onOpenChange,
  onActivated,
}: {
  apiBase: string;
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!templateId || busy) return;
    setBusy(true);
    try {
      await activateShiftTemplate(apiBase, templateId);
      toast.success("Đã kích hoạt ca làm việc.");
      onOpenChange(false);
      onActivated();
    } catch (error) {
      toast.error(
        "Không thể kích hoạt ca làm việc",
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
          <DialogTitle>Kích hoạt lại ca làm việc?</DialogTitle>
          <DialogDescription>
            Ca làm việc này sẽ được đưa trở lại trạng thái hoạt động.
          </DialogDescription>
        </DialogHeader>
        <div className="mx-6 mb-6 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
          <Button
            className="min-h-11"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button className="min-h-11" disabled={busy} onClick={confirm}>
            {busy ? "Đang kích hoạt..." : "Kích hoạt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
