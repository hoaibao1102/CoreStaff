import { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/button';
import { Label } from '@/components/label';
import { Textarea } from '@/components/textarea';
import { reopenTimesheetPeriod, hrErrorMessage } from '@/services/hrService';
import { toast } from '@/components/toast';

interface ReopenPeriodDialogProps {
  open: boolean;
  periodId: string;
  onClose: () => void;
  onReopened: () => void;
  apiBase: string;
}

export function ReopenPeriodDialog({ open, periodId, onClose, onReopened, apiBase }: ReopenPeriodDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (reason.length < 10) {
      setError('Lý do phải có ít nhất 10 ký tự.');
      return;
    }

    setLoading(true);
    try {
      await reopenTimesheetPeriod(apiBase, periodId, { reason });
      toast.success('Mở lại kỳ công thành công!');
      onReopened();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Mở lại kỳ công</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
            <p className="font-medium">⚠️ Cảnh báo</p>
            <p className="mt-1 text-muted-foreground">
              Khi mở lại kỳ công:
            </p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              <li>Version sẽ tăng lên</li>
              <li>Tất cả xác nhận phòng ban sẽ bị hủy</li>
              <li>Snapshot tính lương sẽ bị đánh dấu lỗi thời</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Lý do mở lại * ({reason.length}/10 ký tự tối thiểu)
            </Label>
            <Textarea
              id="reason"
              placeholder="Ví dụ: Nhân viên ABC chưa chấm công ngày 15/10, cần bổ sung..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length >= 10 ? '✅ Đủ ký tự' : `Cần thêm ${10 - reason.length} ký tự nữa`}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading || reason.length < 10}>
              {loading ? 'Đang mở lại...' : 'Xác nhận mở lại'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
