import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, LoadingBlock, ScreenHeader, SectionTitle, StatusBadge, formatDate, formatMoney, formatPeriod } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
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
    <ScreenHeader eyebrow="PHIẾU LƯƠNG" title="Phiếu lương" description="Theo dõi thu nhập và các khoản khấu trừ của bạn." />
    {error ? <ErrorBanner message={error} /> : null}
    {loading ? <LoadingBlock /> : <>
      {newest ? <Card dark style={styles.summaryCard}>
        <View style={styles.summaryTop}><View><Text style={styles.summaryEyebrow}>KỲ GẦN NHẤT</Text><Text style={styles.summaryPeriod}>Tháng {formatPeriod(newest.periodLabel)}</Text></View>{unread ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{unread} mới</Text></View> : null}</View>
        <Text style={styles.summaryLabel}>Thực nhận</Text>
        <Text style={styles.summaryValue}>{formatMoney(newest.netSalary)}</Text>
        <Text style={styles.summaryMeta}>{newest.releasedAt ? `Phát hành ${formatDate(newest.releasedAt)}` : 'Chưa phát hành'}</Text>
      </Card> : null}

      <View style={styles.sectionRow}><SectionTitle>Lịch sử phiếu lương</SectionTitle><Text style={styles.count}>{items.length} kỳ</Text></View>
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
            <View style={styles.payslipTop}><View style={styles.periodCopy}><Text style={styles.period}>Kỳ {formatPeriod(item.periodLabel)}</Text><Text style={styles.released}>{item.releasedAt ? `Phát hành ${formatDate(item.releasedAt)}` : 'Chưa phát hành'}</Text></View><StatusBadge status={item.status} label={statusLabel(item.status)} /></View>
            <View style={styles.netRow}><Text style={styles.netLabel}>Thực nhận</Text><Text style={styles.netValue}>{formatMoney(item.netSalary)}</Text></View>
            {isExpanded ? <View style={styles.breakdown}><PayslipDetail item={item} /></View> : <Text style={styles.expandHint}>Chạm để xem chi tiết</Text>}
          </Card>
        </Pressable>;
      })}
    </>}
  </ScrollView>;
}

function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.moneyRow}><Text style={styles.moneyLabel}>{label}</Text><Text style={styles.moneyValue}>{value}</Text></View>; }
function SubRow({ label, value }: { label: string; value: number }) { return <View style={[styles.moneyRow, styles.subRow]}><Text style={styles.subLabel}>{label}</Text><Text style={styles.subValue}>{formatMoney(value)}</Text></View>; }
function Head({ children }: { children: string }) { return <Text style={styles.head}>{children}</Text>; }

/** Cấu trúc theo web PayslipPreviewDialog: thu nhập → khấu trừ → thông tin tính thuế → thực nhận. */
function PayslipDetail({ item }: { item: Payslip }) {
  const earnings = item.earningBreakdown ?? [];
  const allowances = item.allowanceBreakdown ?? [];
  const otLines = item.otBreakdown?.breakdown ?? [];
  const insurance = item.socialInsurance + item.healthInsurance + item.unemploymentInsurance;
  const otLabel = (l: { label: string; hours?: number; coefficient?: number }) => { const h = l.hours ?? 0; return `${l.label}: ${Number.isInteger(h) ? h : h.toFixed(1)} giờ × hệ số ${l.coefficient}`; };
  // Dòng chi tiết OT thu gọn mặc định — bấm vào "Tiền làm thêm giờ" mới xổ.
  const [showOtLines, setShowOtLines] = useState(false);

  // Năm khoản thu nhập cố định — backend cắt khoản 0 khỏi `earningBreakdown` nên
  // thiếu dòng không có nghĩa là không áp dụng. Luôn in đủ, kể cả 0 ₫.
  const amountOf = (type: string) => earnings.find((e) => e.type === type)?.amount ?? 0;

  return <>
    {item.payableWorkingDays != null && item.standardWorkingDays != null ? <InfoRow label="Ngày công tính lương" value={`${item.payableWorkingDays} / ${item.standardWorkingDays} ngày`} /> : null}
    {item.employeeCode ? <InfoRow label="Mã nhân viên" value={item.employeeCode} /> : null}
    {item.taxCode ? <InfoRow label="Mã số thuế" value={item.taxCode} /> : null}
    <View style={styles.divider} />
    <Head>THU NHẬP</Head>
    <MoneyRow label="Lương cơ bản theo công" value={amountOf('BASE_SALARY')} />
    {allowances.length
      ? allowances.map((a, k) => <MoneyRow key={k} label={a.label} value={a.amount} />)
      : <MoneyRow label="Tổng phụ cấp" value={amountOf('ALLOWANCE')} />}
    <MoneyRow label="Thưởng chuyên cần" value={amountOf('ATTENDANCE_BONUS')} />
    <MoneyRow label="Thưởng KPI" value={amountOf('KPI_BONUS')} />
    <View style={styles.group}>
      {otLines.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showOtLines }}
          accessibilityLabel="Tiền làm thêm giờ, chi tiết theo loại ngày"
          onPress={() => setShowOtLines((open) => !open)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <MoneyRow label="Tiền làm thêm giờ" value={amountOf('OVERTIME') || (item.otBreakdown?.otPay ?? 0)} chevron={showOtLines ? 'chevron-up' : 'chevron-down'} />
        </Pressable>
      ) : (
        <MoneyRow label="Tiền làm thêm giờ" value={amountOf('OVERTIME') || (item.otBreakdown?.otPay ?? 0)} />
      )}
      {showOtLines ? otLines.map((l, k) => <SubRow key={k} label={otLabel(l)} value={l.amount} />) : null}
    </View>
    <MoneyRow label="Tổng thu nhập" value={item.grossEarnings} strong />
    <View style={styles.divider} />
    <Head>KHẤU TRỪ</Head>
    <MoneyRow label="Bảo hiểm (BHXH + BHYT + BHTN)" value={-insurance} />
    <SubRow label="BHXH" value={-(item.socialInsurance || 0)} />
    <SubRow label="BHYT" value={-(item.healthInsurance || 0)} />
    <SubRow label="BHTN" value={-(item.unemploymentInsurance || 0)} />
    <MoneyRow label="Thuế TNCN" value={-(item.pitAmount || 0)} />
    <MoneyRow label="Khấu trừ khác" value={-(item.otherDeductions || 0)} />
    <View style={styles.divider} />
    <Head>THÔNG TIN TÍNH THUẾ</Head>
    <InfoRow label="Thu nhập chịu thuế" value={formatMoney(item.taxableIncome ?? 0)} />
    <InfoRow label="Giảm trừ bản thân" value={formatMoney(item.personalDeduction ?? 0)} />
    <InfoRow label="Giảm trừ người phụ thuộc" value={formatMoney(item.dependentDeduction ?? 0)} />
    <View style={styles.divider} />
    <MoneyRow label="Thực nhận" value={item.netSalary} strong />
  </>;
}

function MoneyRow({ label, value, strong, chevron }: { label: string; value: number; strong?: boolean; chevron?: 'chevron-up' | 'chevron-down' }) {
  return <View style={styles.moneyRow}>
    <View style={styles.moneyLabelRow}>
      <Text style={[styles.moneyLabel, strong && styles.strong]}>{label}</Text>
      {chevron ? <AppIcon name={chevron} size={16} color={colors.muted} /> : null}
    </View>
    <Text style={[styles.moneyValue, value < 0 && styles.negative, strong && styles.strong]}>{formatMoney(value)}</Text>
  </View>;
}

function statusLabel(status: Payslip['status']) {
  return ({ GENERATED: 'Đang xử lý', RELEASED: 'Mới', VIEWED: 'Đã xem' } as Record<Payslip['status'], string>)[status];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.huge + 16, gap: spacing.md },
  summaryCard: { padding: 20, borderRadius: 20 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  summaryEyebrow: { color: colors.navySoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  summaryPeriod: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 6 },
  unreadBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#fff' },
  unreadText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  summaryLabel: { color: colors.navySoft, fontSize: 11, fontWeight: '700', marginTop: spacing.xl },
  summaryValue: { color: '#fff', fontSize: 30, lineHeight: 38, fontWeight: '800', marginTop: 3 },
  summaryMeta: { color: colors.borderLight, fontSize: 11, marginTop: spacing.xs },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  payslipCard: { gap: spacing.md },
  payslipTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  periodCopy: { flex: 1 },
  period: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  released: { color: colors.muted, fontSize: 11, marginTop: 4 },
  netRow: { padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  netLabel: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  netValue: { color: colors.primaryDark, fontSize: 18, fontWeight: '800' },
  expandHint: { color: colors.primary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  breakdown: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  moneyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  moneyLabel: { color: colors.muted, fontSize: 12 },
  moneyValue: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  negative: { color: colors.dangerText },
  strong: { color: colors.ink, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 4 },
  head: { color: colors.primaryDark, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.9, marginTop: 2 },
  group: { gap: spacing.sm },
  subRow: { paddingLeft: 12 }, subLabel: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 15 }, subValue: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.74 },
});
