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
  if (!error) return 'Không thể xử lý xác nhận công cho ngày này. Vui lòng thử lại hoặc liên hệ HR.';

  const isCode = (str: string) => /^[A-Z][A-Z0-9_]{3,}$/.test(str.trim());

  const messages: Record<string, string> = {
    PERIOD_REQUIRED: 'Chưa có kỳ công phù hợp. Vui lòng liên hệ HR tạo hoặc mở kỳ.',
    PERIOD_CLOSED_OR_PAYROLL_CLAIMED: 'Tháng này đã có bảng lương hoặc đã chốt kỳ công, không thể gửi đơn xác nhận công.',
    TIMESHEET_ALREADY_ACKNOWLEDGED: 'Bảng công tháng này bạn đã xác nhận kiểm tra chính xác, không thể gửi thêm yêu cầu xác nhận công.',
    ALREADY_FULL_WORK_CREDIT: 'Ngày này bạn đã chấm đủ 1 công theo ca làm việc, không thể gửi yêu cầu xác nhận công.',
    ATTENDANCE_CONFIRMATION_FUTURE_DATE_FORBIDDEN: 'Không thể gửi xác nhận công cho ngày tương lai. Vui lòng chỉ chọn từ hôm nay trở về trước.',
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
    ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: 'Thông tin xác nhận công chưa hợp lệ (lý do phải từ 10 - 1000 ký tự và vui lòng bấm "Tải lại xem trước").',
    ATTENDANCE_CONFIRMATION_FLOW_REQUIRED: 'Vui lòng dùng xác nhận công theo lịch, không nhập giờ thủ công.',
    TIME_WINDOW_INVALID: 'Giờ vào thực tế phải trước giờ ra thực tế.',
    IDEMPOTENCY_KEY_REQUIRED: 'Thiếu khóa định danh yêu cầu.',
    REASON_REQUIRED: 'Vui lòng nhập lý do xác nhận công.',
    REASON_TOO_SHORT: 'Lý do xác nhận công quá ngắn (tối thiểu 10 ký tự).',
    REASON_TOO_LONG: 'Lý do xác nhận công quá dài (tối đa 1000 ký tự).',
    WORK_DATE_INVALID: 'Ngày làm việc không hợp lệ.',
    PREVIEW_HASH_REQUIRED: 'Thiếu mã xác thực xem trước. Vui lòng bấm "Tải lại xem trước".',
    PREVIEW_HASH_INVALID: 'Mã xác thực xem trước không hợp lệ. Vui lòng bấm "Tải lại xem trước".',
    OPERATION_ID_REQUIRED: 'Thiếu mã định danh thao tác phê duyệt. Vui lòng thử lại.',
    REQUEST_NOT_FOUND: 'Không tìm thấy đơn xác nhận công này.',
    REQUEST_STATE_CHANGED: 'Trạng thái đơn đã thay đổi hoặc đã được xử lý trước đó. Vui lòng tải lại danh sách.',
    REVIEW_REASON_REQUIRED: 'Vui lòng nhập ý kiến phản hồi / lý do từ chối (từ 10 đến 1000 ký tự).',
    SELF_APPROVAL_FORBIDDEN: 'Quản lý không được phép tự phê duyệt đơn của chính mình.',
    CONFIRMATION_QUOTA_INCONSISTENT: 'Dữ liệu lượt xác nhận công trong tháng không đồng nhất. Vui lòng liên hệ HR.',
  };

  const errObj = error as { code?: string; message?: string; details?: any };
  const rawMsg = typeof error === 'string' ? error : errObj?.message;
  const code = typeof error === 'string' ? (error.includes(':') ? error.split(':')[0].trim() : error) : errObj?.code;
  const details = errObj?.details;

  // 1. If details array exists (e.g. from ValidationPipe / class-validator)
  if (Array.isArray(details) && details.length > 0) {
    const detailList = details.map((d: any) => {
      const str = typeof d === 'string' ? d : JSON.stringify(d);
      if (str.includes(':')) {
        const text = str.split(':').slice(1).join(':').trim();
        if (text && !isCode(text)) return text;
      }
      return !isCode(str) ? str : (messages[str] ?? null);
    }).filter(Boolean);
    if (detailList.length > 0) return detailList.join('; ');
  }

  // 2. If message contains specific detail after ":" (e.g. "ATTENDANCE_CONFIRMATION_PAYLOAD_INVALID: Lý do quá ngắn")
  if (rawMsg && typeof rawMsg === 'string' && rawMsg.includes(':')) {
    const [, ...rest] = rawMsg.split(':');
    const detail = rest.join(':').trim();
    if (detail && !detail.startsWith('http') && !detail.startsWith('HTTP') && !detail.startsWith('//') && !isCode(detail)) {
      return detail;
    }
  }

  // 3. Known error code mappings
  if (code && messages[code]) return messages[code];

  // 4. Raw human-readable message if not an internal code
  if (rawMsg && typeof rawMsg === 'string' && !rawMsg.startsWith('HTTP ') && rawMsg !== 'Request failed.' && !isCode(rawMsg)) {
    return rawMsg;
  }

  return 'Không thể xử lý xác nhận công cho ngày này. Vui lòng thử lại hoặc liên hệ HR.';
}

/** `HH:mm` in Vietnam time for an ISO instant, or '' when absent. */
const vnClock = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
};

export function ConfirmationSummary({ preview: p, customCheckInTime, customCheckOutTime }: { preview: AttendanceConfirmationPreview; customCheckInTime?: string; customCheckOutTime?: string }) {
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
              {customCheckInTime
                ? customCheckInTime
                : p.existingPunches?.checkInAt
                ? confirmationTime(p.existingPunches.checkInAt)
                : hasIn
                ? (inSource && inSource !== 'LEGACY_UNKNOWN' ? inSource : 'Đã chấm')
                : confirmationTime(p.proposedChanges?.checkInAt)}
            </span>
            <span className="text-xs text-muted-foreground">
              {customCheckInTime ? 'Tự khai báo thực tế' : hasIn ? (inSource && inSource !== 'LEGACY_UNKNOWN' ? inSource : 'Giờ thực tế') : 'Đề xuất theo ca'}
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
              {customCheckOutTime
                ? customCheckOutTime
                : p.existingPunches?.checkOutAt
                ? confirmationTime(p.existingPunches.checkOutAt)
                : hasOut
                ? (outSource && outSource !== 'LEGACY_UNKNOWN' ? outSource : 'Đã chấm')
                : confirmationTime(p.proposedChanges?.checkOutAt)}
            </span>
            <span className="text-xs text-muted-foreground">
              {customCheckOutTime ? 'Tự khai báo thực tế' : hasOut ? (outSource && outSource !== 'LEGACY_UNKNOWN' ? outSource : 'Giờ thực tế') : 'Giờ tan ca'}
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
      {(p.blockedReasons ?? [])
        .filter(r => {
          const code = typeof r === 'string' ? r : r.code;
          return !['ATTENDANCE_CONFIRMATION_PAST_DATE_REQUIRED', 'NO_WORK_OBLIGATION', 'ALREADY_COMPLETE'].includes(code);
        })
        .map((r, index) => (
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
  // QC 1.2 — both endpoints are editable and default to the shift proposal,
  // never to a hard-coded 17:00.
  const [customCheckInTime, setCustomCheckInTime] = useState('');
  const [customCheckOutTime, setCustomCheckOutTime] = useState('');
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

  // Seed the editable times once per preview: defaults to proposal, existing punch, or standard shift.
  useEffect(() => {
    const p = result?.date === workDate ? result.preview : undefined;
    if (!p) return;
    const defaultIn = vnClock(p.proposedChanges?.checkInAt) || vnClock(p.existingPunches?.checkInAt) || '08:00';
    const defaultOut = vnClock(p.proposedChanges?.checkOutAt) || vnClock(p.existingPunches?.checkOutAt) || '17:00';
    setCustomCheckInTime(defaultIn);
    setCustomCheckOutTime(defaultOut);
  }, [result, workDate]);

  if (bypass) return <>{legacy}</>;
  const currentResult = result?.date === workDate ? result : null;
  if (currentResult?.legacy) return <>{legacy}</>;

  const preview = currentResult?.preview;
  const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const isFutureDate = Boolean(workDate && workDate > todayVN);

  const isTimeOrderValid = !customCheckInTime || !customCheckOutTime || customCheckInTime < customCheckOutTime;
  const canSubmit = Boolean(preview) && !busy && !stale && !isFutureDate && isTimeOrderValid
    && preview!.canSubmit
    && preview!.period?.canMutate !== false
    && (preview!.quota?.remaining ?? 1) > 0 && reason.trim().length >= 10 && reason.trim().length <= 1000;

  return (
    <form
      className="space-y-4 p-6"
      onSubmit={async event => {
        event.preventDefault();
        if (!canSubmit || !preview || submitting.current) return;
        submitting.current = true; setBusy(true); setError('');
        const formatIsoTime = (time: string) => {
          if (!time) return undefined;
          const clean = time.trim();
          if (!clean) return undefined;
          const parts = clean.split(':');
          const hh = (parts[0] || '00').padStart(2, '0');
          const mm = (parts[1] || '00').padStart(2, '0');
          const ss = (parts[2] || '00').padStart(2, '0');
          return `${workDate}T${hh}:${mm}:${ss}+07:00`;
        };
        const effectivePreviewHash = preview.previewHash || (preview as any).contextHash;
        const payload: any = {
          workDate,
          reason: reason.trim(),
          previewHash: effectivePreviewHash,
          ...(customCheckInTime ? { customCheckInTime: formatIsoTime(customCheckInTime) } : {}),
          ...(customCheckOutTime ? { customCheckOutTime: formatIsoTime(customCheckOutTime) } : {}),
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
          max={todayVN}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={workDate}
          disabled={busy}
          onChange={e => onDateChange(e.target.value)}
        />
      </label>
      {isFutureDate && (
        <p role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs font-medium text-destructive">
          Không thể gửi xác nhận công cho ngày tương lai. Vui lòng chỉ chọn từ hôm nay trở về trước.
        </p>
      )}

      {!currentResult ? (
        <div role="status" className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 text-sm text-muted-foreground">
          Đang tải xem trước…
        </div>
      ) : preview ? (
        <ConfirmationSummary preview={preview} customCheckInTime={customCheckInTime} customCheckOutTime={customCheckOutTime} />
      ) : (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {currentResult.error}
        </p>
      )}

      {/* QC 1.2 — the employee may adjust both endpoints; each defaults to proposal, punch or shift. */}
      {preview && (
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3.5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Giờ vào / ra thực tế</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mặc định theo ca. Nếu hôm nay bạn vào muộn, về muộn hoặc làm thêm giờ (OT), hãy sửa lại giờ thực tế để Quản lý duyệt đúng công.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-foreground">
              Giờ vào thực tế
              <input
                type="time"
                aria-label="Giờ vào thực tế"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                value={customCheckInTime}
                disabled={busy || preview?.canSubmit === false}
                onChange={e => setCustomCheckInTime(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-foreground">
              Giờ ra thực tế
              <input
                type="time"
                aria-label="Giờ ra thực tế"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                value={customCheckOutTime}
                disabled={busy || preview?.canSubmit === false}
                onChange={e => setCustomCheckOutTime(e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      <label className="grid gap-1.5 text-sm font-medium">
        Lý do xác nhận công
        <textarea
          className="min-h-24 w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
          placeholder="Ví dụ: Tôi đã có mặt làm việc cả ngày nhưng lúc về vội nên quên bấm máy chấm công (ít nhất 10 ký tự)..."
          value={reason}
          disabled={busy || preview?.canSubmit === false}
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
