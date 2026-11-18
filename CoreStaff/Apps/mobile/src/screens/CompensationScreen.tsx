import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../components/AppIcon';
import { TimesheetReviewSection } from '../components/TimesheetReviewSection';
import { ScreenHeader, SegmentedControl, todayKey } from '../components/ui';
import { colors, spacing } from '../theme';
import { PayslipsScreen } from './PayslipsScreen';

export type CompensationTab = 'timesheet' | 'payslip';

const monthOf = (date: string) => date.slice(0, 7);
const shiftMonth = (month: string, offset: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + offset, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/**
 * Công & Lương của tôi — cùng cấu trúc với web (MyCompensationScreen):
 * tab Bảng công (rà soát/xác nhận bảng công theo tháng) và tab Bảng lương (phiếu lương).
 */
export function CompensationScreen({ apiBase, realtimeRevision = 0, initialTab = 'timesheet' }: { apiBase: string; realtimeRevision?: number; initialTab?: CompensationTab }) {
  const [tab, setTab] = useState<CompensationTab>(initialTab);
  const [month, setMonth] = useState(() => monthOf(todayKey()));
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const current = monthOf(todayKey());

  const header = <>
    <ScreenHeader eyebrow="CÔNG & LƯƠNG" title="Công & Lương của tôi" description="Theo dõi từ xác nhận bảng công đến nhận phiếu lương." />
    <SegmentedControl value={tab} onChange={setTab} options={[{ value: 'timesheet', label: 'Bảng công' }, { value: 'payslip', label: 'Bảng lương' }]} />
  </>;

  if (tab === 'payslip') return <View style={styles.flex}>
    <View style={styles.pinned}>{header}</View>
    <View style={styles.flex}><PayslipsScreen apiBase={apiBase} realtimeRevision={realtimeRevision} embedded /></View>
  </View>;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setRefreshKey(k => k + 1); setTimeout(() => setRefreshing(false), 600); }} tintColor={colors.primary} />}>
    {header}
    <View style={styles.monthBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Tháng trước" onPress={() => setMonth(m => shiftMonth(m, -1))} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}><AppIcon name="chevron-back" size={20} color={colors.primary} /></Pressable>
      <View style={styles.monthCopy}>
        <Text style={styles.monthLabel}>Lọc theo tháng</Text>
        <Text accessibilityRole="header" style={styles.monthTitle}>Tháng {Number(month.slice(5))}/{month.slice(0, 4)}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Tháng sau" disabled={month >= current} onPress={() => setMonth(m => shiftMonth(m, 1))} style={({ pressed }) => [styles.monthButton, month >= current && styles.disabled, pressed && styles.pressed]}><AppIcon name="chevron-forward" size={20} color={colors.primary} /></Pressable>
    </View>
    <TimesheetReviewSection apiBase={apiBase} month={month} refreshKey={realtimeRevision + refreshKey} hideTitle />
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.huge + 16, gap: spacing.md },
  pinned: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md, backgroundColor: colors.background },
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  monthButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  monthCopy: { flex: 1, alignItems: 'center' },
  monthLabel: { color: colors.muted, fontSize: 11 },
  monthTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 2 },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.4 },
});
