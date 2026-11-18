import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/dialog';
import { Button } from '../../../components/button';
import { Input } from '../../../components/input';
import { Alert, AlertDescription } from '../../../components/alert';
import { toast } from '../../../components/toast';
import { hrErrorMessage } from '../../../services/hrService';
import { respondRequestClarification, type ManagerRequest } from '../../../services/manager.service';
import { AlertCircle, Clock, Info } from 'lucide-react';
import { formatVN } from '@/lib/datetime';

interface Props {
  apiBase: string;
  request: ManagerRequest;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/** `HH:mm` in Vietnam time, or '' when the value is missing/invalid. */
function vnClock(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
}

export function ClarificationResponseModal({ apiBase, request, open, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  // QC 1.2 — seed from the request's proposed times; never a hard-coded 17:00.
  const [customInTime, setCustomInTime] = useState(() => vnClock(request.requestedStart));
  const [customOutTime, setCustomOutTime] = useState(() => vnClock(request.requestedEnd));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const workDateFormatted = request.workDate
    ? formatVN(request.workDate)
    : '';

  const hrMessage = request.reviewComment || request.reason || 'HR yêu cầu nhân viên giải trình mốc chấm công còn thiếu.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError('Lý do giải trình phải có ít nhất 10 ký tự.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const dateStr = request.workDate
        ? new Date(request.workDate).toISOString().slice(0, 10)
        : '';

      const customCheckOutTime = customOutTime && dateStr
        ? `${dateStr}T${customOutTime}:00+07:00`
        : undefined;
      const customCheckInTime = customInTime && dateStr
        ? `${dateStr}T${customInTime}:00+07:00`
        : undefined;

      await respondRequestClarification(apiBase, request._id, {
        reason: reason.trim(),
        customCheckInTime,
        customCheckOutTime,
        expectedVersion: request.version,
      });

      toast.success(
        'Đã gửi giải trình thành công',
        'Yêu cầu đã được chuyển tới Quản lý phòng ban để xem xét phê duyệt.'
      );
      onSuccess();
      onClose();
    } catch (err) {
      const msg = hrErrorMessage(err);
      setError(msg);
      toast.error('Gửi giải trình thất bại', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !busy && !val && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <AlertCircle className="size-5" />
            </span>
            Phản hồi giải trình chấm công
          </DialogTitle>
          <DialogDescription>
            Bổ sung lý do và mốc giờ làm việc thực tế cho ngày <strong>{workDateFormatted}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6 pt-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Lời nhắn từ HR */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <Info className="size-4 text-amber-700 shrink-0" />
              <span>Yêu cầu từ Nhân sự (HR):</span>
            </div>
            <p className="text-amber-800 text-xs sm:text-sm pl-6 italic">
              "{hrMessage}"
            </p>
          </div>

          {/* Mốc giờ thực tế — cả vào và ra đều sửa được (QC 1.2) */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="size-4 text-primary" />
              Mốc giờ làm việc thực tế
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                Giờ vào thực tế
                <Input type="time" aria-label="Giờ vào thực tế" value={customInTime} onChange={(e) => setCustomInTime(e.target.value)} className="font-medium" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                Giờ ra thực tế
                <Input type="time" aria-label="Giờ ra thực tế" value={customOutTime} onChange={(e) => setCustomOutTime(e.target.value)} className="font-medium" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Để trống mốc nào bạn không muốn xác nhận. <strong>Nếu hôm nay có làm thêm giờ (OT)</strong>, nhập đúng giờ ra thực tế (ví dụ 19:30) — Quản lý duyệt sẽ là căn cứ ghi nhận đủ công và thời gian OT.
            </p>
          </div>

          {/* Lý do giải trình */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Lý do giải trình <span className="text-destructive">*</span>
            </label>
            <textarea
              className="w-full min-h-24 rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Trình bày chi tiết lý do quên chấm công hoặc công việc thực hiện trong ngày (ít nhất 10 ký tự)..."
              required
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tối thiểu 10 ký tự</span>
              <span className={reason.trim().length >= 10 ? 'text-emerald-600' : 'text-amber-600'}>
                {reason.trim().length}/10 ký tự
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={busy || reason.trim().length < 10}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              {busy ? 'Đang gửi…' : 'Gửi giải trình cho Quản lý'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
