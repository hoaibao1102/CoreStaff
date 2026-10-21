import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, LoadingBlock, ScreenHeader, StatusBadge, formatDate, formatMoney } from '../components/ui';
import { friendlyEmployeeError, getMyPayslips, markPayslipViewed, type Payslip } from '../employee-api';
import { colors, radius, spacing } from '../theme';

export function PayslipsScreen({ apiBase, realtimeRevision = 0 }: { apiBase: string; realtimeRevision?: number }) {
  const [items, setItems] = useState<Payslip[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try { setItems((await getMyPayslips(apiBase)) || []); }
    catch (reason) { setError(friendlyEmployeeError(reason)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [apiBase, realtimeRevision]);

  useEffect(() => { void load(); }, [load]);

  const newest = items[0];
  const unread = useMemo(() => items.filter(item => item.status === 'RELEASED').length, [items]);

  const open = async (item: Payslip) => {
    setExpanded(current => current === item._id ? null : item._id);
    if (item.status !== 'RELEASED') return;
    try {
      await markPayslipViewed(apiBase, item._id);
      setItems(rows => rows.map(row => row._id === item._id ? { ...row, status: 'VIEWED' } : row));
    } catch { /* The detail can still be read if the audit update is unavailable. */ }
  };

  return <ScrollView
    style={styles.screen}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
  >
    <ScreenHeader eyebrow="THU NHẬP" title="Phiếu lương" description="Theo dõi thu nhập và các khoản khấu trừ của bạn." />
    {error ? <ErrorBanner message={error} /> : null}
    {loading ? <LoadingBlock /> : <>
      <Card dark style={styles.summaryCard}>
        <View style={styles.summaryTop}><View><Text style={styles.summaryEyebrow}>KỲ GẦN NHẤT</Text><Text style={styles.summaryPeriod}>{newest ? `Tháng ${newest.periodLabel}` : 'Chưa phát hành'}</Text></View>{unread ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{unread} mới</Text></View> : null}</View>
        <Text style={styles.summaryLabel}>Thực nhận</Text>
        <Text style={styles.summaryValue}>{newest ? formatMoney(newest.netSalary) : '—'}</Text>
        <Text style={styles.summaryMeta}>{newest?.releasedAt ? `Phát hành ${formatDate(newest.releasedAt)}` : 'Phiếu lương mới sẽ xuất hiện tại đây.'}</Text>
      </Card>

      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Lịch sử phiếu lương</Text><Text style={styles.count}>{items.length} kỳ</Text></View>
      {!items.length ? <EmptyState icon="wallet-outline" title="Chưa có phiếu lương" description="Phiếu lương sẽ xuất hiện khi HR phát hành kỳ lương." /> : items.map(item => {
        const isExpanded = expanded === item._id;
        return <Pressable
          key={item._id}
          accessibilityRole="button"
          accessibilityLabel={`Phiếu lương kỳ ${item.periodLabel}`}
          accessibilityState={{ expanded: isExpanded }}
          onPress={() => void open(item)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.payslipCard}>
            <View style={styles.payslipTop}><View style={styles.periodCopy}><Text style={styles.period}>Kỳ {item.periodLabel}</Text><Text style={styles.released}>{item.releasedAt ? `Phát hành ${formatDate(item.releasedAt)}` : 'Chưa phát hành'}</Text></View><StatusBadge status={item.status} label={statusLabel(item.status)} /></View>
            <View style={styles.netRow}><Text style={styles.netLabel}>Thực nhận</Text><Text style={styles.netValue}>{formatMoney(item.netSalary)}</Text></View>
            {isExpanded ? <View style={styles.breakdown}>
              <MoneyRow label="Tổng thu nhập" value={item.grossEarnings} />
              <MoneyRow label="Bảo hiểm" value={-(item.socialInsurance + item.healthInsurance + item.unemploymentInsurance)} />
              <MoneyRow label="Thuế TNCN" value={-item.pitAmount} />
              <MoneyRow label="Khấu trừ khác" value={-item.otherDeductions} />
              <View style={styles.divider} />
              <MoneyRow label="Thực nhận" value={item.netSalary} strong />
            </View> : <Text style={styles.expandHint}>Chạm để xem chi tiết</Text>}
          </Card>
        </Pressable>;
      })}
    </>}
  </ScrollView>;
}

function MoneyRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <View style={styles.moneyRow}><Text style={[styles.moneyLabel, strong && styles.strong]}>{label}</Text><Text style={[styles.moneyValue, value < 0 && styles.negative, strong && styles.strong]}>{formatMoney(value)}</Text></View>;
}

function statusLabel(status: Payslip['status']) {
  return ({ GENERATED: 'Đang xử lý', RELEASED: 'Mới', VIEWED: 'Đã xem' } as Record<Payslip['status'], string>)[status];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.huge, gap: spacing.md },
  summaryCard: { padding: spacing.lg },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  summaryEyebrow: { color: colors.navySoft, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  summaryPeriod: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 6 },
  unreadBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#fff' },
  unreadText: { color: colors.primaryDark, fontSize: 10, fontWeight: '800' },
  summaryLabel: { color: colors.navySoft, fontSize: 11, fontWeight: '700', marginTop: spacing.xl },
  summaryValue: { color: '#fff', fontSize: 30, lineHeight: 38, fontWeight: '800', marginTop: 3 },
  summaryMeta: { color: '#cbd5e1', fontSize: 11, marginTop: spacing.xs },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  payslipCard: { gap: spacing.md },
  payslipTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  periodCopy: { flex: 1 },
  period: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  released: { color: colors.muted, fontSize: 10, marginTop: 4 },
  netRow: { padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  netLabel: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  netValue: { color: colors.primaryDark, fontSize: 18, fontWeight: '800' },
  expandHint: { color: colors.primary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  breakdown: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  moneyLabel: { color: colors.muted, fontSize: 12 },
  moneyValue: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  negative: { color: colors.dangerText },
  strong: { color: colors.ink, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.divider },
  pressed: { opacity: 0.74 },
});
