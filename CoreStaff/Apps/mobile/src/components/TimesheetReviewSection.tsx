import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { acknowledgeMyTimesheetReview, disputeMyTimesheetReview, friendlyEmployeeError, getMyTimesheetReview, listMyTimesheetReviews, type TimesheetReview, type TimesheetReviewCard, type TimesheetReviewDay, type TimesheetReviewState } from '../employee-api';
import { AppButton, ErrorBanner, LoadingBlock, NoticeBanner, SuccessBanner } from './ui';
import { AppIcon } from './AppIcon';
import { colors, radius, spacing } from '../theme';

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const STATE_LABEL: Record<TimesheetReviewState, string> = { PENDING: 'Chờ rà soát', ACKNOWLEDGED: 'Đã xác nhận', DISPUTED: 'Đã báo sai lệch' };
const STATE_COLOR: Record<TimesheetReviewState, { bg: string; fg: string }> = {
  PENDING: { bg: '#fef3c7', fg: '#92400e' }, ACKNOWLEDGED: { bg: '#dcfce7', fg: '#166534' }, DISPUTED: { bg: '#fee2e2', fg: '#991b1b' },
};
const CLOSED_COLOR = { bg: '#dbeafe', fg: '#1e40af' };

const isClosed = (p?: { periodStatus?: string } | null) => p?.periodStatus === 'CLOSED';
/** 7h52 · 8h · 45p — gọn để vừa một dòng trên màn hình hẹp. */
function hm(min: number) { const t = Math.max(0, Math.round(min || 0)); const h = Math.floor(t / 60), m = t % 60; return h ? (m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m}p`; }
const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
function dayLabel(date: string) { const [y, m, d] = date.slice(0, 10).split('-').map(Number); return { wd: WEEKDAY[new Date(y, m - 1, d).getDay()], dm: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` }; }
/** Ngày không có nghĩa vụ, công, giờ làm, nghỉ hay OT (vd. nghỉ tuần) không mang thông tin. */
const hasInfo = (d: TimesheetReviewDay) => d.scheduledObligationMinutes > 0 || d.workedScheduledMinutes > 0 || d.payableLeaveMinutes > 0 || d.unpaidLeaveMinutes > 0 || d.overtimeMinutes > 0 || d.workCredit > 0;

/**
 * Bảng công kỳ của tháng đang xem ở lịch chấm công (kỳ công = 1 tháng, khớp `month`).
 * Cùng API/luật với web: kỳ đang rà soát cho xác nhận/báo sai lệch; kỳ HR đã chốt chỉ để xem.
 */
export function TimesheetReviewSection({ apiBase, month, refreshKey = 0 }: { apiBase: string; month: string; refreshKey?: number }) {
  const [cards, setCards] = useState<TimesheetReviewCard[] | null>(null);
  const [review, setReview] = useState<TimesheetReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');

  const [y, m] = month.split('-');
  const monthLabel = `${Number(m)}/${y}`;

  // Danh sách kỳ chỉ cần tải lại khi realtime báo đổi, không phải mỗi lần đổi tháng.
  const loadCards = useCallback(async () => {
    try { setCards(await listMyTimesheetReviews(apiBase)); setError(null); }
    catch (err) { setCards([]); setError(friendlyEmployeeError(err)); }
  }, [apiBase]);
  useEffect(() => { void loadCards(); }, [loadCards, refreshKey]);

  const periodId = useMemo(() => cards?.find(c => c.periodKey === month)?.periodId ?? null, [cards, month]);
  const ready = cards !== null;

  // Phụ thuộc id kỳ (không phải object card): cập nhật trạng thái sau khi xác nhận không kéo tải lại.
  useEffect(() => {
    if (!ready) return;
    setExpanded(false); setActionError(null);
    if (!periodId) { setReview(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setReview(null);
    getMyTimesheetReview(apiBase, periodId)
      .then(value => { if (!cancelled) { setReview(value); setError(null); } })
      .catch(err => { if (!cancelled) setError(friendlyEmployeeError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, periodId, ready, refreshKey]);

  const totals = useMemo(() => {
    const days = review?.days ?? [];
    return {
      worked: days.reduce((s, d) => s + d.workedScheduledMinutes, 0),
      leave: days.reduce((s, d) => s + d.payableLeaveMinutes, 0),
      ot: days.reduce((s, d) => s + d.overtimeMinutes, 0),
      late: days.filter(d => (d.lateMinutes ?? 0) > 0).length,
      early: days.filter(d => (d.earlyMinutes ?? 0) > 0).length,
      visible: days.filter(hasInfo),
    };
  }, [review]);

  const run = async (task: () => Promise<TimesheetReview>, done: () => void) => {
    setBusy(true); setActionError(null);
    try {
      const next = await task();
      setReview(next);
      setCards(list => list && list.map(p => p.periodId === next.periodId ? { ...p, state: next.state } : p));
      done();
    } catch (err) { setActionError(friendlyEmployeeError(err)); }
    finally { setBusy(false); }
  };
  const acknowledge = () => { if (review) void run(() => acknowledgeMyTimesheetReview(apiBase, review), () => setConfirming(false)); };
  const dispute = () => { if (review && reason.trim().length >= 10) void run(() => disputeMyTimesheetReview(apiBase, review, reason.trim()), () => { setDisputing(false); setReason(''); }); };

  const closed = isClosed(review);
  const badge = review ? (closed ? { label: 'HR đã chốt', ...CLOSED_COLOR } : { label: STATE_LABEL[review.state], ...STATE_COLOR[review.state] }) : null;
  const ratio = review && review.standardWorkUnits > 0 ? Math.min(1, review.payableWorkUnits / review.standardWorkUnits) : 0;

  return <View style={styles.wrap}>
    <Text accessibilityRole="header" style={styles.title}>Bảng công kỳ {monthLabel}</Text>

    {loading || cards === null ? <LoadingBlock label="Đang tải bảng công kỳ…" />
      : error && !review ? <><ErrorBanner message={error} /><AppButton label="Thử lại" variant="secondary" onPress={() => { void loadCards(); }} /></>
      : !review ? <View style={styles.empty}>
        <View style={styles.emptyIcon}><AppIcon name="clipboard-outline" size={24} color={colors.primaryDark} /></View>
        <Text style={styles.emptyTitle}>Chưa có bảng công tháng {monthLabel}</Text>
        <Text style={styles.emptyText}>Bảng công hiện ra khi HR mở kỳ để rà soát, và vẫn xem lại được sau khi HR chốt.</Text>
      </View>
      : <>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View><Text style={styles.heroLabel}>Công thực tế / công chuẩn</Text><Text style={styles.heroValue}>{num(review.payableWorkUnits)}<Text style={styles.heroStd}> / {num(review.standardWorkUnits)} công</Text></Text></View>
            {badge ? <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text></View> : null}
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} /></View>
          <View style={styles.statRow}>
            <Stat label="Giờ làm" value={hm(totals.worked)} />
            <Stat label="Nghỉ có lương" value={totals.leave ? hm(totals.leave) : '—'} />
            <Stat label="Tăng ca" value={totals.ot ? hm(totals.ot) : '—'} accent />
            <Stat label="Muộn / Sớm" value={`${totals.late} / ${totals.early}`} />
          </View>
        </View>

        {closed ? <NoticeBanner message={review.state === 'ACKNOWLEDGED' ? 'HR đã chốt kỳ công này. Bạn đã xác nhận bảng công; vẫn có thể xem lại bất cứ lúc nào.' : review.state === 'DISPUTED' ? 'HR đã chốt kỳ công này. Báo sai lệch của bạn đã được ghi nhận; bảng công chỉ còn để xem.' : 'HR đã chốt kỳ công này. Bảng công chỉ còn để xem, không thể xác nhận hay báo sai lệch.'} /> : null}
        {!closed && review.state === 'ACKNOWLEDGED' ? <SuccessBanner message="Bạn đã xác nhận thông tin bảng công chính xác." /> : null}
        {!closed && review.state === 'DISPUTED' ? <NoticeBanner message="Bạn đã báo sai lệch. Bộ phận phụ trách sẽ kiểm tra và cập nhật dữ liệu." /> : null}
        {!closed && review.state !== 'ACKNOWLEDGED' && review.hasUnresolvedDays ? <NoticeBanner message="Còn ngày chấm công chưa hoàn tất. Hãy báo sai lệch; bạn chỉ xác nhận được sau khi dữ liệu được xử lý." /> : null}

        <View style={styles.list}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(v => !v)} style={styles.listHead}>
            <Text style={styles.listTitle}>Chi tiết ngày công · {totals.visible.length} ngày</Text>
            <AppIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
          </Pressable>
          {expanded ? totals.visible.map(d => {
            const { wd, dm } = dayLabel(d.workDate);
            const tone = d.workCredit >= 1 ? styles.creditFull : d.workCredit > 0 ? styles.creditHalf : styles.creditZero;
            return <View key={d.workDate} style={styles.row}>
              <View style={styles.rowDate}><Text style={[styles.rowWd, (wd === 'CN') && styles.sunday]}>{wd}</Text><Text style={styles.rowDm}>{dm}</Text></View>
              <View style={styles.rowBody}>
                <Text style={styles.rowMain}>{d.workedScheduledMinutes ? hm(d.workedScheduledMinutes) : '—'}<Text style={styles.rowSub}> / {hm(d.scheduledObligationMinutes)}</Text></Text>
                <View style={styles.tags}>
                  {d.payableLeaveMinutes > 0 ? <Tag text={`Phép ${hm(d.payableLeaveMinutes)}`} bg="#bae6fd" fg="#0c4a6e" /> : null}
                  {d.unpaidLeaveMinutes > 0 ? <Tag text={`Không lương ${hm(d.unpaidLeaveMinutes)}`} bg="#e2e8f0" fg="#334155" /> : null}
                  {d.overtimeMinutes > 0 ? <Tag text={`OT ${hm(d.overtimeMinutes)}`} bg="#e0e7ff" fg="#3730a3" /> : null}
                  {(d.lateMinutes ?? 0) > 0 ? <Tag text={`Muộn ${hm(d.lateMinutes ?? 0)}`} bg="#fed7aa" fg="#7c2d12" /> : null}
                  {(d.earlyMinutes ?? 0) > 0 ? <Tag text={`Sớm ${hm(d.earlyMinutes ?? 0)}`} bg="#f5d0fe" fg="#701a75" /> : null}
                </View>
              </View>
              <Text style={[styles.credit, tone]}>{num(d.workCredit)}</Text>
            </View>;
          }) : null}
        </View>

        {review.state !== 'ACKNOWLEDGED' && !closed ? <View style={styles.actions}>
          <Text style={styles.actionHint}>{review.hasUnresolvedDays ? 'Cần xử lý các ngày chấm công chưa hoàn tất trước khi xác nhận.' : 'Hãy báo sai lệch nếu số liệu chưa đúng trước khi xác nhận.'}</Text>
          <AppButton label="Đã kiểm tra — thông tin chính xác" disabled={busy || !review.canAcknowledge} onPress={() => { setActionError(null); setConfirming(true); }} />
          <AppButton label="Báo sai lệch" variant="secondary" disabled={busy} onPress={() => { setActionError(null); setDisputing(true); }} />
        </View> : null}
      </>}

    <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirming(false); }}>
      <View style={styles.backdrop}><View style={styles.dialog}>
        <Text style={styles.dialogTitle}>Xác nhận thông tin chính xác</Text>
        <Text style={styles.dialogText}>Xác nhận được gắn với đúng phiên bản bảng công bạn vừa xem. Hãy chắc chắn bạn đã kiểm tra đầy đủ.</Text>
        {actionError ? <ErrorBanner message={actionError} /> : null}
        <View style={styles.dialogActions}><View style={styles.flex}><AppButton label="Hủy" variant="secondary" disabled={busy} onPress={() => setConfirming(false)} /></View><View style={styles.flex}><AppButton label="Xác nhận" loading={busy} onPress={acknowledge} /></View></View>
      </View></View>
    </Modal>

    <Modal visible={disputing} transparent animationType="fade" onRequestClose={() => { if (!busy) setDisputing(false); }}>
      <View style={styles.backdrop}><View style={styles.dialog}>
        <Text style={styles.dialogTitle}>Báo sai lệch bảng công</Text>
        <Text style={styles.dialogText}>Mô tả ngày và nội dung chưa chính xác để bộ phận phụ trách kiểm tra nhanh hơn.</Text>
        <TextInput accessibilityLabel="Lý do sai lệch" multiline maxLength={2000} value={reason} onChangeText={setReason} placeholder="Ví dụ: Ngày 15/10 tôi đã chấm công lúc 08:02 nhưng hệ thống chưa ghi nhận check-in." placeholderTextColor={colors.faint} style={styles.input} />
        <Text style={[styles.counter, reason.length > 0 && reason.trim().length < 10 && styles.counterError]}>{reason.length > 0 && reason.trim().length < 10 ? `Cần thêm ${10 - reason.trim().length} ký tự để gửi.` : `Tối thiểu 10 ký tự · ${reason.length}/2000`}</Text>
        {actionError ? <ErrorBanner message={actionError} /> : null}
        <View style={styles.dialogActions}><View style={styles.flex}><AppButton label="Hủy" variant="secondary" disabled={busy} onPress={() => setDisputing(false)} /></View><View style={styles.flex}><AppButton label="Gửi báo cáo" variant="danger" loading={busy} disabled={reason.trim().length < 10} onPress={dispute} /></View></View>
      </View></View>
    </Modal>
  </View>;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <View style={styles.stat}><Text style={[styles.statValue, accent && styles.statAccent]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function Tag({ text, bg, fg }: { text: string; bg: string; fg: string }) { return <Text style={[styles.tag, { backgroundColor: bg, color: fg }]}>{text}</Text>; }

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.md }, flex: { flex: 1 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 6, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', textAlign: 'center' }, emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  hero: { backgroundColor: colors.navy, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.xs },
  heroLabel: { color: colors.navySoft, fontSize: 11, fontWeight: '700' }, heroValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2 }, heroStd: { color: colors.navySoft, fontSize: 14, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill }, badgeText: { fontSize: 11, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }, fill: { height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  statRow: { flexDirection: 'row', gap: 4 }, stat: { flex: 1, alignItems: 'center', paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md },
  statValue: { color: '#fff', fontSize: 14, fontWeight: '800' }, statAccent: { color: '#a5b4fc' }, statLabel: { color: colors.navySoft, fontSize: 10, marginTop: 2 },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, minHeight: 48 }, listTitle: { color: colors.inkSoft, fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider },
  rowDate: { width: 44, alignItems: 'center' }, rowWd: { color: colors.muted, fontSize: 10, fontWeight: '800' }, sunday: { color: colors.danger }, rowDm: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 1 },
  rowBody: { flex: 1, gap: 4 }, rowMain: { color: colors.ink, fontSize: 13, fontWeight: '800' }, rowSub: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, tag: { fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  credit: { minWidth: 34, textAlign: 'center', fontSize: 13, fontWeight: '800', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  creditFull: { backgroundColor: '#dcfce7', color: '#166534' }, creditHalf: { backgroundColor: '#dbeafe', color: '#1e40af' }, creditZero: { backgroundColor: '#fef3c7', color: '#92400e' },
  actions: { gap: spacing.xs }, actionHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: spacing.xl }, dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  dialogTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, dialogText: { color: colors.muted, fontSize: 13, lineHeight: 19 }, dialogActions: { flexDirection: 'row', gap: spacing.xs },
  input: { minHeight: 110, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, padding: spacing.sm, color: colors.ink, fontSize: 14 }, counter: { color: colors.muted, fontSize: 11 }, counterError: { color: colors.danger },
});
