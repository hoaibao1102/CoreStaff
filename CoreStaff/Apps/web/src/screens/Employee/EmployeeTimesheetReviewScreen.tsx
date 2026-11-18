import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, RefreshCw, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/dialog';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { DiscrepancyForm } from './components/DiscrepancyForm';
import {
  acknowledgeMyTimesheetReview,
  disputeMyTimesheetReview,
  getMyTimesheetReview,
  listMyTimesheetReviews,
  type EmployeeTimesheetReview,
  type TimesheetReviewCard,
} from '../../services/hrService';

const STATUS_LABEL = { PENDING: 'Chờ rà soát', ACKNOWLEDGED: 'Đã xác nhận', DISPUTED: 'Đã báo sai lệch' } as const;

function formatPeriod(value: string) {
  const [year, month] = value.split('-');
  return year && month ? `Tháng ${Number(month)}/${year}` : value;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatMinutes(value: number) {
  if (!value) return '—';
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return [hours ? `${hours} giờ` : '', minutes ? `${minutes} phút` : ''].filter(Boolean).join(' ');
}

function formatPunchTime(value?: string | null) {
  if (!value) return null;
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false })
    : null;
}

function errorMessage(error: any) {
  if (error?.code === 'WORK_CREDIT_POLICY_MISSING' || error?.code === 'WORK_CREDIT_POLICY_NOT_FOUND') {
    return 'Chưa có chính sách quy đổi ngày công áp dụng cho kỳ này.';
  }
  if (error?.code === 'TIMESHEET_REVIEW_CHANGED' || error?.code === 'PERIOD_VERSION_CONFLICT') {
    return 'Bảng công đã thay đổi. Vui lòng tải lại và kiểm tra lại.';
  }
  if (error?.code === 'TIMESHEET_ALREADY_ACKNOWLEDGED') {
    return 'Bảng công này đã được xác nhận và không thể báo sai lệch thêm.';
  }
  if (error?.code === 'TIMESHEET_HAS_UNRESOLVED_DAYS') {
    return 'Bảng công còn ngày chấm công chưa hoàn tất. Bạn có thể báo sai lệch nhưng chưa thể xác nhận chính xác.';
  }
  if (error?.status === 403) return 'Bạn không có quyền xem bảng công này.';
  if (error?.status === 404) return 'Chưa có dữ liệu bảng công phù hợp.';
  return 'Không thể tải bảng công. Vui lòng thử lại.';
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Đang tải bảng công">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Skeleton className="h-28 rounded-xl" key={item} />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

/** Reason stored on the period when corrections were filed — the dispute mark's own text. */
function disputeReason(sentWorkDates: string[]) {
  const dates = sentWorkDates.map(formatDate).join(', ');
  return `Báo sai lệch ${sentWorkDates.length} ngày: ${dates}.`.slice(0, 2000);
}

export function EmployeeTimesheetReviewScreen({ apiBase, embedded = false }: { apiBase: string; embedded?: boolean }) {
  const [review, setReview] = useState<EmployeeTimesheetReview | null>(null);
  const [periods, setPeriods] = useState<TimesheetReviewCard[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async (preferredPeriodId?: string) => {
    setLoading(true);
    setError('');
    try {
      const cards = await listMyTimesheetReviews(apiBase);
      setPeriods(cards);
      // Open on the period that actually needs the employee: one that has ended and
      // is not acknowledged yet. The month in progress is listed first but cannot be
      // acknowledged (its future days are incomplete), so it must not be the default.
      // Vietnam calendar date (UTC+7), not the browser's UTC date.
      const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
      const needsAction = cards.find((card) => card.state === 'PENDING' && card.endDate && card.endDate.slice(0, 10) < today);
      const target = cards.find((card) => card.periodId === preferredPeriodId) ?? needsAction ?? cards[0];
      setSelectedPeriodId(target?.periodId ?? '');
      setReview(target ? await getMyTimesheetReview(apiBase, target.periodId) : null);
    } catch (caught) {
      setReview(null);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectPeriod = async (periodId: string) => {
    setSelectedPeriodId(periodId);
    setLoading(true);
    setError('');
    setConfirming(false);
    setDisputing(false);
    try {
      setReview(await getMyTimesheetReview(apiBase, periodId));
    } catch (caught) {
      setReview(null);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const acknowledge = async () => {
    if (!review) return;
    setBusy(true);
    setActionError('');
    try {
      const updated = await acknowledgeMyTimesheetReview(apiBase, review.periodId, review.periodVersion, review.projectionHash);
      setReview(updated);
      setPeriods((list) =>
        list.map((p) => (p.periodId === updated.periodId ? { ...p, state: updated.state, periodVersion: updated.periodVersion } : p)),
      );
      setConfirming(false);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  /**
   * After the batch is filed, record the period-level dispute mark so the
   * department-confirm gate knows the timesheet was queried. Only corrections
   * count: an overtime request alone does not make the timesheet wrong.
   *
   * Because `createAttendanceConfirmation` / `createOvertimeRequest` bumps
   * `TimesheetPeriod.version` on the server, retry with a freshly fetched
   * review if `disputeMyTimesheetReview` reports `PERIOD_VERSION_CONFLICT` or
   * `TIMESHEET_REVIEW_CHANGED`.
   */
  const finishBatch = async (sentWorkDates: string[], allSent: boolean, sentOvertimeCount = 0) => {
    if (!review) {
      if (allSent) setDisputing(false);
      return;
    }
    const uniqueDates = [...new Set(sentWorkDates)];
    if (uniqueDates.length === 0) {
      if (sentOvertimeCount > 0) {
        try {
          const refreshed = await getMyTimesheetReview(apiBase, review.periodId);
          if (refreshed) setReview(refreshed);
        } catch {
          // Keep current review if refresh fails
        }
      }
      if (allSent) setDisputing(false);
      return;
    }
    try {
      let updated: EmployeeTimesheetReview;
      try {
        updated = await disputeMyTimesheetReview(
          apiBase,
          review.periodId,
          review.periodVersion,
          review.projectionHash,
          disputeReason(uniqueDates),
          uniqueDates,
        );
      } catch (firstErr: any) {
        if (firstErr?.code === 'PERIOD_VERSION_CONFLICT' || firstErr?.code === 'TIMESHEET_REVIEW_CHANGED') {
          const latest = await getMyTimesheetReview(apiBase, review.periodId);
          updated = await disputeMyTimesheetReview(
            apiBase,
            latest.periodId,
            latest.periodVersion,
            latest.projectionHash,
            disputeReason(uniqueDates),
            uniqueDates,
          );
        } else {
          throw firstErr;
        }
      }
      setReview(updated);
      setPeriods((list) =>
        list.map((p) => (p.periodId === updated.periodId ? { ...p, state: updated.state, periodVersion: updated.periodVersion } : p)),
      );
    } catch (caught) {
      // The requests already reached the manager; this mark is informational,
      // so keep the panel open only to surface the reason.
      setActionError(errorMessage(caught));
      return;
    }
    if (allSent) setDisputing(false);
  };

  const canDispute = Boolean(review) && review!.state !== 'ACKNOWLEDGED' && review!.periodStatus !== 'CLOSED';
  const panelOpen = disputing && canDispute;
  const todayVN = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

  return (
    <section className={`w-full space-y-6 ${embedded ? '' : 'mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8'}`}>
      <span className="sr-only" aria-live="polite">
        {confirming ? 'Xác nhận thông tin chính xác' : panelOpen ? 'Báo sai lệch bảng công' : ''}
      </span>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Rà soát bảng công</h1>
            <p className="mt-1 text-sm text-muted-foreground">Kiểm tra dữ liệu chấm công trước khi kỳ công được chốt.</p>
          </div>
        )}
        {!loading && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            {periods.length > 0 && (
              <label className="space-y-1 text-sm font-medium">
                <span className="block text-xs text-muted-foreground">Lọc theo tháng</span>
                <select
                  aria-label="Lọc kỳ công theo tháng"
                  className="h-10 min-w-48 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={selectedPeriodId}
                  onChange={(event) => void selectPeriod(event.target.value)}
                >
                  {periods.map((period) => (
                    <option key={period.periodId} value={period.periodId}>
                      {formatPeriod(period.periodKey)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button type="button" variant="outline" onClick={() => void load(selectedPeriodId)}>
              <RefreshCw data-icon="inline-start" />
              Tải lại
            </Button>
          </div>
        )}
      </header>

      {/* Three columns from lg up: the workspace sidebar is column 1, this grid is 2 + 3. */}
      <div className={panelOpen ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_480px] xl:grid-cols-[minmax(0,1fr)_520px] lg:items-start' : ''}>
        <div className="min-w-0 space-y-6">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <Card className="min-h-72 justify-center border-destructive/20 bg-destructive/5">
              <CardContent className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
                <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="size-7" />
                </span>
                <h2 className="text-lg font-semibold">Chưa tải được bảng công</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground" role="alert">
                  {error}
                </p>
                <Button className="mt-5" variant="outline" onClick={() => void load()}>
                  <RefreshCw data-icon="inline-start" />
                  Thử lại
                </Button>
              </CardContent>
            </Card>
          ) : !review ? (
            <Card className="min-h-[380px] justify-center border-dashed bg-muted/20">
              <CardContent className="mx-auto flex max-w-md flex-col items-center py-14 text-center">
                <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ClipboardCheck className="size-8" />
                </span>
                <h2 className="text-lg font-semibold">Chưa có kỳ công cần rà soát</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Khi kỳ công được mở, dữ liệu sẽ xuất hiện tại đây để bạn kiểm tra và xác nhận.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="flex items-center gap-4">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <CalendarDays className="size-5" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">Kỳ công</p>
                      <p className="mt-1 font-semibold">{formatPeriod(review.periodKey)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Clock3 className="size-5" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">Công dự kiến</p>
                      <p className="mt-1 font-semibold">
                        {review.payableWorkUnits} / {review.standardWorkUnits} công
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                      <ClipboardCheck className="size-5" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">Trạng thái</p>
                      <Badge
                        className="mt-1"
                        variant={review.state === 'ACKNOWLEDGED' ? 'success' : review.state === 'DISPUTED' ? 'destructive' : 'secondary'}
                      >
                        {STATUS_LABEL[review.state]}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {actionError && (
                <Alert className="border-destructive/30 bg-destructive/5 text-destructive" role="alert">
                  <AlertCircle />
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}
              {review.state === 'ACKNOWLEDGED' && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                  <CheckCircle2 />
                  <AlertDescription>Bạn đã xác nhận thông tin bảng công chính xác.</AlertDescription>
                </Alert>
              )}
              {review.state === 'DISPUTED' && (
                <Alert>
                  <TriangleAlert />
                  <AlertDescription>Bạn đã báo sai lệch. Bộ phận phụ trách sẽ kiểm tra và cập nhật dữ liệu.</AlertDescription>
                </Alert>
              )}
              {review.state !== 'ACKNOWLEDGED' && review.hasUnresolvedDays && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                  <TriangleAlert />
                  <AlertDescription>
                    Bảng công còn ngày chấm công chưa hoàn tất. Hãy kiểm tra và báo sai lệch; bạn chỉ có thể xác nhận sau khi dữ liệu được xử lý.
                  </AlertDescription>
                </Alert>
              )}

              {canDispute && (
                <div className="flex flex-col-reverse gap-3 rounded-xl border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {review.hasUnresolvedDays
                      ? 'Cần xử lý các ngày chấm công chưa hoàn tất trước khi xác nhận.'
                      : 'Hãy báo sai lệch nếu số liệu chưa đúng trước khi xác nhận.'}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant={panelOpen ? 'secondary' : 'outline'}
                      disabled={busy}
                      onClick={() => {
                        setActionError('');
                        setDisputing(true);
                      }}
                    >
                      <TriangleAlert data-icon="inline-start" />
                      Báo sai lệch
                    </Button>
                    <Button
                      type="button"
                      disabled={busy || !review.canAcknowledge}
                      onClick={() => {
                        setActionError('');
                        setConfirming(true);
                      }}
                    >
                      <CheckCircle2 data-icon="inline-start" />
                      Đã kiểm tra — thông tin chính xác
                    </Button>
                  </div>
                </div>
              )}

              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Chi tiết ngày công</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Phiên bản {review.periodVersion} · {review.days.length} ngày có dữ liệu
                  </p>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="pl-4">Ngày</TableHead>
                        <TableHead>Giờ vào / ra</TableHead>
                        <TableHead>Nghĩa vụ</TableHead>
                        <TableHead>Đã làm</TableHead>
                        <TableHead>Nghỉ có lương</TableHead>
                        <TableHead>Tăng ca</TableHead>
                        <TableHead className="pr-4 text-right">Công dự kiến</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {review.days.map((day) => {
                        const inTime = formatPunchTime(day.checkInAt);
                        const outTime = formatPunchTime(day.checkOutAt);
                        const hasAnyPunchField = day.checkInAt !== undefined || day.checkOutAt !== undefined;
                        const isIncomplete =
                          day.scheduledObligationMinutes > 0 &&
                          (day.payableLeaveMinutes ?? 0) < day.scheduledObligationMinutes &&
                          day.workDate.slice(0, 10) <= todayVN &&
                          (day.workCredit < 1 || (hasAnyPunchField && (!inTime || !outTime)));

                        return (
                          <TableRow key={day.workDate} className={isIncomplete ? 'bg-amber-50/40' : undefined}>
                            <TableCell className="pl-4 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{formatDate(day.workDate)}</span>
                                {isIncomplete && (
                                  <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                    Cần kiểm tra
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {inTime || outTime ? (
                                <span className="font-mono text-foreground">
                                  {inTime ?? '—'} → {outTime ?? '—'}
                                </span>
                              ) : day.scheduledObligationMinutes > 0 ? (
                                '—'
                              ) : (
                                'Nghỉ'
                              )}
                            </TableCell>
                            <TableCell>{formatMinutes(day.scheduledObligationMinutes)}</TableCell>
                            <TableCell>{formatMinutes(day.workedScheduledMinutes)}</TableCell>
                            <TableCell>{formatMinutes(day.payableLeaveMinutes)}</TableCell>
                            <TableCell>{formatMinutes(day.overtimeMinutes)}</TableCell>
                            <TableCell className="pr-4 text-right font-semibold">{day.workCredit}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {review.periodStatus === 'CLOSED' && (
                <Alert>
                  <CheckCircle2 />
                  <AlertDescription>HR đã chốt kỳ công này. Bảng công chỉ còn để xem.</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        {panelOpen && review && (
          // One instance: full-screen overlay below lg, sticky third column at lg and up.
          <aside className="flex flex-col overflow-hidden max-lg:fixed max-lg:inset-0 max-lg:z-50 max-lg:h-dvh max-lg:bg-background max-lg:p-3 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:rounded-2xl lg:border lg:bg-card lg:shadow-md">
            <DiscrepancyForm
              apiBase={apiBase}
              days={review.days}
              onClose={() => setDisputing(false)}
              onSent={(dates, allSent, sentOt) => void finishBatch(dates, allSent, sentOt)}
            />
          </aside>
        )}
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận thông tin chính xác</DialogTitle>
            <DialogDescription>
              Xác nhận được gắn với đúng phiên bản bảng công bạn vừa xem. Hãy chắc chắn bạn đã kiểm tra đầy đủ.
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <Alert className="mx-6 mb-4 border-destructive/30 bg-destructive/5 text-destructive" role="alert">
              <AlertCircle />
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Hủy
            </Button>
            <Button type="button" disabled={busy} onClick={acknowledge}>
              {busy ? 'Đang xác nhận...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
