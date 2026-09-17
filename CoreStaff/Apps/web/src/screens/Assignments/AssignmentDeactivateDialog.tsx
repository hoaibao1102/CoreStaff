import { useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { toast } from '@/components/toast';
import { assignmentErrorMessage, deactivateAssignment } from '@/services/assignment.service';

interface AssignmentDeactivateDialogProps {
  apiBase: string;
  assignmentId: string;
  onClose: () => void;
  onDeactivated: () => void;
}

export function AssignmentDeactivateDialog({ apiBase, assignmentId, onClose, onDeactivated }: AssignmentDeactivateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function confirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await deactivateAssignment(apiBase, assignmentId);
      onDeactivated();
      onClose();
      toast.success('Đã ngưng hoạt động phân công.');
    } catch (error) {
      toast.error('Không thể ngưng hoạt động phân công', assignmentErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !submittingRef.current) onClose(); }}>
    <DialogContent showCloseButton={!submitting}>
      <DialogHeader className="border-b border-border pr-16">
        <DialogTitle>Ngưng hoạt động phân công?</DialogTitle>
        <DialogDescription>Phân công này sẽ được chuyển sang trạng thái ngưng hoạt động. Bạn có thể kích hoạt lại sau.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col-reverse gap-2 px-6 pb-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={onClose}>Hủy</Button>
        <Button type="button" variant="destructive" className="min-h-11" disabled={submitting} onClick={() => void confirm()}>
          {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {submitting ? 'Đang xử lý...' : 'Ngưng hoạt động'}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}
