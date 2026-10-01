import { useEffect, useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Label } from '@/components/label';
import { createTimesheetPeriod, getTimesheetPeriods, hrErrorMessage, type CreateTimesheetPeriodDto, type TimesheetPeriod } from '@/services/hrService';
import { toast } from '@/components/toast';

const MIN_PERIOD_DAYS = 28;
const MAX_PERIOD_DAYS = 31;

/** Calculate inclusive number of days between two date strings (YYYY-MM-DD). */
function calculateDayRange(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/** Check if a date is in the past (before today at midnight). */
function isDateInPast(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/** Check if two date ranges overlap. */
function doRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);
  // Overlap: start1 <= end2 && end1 >= start2
  return s1 <= e2 && e1 >= s2;
}

interface CreatePeriodDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  apiBase: string;
  organizationId?: string;
}

export function CreatePeriodDialog({ open, onClose, onCreated, apiBase, organizationId }: CreatePeriodDialogProps) {
  const [period, setPeriod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Separate error states for each validation — never overlap
  const [periodFormatError, setPeriodFormatError] = useState<string | null>(null);
  const [dayRangeError, setDayRangeError] = useState<string | null>(null);
  const [pastError, setPastError] = useState<string | null>(null);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  
  const [existingPeriods, setExistingPeriods] = useState<TimesheetPeriod[]>([]);
  const [fetchingPeriods, setFetchingPeriods] = useState(false);

  // Fetch existing periods when dialog opens
  useEffect(() => {
    if (!open || !apiBase || !organizationId) return;

    let cancelled = false;
    setFetchingPeriods(true);
    void getTimesheetPeriods(apiBase)
      .then(data => {
        if (!cancelled) {
          setExistingPeriods(data.filter(p => p.organizationId === organizationId));
        }
      })
      .catch(() => { /* silently fail — will be caught by backend */ })
      .finally(() => { if (!cancelled) setFetchingPeriods(false); });

    return () => { cancelled = true; };
  }, [open, apiBase, organizationId]);

  // Validate period format (YYYY-MM)
  const validatePeriodFormat = (value: string): string | null => {
    if (!value) return null;
    if (!/^\d{4}-\d{2}$/.test(value)) {
      return 'Tháng/Năm phải theo định dạng YYYY-MM (ví dụ: 2026-10).';
    }
    return null;
  };

  // Validate day range (28-31 days)
  const validateDayRange = (start: string, end: string): string | null => {
    if (!start || !end) return null;
    const days = calculateDayRange(start, end);
    if (days < MIN_PERIOD_DAYS || days > MAX_PERIOD_DAYS) {
      return `Kỳ công phải có từ ${MIN_PERIOD_DAYS} đến ${MAX_PERIOD_DAYS} ngày (actual: ${days} ngày).`;
    }
    return null;
  };

  // Validate not in past (only for startDate)
  const validateNotInPast = (dateStr: string): string | null => {
    if (!dateStr) return null;
    if (isDateInPast(dateStr)) {
      return 'Ngày bắt đầu không được nằm trong quá khứ.';
    }
    return null;
  };

  // Validate no overlap with closed periods
  const validateNoOverlap = (start: string, end: string): string | null => {
    if (!start || !end) return null;
    for (const existing of existingPeriods) {
      if (existing.status === 'CLOSED') {
        const existingStart = new Date(existing.startDate).toISOString().substring(0, 10);
        const existingEnd = new Date(existing.endDate).toISOString().substring(0, 10);
        if (doRangesOverlap(start, end, existingStart, existingEnd)) {
          return `Kỳ công mới trùng/lấn khoảng thời gian với kỳ đã chốt ${existing.period}. Vui lòng chọn khoảng thời gian khác.`;
        }
      }
    }
    return null;
  };

  // Real-time validation when dates change
  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    if (field === 'startDate') setStartDate(value);
    if (field === 'endDate') setEndDate(value);

    // Clear server error when user changes inputs
    setServerError(null);

    // Validate startDate for past date immediately
    if (field === 'startDate') {
      setPastError(validateNotInPast(value));
    }

    // Validate day range and overlap when both dates are available
    if (value && (field === 'endDate' || startDate)) {
      const start = field === 'startDate' ? value : startDate;
      const end = field === 'endDate' ? value : endDate;
      
      if (start && end) {
        setDayRangeError(validateDayRange(start, end));
        setOverlapError(validateNoOverlap(start, end));
      }
    } else {
      setDayRangeError(null);
      setOverlapError(null);
    }
  };

  // Validate period format on change
  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    setPeriodFormatError(validatePeriodFormat(value));
    setServerError(null);
  };

  if (!open) return null;

  // Check if there's an active period (for UI warning)
  const hasActivePeriod = existingPeriods.some(p => 
    ['OPEN', 'REVIEWING', 'READY_TO_CLOSE'].includes(p.status)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear server error on new submission
    setServerError(null);

    // Check required fields
    if (!period || !startDate || !endDate) {
      setServerError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    // Run all validations using the dedicated functions
    const periodFormatErr = validatePeriodFormat(period);
    const dayRangeErr = validateDayRange(startDate, endDate);
    const pastErr = validateNotInPast(startDate);
    const overlapErr = validateNoOverlap(startDate, endDate);

    // Set each error to its own state — never overlap
    setPeriodFormatError(periodFormatErr);
    setDayRangeError(dayRangeErr);
    setPastError(pastErr);
    setOverlapError(overlapErr);

    // If any validation failed, stop
    if (periodFormatErr || dayRangeErr || pastErr || overlapErr) {
      return;
    }

    setLoading(true);
    try {
      const dto: CreateTimesheetPeriodDto = { period, startDate, endDate };
      await createTimesheetPeriod(apiBase, dto);
      toast.success('Tạo kỳ công thành công!');
      onCreated();
    } catch (err) {
      // Server-side errors (active period, overlap with backend check, etc.)
      setServerError(hrErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Calculate total disabled state
  const isSubmitDisabled = loading || 
    !!periodFormatError || 
    !!dayRangeError || 
    !!pastError || 
    !!overlapError ||
    !!serverError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Tạo kỳ công mới</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Server error — displayed at top */}
        {serverError && (
          <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Period field with its own error */}
          <div className="space-y-2">
            <Label htmlFor="period">Tháng/Năm *</Label>
            <Input
              id="period"
              placeholder="YYYY-MM (ví dụ: 2026-10)"
              value={period}
              onChange={e => handlePeriodChange(e.target.value)}
              className={`font-mono ${periodFormatError ? 'border-destructive' : ''}`}
            />
            <p className="text-xs text-muted-foreground">Định dạng: YYYY-MM, ví dụ 2026-10 cho tháng 10 năm 2026</p>
            {periodFormatError && (
              <p className="text-xs text-destructive">{periodFormatError}</p>
            )}
          </div>

          {/* Start date field with its own error */}
          <div className="space-y-2">
            <Label htmlFor="startDate">Ngày bắt đầu *</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={e => handleDateChange('startDate', e.target.value)}
              className={pastError ? 'border-destructive' : ''}
            />
            {pastError && (
              <p className="text-xs text-destructive">{pastError}</p>
            )}
          </div>

          {/* End date field */}
          <div className="space-y-2">
            <Label htmlFor="endDate">Ngày kết thúc *</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={e => handleDateChange('endDate', e.target.value)}
            />
          </div>

          {/* Day range feedback — shown when both dates are selected */}
          {startDate && endDate && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Số ngày: {calculateDayRange(startDate, endDate)} ngày
                <span
                  className={
                    !dayRangeError
                      ? ' text-green-600 dark:text-green-400'
                      : ' text-red-600 dark:text-red-400'
                  }
                >
                  {' '}({dayRangeError ? '❌ Không hợp lệ' : '✅ Hợp lệ'})
                </span>
              </p>
              {dayRangeError && (
                <p className="text-xs text-destructive">{dayRangeError}</p>
              )}
            </div>
          )}

          {/* Overlap error — shown when there's a conflict */}
          {overlapError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
              ⚠️ {overlapError}
            </div>
          )}

          {/* Active period warning — informational only */}
          {fetchingPeriods && existingPeriods.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300">
              Đang tải dữ liệu kỳ công...
            </div>
          )}
          {!fetchingPeriods && hasActivePeriod && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300">
              ⚠️ Tổ chức đang có kỳ công đang mở. Vui lòng chốt kỳ hiện tại trước khi tạo kỳ mới.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {loading ? 'Đang tạo...' : 'Tạo kỳ công'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
