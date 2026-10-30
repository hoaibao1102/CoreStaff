import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, RefreshCw, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/dialog';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { Textarea } from '@/components/textarea';
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
  return <div className="space-y-5" aria-label="Đang tải bảng công">
    <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton className="h-28 rounded-xl" key={item} />)}</div>
    <Skeleton className="h-80 rounded-xl" />
  </div>;
}

export function EmployeeTimesheetReviewScreen({ apiBase, embedded = false }: { apiBase: string; embedded?: boolean }) {
  const [review, setReview] = useState<EmployeeTimesheetReview | null>(null);
  const [periods, setPeriods] = useState<TimesheetReviewCard[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async (preferredPeriodId?: string) => {
    setLoading(true);
    setError('');
    try {
      const cards = await listMyTimesheetReviews(apiBase);
      setPeriods(cards);
      const target = cards.find((card) => card.periodId === preferredPeriodId) ?? cards[0];
      setSelectedPeriodId(target?.periodId ?? '');
      setReview(target ? await getMyTimesheetReview(apiBase, target.periodId) : null);
    } catch (caught) {
      setReview(null);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { void load(); }, [load]);

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
      setReview(await acknowledgeMyTimesheetReview(apiBase, review.periodId, review.periodVersion, review.projectionHash));
      setConfirming(false);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally { setBusy(false); }
  };

  const dispute = async () => {
    if (!review || reason.trim().length < 10) return;
    setBusy(true);
    setActionError('');
    try {
      setReview(await disputeMyTimesheetReview(apiBase, review.periodId, review.periodVersion, review.projectionHash, reason.trim()));
      setDisputing(false);
      setReason('');
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally { setBusy(false); }
  };

  return <section className={`w-full space-y-6 ${embedded ? '' : 'mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8'}`}>
    <span className="sr-only" aria-live="polite">{confirming ? 'Xác nhận thông tin chính xác' : disputing ? 'Lý do sai lệch' : ''}</span>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      {!embedded && <div><h1 className="text-2xl font-semibold tracking-tight">Rà soát bảng công</h1><p className="mt-1 text-sm text-muted-foreground">Kiểm tra dữ liệu chấm công trước khi kỳ công được chốt.</p></div>}
      {!loading && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
        {periods.length > 0 && <label className="space-y-1 text-sm font-medium">
          <span className="block text-xs text-muted-foreground">Lọc theo tháng</span>
          <select
            aria-label="Lọc kỳ công theo tháng"
            className="h-10 min-w-48 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={selectedPeriodId}
            onChange={(event) => void selectPeriod(event.target.value)}
          >
            {periods.map((period) => <option key={period.periodId} value={period.periodId}>{formatPeriod(period.periodKey)}</option>)}
          </select>
        </label>}
        <Button type="button" variant="outline" onClick={() => void load(selectedPeriodId)}><RefreshCw data-icon="inline-start" />Tải lại</Button>
      </div>}
    </header>

    {loading ? <LoadingState /> : error ? <Card className="min-h-72 justify-center border-destructive/20 bg-destructive/5"><CardContent className="mx-auto flex max-w-md flex-col items-center py-12 text-center"><span className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertCircle className="size-7" /></span><h2 className="text-lg font-semibold">Chưa tải được bảng công</h2><p className="mt-2 text-sm leading-6 text-muted-foreground" role="alert">{error}</p><Button className="mt-5" variant="outline" onClick={() => void load()}><RefreshCw data-icon="inline-start" />Thử lại</Button></CardContent></Card>
      : !review ? <Card className="min-h-[380px] justify-center border-dashed bg-muted/20"><CardContent className="mx-auto flex max-w-md flex-col items-center py-14 text-center"><span className="mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"><ClipboardCheck className="size-8" /></span><h2 className="text-lg font-semibold">Chưa có kỳ công cần rà soát</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Khi kỳ công được mở, dữ liệu sẽ xuất hiện tại đây để bạn kiểm tra và xác nhận.</p></CardContent></Card>
      : <>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="flex items-center gap-4"><span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><CalendarDays className="size-5" /></span><div><p className="text-xs text-muted-foreground">Kỳ công</p><p className="mt-1 font-semibold">{formatPeriod(review.periodKey)}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-4"><span className="flex size-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Clock3 className="size-5" /></span><div><p className="text-xs text-muted-foreground">Công dự kiến</p><p className="mt-1 font-semibold">{review.payableWorkUnits} / {review.standardWorkUnits} công</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-4"><span className="flex size-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><ClipboardCheck className="size-5" /></span><div><p className="text-xs text-muted-foreground">Trạng thái</p><Badge className="mt-1" variant={review.state === 'ACKNOWLEDGED' ? 'success' : review.state === 'DISPUTED' ? 'destructive' : 'secondary'}>{STATUS_LABEL[review.state]}</Badge></div></CardContent></Card>
        </div>

        {review.state === 'ACKNOWLEDGED' && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><CheckCircle2 /><AlertDescription>Bạn đã xác nhận thông tin bảng công chính xác.</AlertDescription></Alert>}
        {review.state === 'DISPUTED' && <Alert><TriangleAlert /><AlertDescription>Bạn đã báo sai lệch. Bộ phận phụ trách sẽ kiểm tra và cập nhật dữ liệu.</AlertDescription></Alert>}
        {review.state !== 'ACKNOWLEDGED' && review.hasUnresolvedDays && <Alert className="border-amber-200 bg-amber-50 text-amber-950"><TriangleAlert /><AlertDescription>Bảng công còn ngày chấm công chưa hoàn tất. Hãy kiểm tra và báo sai lệch; bạn chỉ có thể xác nhận sau khi dữ liệu được xử lý.</AlertDescription></Alert>}

        <Card><CardHeader className="border-b"><CardTitle>Chi tiết ngày công</CardTitle><p className="text-sm text-muted-foreground">Phiên bản {review.periodVersion} · {review.days.length} ngày có dữ liệu</p></CardHeader><CardContent className="px-0"><Table><TableHeader className="bg-muted/40"><TableRow><TableHead className="pl-4">Ngày</TableHead><TableHead>Nghĩa vụ</TableHead><TableHead>Đã làm</TableHead><TableHead>Nghỉ có lương</TableHead><TableHead>Tăng ca</TableHead><TableHead className="pr-4 text-right">Công dự kiến</TableHead></TableRow></TableHeader><TableBody>{review.days.map((day) => <TableRow key={day.workDate}><TableCell className="pl-4 font-medium">{formatDate(day.workDate)}</TableCell><TableCell>{formatMinutes(day.scheduledObligationMinutes)}</TableCell><TableCell>{formatMinutes(day.workedScheduledMinutes)}</TableCell><TableCell>{formatMinutes(day.payableLeaveMinutes)}</TableCell><TableCell>{formatMinutes(day.overtimeMinutes)}</TableCell><TableCell className="pr-4 text-right font-semibold">{day.workCredit}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

        {review.state !== 'ACKNOWLEDGED' && <div className="flex flex-col-reverse gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{review.hasUnresolvedDays ? 'Cần xử lý các ngày chấm công chưa hoàn tất trước khi xác nhận.' : 'Hãy báo sai lệch nếu số liệu chưa đúng trước khi xác nhận.'}</p><div className="flex flex-col gap-3 sm:flex-row"><Button type="button" variant="outline" disabled={busy} onClick={() => { setActionError(''); setDisputing(true); }}><TriangleAlert data-icon="inline-start" />Báo sai lệch</Button><Button type="button" disabled={busy || !review.canAcknowledge} onClick={() => { setActionError(''); setConfirming(true); }}><CheckCircle2 data-icon="inline-start" />Đã kiểm tra — thông tin chính xác</Button></div></div>}
      </>}

    <Dialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Xác nhận thông tin chính xác</DialogTitle><DialogDescription>Xác nhận được gắn với đúng phiên bản bảng công bạn vừa xem. Hãy chắc chắn bạn đã kiểm tra đầy đủ.</DialogDescription></DialogHeader>{actionError && <Alert className="mx-6 mb-4 border-destructive/30 bg-destructive/5 text-destructive" role="alert"><AlertCircle /><AlertDescription>{actionError}</AlertDescription></Alert>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Hủy</Button><Button type="button" disabled={busy} onClick={acknowledge}>{busy ? 'Đang xác nhận...' : 'Xác nhận'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={disputing} onOpenChange={(open) => !busy && setDisputing(open)}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="border-b p-6 pr-14">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <TriangleAlert className="size-5" />
            </span>
            <div className="space-y-1">
              <DialogTitle>Báo sai lệch bảng công</DialogTitle>
              <DialogDescription>Mô tả ngày và nội dung chưa chính xác để bộ phận phụ trách kiểm tra nhanh hơn.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-semibold" htmlFor="timesheet-dispute-reason">Lý do sai lệch</label>
            <span className="text-xs tabular-nums text-muted-foreground">{reason.length}/2000</span>
          </div>
          <Textarea
            id="timesheet-dispute-reason"
            className="min-h-32 resize-y px-3 py-2.5 leading-6"
            rows={5}
            maxLength={2000}
            autoFocus
            aria-invalid={reason.length > 0 && reason.trim().length < 10}
            aria-describedby="timesheet-dispute-help"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Ngày 15/10 tôi đã chấm công lúc 08:02 nhưng hệ thống chưa ghi nhận check-in."
          />
          <div id="timesheet-dispute-help" className="flex min-h-5 items-start justify-between gap-4 text-xs">
            <p className={reason.length > 0 && reason.trim().length < 10 ? 'text-destructive' : 'text-muted-foreground'}>
              {reason.length > 0 && reason.trim().length < 10 ? `Cần thêm ${10 - reason.trim().length} ký tự để gửi.` : 'Nêu rõ ngày, giờ và dữ liệu cần điều chỉnh (tối thiểu 10 ký tự).'}
            </p>
          </div>
          {actionError && <Alert className="border-destructive/30 bg-destructive/5 text-destructive" role="alert"><AlertCircle /><AlertDescription>{actionError}</AlertDescription></Alert>}
        </div>
        <DialogFooter className="border-t bg-muted/20 p-4 sm:px-6">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" className="sm:min-w-24" variant="outline" disabled={busy} onClick={() => setDisputing(false)}>Hủy</Button>
            <Button type="button" className="sm:min-w-36" variant="destructive" disabled={busy || reason.trim().length < 10} onClick={dispute}>
              <TriangleAlert data-icon="inline-start" />{busy ? 'Đang gửi...' : 'Gửi báo sai lệch'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
