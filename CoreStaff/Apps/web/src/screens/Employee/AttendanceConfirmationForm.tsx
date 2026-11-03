import { useEffect, useRef, useState, type ReactNode } from 'react';
import { confirmationSource, createAttendanceConfirmation, getAttendanceConfirmationPreview, type AttendanceConfirmationPreview } from '../../services/manager.service';

export const confirmationDisclaimer = 'Giờ bổ sung theo lịch, chỉ hiệu lực sau quản lý duyệt; không xác nhận thời gian OT.';

export const confirmationTime = (value?: string | null) => {
  if (!value) return 'Chưa có';
  // Obligations are currently date-local HH:mm; punches are instants. Never parse a clock as a Date.
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'Không xác định';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
    : 'Không xác định';
};

const enablementError = 'Chưa xác định chế độ xác nhận công từ máy chủ. Vui lòng liên hệ HR hoặc tải lại; không chuyển sang nhập giờ thủ công.';

export function confirmationError(error: unknown): string {
  const code = typeof error === 'string' ? error : (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    PERIOD_REQUIRED: 'Chưa có kỳ công phù hợp. Vui lòng liên hệ HR tạo hoặc mở kỳ.',
    PERIOD_CLOSED_OR_PAYROLL_CLAIMED: 'Kỳ công đã khóa hoặc đã tính lương. Vui lòng liên hệ HR.',
    ATTENDANCE_CONFIRMATION_STALE: 'Dữ liệu đã thay đổi. Hãy tải lại xem trước; đơn cũ cần quản lý từ chối hoặc yêu cầu giải trình.',
    MONTHLY_CONFIRMATION_LIMIT_EXCEEDED: 'Đã hết lượt xác nhận công trong tháng ngày làm việc.',
    ATTENDANCE_CONFIRMATION_DUPLICATE: 'Ngày này đã có yêu cầu xác nhận công đang giữ lượt.',
    POLICY_CONFIGURATION_REQUIRED: 'Chưa cấu hình chính sách. Vui lòng liên hệ HR.',
    UNSUPPORTED_OVERNIGHT_SHIFT: 'Chưa hỗ trợ ca qua đêm. Vui lòng liên hệ HR.',
    ALREADY_COMPLETE: 'Ngày này đã đủ mốc công, không thể ghi đè.',
    NO_WORK_OBLIGATION: 'Ngày này không có nghĩa vụ làm việc cần bổ sung.',
    ATTENDANCE_CONFIRMATION_PAST_DATE_REQUIRED: 'Chỉ có thể gửi xác nhận công cho ngày đã qua.',
    ATTENDANCE_ADJUSTMENT_PAST_DATE_REQUIRED: 'Chỉ có thể điều chỉnh công cho ngày đã qua.',
    NEEDS_MANUAL_REVIEW: 'Dữ liệu chấm công của ngày này cần HR kiểm tra trước khi tạo yêu cầu.',
    CONTEXT_REQUIRES_REVIEW: 'Ngày công này đã được HR xác nhận vắng không tính công (hoặc đang có xử lý rà soát). Vui lòng liên hệ HR nếu cần mở lại.',
    ATTENDANCE_CONFIRMATION_DISABLED: 'Tính năng xác nhận công hiện chưa được bật. Vui lòng liên hệ HR.',
    ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: 'Thông tin xác nhận công chưa hợp lệ. Vui lòng kiểm tra lại.',
    ATTENDANCE_CONFIRMATION_FLOW_REQUIRED: 'Vui lòng dùng xác nhận công theo lịch, không nhập giờ thủ công.',
  };
  if (code && messages[code]) return messages[code];
  return 'Không thể xử lý xác nhận công cho ngày này. Vui lòng thử lại hoặc liên hệ HR.';
}

export function ConfirmationSummary({ preview: p, customCheckOutTime }: { preview: AttendanceConfirmationPreview; customCheckOutTime?: string }) {
  const inSource = confirmationSource(p.existingPunches?.checkInProvenance);
  const outSource = confirmationSource(p.existingPunches?.checkOutProvenance);
  const hasIn = Boolean(p.existingPunches?.checkInAt || (inSource && inSource !== 'LEGACY_UNKNOWN'));
  const hasOut = Boolean(p.existingPunches?.checkOutAt || (outSource && outSource !== 'LEGACY_UNKNOWN'));

  return (
    <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4 text-sm" aria-label="Xem trước xác nhận công">
      {/* Header ca làm việc & Quota */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border-b border-blue-100/80 pb-3">
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ca làm việc</span>
          <p className="font-semibold text-foreground text-sm">
            {p.obligation?.shiftLabel ?? 'Ca hành chính (08:00 – 17:00)'}
          </p>
          {p.obligation?.requiredWorkingIntervals && p.obligation.requiredWorkingIntervals.length > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Khung giờ: {p.obligation.requiredWorkingIntervals.map(i => `${confirmationTime(i.from)} → ${confirmationTime(i.to)}`).join(', ')}
            </div>
          )}
        </div>
        {p.quota && (
          <div className="flex items-center gap-1.5 rounded-lg bg-white/80 border border-blue-200/60 px-2.5 py-1 text-xs font-medium text-blue-800 shadow-xs">
            <span>Tháng {p.quota.monthKey}: còn <strong>{p.quota.remaining}/{p.quota.limit}</strong> lượt</span>
          </div>
        )}
      </div>

      {/* Bảng so sánh 2 mốc Check-in / Check-out */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Mốc vào */}
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium text-foreground">Giờ vào (Check-in)</span>
            {hasIn ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">✓ Đã chấm</span>
            ) : (
              <span className="text-amber-600 font-medium">Chưa có</span>
            )}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-foreground">
              {p.existingPunches?.checkInAt
                ? confirmationTime(p.existingPunches.checkInAt)
                : hasIn
                ? (inSource && inSource !== 'LEGACY_UNKNOWN' ? inSource : 'Đã chấm')
                : confirmationTime(p.proposedChanges?.checkInAt)}
            </span>
            <span className="text-xs text-muted-foreground">
              {hasIn ? (inSource && inSource !== 'LEGACY_UNKNOWN' ? inSource : 'Giờ thực tế') : 'Đề xuất theo ca'}
            </span>
          </div>
        </div>

        {/* Mốc ra */}
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium text-foreground">Giờ ra (Check-out)</span>
            {hasOut ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">✓ Đã chấm</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-blue-600 font-medium">Bổ sung theo ca</span>
            )}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-foreground">
              {p.existingPunches?.checkOutAt
                ? confirmationTime(p.existingPunches.checkOutAt)
                : customCheckOutTime
                ? customCheckOutTime
                : hasOut
                ? (outSource && outSource !== 'LEGACY_UNKNOWN' ? outSource : 'Đã chấm')
                : confirmationTime(p.proposedChanges?.checkOutAt)}
            </span>
            <span className="text-xs text-muted-foreground">
              {hasOut ? (outSource && outSource !== 'LEGACY_UNKNOWN' ? outSource : 'Giờ thực tế') : customCheckOutTime ? 'Tự khai báo thực tế' : 'Giờ tan ca'}
            </span>
          </div>
        </div>
      </div>

      {/* Tóm tắt công dự kiến */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/60 border border-blue-100/60 px-3 py-2 text-xs text-muted-foreground">
        <div>
          Làm việc dự kiến: <strong className="text-foreground">{p.workingMinutes ? `${p.workingMinutes} phút (${Math.round(p.workingMinutes / 60)} giờ)` : '8 giờ'}</strong>
          {p.lateMinutes ? ` · Muộn: ${p.lateMinutes}p` : ''}
          {p.earlyMinutes ? ` · Về sớm: ${p.earlyMinutes}p` : ''}
        </div>
        <div>
          Nghỉ trưa: {p.obligation?.breakMinutes ?? 60} phút
        </div>
      </div>

      {/* Lỗi / Chặn nếu có */}
      {(p.blockedReasons ?? []).map((r, index) => (
        <p role="alert" key={index} className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs font-medium text-destructive">
          {confirmationError(typeof r === 'string' ? r : r.code)}
        </p>
      ))}

      {/* Lưu ý ngắn gọn */}
      <p className="text-xs text-muted-foreground/90 italic pt-1 border-t border-blue-100/60">
        💡 {confirmationDisclaimer}
      </p>
    </div>
  );
}

export function AttendanceConfirmationForm({
  apiBase,
  workDate,
  onDateChange,
  onCreated,
  legacy,
  bypass = false,
  onCancel,
}: {
  apiBase: string;
  workDate: string;
  onDateChange: (date: string) => void;
  onCreated: () => void;
  legacy: ReactNode;
  bypass?: boolean;
  onCancel?: () => void;
}) {
  const [reason, setReason] = useState('');
  const [customCheckOutTime, setCustomCheckOutTime] = useState('');
  const [showCustomCheckOut, setShowCustomCheckOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [revision, setRevision] = useState(0);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const submitting = useRef(false);
  const [result, setResult] = useState<{ date: string; preview?: AttendanceConfirmationPreview; legacy?: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (bypass) return;
    let live = true;
    setResult(null); setStale(false); setError('');
    getAttendanceConfirmationPreview(apiBase, workDate).then(p => {
      if (live) setResult(p.enabled === false ? { date: workDate, legacy: true } : p.enabled !== true ? { date: workDate, error: enablementError } : p.workDate === workDate ? { date: workDate, preview: p } : { date: workDate, error: 'Ngày xem trước không khớp. Vui lòng tải lại.' });
    }).catch(e => {
      if (live) setResult({ date: workDate, error: confirmationError(e) });
    });
    return () => { live = false; };
  }, [apiBase, workDate, revision, bypass]);

  if (bypass) return <>{legacy}</>;
  const currentResult = result?.date === workDate ? result : null;
  if (currentResult?.legacy) return <>{legacy}</>;

  const preview = currentResult?.preview;
  const canSubmit = Boolean(preview) && !busy && !stale && preview!.canSubmit && Boolean(preview!.actionType) && Boolean(preview!.previewHash)
    && !preview!.blockedReasons?.length && preview!.period?.canMutate !== false
    && (preview!.quota?.remaining ?? 1) > 0 && reason.trim().length >= 10 && reason.trim().length <= 1000;

  return (
    <form
      className="space-y-4 p-6"
      onSubmit={async event => {
        event.preventDefault();
        if (!canSubmit || !preview || submitting.current) return;
        submitting.current = true; setBusy(true); setError('');
        const payload: any = {
          workDate,
          reason: reason.trim(),
          previewHash: preview.previewHash!,
          ...(customCheckOutTime ? { customCheckOutTime: `${workDate}T${customCheckOutTime}:00+07:00` } : {}),
        };
        const serialized = JSON.stringify(payload);
        if (attempt.current?.payload !== serialized) attempt.current = { payload: serialized, key: crypto.randomUUID() };
        try {
          await createAttendanceConfirmation(apiBase, payload, attempt.current.key);
          onCreated();
        } catch (e) {
          setError(confirmationError(e));
          if ((e as { code?: string }).code === 'ATTENDANCE_CONFIRMATION_STALE') setStale(true);
        } finally {
          submitting.current = false; setBusy(false);
        }
      }}
    >
      <label className="grid gap-1.5 text-sm font-medium">
        Ngày
        <input
          type="date"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={workDate}
          disabled={busy}
          onChange={e => onDateChange(e.target.value)}
        />
      </label>

      {!currentResult ? (
        <div role="status" className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 text-sm text-muted-foreground">
          Đang tải xem trước…
        </div>
      ) : preview ? (
        <ConfirmationSummary preview={preview} customCheckOutTime={customCheckOutTime} />
      ) : (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {currentResult.error}
        </p>
      )}

      {preview && !preview.existingPunches?.checkOutAt && (
        <div className="pt-1">
          {!showCustomCheckOut ? (
            <button
              type="button"
              onClick={() => setShowCustomCheckOut(true)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium"
            >
              🕒 Hôm nay bạn có làm thêm giờ (OT)? Bấm vào đây để tự nhập giờ ra thực tế
            </button>
          ) : (
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  🕒 Giờ ra thực tế (làm căn cứ tính OT)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomCheckOut(false);
                    setCustomCheckOutTime('');
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Hủy, dùng giờ theo ca
                </button>
              </div>
              <input
                type="time"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={customCheckOutTime}
                onChange={e => setCustomCheckOutTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nếu hôm nay bạn có làm việc ngoài giờ (OT), vui lòng nhập giờ ra thực tế (ví dụ: 19:30). Mốc này sẽ làm căn cứ để Quản lý duyệt và hệ thống tính đủ giờ OT cho bạn.
              </p>
            </div>
          )}
        </div>
      )}

      <label className="grid gap-1.5 text-sm font-medium">
        Lý do xác nhận công
        <textarea
          className="min-h-24 w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
          placeholder="Ví dụ: Tôi đã có mặt làm việc cả ngày nhưng lúc về vội nên quên bấm máy chấm công (ít nhất 10 ký tự)..."
          value={reason}
          disabled={busy}
          maxLength={1000}
          required
          onChange={e => setReason(e.target.value)}
        />
        <span className="text-xs text-muted-foreground text-right">{reason.length}/1000 ký tự (tối thiểu 10)</span>
      </label>

      {error && <p role="alert" className="text-sm text-destructive font-medium">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => { setResult(null); setRevision(r => r + 1); }}
          className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          Tải lại xem trước
        </button>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Hủy
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {busy ? 'Đang gửi…' : 'Gửi xác nhận công'}
          </button>
        </div>
      </div>
    </form>
  );
}
