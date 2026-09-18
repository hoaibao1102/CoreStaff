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
  activateWorkplace,
  workplaceErrorMessage,
} from "@/services/workplace.service";

interface Props {
  apiBase: string;
  workplaceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated: () => void;
}

export function WorkplaceActivateDialog({
  apiBase,
  workplaceId,
  open,
  onOpenChange,
  onActivated,
}: Props) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!workplaceId || busy) return;
    setBusy(true);
    try {
      await activateWorkplace(apiBase, workplaceId);
      toast.success("Đã kích hoạt nơi làm việc.");
      onOpenChange(false);
      onActivated();
    } catch (error) {
      toast.error(
        "Không thể kích hoạt nơi làm việc",
        workplaceErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b border-border pr-16">
          <DialogTitle>Kích hoạt lại nơi làm việc?</DialogTitle>
          <DialogDescription>
            Nơi làm việc này sẽ được đưa trở lại trạng thái hoạt động và có thể
            tiếp tục được sử dụng trong các nghiệp vụ liên quan.
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
