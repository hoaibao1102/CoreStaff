import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AuthUser } from '../auth';
import { friendlyEmployeeError, getMyLeaveRequests, getMyOvertimeRequests, getMyPayslips, getTodayAttendance, type TodayAttendance } from '../employee-api';
import { Card, ErrorBanner, LoadingBlock, SectionTitle, StatusBadge, formatTime, initialsOf, shiftTitle } from '../components/ui';
import { colors, radius, spacing } from '../theme';
import type { BottomTabKey } from '../components/BottomTabBar';
import { AppIcon, type AppIconName } from '../components/AppIcon';

function greeting() {
  const hour = Number(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 2));
  return hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}

function todayLabel() {
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return `${days[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function OverviewScreen({ user, apiBase, onNavigate, realtimeRevision = 0, pendingApprovals }: { user: AuthUser; apiBase: string; onNavigate: (tab: BottomTabKey) => void; realtimeRevision?: number; pendingApprovals?: number }) {
  const isManager = pendingApprovals !== undefined;
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
  const initials = initialsOf(user.fullName);
  const status = today?.attendanceStatus;
  const statusLabel = status === 'CHECKED_IN' ? 'Đang trong ca' : status === 'COMPLETED' ? 'Đã hoàn thành' : status === 'DAY_OFF' ? 'Ngày nghỉ' : 'Chưa vào ca';
  const action = today?.availableAction;
  const ctaLabel = action === 'CHECK_OUT' ? 'Ra ca ngay' : action === 'CHECK_IN' ? 'Vào ca ngay' : 'Xem ngày công';

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.date}>{todayLabel()}</Text>
        <Text style={styles.greeting}>{greeting()},</Text>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>{user.fullName}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Tài khoản của ${user.fullName}`} onPress={() => onNavigate('account')} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}><Text style={styles.avatarText}>{initials}</Text></Pressable>
    </View>
    {error ? <ErrorBanner message={error} /> : null}
    {loading ? <LoadingBlock /> : <Card dark style={styles.todayCard}>
      <View style={styles.todayTop}>
        <View style={styles.todayCopy}><Text style={styles.todayEyebrow}>CA LÀM HÔM NAY</Text><Text style={styles.shiftName}>{shiftTitle(today?.assignment.shiftName, 'Chưa có ca làm')}</Text></View>
        <StatusBadge status={status || 'NOT_CHECKED_IN'} tone={status === 'CHECKED_IN' ? 'info' : status === 'COMPLETED' ? 'success' : 'neutral'} label={statusLabel} />
      </View>
      <Text style={styles.shiftMeta}>{today ? `${today.assignment.shiftHours || '-'} · ${today.assignment.workplaceName || ''}` : 'Liên hệ HR để được phân ca'}</Text>
      <View style={styles.timeRow}>
        <TimeCell label="VÀO CA" value={formatTime(today?.checkIn?.recordedAt)} />
        <View style={styles.timeDivider} />
        <TimeCell label="RA CA" value={formatTime(today?.checkOut?.recordedAt)} />
      </View>
      <Pressable accessibilityRole="button" testID="overview-cta" onPress={() => onNavigate('attendance')} style={({ pressed }) => [styles.cta, !action || action === 'NONE' ? styles.ctaMuted : null, pressed && styles.pressed]}>
        <AppIcon name="finger-print" size={20} color={!action || action === 'NONE' ? '#fff' : colors.ink} />
        <Text style={[styles.ctaText, !action || action === 'NONE' ? styles.ctaTextMuted : null]}>{ctaLabel}</Text>
      </Pressable>
    </Card>}

    {isManager ? <Pressable accessibilityRole="button" accessibilityLabel={`${pendingApprovals} đơn đang chờ bạn duyệt`} onPress={() => onNavigate('approvals')} style={({ pressed }) => [styles.approvalBanner, !pendingApprovals && styles.approvalBannerIdle, pressed && styles.pressed]}>
      <View style={[styles.approvalIcon, !pendingApprovals && styles.approvalIconIdle]}><AppIcon name="checkmark-done" size={22} color={pendingApprovals ? colors.warningText : colors.primary} /></View>
      <View style={styles.approvalCopy}><Text style={styles.approvalTitle}>{pendingApprovals ? `${pendingApprovals} đơn đang chờ bạn duyệt` : 'Không có đơn chờ duyệt'}</Text><Text style={styles.approvalMeta}>{pendingApprovals ? 'Chạm để xem và xử lý' : 'Bạn đã xử lý hết đơn của nhân viên'}</Text></View>
      <AppIcon name="chevron-forward" size={18} color={colors.faint} />
    </Pressable> : null}

    <SectionTitle>Cần bạn chú ý</SectionTitle>
    <View style={styles.metricRow}>
      <Metric icon="document-text-outline" value={requestCount} label="Đơn đang chờ duyệt" tone={requestCount ? 'warning' : 'default'} onPress={() => onNavigate('requests')} />
      <Metric icon="wallet-outline" value={newPayslips} label="Phiếu lương mới" tone={newPayslips ? 'accent' : 'default'} onPress={() => onNavigate('payslips')} />
    </View>

    <SectionTitle>Truy cập nhanh</SectionTitle>
    <View style={styles.quickGrid}>
      {isManager ? <>
        <QuickTile icon="checkmark-done-outline" title="Duyệt đơn" onPress={() => onNavigate('approvals')} />
        <QuickTile icon="people-outline" title="Phòng ban" onPress={() => onNavigate('team')} />
        <QuickTile icon="list-outline" title="Lịch sử công" onPress={() => onNavigate('attendance')} />
        <QuickTile icon="document-text-outline" title="Đơn của tôi" onPress={() => onNavigate('requests')} />
      </> : <>
        <QuickTile icon="calendar-outline" title="Xin nghỉ phép" onPress={() => onNavigate('requests')} />
        <QuickTile icon="time-outline" title="Đăng ký tăng ca" onPress={() => onNavigate('requests')} />
        <QuickTile icon="list-outline" title="Lịch sử công" onPress={() => onNavigate('attendance')} />
        <QuickTile icon="cash-outline" title="Phiếu lương" onPress={() => onNavigate('payslips')} />
      </>}
    </View>
  </ScrollView>;
}

function TimeCell({ label, value }: { label: string; value: string }) { return <View style={styles.timeCell}><Text style={styles.timeLabel}>{label}</Text><Text style={styles.timeValue}>{value}</Text></View>; }

function Metric({ icon, value, label, tone, onPress }: { icon: AppIconName; value: number; label: string; tone: 'default' | 'warning' | 'accent'; onPress: () => void }) {
  const iconColor = tone === 'warning' ? colors.warningText : tone === 'accent' ? colors.primary : colors.muted;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${value} ${label}`} onPress={onPress} style={({ pressed }) => [styles.metric, pressed && styles.pressed]}>
    <AppIcon name={icon} size={20} color={iconColor} />
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </Pressable>;
}

function QuickTile({ icon, title, onPress }: { icon: AppIconName; title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}>
    <View style={styles.quickSymbol}><AppIcon name={icon} size={19} color={colors.primaryDark} /></View>
    <Text style={styles.quickTitle}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: spacing.huge, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 4 },
  headerCopy: { flex: 1 },
  date: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  greeting: { color: colors.muted, fontSize: 14, marginTop: 8 },
  name: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '800', marginTop: 2 },
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontSize: 17, fontWeight: '800' },
  todayCard: { padding: 20, borderRadius: radius.xl, backgroundColor: colors.navy, gap: 0 },
  todayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  todayCopy: { flex: 1 },
  todayEyebrow: { color: colors.navySoft, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  shiftName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 8 },
  shiftMeta: { color: colors.borderLight, fontSize: 13, lineHeight: 20, marginTop: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 16 },
  timeCell: { flex: 1, alignItems: 'center' },
  timeDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.24)' },
  timeLabel: { color: colors.navySoft, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  timeValue: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
  cta: { paddingVertical: 14, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  ctaMuted: { backgroundColor: 'rgba(255,255,255,0.12)' },
  ctaText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  ctaTextMuted: { color: '#fff' },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  metricRow: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  metricValue: { color: colors.ink, fontSize: 26, lineHeight: 29, fontWeight: '800', marginTop: 10 },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickTile: { width: '48%', flexGrow: 1, height: 64, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14 },
  quickSymbol: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '800' },
  approvalBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: radius.lg, padding: spacing.md },
  approvalBannerIdle: { backgroundColor: colors.infoSoft, borderColor: colors.infoBorder },
  approvalIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  approvalIconIdle: {},
  approvalCopy: { flex: 1 },
  approvalTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  approvalMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pressed: { opacity: 0.75 },
});
