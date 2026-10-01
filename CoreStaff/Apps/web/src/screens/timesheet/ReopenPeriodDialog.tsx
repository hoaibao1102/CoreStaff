import { useState } from 'react';
import { Button } from '@/components/button';
import { Textarea } from '@/components/textarea';
import { Label } from '@/components/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { hrRequest } from '@/services/api';
import { getApiBaseSync } from '@/config/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onReopened: () => void;
  period: { _id: string; period: string } | null;
  organizationId: string;
}

export function ReopenPeriodDialog({ open, onClose, onReopened, period, organizationId }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const MIN_REASON_LENGTH = 10;

  async function handleReopen() {
    if (!period) return;
    
    // Validate reason
    if (reason.length < MIN_REASON_LENGTH) {
      setError(`Lý do phải có ít nhất ${MIN_REASON_LENGTH} ký tự`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await hrRequest(
        getApiBaseSync(),
        `/api/hr/timesheet-periods/${period._id}/reopen`,
        { method: 'POST', body: JSON.stringify({ reason }) },
      );
      onReopened();
      setReason('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mở lại kỳ công việc</DialogTitle>
          <DialogDescription>
            Nhập lý do để mở lại kỳ công việc đã đóng.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="reason">Lý do</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            placeholder="Nhập lý do (tối thiểu 10 ký tự)..."
            rows={4}
          />
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button onClick={handleReopen} disabled={loading || reason.length < MIN_REASON_LENGTH}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              'Xác nhận mở lại'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
