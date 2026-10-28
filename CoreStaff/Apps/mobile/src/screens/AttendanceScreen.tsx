import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { getAttendanceHistory, getTodayAttendance, punchAttendance, friendlyEmployeeError, type AttendanceHistory, type PunchLocation, type TodayAttendance } from '../employee-api';
import { currentWifi } from '../wifi';
import { AppButton, Card, ErrorBanner, ErrorState, LoadingBlock, ScreenHeader, StatusBadge, SuccessBanner, formatDate, formatMinutes, formatTime } from '../components/ui';
import { colors, radius, spacing } from '../theme';

const monthKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7);

/** Thrown when the device cannot produce the evidence this punch needs. */
class PunchError extends Error {}

async function currentLocation(): Promise<PunchLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new PunchError('Cần quyền truy cập vị trí để chấm công. Hãy bật trong Cài đặt.');
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    latitude: fix.coords.latitude,
    longitude: fix.coords.longitude,
    accuracyMeters: fix.coords.accuracy ?? undefined,
  };
}

/** Returns undefined when the employee backs out of the camera. */
async function takeSelfie(): Promise<string | undefined> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new PunchError('Cần quyền camera để chụp ảnh chấm công. Hãy bật trong Cài đặt.');
  const shot = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.6 });
  return shot.canceled ? undefined : shot.assets[0]?.uri;
}

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

  /**
   * Mirrors the server's order: Wi-Fi (BSSID) -> GPS -> selfie. Each step runs
   * only after the previous one answered SELFIE_REQUIRED, so an employee in the
   * office never gets a GPS or camera prompt. OUT_OFFICE skips straight to selfie,
   * and a workplace with no trusted Wi-Fi skips straight to GPS.
   */
  const submit = async () => {
    if (!today || today.availableAction === 'NONE') return;
    const action = today.availableAction;
    const outOffice = today.assignment.workplaceType === 'OUT_OFFICE';
    const punch = (evidence: { location?: PunchLocation; selfieUri?: string; wifi?: { ssid?: string; bssid?: string } }) =>
      punchAttendance(apiBase, action, { workMode: outOffice ? 'OUT_OFFICE' : 'IN_OFFICE', ...evidence });
    const accepted = async (evidence: Parameters<typeof punch>[0]) => {
      try { await punch(evidence); return true; } catch (err) { if (!isSelfieRequired(err)) throw err; return false; }
    };
    setSubmitting(true); setError(null); setSuccess(null);
    try {
      if (outOffice) {
        const selfieUri = await takeSelfie();
        if (!selfieUri) return;
        await punch({ selfieUri });
      } else {
        const wifiFirst = today.assignment.hasWifiNetworks !== false;
        const wifi = wifiFirst ? await currentWifi() : {};
        if (!(wifiFirst && await accepted({ wifi }))) {
          setError('Chưa xác thực được Wi-Fi công ty. Đang kiểm tra vị trí GPS…');
          const location = await currentLocation();
          if (!(await accepted({ location, wifi }))) {
            setError('Vị trí ngoài phạm vi công ty. Chụp ảnh selfie để gửi quản lý duyệt.');
            const selfieUri = await takeSelfie();
            if (!selfieUri) return;
            await punch({ location, selfieUri, wifi });
          }
        }
      }
      setSuccess(action === 'CHECK_IN' ? 'Đã ghi nhận thời gian vào ca.' : 'Đã ghi nhận thời gian ra ca.');
      await load(true);
    } catch (err) {
      setError(err instanceof PunchError ? err.message : friendlyEmployeeError(err));
    } finally { setSubmitting(false); }
  };
  const monthLabel = useMemo(() => { const [year, value] = month.split('-'); return `Tháng ${Number(value)}/${year}`; }, [month]);
  const canMoveNext = month < monthKey();
  const changeMonth = (offset: number) => { const [year, value] = month.split('-').map(Number); const next = new Date(year, value - 1 + offset, 1); const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`; if (nextKey <= monthKey()) setMonth(nextKey); };
  const confirmSubmit = () => {
    if (!today || today.availableAction === 'NONE') return;
    const checkingIn = today.availableAction === 'CHECK_IN';
    const outOffice = today.assignment.workplaceType === 'OUT_OFFICE';
    Alert.alert(checkingIn ? 'Xác nhận vào ca' : 'Xác nhận ra ca', checkingIn ? `Ghi nhận vào ca tại ${today.assignment.workplaceName}?` : 'Ghi nhận kết thúc ca làm việc hôm nay?', [
      { text: 'Hủy', style: 'cancel' },
      { text: outOffice ? 'Chụp selfie' : checkingIn ? 'Vào ca' : 'Ra ca', onPress: () => void submit() },
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
      {today?.attendanceRequirements ? <Card style={styles.leaveCard}><Text style={styles.leaveTitle}>Nghỉ phép đã được HR áp dụng</Text><Text style={styles.leaveText}>Thời gian nghỉ: {intervalText(today.attendanceRequirements.approvedLeaveIntervals)} ({formatMinutes(today.attendanceRequirements.approvedLeaveMinutes)})</Text><Text style={styles.leaveText}>Thời gian còn phải làm: {intervalText(today.attendanceRequirements.requiredWorkingIntervals)} ({formatMinutes(today.attendanceRequirements.requiredWorkingMinutes)})</Text><Text style={styles.leaveText}>Khung chấm công hiệu lực: {today.attendanceRequirements.effectiveCheckInTime || '—'} – {today.attendanceRequirements.effectiveCheckOutTime || '—'}</Text></Card> : today?.pendingLeave ? <Card style={styles.pendingCard}><Text style={styles.pendingTitle}>Đơn nghỉ đang chờ xử lý</Text><Text style={styles.pendingText}>{pendingLeaveText(today.pendingLeave.durationType, today.pendingLeave.requestedStart, today.pendingLeave.requestedEnd)}. Ca làm gốc vẫn được áp dụng cho tới khi quản lý duyệt và HR áp dụng.</Text></Card> : null}
      <View style={styles.metricGrid}><Metric label="Giờ làm" value={formatMinutes(today?.workingMinutes)} /><Metric label="Đi muộn" value={formatMinutes(today?.lateMinutes)} /><Metric label="Về sớm" value={formatMinutes(today?.earlyMinutes)} /></View>
      <View style={styles.monthHeader}><Text style={styles.sectionTitle}>Lịch sử tháng</Text><View style={styles.monthControl}><MonthButton label="Tháng trước" symbol="‹" onPress={() => changeMonth(-1)} /><Text style={styles.monthText}>{monthLabel}</Text><MonthButton label="Tháng sau" symbol="›" disabled={!canMoveNext} onPress={() => changeMonth(1)} /></View></View>
      {history ? <View style={styles.summaryRow}><Summary label="Ngày công" value={history.summary.workingDays} /><Summary label="Đi muộn" value={history.summary.lateDays} /><Summary label="OT" value={`${Math.round(history.summary.otMinutes / 60 * 10) / 10}g`} /></View> : null}
      {!history?.items.length ? <Card><Text style={styles.emptyText}>Chưa có dữ liệu chấm công trong tháng này.</Text></Card> : history.items.map(day => <Card key={day._id || day.workDate} style={styles.dayCard}><View style={styles.dayTop}><View><Text style={styles.dayDate}>{formatDate(day.workDate)}</Text><Text style={styles.dayTimes}>{formatTime(day.checkIn?.recordedAt)} - {formatTime(day.checkOut?.recordedAt)}</Text></View><StatusBadge status={day.attendanceStatus} label={attendanceLabel(day.attendanceStatus)} /></View><View style={styles.dayMeta}><Text style={styles.dayMetaText}>{formatMinutes(day.workingMinutes)}</Text>{day.lateMinutes ? <Text style={styles.warningText}>Muộn {day.lateMinutes}p</Text> : null}{day.earlyMinutes ? <Text style={styles.earlyText}>Về sớm {day.earlyMinutes}p</Text> : null}{day.overtime?.otMinutes ? <Text style={styles.blueText}>OT {day.overtime.otMinutes}p</Text> : null}</View></Card>)}
    </>}
  </ScrollView>;
}

function attendanceLabel(status?: string) { return ({ NOT_CHECKED_IN: 'Chưa vào ca', CHECKED_IN: 'Đang trong ca', COMPLETED: 'Hoàn thành', DAY_OFF: 'Ngày nghỉ', LOCKED: 'Đã khóa' } as Record<string, string>)[status || ''] || 'Chưa có dữ liệu'; }
function intervalText(items: Array<{ from: string; to: string }>) { return items.length ? items.map(item => `${item.from}–${item.to}`).join(', ') : 'Không có'; }
function pendingLeaveText(duration: string, start?: string, end?: string) { if (duration === 'MORNING_HALF') return 'Nghỉ buổi sáng'; if (duration === 'AFTERNOON_HALF') return 'Nghỉ buổi chiều'; if (duration === 'CUSTOM_HOURS') return `Nghỉ theo giờ${start && end ? ` (${start}–${end})` : ''}`; return 'Nghỉ cả ngày'; }
function isSelfieRequired(err: unknown): boolean { return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'SELFIE_REQUIRED'; }
function TimelinePoint({ active, label, time }: { active: boolean; label: string; time: string }) { return <View style={styles.timelinePoint}><View style={[styles.dot, active && styles.dotActive]} /><Text style={styles.timelineLabel}>{label}</Text><Text style={styles.timelineTime}>{time}</Text></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Summary({ label, value }: { label: string; value: string | number }) { return <View style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function MonthButton({ label, symbol, disabled, onPress }: { label: string; symbol: string; disabled?: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.monthButton, disabled && styles.monthButtonDisabled, pressed && !disabled && styles.pressed]}><Text style={styles.monthArrow}>{symbol}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.huge, gap: spacing.md }, hero: { padding: spacing.lg }, heroTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', justifyContent: 'space-between' }, heroCopy: { flex: 1 }, heroLabel: { color: colors.navySoft, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, heroHours: { color: '#fff', fontSize: 25, fontWeight: '800', marginTop: 6 }, workplace: { color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginTop: spacing.xs }, heroNote: { color: '#bfdbfe', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: spacing.sm },
  timeline: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: spacing.lg }, timelinePoint: { width: 68, alignItems: 'center' }, dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#64748b', backgroundColor: colors.navy }, dotActive: { borderColor: '#86efac', backgroundColor: colors.success }, timelineLine: { flex: 1, height: 2, backgroundColor: '#475569', marginTop: 6 }, timelineLineDone: { backgroundColor: colors.success }, timelineLabel: { color: colors.navySoft, fontSize: 9, fontWeight: '800', marginTop: 7 }, timelineTime: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 3 },
  metricGrid: { flexDirection: 'row', gap: spacing.xs }, metric: { flex: 1, minHeight: 76, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.xs }, metricValue: { color: colors.ink, fontSize: 14, fontWeight: '800' }, metricLabel: { color: colors.muted, fontSize: 10, marginTop: 4 },
  leaveCard: { backgroundColor: colors.successSoft, borderColor: colors.success }, leaveTitle: { color: colors.successText, fontSize: 13, fontWeight: '800' }, leaveText: { color: colors.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 4 }, pendingCard: { backgroundColor: colors.warningSoft }, pendingTitle: { color: colors.warningText, fontSize: 13, fontWeight: '800' }, pendingText: { color: colors.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 4 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }, sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, monthControl: { flexDirection: 'row', alignItems: 'center', gap: 2 }, monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md }, monthButtonDisabled: { opacity: 0.35 }, monthArrow: { color: colors.primary, fontSize: 24, lineHeight: 27, fontWeight: '700' }, monthText: { minWidth: 82, color: colors.inkSoft, fontSize: 12, fontWeight: '800', textAlign: 'center' }, summaryRow: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.sm }, summary: { flex: 1, alignItems: 'center' }, summaryValue: { color: colors.primaryDark, fontSize: 17, fontWeight: '800' }, summaryLabel: { color: colors.muted, fontSize: 9, marginTop: 3 },
  dayCard: { gap: spacing.sm }, dayTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }, dayDate: { color: colors.ink, fontSize: 14, fontWeight: '800' }, dayTimes: { color: colors.muted, fontSize: 12, marginTop: 5 }, dayMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }, dayMetaText: { color: colors.inkSoft, fontSize: 11, fontWeight: '700' }, warningText: { color: colors.warningText, fontSize: 11, fontWeight: '700' }, earlyText: { color: colors.dangerText, fontSize: 11, fontWeight: '700' }, blueText: { color: colors.primaryDark, fontSize: 11, fontWeight: '700' }, emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg }, pressed: { opacity: 0.7 },
});
