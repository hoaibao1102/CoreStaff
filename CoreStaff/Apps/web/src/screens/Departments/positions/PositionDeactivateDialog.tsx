import { useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { toast } from '@/components/toast';
import { deactivatePosition, hrErrorMessage } from '@/services/hrService';

interface PositionDeactivateDialogProps {
  apiBase: string;
  positionId: string;
  onClose: () => void;
  onDeactivated: () => void;
}

export function PositionDeactivateDialog({ apiBase, positionId, onClose, onDeactivated }: PositionDeactivateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function confirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await deactivatePosition(apiBase, positionId);
      onClose();
      onDeactivated();
      toast.success('Đã ngưng hoạt động chức vụ.');
    } catch (error) {
      toast.error('Không thể ngưng hoạt động chức vụ', hrErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !submittingRef.current) onClose(); }}>
    <DialogContent showCloseButton={!submitting}>
      <DialogHeader className="border-b border-border pr-16">
        <DialogTitle>Ngưng hoạt động chức vụ?</DialogTitle>
        <DialogDescription>Chức vụ này sẽ không còn được sử dụng cho các thao tác mới. Bạn có thể kích hoạt lại sau.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap justify-end gap-3 px-6 pb-6">
        <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={onClose}>Hủy</Button>
        <Button type="button" variant="destructive" className="min-h-11" disabled={submitting} onClick={() => void confirm()}>
          {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {submitting ? 'Đang xử lý...' : 'Ngưng hoạt động'}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}
