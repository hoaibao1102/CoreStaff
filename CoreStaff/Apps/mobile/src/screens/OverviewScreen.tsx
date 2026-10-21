import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AuthUser } from '../auth';
import { friendlyEmployeeError, getMyLeaveRequests, getMyOvertimeRequests, getMyPayslips, getTodayAttendance, type TodayAttendance } from '../employee-api';
import { Card, ErrorBanner, LoadingBlock, StatusBadge, formatTime } from '../components/ui';
import { colors, radius, spacing } from '../theme';
import type { BottomTabKey } from '../components/BottomTabBar';
import { AppIcon, type AppIconName } from '../components/AppIcon';

export function OverviewScreen({ user, apiBase, onNavigate, realtimeRevision = 0 }: { user: AuthUser; apiBase: string; onNavigate: (tab: BottomTabKey) => void; realtimeRevision?: number }) {
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [newPayslips, setNewPayslips] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    const [attendance, leaves, overtime, payslips] = await Promise.allSettled([
      getTodayAttendance(apiBase), getMyLeaveRequests(apiBase), getMyOvertimeRequests(apiBase), getMyPayslips(apiBase),
    ]);
    if (attendance.status === 'fulfilled') setToday(attendance.value);
    const pendingLeaves = leaves.status === 'fulfilled' ? leaves.value.filter(item => item.status === 'PENDING_MANAGER').length : 0;
    const pendingOvertime = overtime.status === 'fulfilled' ? overtime.value.filter(item => item.status === 'PENDING' || item.status === 'CLARIFICATION_REQUESTED').length : 0;
    setRequestCount(pendingLeaves + pendingOvertime);
    if (payslips.status === 'fulfilled') setNewPayslips(payslips.value.filter(item => item.status === 'RELEASED').length);
    const failure = [attendance, leaves, overtime, payslips].find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') setError(friendlyEmployeeError(failure.reason));
    setLoading(false); setRefreshing(false);
  }, [apiBase, realtimeRevision]);

  useEffect(() => { void load(); }, [load]);
  const initials = user.fullName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();
  const statusLabel = today?.attendanceStatus === 'CHECKED_IN' ? 'Đang trong ca' : today?.attendanceStatus === 'COMPLETED' ? 'Đã hoàn thành ca' : today?.attendanceStatus === 'DAY_OFF' ? 'Ngày nghỉ' : 'Chưa vào ca';

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.eyebrow}>KHÔNG GIAN CÁ NHÂN</Text><Text style={styles.greeting}>Chào bạn,</Text><Text numberOfLines={1} style={styles.name}>{user.fullName}</Text></View><View accessibilityLabel={`Ảnh đại diện ${user.fullName}`} style={styles.avatar}><Text style={styles.avatarText}>{initials || 'NV'}</Text></View></View>
    {error ? <ErrorBanner message={error} /> : null}
    {loading ? <LoadingBlock /> : <Card dark style={styles.todayCard}>
      <View style={styles.todayTop}><View><Text style={styles.todayEyebrow}>CA LÀM HÔM NAY</Text><Text style={styles.shiftName}>{today?.assignment.shiftName || 'Chưa có ca làm'}</Text></View><StatusBadge status={today?.attendanceStatus || 'NOT_CHECKED_IN'} label={statusLabel} /></View>
      <Text style={styles.shiftMeta}>{today ? `${today.assignment.shiftHours} - ${today.assignment.workplaceName}` : 'Liên hệ HR để được phân ca'}</Text>
      <View style={styles.timeRow}><TimeCell label="VÀO CA" value={formatTime(today?.checkIn?.recordedAt)} /><View style={styles.timeDivider} /><TimeCell label="RA CA" value={formatTime(today?.checkOut?.recordedAt)} /></View>
      <Pressable accessibilityRole="button" accessibilityHint="Mở màn hình chấm công" onPress={() => onNavigate('attendance')} style={({ pressed }) => [styles.todayAction, pressed && styles.pressed]}><Text style={styles.todayActionText}>{today?.availableAction === 'CHECK_OUT' ? 'Mở chấm công để ra ca' : today?.availableAction === 'CHECK_IN' ? 'Mở chấm công để vào ca' : 'Xem chi tiết ngày công'}</Text><Text style={styles.actionChevron}>›</Text></Pressable>
    </Card>}
    <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Cần bạn chú ý</Text></View>
    <View style={styles.metricRow}><Metric value={String(requestCount)} label="Đơn đang chờ" tone={requestCount ? 'warning' : 'default'} /><Metric value={String(newPayslips)} label="Phiếu lương mới" tone={newPayslips ? 'blue' : 'default'} /></View>
    <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
    <QuickRow icon="finger-print-outline" title="Chấm công & lịch sử" description="Vào ca, ra ca và theo dõi ngày công" onPress={() => onNavigate('attendance')} />
    <QuickRow icon="calendar-outline" title="Nghỉ phép & tăng ca" description="Tạo mới và xem trạng thái phê duyệt" onPress={() => onNavigate('requests')} />
    <QuickRow icon="wallet-outline" title="Phiếu lương & thu nhập" description="Xem chi tiết các kỳ lương đã phát hành" onPress={() => onNavigate('payslips')} />
  </ScrollView>;
}

function TimeCell({ label, value }: { label: string; value: string }) { return <View style={styles.timeCell}><Text style={styles.timeLabel}>{label}</Text><Text style={styles.timeValue}>{value}</Text></View>; }
function Metric({ value, label, tone }: { value: string; label: string; tone: 'default' | 'warning' | 'blue' }) { return <View style={[styles.metric, tone === 'warning' && styles.metricWarning, tone === 'blue' && styles.metricBlue]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function QuickRow({ icon, title, description, onPress }: { icon: AppIconName; title: string; description: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickRow, pressed && styles.pressed]}><View style={styles.quickSymbol}><AppIcon name={icon} size={21} color={colors.primaryDark} /></View><View style={styles.quickCopy}><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickDescription}>{description}</Text></View><AppIcon name="chevron-forward" size={20} color={colors.faint} /></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.huge, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 4 }, headerCopy: { flex: 1 }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.25 }, greeting: { color: colors.muted, fontSize: 13, marginTop: spacing.xs }, name: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '800' }, avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.primaryDark, fontSize: 17, fontWeight: '800' },
  todayCard: { padding: spacing.lg }, todayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }, todayEyebrow: { color: colors.navySoft, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, shiftName: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '800', marginTop: 7 }, shiftMeta: { color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginTop: spacing.xs }, timeRow: { flexDirection: 'row', marginTop: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }, timeCell: { flex: 1 }, timeDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: spacing.md }, timeLabel: { color: colors.navySoft, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, timeValue: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 5 }, todayAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }, todayActionText: { color: '#bfdbfe', fontSize: 12, fontWeight: '800' }, actionChevron: { color: '#bfdbfe', fontSize: 24, lineHeight: 26 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }, sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, metricRow: { flexDirection: 'row', gap: spacing.sm }, metric: { flex: 1, minHeight: 92, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }, metricWarning: { backgroundColor: colors.warningSoft, borderColor: '#fde68a' }, metricBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }, metricValue: { color: colors.ink, fontSize: 24, fontWeight: '800' }, metricLabel: { color: colors.muted, fontSize: 11, marginTop: 5 },
  quickRow: { minHeight: 76, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, quickSymbol: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, quickCopy: { flex: 1 }, quickTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' }, quickDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, pressed: { opacity: 0.75 },
});
