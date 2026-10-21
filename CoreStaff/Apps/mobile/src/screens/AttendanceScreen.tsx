import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getAttendanceHistory, getTodayAttendance, punchAttendance, friendlyEmployeeError, type AttendanceHistory, type TodayAttendance } from '../employee-api';
import { AppButton, Card, ErrorBanner, ErrorState, LoadingBlock, ScreenHeader, StatusBadge, SuccessBanner, formatDate, formatMinutes, formatTime } from '../components/ui';
import { colors, radius, spacing } from '../theme';

const monthKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7);

export function AttendanceScreen({ apiBase, realtimeRevision = 0 }: { apiBase: string; realtimeRevision?: number }) {
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [history, setHistory] = useState<AttendanceHistory | null>(null);
  const [month, setMonth] = useState(monthKey());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError(null);
    const [todayResult, historyResult] = await Promise.allSettled([getTodayAttendance(apiBase), getAttendanceHistory(apiBase, month)]);
    if (todayResult.status === 'fulfilled') setToday(todayResult.value);
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
    const failure = todayResult.status === 'rejected' ? todayResult.reason : historyResult.status === 'rejected' ? historyResult.reason : null;
    if (failure) setError(friendlyEmployeeError(failure));
    setLoading(false); setRefreshing(false);
  }, [apiBase, month, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);

  const actionLabel = today?.availableAction === 'CHECK_IN' ? 'Xác nhận vào ca' : today?.availableAction === 'CHECK_OUT' ? 'Xác nhận ra ca' : 'Ca làm đã hoàn tất';
  const submit = async () => {
    if (!today || today.availableAction === 'NONE') return;
    setSubmitting(true); setError(null); setSuccess(null);
    try { await punchAttendance(apiBase, today.availableAction, today.assignment.workplaceType); setSuccess(today.availableAction === 'CHECK_IN' ? 'Đã ghi nhận thời gian vào ca.' : 'Đã ghi nhận thời gian ra ca.'); await load(true); }
    catch (err) { setError(friendlyEmployeeError(err)); }
    finally { setSubmitting(false); }
  };
  const monthLabel = useMemo(() => { const [year, value] = month.split('-'); return `Tháng ${Number(value)}/${year}`; }, [month]);
  const canMoveNext = month < monthKey();
  const changeMonth = (offset: number) => { const [year, value] = month.split('-').map(Number); const next = new Date(year, value - 1 + offset, 1); const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`; if (nextKey <= monthKey()) setMonth(nextKey); };
  const confirmSubmit = () => {
    if (!today || today.availableAction === 'NONE') return;
    const checkingIn = today.availableAction === 'CHECK_IN';
    Alert.alert(checkingIn ? 'Xác nhận vào ca' : 'Xác nhận ra ca', checkingIn ? `Ghi nhận vào ca tại ${today.assignment.workplaceName}?` : 'Ghi nhận kết thúc ca làm việc hôm nay?', [
      { text: 'Hủy', style: 'cancel' },
      { text: checkingIn ? 'Vào ca' : 'Ra ca', onPress: () => void submit() },
    ]);
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <ScreenHeader eyebrow="CHẤM CÔNG" title="Ngày làm việc" description="Ghi nhận thời gian và theo dõi công của bạn." />
    {error && (loading || today || history) ? <ErrorBanner message={error} /> : null}{success ? <SuccessBanner message={success} /> : null}
    {loading ? <LoadingBlock /> : error && !today && !history ? <ErrorState message={error} onRetry={() => void load()} /> : <>
      <Card dark style={styles.hero}>
        <View style={styles.heroTop}><View style={styles.heroCopy}><Text style={styles.heroLabel}>{today?.assignment.shiftName || 'Ca làm hôm nay'}</Text><Text style={styles.heroHours}>{today?.assignment.shiftHours || '-'}</Text></View><StatusBadge status={today?.attendanceStatus || 'NOT_CHECKED_IN'} label={attendanceLabel(today?.attendanceStatus)} /></View>
        <Text style={styles.workplace}>{today?.assignment.workplaceName}{today?.assignment.address ? ` - ${today.assignment.address}` : ''}</Text>
        <View style={styles.timeline}><TimelinePoint active label="Vào ca" time={formatTime(today?.checkIn?.recordedAt)} /><View style={[styles.timelineLine, today?.checkOut && styles.timelineLineDone]} /><TimelinePoint active={!!today?.checkOut} label="Ra ca" time={formatTime(today?.checkOut?.recordedAt)} /></View>
        <AppButton label={actionLabel} loading={submitting} disabled={!today || today.availableAction === 'NONE'} onPress={confirmSubmit} />
        {today?.assignment.workplaceType === 'OUT_OFFICE' ? <Text style={styles.heroNote}>Ca ngoài văn phòng có thể yêu cầu vị trí hoặc selfie theo chính sách công ty.</Text> : null}
      </Card>
      <View style={styles.metricGrid}><Metric label="Giờ làm" value={formatMinutes(today?.workingMinutes)} /><Metric label="Đi muộn" value={formatMinutes(today?.lateMinutes)} /><Metric label="Về sớm" value={formatMinutes(today?.earlyMinutes)} /></View>
      <View style={styles.monthHeader}><Text style={styles.sectionTitle}>Lịch sử tháng</Text><View style={styles.monthControl}><MonthButton label="Tháng trước" symbol="‹" onPress={() => changeMonth(-1)} /><Text style={styles.monthText}>{monthLabel}</Text><MonthButton label="Tháng sau" symbol="›" disabled={!canMoveNext} onPress={() => changeMonth(1)} /></View></View>
      {history ? <View style={styles.summaryRow}><Summary label="Ngày công" value={history.summary.workingDays} /><Summary label="Đi muộn" value={history.summary.lateDays} /><Summary label="OT" value={`${Math.round(history.summary.otMinutes / 60 * 10) / 10}g`} /></View> : null}
      {!history?.items.length ? <Card><Text style={styles.emptyText}>Chưa có dữ liệu chấm công trong tháng này.</Text></Card> : history.items.map(day => <Card key={day._id || day.workDate} style={styles.dayCard}><View style={styles.dayTop}><View><Text style={styles.dayDate}>{formatDate(day.workDate)}</Text><Text style={styles.dayTimes}>{formatTime(day.checkIn?.recordedAt)} - {formatTime(day.checkOut?.recordedAt)}</Text></View><StatusBadge status={day.attendanceStatus} label={attendanceLabel(day.attendanceStatus)} /></View><View style={styles.dayMeta}><Text style={styles.dayMetaText}>{formatMinutes(day.workingMinutes)}</Text>{day.lateMinutes ? <Text style={styles.warningText}>Muộn {day.lateMinutes}p</Text> : null}{day.overtime?.otMinutes ? <Text style={styles.blueText}>OT {day.overtime.otMinutes}p</Text> : null}</View></Card>)}
    </>}
  </ScrollView>;
}

function attendanceLabel(status?: string) { return ({ NOT_CHECKED_IN: 'Chưa vào ca', CHECKED_IN: 'Đang trong ca', COMPLETED: 'Hoàn thành', DAY_OFF: 'Ngày nghỉ', LOCKED: 'Đã khóa' } as Record<string, string>)[status || ''] || 'Chưa có dữ liệu'; }
function TimelinePoint({ active, label, time }: { active: boolean; label: string; time: string }) { return <View style={styles.timelinePoint}><View style={[styles.dot, active && styles.dotActive]} /><Text style={styles.timelineLabel}>{label}</Text><Text style={styles.timelineTime}>{time}</Text></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Summary({ label, value }: { label: string; value: string | number }) { return <View style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function MonthButton({ label, symbol, disabled, onPress }: { label: string; symbol: string; disabled?: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.monthButton, disabled && styles.monthButtonDisabled, pressed && !disabled && styles.pressed]}><Text style={styles.monthArrow}>{symbol}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.huge, gap: spacing.md }, hero: { padding: spacing.lg }, heroTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', justifyContent: 'space-between' }, heroCopy: { flex: 1 }, heroLabel: { color: colors.navySoft, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, heroHours: { color: '#fff', fontSize: 25, fontWeight: '800', marginTop: 6 }, workplace: { color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginTop: spacing.xs }, heroNote: { color: '#bfdbfe', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: spacing.sm },
  timeline: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: spacing.lg }, timelinePoint: { width: 68, alignItems: 'center' }, dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#64748b', backgroundColor: colors.navy }, dotActive: { borderColor: '#86efac', backgroundColor: colors.success }, timelineLine: { flex: 1, height: 2, backgroundColor: '#475569', marginTop: 6 }, timelineLineDone: { backgroundColor: colors.success }, timelineLabel: { color: colors.navySoft, fontSize: 9, fontWeight: '800', marginTop: 7 }, timelineTime: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 3 },
  metricGrid: { flexDirection: 'row', gap: spacing.xs }, metric: { flex: 1, minHeight: 76, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.xs }, metricValue: { color: colors.ink, fontSize: 14, fontWeight: '800' }, metricLabel: { color: colors.muted, fontSize: 10, marginTop: 4 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }, sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, monthControl: { flexDirection: 'row', alignItems: 'center', gap: 2 }, monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md }, monthButtonDisabled: { opacity: 0.35 }, monthArrow: { color: colors.primary, fontSize: 24, lineHeight: 27, fontWeight: '700' }, monthText: { minWidth: 82, color: colors.inkSoft, fontSize: 12, fontWeight: '800', textAlign: 'center' }, summaryRow: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.sm }, summary: { flex: 1, alignItems: 'center' }, summaryValue: { color: colors.primaryDark, fontSize: 17, fontWeight: '800' }, summaryLabel: { color: colors.muted, fontSize: 9, marginTop: 3 },
  dayCard: { gap: spacing.sm }, dayTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }, dayDate: { color: colors.ink, fontSize: 14, fontWeight: '800' }, dayTimes: { color: colors.muted, fontSize: 12, marginTop: 5 }, dayMeta: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }, dayMetaText: { color: colors.inkSoft, fontSize: 11, fontWeight: '700' }, warningText: { color: colors.warningText, fontSize: 11, fontWeight: '700' }, blueText: { color: colors.primaryDark, fontSize: 11, fontWeight: '700' }, emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg }, pressed: { opacity: 0.7 },
});
