import { useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { toast } from '@/components/toast';
import { activatePosition, hrErrorMessage } from '@/services/hrService';

interface PositionActivateDialogProps {
  apiBase: string;
  positionId: string;
  onClose: () => void;
  onActivated: () => void;
}

export function PositionActivateDialog({ apiBase, positionId, onClose, onActivated }: PositionActivateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function confirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await activatePosition(apiBase, positionId);
      onClose();
      onActivated();
      toast.success('Đã kích hoạt chức vụ.');
    } catch (error) {
      toast.error('Không thể kích hoạt chức vụ', hrErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !submittingRef.current) onClose(); }}>
    <DialogContent showCloseButton={!submitting}>
      <DialogHeader className="border-b border-border pr-16">
        <DialogTitle>Kích hoạt lại chức vụ?</DialogTitle>
        <DialogDescription>Chức vụ này sẽ có thể được sử dụng trở lại.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap justify-end gap-3 px-6 pb-6">
        <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={onClose}>Hủy</Button>
        <Button type="button" className="min-h-11" disabled={submitting} onClick={() => void confirm()}>
          {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {submitting ? 'Đang xử lý...' : 'Kích hoạt'}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}
