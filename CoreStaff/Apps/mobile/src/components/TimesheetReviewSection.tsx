import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  acknowledgeMyTimesheetReview,
  createAttendanceConfirmation,
  createOvertimeRequest,
  disputeMyTimesheetReview,
  friendlyEmployeeError,
  getAttendanceConfirmationPreview,
  getMyTimesheetReview,
  listMyTimesheetReviews,
  newRequestKey,
  previewOvertimeRequest,
  type AttendanceConfirmationPreview,
  type OvertimePreview,
  type TimesheetReview,
  type TimesheetReviewCard,
  type TimesheetReviewDay,
  type TimesheetReviewState,
} from '../employee-api';
import {
  AppButton,
  DateTimeField,
  ErrorBanner,
  Field,
  LoadingBlock,
  NoticeBanner,
  SegmentedControl,
  SuccessBanner,
  formatDate,
  formatTime,
  todayKey,
} from './ui';
import { AppIcon } from './AppIcon';
import { colors, radius, spacing } from '../theme';

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const STATE_LABEL: Record<TimesheetReviewState, string> = {
  PENDING: 'Chờ rà soát',
  ACKNOWLEDGED: 'Đã xác nhận',
  DISPUTED: 'Đã báo sai lệch',
};
const STATE_COLOR: Record<TimesheetReviewState, { bg: string; fg: string }> = {
  PENDING: { bg: '#fef3c7', fg: '#92400e' },
  ACKNOWLEDGED: { bg: '#dcfce7', fg: '#166534' },
  DISPUTED: { bg: '#fee2e2', fg: '#991b1b' },
};
const PREVIEW_DAYS = 10;
const CLOSED_COLOR = { bg: '#dbeafe', fg: '#1e40af' };
const SILENT_BLOCKS = ['ATTENDANCE_CONFIRMATION_PAST_DATE_REQUIRED', 'NO_WORK_OBLIGATION', 'ALREADY_COMPLETE'];
const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const isClosed = (p?: { periodStatus?: string } | null) => p?.periodStatus === 'CLOSED';
/** 7h52 · 8h · 45p — gọn để vừa một dòng trên màn hình hẹp. */
function hm(min: number) {
  const t = Math.max(0, Math.round(min || 0));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return h ? (m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m}p`;
}
const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
function dayLabel(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return { wd: WEEKDAY[new Date(y, m - 1, d).getDay()], dm: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` };
}
const hasInfo = (d: TimesheetReviewDay) =>
  d.scheduledObligationMinutes > 0 ||
  d.workedScheduledMinutes > 0 ||
  d.payableLeaveMinutes > 0 ||
  d.unpaidLeaveMinutes > 0 ||
  d.overtimeMinutes > 0 ||
  d.workCredit > 0;

const shiftDay = (day: string, days: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const clockOf = (value?: string | null) => {
  if (!value) return '';
  if (CLOCK.test(value)) return value;
  const t = formatTime(value);
  return t === '--:--' ? '' : t;
};
const stepClock = (value?: string | null) => (value && CLOCK.test(value) ? value : value ? formatTime(value) : 'Chưa có');
const blockMessage = (reason: string | { code: string }) =>
  friendlyEmployeeError(new Error(typeof reason === 'string' ? reason : reason.code));

interface AttendanceDraft {
  id: string;
  workDate: string;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
  touched?: boolean;
  timeEdited?: boolean;
  error?: string;
}

interface OvertimeDraft {
  id: string;
  workDate: string;
  start: string;
  end: string;
  reason: string;
  workDescription: string;
  retroactiveReason: string;
  error?: string;
}

let seq = 0;
const nextId = () => `md${++seq}`;

function pickDefaultDate(days: TimesheetReviewDay[], exclude: string[] = []): string {
  const today = todayKey();
  const candidates = days
    .map((d) => d.workDate.slice(0, 10))
    .filter((d) => d <= today && !exclude.includes(d));
  if (candidates.length > 0) return candidates[candidates.length - 1];
  const anyPast = days.map((d) => d.workDate.slice(0, 10)).filter((d) => d <= today);
  if (anyPast.length > 0) return anyPast[anyPast.length - 1];
  return shiftDay(today, -1);
}

function disputeReasonText(sentWorkDates: string[]) {
  const dates = sentWorkDates.map((d) => formatDate(d)).join(', ');
  return `Báo sai lệch ${sentWorkDates.length} ngày: ${dates}.`.slice(0, 2000);
}

/**
 * Bảng công kỳ của tháng đang xem ở lịch chấm công (kỳ công = 1 tháng, khớp `month`).
 * Cùng API/luật với web: kỳ đang rà soát cho xác nhận/báo sai lệch; kỳ HR đã chốt chỉ để xem.
 */
export function TimesheetReviewSection({
  apiBase,
  month,
  refreshKey = 0,
  hideTitle = false,
}: {
  apiBase: string;
  month: string;
  refreshKey?: number;
  hideTitle?: boolean;
}) {
  const [cards, setCards] = useState<TimesheetReviewCard[] | null>(null);
  const [review, setReview] = useState<TimesheetReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [y, m] = month.split('-');
  const monthLabel = `${Number(m)}/${y}`;

  const loadCards = useCallback(async () => {
    try {
      setCards(await listMyTimesheetReviews(apiBase));
      setError(null);
    } catch (err) {
      setCards([]);
      setError(friendlyEmployeeError(err));
    }
  }, [apiBase]);
  useEffect(() => {
    void loadCards();
  }, [loadCards, refreshKey]);

  const periodId = useMemo(() => cards?.find((c) => c.periodKey === month)?.periodId ?? null, [cards, month]);
  const ready = cards !== null;

  useEffect(() => {
    if (!ready) return;
    setShowAll(false);
    setActionError(null);
    setActionSuccess(null);
    if (!periodId) {
      setReview(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setReview(null);
    getMyTimesheetReview(apiBase, periodId)
      .then((value) => {
        if (!cancelled) {
          setReview(value);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyEmployeeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, periodId, ready, refreshKey]);

  const totals = useMemo(() => {
    const days = review?.days ?? [];
    return {
      worked: days.reduce((s, d) => s + d.workedScheduledMinutes, 0),
      leave: days.reduce((s, d) => s + d.payableLeaveMinutes, 0),
      ot: days.reduce((s, d) => s + d.overtimeMinutes, 0),
      late: days.filter((d) => (d.lateMinutes ?? 0) > 0).length,
      early: days.filter((d) => (d.earlyMinutes ?? 0) > 0).length,
      visible: days.filter(hasInfo),
    };
  }, [review]);

  const acknowledge = async () => {
    if (!review) return;
    setBusy(true);
    setActionError(null);
    try {
      const next = await acknowledgeMyTimesheetReview(apiBase, review);
      setReview(next);
      setCards((list) => list && list.map((p) => (p.periodId === next.periodId ? { ...p, state: next.state } : p)));
      setConfirming(false);
    } catch (err) {
      setActionError(friendlyEmployeeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDiscrepancySent = async (sentWorkDates: string[], allSent: boolean, sentOtCount: number) => {
    if (!review) return;
    const uniqueDates = [...new Set(sentWorkDates)];
    const totalSent = uniqueDates.length + sentOtCount;
    if (totalSent > 0) {
      setActionSuccess(`Đã gửi ${totalSent} yêu cầu tới Quản lý phòng ban.`);
    }
    if (uniqueDates.length === 0) {
      if (sentOtCount > 0) {
        try {
          const fresh = await getMyTimesheetReview(apiBase, review.periodId);
          setReview(fresh);
        } catch {
          // Keep current review
        }
      }
      if (allSent) setDisputing(false);
      return;
    }
    try {
      let next: TimesheetReview;
      try {
        next = await disputeMyTimesheetReview(apiBase, review, disputeReasonText(uniqueDates), uniqueDates);
      } catch (firstErr: any) {
        if (firstErr?.code === 'PERIOD_VERSION_CONFLICT' || firstErr?.code === 'TIMESHEET_REVIEW_CHANGED') {
          const latest = await getMyTimesheetReview(apiBase, review.periodId);
          next = await disputeMyTimesheetReview(apiBase, latest, disputeReasonText(uniqueDates), uniqueDates);
        } else {
          throw firstErr;
        }
      }
      setReview(next);
      setCards((list) => list && list.map((p) => (p.periodId === next.periodId ? { ...p, state: next.state } : p)));
      if (allSent) setDisputing(false);
    } catch (err) {
      setActionError(friendlyEmployeeError(err));
      if (allSent) setDisputing(false);
    }
  };

  const closed = isClosed(review);
  const badge = review
    ? closed
      ? { label: 'HR đã chốt', ...CLOSED_COLOR }
      : { label: STATE_LABEL[review.state], ...STATE_COLOR[review.state] }
    : null;
  const ratio = review && review.standardWorkUnits > 0 ? Math.min(1, review.payableWorkUnits / review.standardWorkUnits) : 0;
  const rows = showAll ? totals.visible : totals.visible.slice(0, PREVIEW_DAYS);

  return (
    <View style={styles.wrap}>
      {hideTitle ? null : (
        <Text accessibilityRole="header" style={styles.title}>
          Bảng công kỳ {monthLabel}
        </Text>
      )}

      {loading || cards === null ? (
        <LoadingBlock label="Đang tải bảng công kỳ…" />
      ) : error && !review ? (
        <>
          <ErrorBanner message={error} />
          <AppButton label="Thử lại" variant="secondary" onPress={() => void loadCards()} />
        </>
      ) : !review ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <AppIcon name="clipboard-outline" size={24} color={colors.primaryDark} />
          </View>
          <Text style={styles.emptyTitle}>Chưa có bảng công tháng {monthLabel}</Text>
          <Text style={styles.emptyText}>
            Bảng công hiện ra khi HR mở kỳ để rà soát, và vẫn xem lại được sau khi HR chốt.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>CÔNG THỰC TẾ</Text>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroValue}>
              {num(review.payableWorkUnits)}
              <Text style={styles.heroStd}> / {num(review.standardWorkUnits)} công chuẩn</Text>
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
            </View>
            <View style={styles.grid}>
              <Stat label="Giờ làm" value={hm(totals.worked)} />
              <Stat label="Nghỉ có lương" value={totals.leave ? hm(totals.leave) : '—'} />
              <Stat label="Tăng ca" value={totals.ot ? hm(totals.ot) : '—'} />
              <Stat label="Đi muộn / về sớm" value={`${totals.late} / ${totals.early} ngày`} />
            </View>
          </View>

          {actionSuccess ? <SuccessBanner message={actionSuccess} /> : null}
          {actionError && !confirming && !disputing ? <ErrorBanner message={actionError} /> : null}
          {closed ? (
            <NoticeBanner
              message={
                review.state === 'ACKNOWLEDGED'
                  ? 'HR đã chốt kỳ công này. Bạn đã xác nhận bảng công; vẫn có thể xem lại bất cứ lúc nào.'
                  : review.state === 'DISPUTED'
                  ? 'HR đã chốt kỳ công này. Báo sai lệch của bạn đã được ghi nhận; bảng công chỉ còn để xem.'
                  : 'HR đã chốt kỳ công này. Bảng công chỉ còn để xem, không thể xác nhận hay báo sai lệch.'
              }
            />
          ) : null}
          {!closed && review.state === 'ACKNOWLEDGED' ? (
            <SuccessBanner message="Bạn đã xác nhận thông tin bảng công chính xác." />
          ) : null}
          {!closed && review.state === 'DISPUTED' ? (
            <NoticeBanner message="Bạn đã báo sai lệch. Bộ phận phụ trách sẽ kiểm tra và cập nhật dữ liệu." />
          ) : null}
          {!closed && review.state !== 'ACKNOWLEDGED' && review.hasUnresolvedDays ? (
            <NoticeBanner message="Còn ngày chấm công chưa hoàn tất. Hãy báo sai lệch; bạn chỉ xác nhận được sau khi dữ liệu được xử lý." />
          ) : null}

          <View style={styles.list}>
            <View style={styles.listHead}>
              <Text style={styles.listTitle}>Chi tiết ngày công</Text>
              <Text style={styles.listCount}>{totals.visible.length} ngày</Text>
            </View>
            <View style={styles.colHead}>
              <Text style={[styles.colText, styles.colDate]}>NGÀY</Text>
              <Text style={[styles.colText, styles.colBody]}>ĐÃ LÀM / NGHĨA VỤ</Text>
              <Text style={[styles.colText, styles.colCreditHead]}>CÔNG</Text>
            </View>
            {totals.visible.length === 0 ? (
              <Text style={styles.noDays}>Chưa có ngày công nào trong kỳ này.</Text>
            ) : (
              rows.map((d) => {
                const { wd, dm } = dayLabel(d.workDate);
                const tone = d.workCredit >= 1 ? styles.creditFull : d.workCredit > 0 ? styles.creditHalf : styles.creditZero;
                const notes: Array<{ text: string; color: string }> = [];
                const inClock = clockOf(d.checkInAt);
                const outClock = clockOf(d.checkOutAt);
                if (inClock || outClock) {
                  notes.push({ text: `${inClock || '—'} → ${outClock || '—'}`, color: colors.inkSoft });
                } else if (
                  d.scheduledObligationMinutes > 0 &&
                  d.payableLeaveMinutes < d.scheduledObligationMinutes &&
                  d.workDate.slice(0, 10) <= todayKey() &&
                  d.workCredit < 1
                ) {
                  notes.push({ text: 'Thiếu chấm công', color: colors.warningText });
                }
                if (d.payableLeaveMinutes > 0) notes.push({ text: `Phép ${hm(d.payableLeaveMinutes)}`, color: colors.info });
                if (d.unpaidLeaveMinutes > 0) notes.push({ text: `Không lương ${hm(d.unpaidLeaveMinutes)}`, color: colors.muted });
                if (d.overtimeMinutes > 0) notes.push({ text: `OT ${hm(d.overtimeMinutes)}`, color: colors.primaryDark });
                if ((d.lateMinutes ?? 0) > 0) notes.push({ text: `Muộn ${hm(d.lateMinutes ?? 0)}`, color: colors.warningText });
                if ((d.earlyMinutes ?? 0) > 0) notes.push({ text: `Sớm ${hm(d.earlyMinutes ?? 0)}`, color: colors.warningText });
                return (
                  <View key={d.workDate} style={styles.row}>
                    <View style={styles.colDate}>
                      <Text style={[styles.rowWd, wd === 'CN' && styles.sunday]}>{wd}</Text>
                      <Text style={styles.rowDm}>{dm}</Text>
                    </View>
                    <View style={styles.colBody}>
                      <Text style={styles.rowMain}>
                        {d.workedScheduledMinutes ? hm(d.workedScheduledMinutes) : '—'}
                        <Text style={styles.rowSub}> / {hm(d.scheduledObligationMinutes)}</Text>
                      </Text>
                      {notes.length ? (
                        <Text style={styles.notes}>
                          {notes.map((n, i) => (
                            <Text key={n.text} style={{ color: n.color }}>
                              {i ? '  ·  ' : ''}
                              {n.text}
                            </Text>
                          ))}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.colCredit}>
                      <Text style={[styles.credit, tone]}>{num(d.workCredit)}</Text>
                    </View>
                  </View>
                );
              })
            )}
            {totals.visible.length > PREVIEW_DAYS ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAll((v) => !v)}
                style={({ pressed }) => [styles.more, pressed && styles.pressed]}
              >
                <Text style={styles.moreText}>{showAll ? 'Thu gọn' : `Xem tất cả ${totals.visible.length} ngày`}</Text>
                <AppIcon name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>

          {review.state !== 'ACKNOWLEDGED' && !closed ? (
            <View style={styles.actions}>
              <Text style={styles.actionHint}>
                {review.hasUnresolvedDays
                  ? 'Cần xử lý các ngày chấm công chưa hoàn tất trước khi xác nhận.'
                  : 'Hãy báo sai lệch nếu số liệu chưa đúng trước khi xác nhận.'}
              </Text>
              <AppButton
                label="Xác nhận thông tin chính xác"
                disabled={busy || !review.canAcknowledge}
                onPress={() => {
                  setActionError(null);
                  setConfirming(true);
                }}
              />
              <AppButton
                label="Báo sai lệch"
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setActionError(null);
                  setActionSuccess(null);
                  setDisputing(true);
                }}
              />
            </View>
          ) : null}
        </>
      )}

      <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => !busy && setConfirming(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Xác nhận thông tin chính xác</Text>
            <Text style={styles.dialogText}>
              Xác nhận được gắn với đúng phiên bản bảng công bạn vừa xem. Hãy chắc chắn bạn đã kiểm tra đầy đủ.
            </Text>
            {actionError ? <ErrorBanner message={actionError} /> : null}
            <View style={styles.dialogActions}>
              <View style={styles.flex}>
                <AppButton label="Hủy" variant="secondary" disabled={busy} onPress={() => setConfirming(false)} />
              </View>
              <View style={styles.flex}>
                <AppButton label="Xác nhận" loading={busy} onPress={() => void acknowledge()} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {review ? (
        <DiscrepancyModal
          visible={disputing}
          apiBase={apiBase}
          days={review.days}
          onClose={() => setDisputing(false)}
          onSent={(sentDates, allSent, sentOt) => void handleDiscrepancySent(sentDates, allSent, sentOt)}
        />
      ) : null}
    </View>
  );
}

function DiscrepancyModal({
  visible,
  apiBase,
  days,
  onClose,
  onSent,
}: {
  visible: boolean;
  apiBase: string;
  days: TimesheetReviewDay[];
  onClose: () => void;
  onSent: (sentWorkDates: string[], allSent: boolean, sentOtCount: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const today = todayKey();

  const missingDays = useMemo(
    () =>
      days.filter(
        (d) =>
          d.scheduledObligationMinutes > 0 &&
          (!d.checkInAt || !d.checkOutAt) &&
          d.payableLeaveMinutes < d.scheduledObligationMinutes &&
          d.workDate.slice(0, 10) <= today,
      ),
    [days, today],
  );

  const [tab, setTab] = useState<'attendance' | 'overtime'>('attendance');
  const [attendance, setAttendance] = useState<AttendanceDraft[]>([]);
  const [overtime, setOvertime] = useState<OvertimeDraft[]>([]);
  const [attPreviews, setAttPreviews] = useState<
    Record<string, { date: string; loading: boolean; preview?: AttendanceConfirmationPreview; error?: string }>
  >({});
  const [otPreviews, setOtPreviews] = useState<
    Record<string, { key: string; loading: boolean; preview?: OvertimePreview; error?: string }>
  >({});
  const [busy, setBusy] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const attemptKeys = useRef<Record<string, { payload: string; key: string }>>({});

  useEffect(() => {
    if (!visible) return;
    setTab('attendance');
    setBannerError(null);
    setAttPreviews({});
    setOtPreviews({});
    setOvertime([]);
    setAttendance(
      missingDays.length
        ? missingDays.map((d) => ({
            id: nextId(),
            workDate: d.workDate.slice(0, 10),
            checkInTime: clockOf(d.checkInAt) || '08:00',
            checkOutTime: clockOf(d.checkOutAt) || '17:00',
            reason: '',
            touched: true,
          }))
        : [
            {
              id: nextId(),
              workDate: pickDefaultDate(days),
              checkInTime: '08:00',
              checkOutTime: '17:00',
              reason: '',
              touched: false,
            },
          ],
    );
  }, [visible, days, missingDays]);

  // Load AttendanceConfirmationPreview per attendance draft
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    attendance.forEach((draft) => {
      if (!draft.workDate || draft.workDate > today) return;
      const cur = attPreviews[draft.id];
      if (cur && cur.date === draft.workDate && (cur.loading || cur.preview || cur.error)) return;
      setAttPreviews((prev) => ({ ...prev, [draft.id]: { date: draft.workDate, loading: true } }));
      getAttendanceConfirmationPreview(apiBase, draft.workDate)
        .then((p) => {
          if (cancelled) return;
          setAttPreviews((prev) => ({ ...prev, [draft.id]: { date: draft.workDate, loading: false, preview: p } }));
          if (p.enabled === true) {
            const defIn = clockOf(p.proposedChanges?.checkInAt) || clockOf(p.existingPunches?.checkInAt) || '08:00';
            const defOut = clockOf(p.proposedChanges?.checkOutAt) || clockOf(p.existingPunches?.checkOutAt) || '17:00';
            setAttendance((rows) =>
              rows.map((r) =>
                r.id === draft.id && r.workDate === draft.workDate && !r.timeEdited
                  ? { ...r, checkInTime: defIn, checkOutTime: defOut }
                  : r,
              ),
            );
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setAttPreviews((prev) => ({
              ...prev,
              [draft.id]: { date: draft.workDate, loading: false, error: friendlyEmployeeError(err) },
            }));
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase, attendance, visible, today, refreshTick]);

  // Load OvertimePreview per overtime draft
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    overtime.forEach((draft) => {
      if (!draft.workDate || !CLOCK.test(draft.start) || !CLOCK.test(draft.end) || draft.start >= draft.end) return;
      const key = `${draft.workDate}|${draft.start}|${draft.end}`;
      const cur = otPreviews[draft.id];
      if (cur && cur.key === key && (cur.loading || cur.preview || cur.error)) return;
      const timer = setTimeout(() => {
        setOtPreviews((prev) => ({ ...prev, [draft.id]: { key, loading: true } }));
        previewOvertimeRequest(apiBase, {
          workDate: draft.workDate,
          requestedStart: `${draft.workDate}T${draft.start}:00+07:00`,
          requestedEnd: `${draft.workDate}T${draft.end}:00+07:00`,
        })
          .then((p) => {
            if (!cancelled) setOtPreviews((prev) => ({ ...prev, [draft.id]: { key, loading: false, preview: p } }));
          })
          .catch((err) => {
            if (!cancelled) {
              setOtPreviews((prev) => ({
                ...prev,
                [draft.id]: { key, loading: false, error: friendlyEmployeeError(err) },
              }));
            }
          });
      }, 250);
      timers.push(timer);
    });
    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [apiBase, overtime, visible, refreshTick]);

  const effectiveAttendance =
    overtime.length > 0 && attendance.length === 1 && !attendance[0].touched && !attendance[0].reason.trim()
      ? []
      : attendance;
  const total = effectiveAttendance.length + overtime.length;

  const canSubmit =
    !busy &&
    total > 0 &&
    effectiveAttendance.every((d) => {
      if (!d.workDate || d.workDate > today || !CLOCK.test(d.checkInTime) || !CLOCK.test(d.checkOutTime)) return false;
      if (d.checkInTime >= d.checkOutTime) return false;
      const len = d.reason.trim().length;
      if (len < 10 || len > 1000) return false;
      const st = attPreviews[d.id];
      if (st?.date === d.workDate && st.preview?.enabled === true && st.preview.canSubmit === false) return false;
      return true;
    }) &&
    overtime.every((d) => {
      if (!d.workDate || d.workDate > today || !CLOCK.test(d.start) || !CLOCK.test(d.end) || d.start >= d.end) return false;
      const len = d.reason.trim().length;
      if (len < 10 || len > 1000) return false;
      if (d.workDescription.trim() && d.workDescription.trim().length < 3) return false;
      if (d.retroactiveReason.trim() && d.retroactiveReason.trim().length < 10) return false;
      return true;
    });

  const patchAttendance = (id: string, patch: Partial<AttendanceDraft>) =>
    setAttendance((rows) =>
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              touched: true,
              timeEdited: patch.checkInTime !== undefined || patch.checkOutTime !== undefined ? true : r.timeEdited,
              error: undefined,
            }
          : r,
      ),
    );

  const patchOvertime = (id: string, patch: Partial<OvertimeDraft>) =>
    setOvertime((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch, error: undefined } : r)));

  const addAttendance = (date?: string) => {
    const used = attendance.map((d) => d.workDate);
    const nextDate = date ?? pickDefaultDate(days, used);
    const matched = days.find((d) => d.workDate.slice(0, 10) === nextDate);
    setAttendance((rows) => [
      ...rows,
      {
        id: nextId(),
        workDate: nextDate,
        checkInTime: clockOf(matched?.checkInAt) || '08:00',
        checkOutTime: clockOf(matched?.checkOutAt) || '17:00',
        reason: '',
        touched: true,
      },
    ]);
    setTab('attendance');
  };

  const addOvertime = () => {
    const used = overtime.map((d) => d.workDate);
    const nextDate = pickDefaultDate(days, used);
    setOvertime((rows) => [
      ...rows,
      {
        id: nextId(),
        workDate: nextDate,
        start: '18:00',
        end: '20:00',
        reason: '',
        workDescription: '',
        retroactiveReason: '',
      },
    ]);
    if (attendance.length === 1 && !attendance[0].touched && !attendance[0].reason.trim()) {
      setAttendance([]);
    }
    setTab('overtime');
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setBannerError(null);
    const sentAttendance: string[] = [];
    const attErrors: Record<string, string> = {};
    const otErrors: Record<string, string> = {};
    let sentOvertime = 0;

    for (const draft of effectiveAttendance) {
      try {
        let preview = attPreviews[draft.id]?.date === draft.workDate ? attPreviews[draft.id]?.preview : undefined;
        if (!preview) {
          preview = await getAttendanceConfirmationPreview(apiBase, draft.workDate);
        }
        if (preview.enabled === true && preview.canSubmit === false) {
          const code = preview.blockedReasons?.[0];
          attErrors[draft.id] = blockMessage(code ?? 'ATTENDANCE_CONFIRMATION_DISABLED');
          continue;
        }
        const hash = preview.previewHash || 'preview-hash';
        const iso = (time: string) => `${draft.workDate}T${time}:00+07:00`;
        const payload = {
          workDate: draft.workDate,
          reason: draft.reason.trim(),
          previewHash: hash,
          ...(draft.checkInTime ? { customCheckInTime: iso(draft.checkInTime) } : {}),
          ...(draft.checkOutTime ? { customCheckOutTime: iso(draft.checkOutTime) } : {}),
        };
        const serialized = JSON.stringify(payload);
        if (attemptKeys.current[draft.id]?.payload !== serialized) {
          attemptKeys.current[draft.id] = { payload: serialized, key: newRequestKey() };
        }
        try {
          await createAttendanceConfirmation(apiBase, payload, attemptKeys.current[draft.id].key);
        } catch (firstErr: any) {
          if (firstErr?.code === 'ATTENDANCE_CONFIRMATION_STALE') {
            const fresh = await getAttendanceConfirmationPreview(apiBase, draft.workDate);
            if (!fresh.canSubmit) {
              throw new Error( typeof fresh.blockedReasons?.[0] === 'string' ? fresh.blockedReasons[0] : fresh.blockedReasons?.[0]?.code || 'ATTENDANCE_CONFIRMATION_STALE');
            }
            const retryPayload = { ...payload, previewHash: fresh.previewHash || hash };
            const retryKey = newRequestKey();
            attemptKeys.current[draft.id] = { payload: JSON.stringify(retryPayload), key: retryKey };
            await createAttendanceConfirmation(apiBase, retryPayload, retryKey);
          } else {
            throw firstErr;
          }
        }
        sentAttendance.push(draft.workDate);
      } catch (err) {
        attErrors[draft.id] = friendlyEmployeeError(err);
      }
    }

    for (const draft of overtime) {
      const requestedStart = `${draft.workDate}T${draft.start}:00+07:00`;
      const requestedEnd = `${draft.workDate}T${draft.end}:00+07:00`;
      const graceOver = draft.workDate < shiftDay(todayKey(), -1);
      try {
        const preview = await previewOvertimeRequest(apiBase, { workDate: draft.workDate, requestedStart, requestedEnd });
        if (preview.blockedReasons?.length || !preview.canFile) {
          otErrors[draft.id] = friendlyEmployeeError(new Error(preview.blockedReasons?.[0] ?? 'OVERTIME_ATTENDANCE_INCOMPLETE'));
          continue;
        }
        await createOvertimeRequest(apiBase, {
          workDate: draft.workDate,
          requestedStart,
          requestedEnd,
          reason: draft.reason.trim(),
          workDescription: draft.workDescription.trim() || undefined,
          retroactiveReason: graceOver ? draft.retroactiveReason.trim() || draft.reason.trim() : undefined,
          previewHash: preview.contextHash,
        });
        sentOvertime += 1;
      } catch (err) {
        otErrors[draft.id] = friendlyEmployeeError(err);
      }
    }

    setBusy(false);
    setAttendance(effectiveAttendance.filter((d) => attErrors[d.id]).map((d) => ({ ...d, error: attErrors[d.id] })));
    setOvertime(overtime.filter((d) => otErrors[d.id]).map((d) => ({ ...d, error: otErrors[d.id] })));

    const failed = Object.keys(attErrors).length + Object.keys(otErrors).length;
    const sent = sentAttendance.length + sentOvertime;
    if (failed > 0 && sent === 0) {
      setBannerError('Không gửi được yêu cầu nào. Xem chi tiết lỗi trên từng đơn bên dưới.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (sent > 0) {
      onSent(sentAttendance, failed === 0, sentOvertime);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ height: insets.top, backgroundColor: colors.background }} />
        <View style={styles.sheetTopBar}>
          <View style={styles.sheetHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng biểu mẫu"
              disabled={busy}
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && !busy && styles.pressed]}
            >
              <AppIcon name="close" size={23} color={colors.inkSoft} />
            </Pressable>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.sheetTitle}>
                Báo sai lệch bảng công
              </Text>
              <Text style={styles.sheetSub}>
                Gửi một hoặc nhiều đơn Xác nhận công và Báo OT tới Quản lý phòng ban.
              </Text>
            </View>
          </View>

          {bannerError ? <ErrorBanner message={bannerError} /> : null}

          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: 'attendance', label: `Báo thiếu công (${attendance.length})` },
              { value: 'overtime', label: `Báo OT (${overtime.length})` },
            ]}
          />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          showsVerticalScrollIndicator
          contentContainerStyle={[styles.sheetContent, { paddingTop: spacing.sm, paddingBottom: spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.sheetBody}>

            {tab === 'attendance' ? (
              <View style={styles.draftList}>
                {attendance.length === 0 ? (
                  <Text style={styles.noDays}>Chưa có đơn xác nhận công nào. Bấm nút bên dưới để thêm đơn.</Text>
                ) : (
                  attendance.map((draft, idx) => {
                    const st = attPreviews[draft.id]?.date === draft.workDate ? attPreviews[draft.id] : undefined;
                    const preview = st?.preview;
                    const hasIn = Boolean(preview?.existingPunches?.checkInAt);
                    const hasOut = Boolean(preview?.existingPunches?.checkOutAt);
                    const blocks = (preview?.blockedReasons ?? []).filter(
                      (r) => !SILENT_BLOCKS.includes(typeof r === 'string' ? r : r.code),
                    );
                    const timeOrderInvalid =
                      Boolean(draft.checkInTime && draft.checkOutTime) && draft.checkInTime >= draft.checkOutTime;

                    return (
                      <View key={draft.id} style={styles.draftCard}>
                        <View style={styles.draftHead}>
                          <Text style={styles.draftBadge}>Đơn thiếu công #{idx + 1}</Text>
                          <View style={styles.draftHeadActions}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Tải lại xem trước"
                              disabled={busy}
                              onPress={() => {
                                setAttPreviews((prev) => {
                                  const next = { ...prev };
                                  delete next[draft.id];
                                  return next;
                                });
                                setRefreshTick((t) => t + 1);
                              }}
                              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                            >
                              <AppIcon name="refresh-outline" size={18} color={colors.primary} />
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Xoá đơn thiếu công"
                              disabled={busy}
                              onPress={() => setAttendance((rows) => rows.filter((r) => r.id !== draft.id))}
                              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                            >
                              <AppIcon name="trash-outline" size={18} color={colors.danger} />
                            </Pressable>
                          </View>
                        </View>

                        <DateTimeField
                          label="Ngày"
                          mode="date"
                          required
                          value={draft.workDate}
                          onChange={(val) => patchAttendance(draft.id, { workDate: val, timeEdited: false })}
                          disabled={busy}
                        />

                        {st?.loading ? (
                          <Text style={styles.previewHint}>Đang tải thông tin ca &amp; chấm công…</Text>
                        ) : st?.error ? (
                          <ErrorBanner message={st.error} />
                        ) : preview ? (
                          <View style={styles.previewBox}>
                            <View style={styles.previewTop}>
                              <View style={styles.flex}>
                                <Text style={styles.kicker}>CA LÀM VIỆC</Text>
                                <Text style={styles.shiftText}>
                                  {preview.obligation?.shiftLabel ?? 'Ca hành chính (08:00 – 17:00)'}
                                </Text>
                              </View>
                              {preview.quota ? (
                                <View style={styles.quotaPill}>
                                  <Text style={styles.quotaText}>
                                    Tháng {preview.quota.monthKey}: còn {preview.quota.remaining}/{preview.quota.limit} lượt
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={styles.twoFields}>
                              <View style={styles.punchMini}>
                                <Text style={styles.punchLabel}>
                                  Giờ vào · <Text style={{ color: hasIn ? colors.successText : colors.warningText }}>{hasIn ? '✓ Đã chấm' : 'Chưa có'}</Text>
                                </Text>
                                <Text style={styles.punchVal}>
                                  {draft.checkInTime || stepClock(preview.proposedChanges?.checkInAt)}
                                </Text>
                              </View>
                              <View style={styles.punchMini}>
                                <Text style={styles.punchLabel}>
                                  Giờ ra · <Text style={{ color: hasOut ? colors.successText : colors.primary }}>{hasOut ? '✓ Đã chấm' : 'Theo ca'}</Text>
                                </Text>
                                <Text style={styles.punchVal}>
                                  {draft.checkOutTime || stepClock(preview.proposedChanges?.checkOutAt)}
                                </Text>
                              </View>
                            </View>
                            {blocks.map((r, i) => (
                              <Text key={i} style={styles.blockError}>
                                {blockMessage(r)}
                              </Text>
                            ))}
                          </View>
                        ) : null}

                        <View style={styles.twoFields}>
                          <DateTimeField
                            label="Giờ vào thực tế"
                            mode="time"
                            value={draft.checkInTime}
                            onChange={(val) => patchAttendance(draft.id, { checkInTime: val })}
                            disabled={busy || preview?.canSubmit === false}
                          />
                          <DateTimeField
                            label="Giờ ra thực tế"
                            mode="time"
                            value={draft.checkOutTime}
                            onChange={(val) => patchAttendance(draft.id, { checkOutTime: val })}
                            disabled={busy || preview?.canSubmit === false}
                          />
                        </View>
                        {timeOrderInvalid ? <Text style={styles.blockError}>Giờ vào thực tế phải trước giờ ra thực tế.</Text> : null}

                        <Field
                          label="Lý do đơn này"
                          required
                          multiline
                          maxLength={1000}
                          value={draft.reason}
                          onChangeText={(val) => patchAttendance(draft.id, { reason: val })}
                          editable={!busy && preview?.canSubmit !== false}
                          placeholder="Nhập chi tiết lý do xác nhận công (ít nhất 10 ký tự)"
                        />
                        {draft.error ? <Text style={styles.blockError}>{draft.error}</Text> : null}
                      </View>
                    );
                  })
                )}

                <AppButton label="+ Thêm đơn thiếu công" variant="secondary" disabled={busy} onPress={() => addAttendance()} />
              </View>
            ) : (
              <View style={styles.draftList}>
                {overtime.length === 0 ? (
                  <Text style={styles.noDays}>Chưa có đơn làm thêm giờ (OT) nào. Bấm nút bên dưới để thêm đơn.</Text>
                ) : (
                  overtime.map((draft, idx) => {
                    const key = `${draft.workDate}|${draft.start}|${draft.end}`;
                    const st = otPreviews[draft.id];
                    const preview = st?.key === key ? st?.preview : undefined;
                    const graceOver = Boolean(draft.workDate && draft.workDate < shiftDay(todayKey(), -1));

                    return (
                      <View key={draft.id} style={styles.draftCard}>
                        <View style={styles.draftHead}>
                          <Text style={styles.draftBadge}>Đơn làm thêm giờ #{idx + 1}</Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Xoá đơn OT"
                            disabled={busy}
                            onPress={() => setOvertime((rows) => rows.filter((r) => r.id !== draft.id))}
                            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                          >
                            <AppIcon name="trash-outline" size={18} color={colors.danger} />
                          </Pressable>
                        </View>

                        <DateTimeField
                          label="Ngày tăng ca"
                          mode="date"
                          required
                          value={draft.workDate}
                          onChange={(val) => patchOvertime(draft.id, { workDate: val })}
                          disabled={busy}
                        />

                        <View style={styles.twoFields}>
                          <DateTimeField
                            label="Bắt đầu"
                            mode="time"
                            required
                            value={draft.start}
                            onChange={(val) => patchOvertime(draft.id, { start: val })}
                            disabled={busy}
                          />
                          <DateTimeField
                            label="Kết thúc"
                            mode="time"
                            required
                            value={draft.end}
                            onChange={(val) => patchOvertime(draft.id, { end: val })}
                            disabled={busy}
                          />
                        </View>

                        {preview ? (
                          <View style={styles.previewBox}>
                            <Text style={styles.shiftText}>
                              Dự tính OT: đủ điều kiện {preview.rawEligibleMinutes ?? 0}p · tính OT {preview.payableMinutes ?? 0}p
                            </Text>
                            {preview.blockedReasons?.map((code) => (
                              <Text key={code} style={styles.blockError}>
                                {friendlyEmployeeError(new Error(code))}
                              </Text>
                            ))}
                          </View>
                        ) : null}

                        <Field
                          label="Mô tả công việc (tùy chọn)"
                          value={draft.workDescription}
                          onChangeText={(val) => patchOvertime(draft.id, { workDescription: val })}
                          editable={!busy}
                          placeholder="Công việc thực hiện trong giờ OT"
                        />

                        <Field
                          label="Lý do đơn này"
                          required
                          multiline
                          maxLength={1000}
                          value={draft.reason}
                          onChangeText={(val) => patchOvertime(draft.id, { reason: val })}
                          editable={!busy}
                          placeholder="Nhập chi tiết lý do làm thêm giờ (ít nhất 10 ký tự)"
                        />

                        {graceOver ? (
                          <Field
                            label="Lý do bổ sung yêu cầu trễ hạn (tùy chọn)"
                            value={draft.retroactiveReason}
                            onChangeText={(val) => patchOvertime(draft.id, { retroactiveReason: val })}
                            editable={!busy}
                            placeholder="Mặc định dùng lý do đơn nếu để trống"
                          />
                        ) : null}

                        {draft.error ? <Text style={styles.blockError}>{draft.error}</Text> : null}
                      </View>
                    );
                  })
                )}

                <AppButton label="+ Thêm đơn OT" variant="secondary" disabled={busy} onPress={addOvertime} />
              </View>
            )}
          </Pressable>
        </ScrollView>

        <View style={[styles.sheetFooter, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
          <View style={styles.dialogActions}>
            <View style={styles.flex}>
              <AppButton label="Đóng" variant="secondary" disabled={busy} onPress={onClose} />
            </View>
            <View style={styles.flex}>
              <AppButton
                label={busy ? 'Đang gửi…' : `Gửi ${total} yêu cầu`}
                loading={busy}
                disabled={!canSubmit}
                onPress={() => void submit()}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  empty: {
    alignItems: 'center',
    gap: 6,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.xs },
  heroLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
  heroValue: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: '800' },
  heroStd: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
    rowGap: spacing.sm,
  },
  stat: { width: '50%', gap: 2 },
  statValue: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 11 },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  listTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  listCount: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surfaceMuted,
  },
  colText: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  colDate: { width: 52 },
  colBody: { flex: 1 },
  colCredit: { width: 52, alignItems: 'flex-end' },
  colCreditHead: { width: 52, textAlign: 'right' },
  noDays: { color: colors.muted, fontSize: 12, textAlign: 'center', padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowWd: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  sunday: { color: colors.danger },
  rowDm: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 1 },
  rowMain: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  rowSub: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  notes: { fontSize: 11, fontWeight: '600', marginTop: 3, lineHeight: 16 },
  credit: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  creditFull: { backgroundColor: colors.successSoft, color: colors.successText },
  creditHalf: { backgroundColor: colors.infoSoft, color: colors.info },
  creditZero: { backgroundColor: colors.warningSoft, color: colors.warningText },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 46,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  moreText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  actions: { gap: spacing.xs },
  actionHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  dialogTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  dialogText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  dialogActions: { flexDirection: 'row', gap: spacing.xs },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetTopBar: {
    paddingHorizontal: 22,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  sheetContent: { paddingHorizontal: 22 },
  sheetBody: { gap: spacing.md },
  sheetFooter: {
    paddingHorizontal: 22,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  closeBtn: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  sheetSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  draftList: { gap: spacing.md },
  draftCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  draftHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  draftBadge: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  draftHeadActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  twoFields: { flexDirection: 'row', gap: spacing.sm },
  previewHint: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  previewBox: {
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  previewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.xs },
  kicker: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  shiftText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  quotaPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  quotaText: { color: colors.info, fontSize: 10, fontWeight: '700' },
  punchMini: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  punchLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  punchVal: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 2 },
  blockError: {
    color: colors.dangerText,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
});
