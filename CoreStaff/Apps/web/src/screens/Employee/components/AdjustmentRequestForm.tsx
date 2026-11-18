import { useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/alert';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { createMyRequest } from '@/services/manager.service';
import { hrErrorMessage } from '@/services/hrService';
import { toast } from '@/components/toast';

/** Today in Vietnam, without shipping a timezone library. */
const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export type AdjustmentEndpoint = 'CHECK_IN' | 'CHECK_OUT';

export interface AdjustmentRow {
  /** `YYYY-MM-DD`. */
  workDate: string;
  adjustmentType: AdjustmentEndpoint;
  /** `HH:mm`, Vietnam time. */
  time: string;
  enabled?: boolean;
  /** Day is already complete — the server will reject, but keep the row visible. */
  warning?: string;
}

interface Props {
  apiBase: string;
  rows: AdjustmentRow[];
  /** Shared reason for the whole batch. */
  reason: string;
  onReasonChange: (value: string) => void;
  /** Multi-row mode: checkbox per row (QC 2.2 — báo sai lệch for several days). */
  selectable?: boolean;
  onRowsChange?: (rows: AdjustmentRow[]) => void;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * One form, two entry points: the single adjustment in "Tăng ca & Xác nhận
 * công" and the multi-day batch behind "Báo sai lệch" in the timesheet review.
 * Both call the same `POST /api/requests` adjustment route, one request per day.
 */
export function AdjustmentRequestForm({
  apiBase,
  rows,
  reason,
  onReasonChange,
  selectable = false,
  onRowsChange,
  onDone,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const selected = useMemo(
    () => rows.filter((row) => (selectable ? row.enabled !== false : true)),
    [rows, selectable],
  );

  const patchRow = (index: number, patch: Partial<AdjustmentRow>) => {
    if (!onRowsChange) return;
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const canSubmit = !busy && reason.trim().length >= 10 && selected.length > 0
    && selected.every((row) => row.workDate < vnToday() && /^\d{2}:\d{2}$/.test(row.time));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setRowErrors({});
    let succeeded = 0;
    const failures: Record<string, string> = {};
    // Sequential on purpose: a failure on one day must not hide which rows worked.
    for (const row of selected) {
      try {
        await createMyRequest(apiBase, {
          type: 'ATTENDANCE',
          workDate: row.workDate,
          reason: reason.trim(),
          adjustmentType: row.adjustmentType,
          requestedStart: `${row.workDate}T${row.time}:00+07:00`,
        });
        succeeded += 1;
      } catch (caught) {
        failures[row.workDate] = hrErrorMessage(caught);
      }
    }
    setBusy(false);
    setRowErrors(failures);

    if (Object.keys(failures).length === 0) {
      toast.success(
        'Gửi yêu cầu thành công',
        `Đã gửi ${succeeded} yêu cầu điều chỉnh công tới Quản lý phòng ban.`,
      );
      onDone();
      return;
    }
    if (succeeded > 0) {
      toast.warning(
        'Gửi một phần',
        `Đã gửi ${succeeded}/${selected.length} yêu cầu. ${Object.keys(failures).length} ngày còn lỗi — xem chi tiết bên dưới và gửi lại.`,
      );
      onDone();
      return;
    }
    setError('Không gửi được yêu cầu nào. Vui lòng kiểm tra các ngày bên dưới.');
  };

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {rows.map((row, index) => {
            const rowError = rowErrors[row.workDate];
            const checked = selectable ? row.enabled !== false : true;
            return (
              <div
                key={`${row.workDate}-${index}`}
                className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[auto_1fr_1fr_1fr] sm:items-end ${
                  checked ? 'border-border bg-card' : 'border-border/60 bg-muted/20'
                }`}
              >
                {selectable ? (
                  <label className="flex items-center gap-2 text-xs font-medium sm:pb-3">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ngày ${row.workDate}`}
                      checked={checked}
                      disabled={busy}
                      onChange={(e) => patchRow(index, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                  </label>
                ) : (
                  <span aria-hidden="true" />
                )}
                <label className="grid gap-1.5 text-xs font-medium">
                  Ngày
                  <Input
                    type="date"
                    value={row.workDate}
                    max={vnToday()}
                    disabled={busy || selectable}
                    onChange={(e) => patchRow(index, { workDate: e.target.value })}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium">
                  Mốc công cần bổ sung
                  <select
                    className="min-h-11 rounded-lg border bg-background px-3"
                    value={row.adjustmentType}
                    disabled={busy}
                    onChange={(e) => patchRow(index, { adjustmentType: e.target.value as AdjustmentEndpoint })}
                  >
                    <option value="CHECK_IN">Thiếu check-in</option>
                    <option value="CHECK_OUT">Thiếu check-out</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium">
                  Giờ đề nghị
                  <Input
                    type="time"
                    value={row.time}
                    required
                    disabled={busy}
                    onChange={(e) => patchRow(index, { time: e.target.value })}
                  />
                </label>
                {(row.warning || rowError) && (
                  <p role="alert" className={`text-xs sm:col-span-4 ${rowError ? 'text-destructive' : 'text-amber-700'}`}>
                    {rowError ?? row.warning}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Quản lý sẽ kiểm tra và mốc giờ này chỉ được ghi vào bảng công sau khi duyệt.
          {selectable && ' Chỉ những ngày được tích mới được gửi.'}
        </p>

        <label className="grid gap-1.5 text-sm font-medium">
          Lý do {selected.length > 1 ? '(áp dụng cho tất cả ngày đã chọn)' : ''}
          <textarea
            className="min-h-24 rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Nhập chi tiết lý do (ít nhất 10 ký tự)..."
            maxLength={1000}
            required
            disabled={busy}
          />
        </label>
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Hủy
        </Button>
        <Button disabled={!canSubmit} type="submit">
          {busy ? 'Đang gửi…' : selected.length > 1 ? `Gửi ${selected.length} yêu cầu` : 'Gửi yêu cầu'}
        </Button>
      </div>
    </form>
  );
}
