import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { friendlyEmployeeError } from '../employee-api';
import { getTeam, type TeamMember } from '../manager-api';
import { Card, EmptyState, ErrorBanner, ErrorState, LoadingBlock, ScreenHeader, StatusBadge, formatTime, initialsOf } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
import { colors, radius, spacing } from '../theme';

const STATUS_LABEL: Record<string, string> = { CHECKED_IN: 'Đang trong ca', COMPLETED: 'Hoàn thành', DAY_OFF: 'Ngày nghỉ', LOCKED: 'Đã khóa', NOT_CHECKED_IN: 'Chưa vào ca' };
const statusOf = (member: TeamMember) => member.todayAttendance?.attendanceStatus || 'NOT_CHECKED_IN';

/** Tổng quan phòng ban: ai đang trong ca, ai chưa vào ca, ai đã hoàn thành hôm nay. */
export function ManagerTeamScreen({ apiBase, realtimeRevision = 0 }: { apiBase: string; realtimeRevision?: number }) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError(null);
    try { setTeam((await getTeam(apiBase)) || []); }
    catch (reason) { setError(friendlyEmployeeError(reason)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [apiBase, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    total: team.length,
    working: team.filter(member => statusOf(member) === 'CHECKED_IN').length,
    done: team.filter(member => statusOf(member) === 'COMPLETED').length,
    waiting: team.filter(member => statusOf(member) === 'NOT_CHECKED_IN').length,
  }), [team]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? team.filter(member => `${member.fullName || ''} ${member.employeeCode}`.toLowerCase().includes(needle)) : team;
  }, [query, team]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <ScreenHeader eyebrow="PHÒNG BAN" title="Phòng ban" description="Tình hình chấm công của nhân viên hôm nay." />
    {error && (loading || team.length > 0) ? <ErrorBanner message={error} /> : null}
    {loading ? <LoadingBlock /> : error && !team.length ? <ErrorState message={error} onRetry={() => void load()} /> : <>
      <View style={styles.stats}>
        <Stat value={counts.working} label="Đang làm" tone="info" />
        <Stat value={counts.done} label="Hoàn thành" tone="success" />
        <Stat value={counts.waiting} label="Chưa vào ca" tone="warning" />
      </View>
      <View style={styles.search}>
        <AppIcon name="search-outline" size={18} color={colors.muted} />
        <TextInput accessibilityLabel="Tìm nhân viên" value={query} onChangeText={setQuery} placeholder="Tìm theo tên hoặc mã nhân viên" placeholderTextColor={colors.faint} style={styles.searchInput} autoCapitalize="none" autoCorrect={false} />
      </View>
      <View style={styles.listHeading}><Text style={styles.sectionTitle}>Nhân viên</Text><Text style={styles.count}>{filtered.length}/{counts.total}</Text></View>
      {!filtered.length ? <EmptyState icon="people-outline" title={team.length ? 'Không tìm thấy nhân viên' : 'Chưa có nhân viên'} description={team.length ? 'Thử tìm bằng tên hoặc mã khác.' : 'Phòng ban của bạn chưa có nhân viên nào.'} /> : filtered.map(member => <MemberCard key={member.id} member={member} />)}
    </>}
  </ScrollView>;
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'info' | 'success' | 'warning' }) {
  const palette = { info: [colors.infoSoft, colors.info], success: [colors.successSoft, colors.successText], warning: [colors.warningSoft, colors.warningText] }[tone];
  return <View style={[styles.stat, { backgroundColor: palette[0] }]}><Text style={[styles.statValue, { color: palette[1] }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = { COMPLETED: 'success', CHECKED_IN: 'info', LOCKED: 'warning' };

function MemberCard({ member }: { member: TeamMember }) {
  const status = statusOf(member);
  const name = member.fullName || member.employeeCode || '';
  const attendance = member.todayAttendance;
  return <Card style={styles.member}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(name)}</Text></View>
    <View style={styles.memberCopy}>
      <View style={styles.nameRow}>
        <Text numberOfLines={2} style={styles.name}>{name}</Text>
        <StatusBadge status={status} tone={TONE[status] || 'neutral'} label={STATUS_LABEL[status] || 'Chưa có dữ liệu'} />
      </View>
      <Text style={styles.code}>{member.employeeCode}</Text>
      {member.workplaceName ? <Text style={styles.meta}>{member.workplaceName}</Text> : null}
      {attendance?.checkInAt ? <Text style={styles.times}>Vào {formatTime(attendance.checkInAt)} · Ra {formatTime(attendance.checkOutAt)}</Text> : null}
    </View>
  </Card>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.huge + 16, gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, borderRadius: radius.lg, padding: spacing.md, minHeight: 84 },
  statValue: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  statLabel: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  searchInput: { flex: 1, minHeight: 46, color: colors.ink, fontSize: 15 },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  member: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  memberCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  code: { color: colors.muted, fontSize: 12, marginTop: 3 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  name: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  times: { color: colors.inkSoft, fontSize: 12, fontWeight: '600', marginTop: 4 },
});
