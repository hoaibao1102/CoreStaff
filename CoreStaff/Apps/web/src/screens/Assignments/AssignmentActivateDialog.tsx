import { useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { toast } from '@/components/toast';
import { activateAssignment, assignmentErrorMessage } from '@/services/assignment.service';

interface AssignmentActivateDialogProps {
  apiBase: string;
  assignmentId: string;
  onClose: () => void;
  onActivated: () => void;
}

export function AssignmentActivateDialog({ apiBase, assignmentId, onClose, onActivated }: AssignmentActivateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function confirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await activateAssignment(apiBase, assignmentId);
      onActivated();
      onClose();
      toast.success('Đã kích hoạt phân công.');
    } catch (error) {
      toast.error('Không thể kích hoạt phân công', assignmentErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !submittingRef.current) onClose(); }}>
    <DialogContent showCloseButton={!submitting}>
      <DialogHeader className="border-b border-border pr-16">
        <DialogTitle>Kích hoạt lại phân công?</DialogTitle>
        <DialogDescription>Phân công này sẽ được đưa trở lại trạng thái hoạt động.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col-reverse gap-2 px-6 pb-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={onClose}>Hủy</Button>
        <Button type="button" className="min-h-11" disabled={submitting} onClick={() => void confirm()}>
          {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {submitting ? 'Đang kích hoạt...' : 'Kích hoạt'}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}
