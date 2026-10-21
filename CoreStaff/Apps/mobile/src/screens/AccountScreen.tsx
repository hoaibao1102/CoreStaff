import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AuthUser } from '../auth';
import { friendlyEmployeeError, getMyPayslips, getMyProfile, markPayslipViewed, type EmployeeProfile, type Payslip } from '../employee-api';
import { AppButton, Card, EmptyState, ErrorBanner, LoadingBlock, ScreenHeader, StatusBadge, formatDate, formatMoney } from '../components/ui';
import { colors, radius, spacing } from '../theme';
import { AppIcon, type AppIconName } from '../components/AppIcon';

type AccountView = 'profile' | 'payslips';

export function AccountScreen({ user, apiBase, onOpenPayslips, onChangePassword, onLogout, logoutBusy, logoutError, realtimeRevision = 0 }: { user: AuthUser; apiBase: string; onOpenPayslips: () => void; onChangePassword: () => void; onLogout: () => void; logoutBusy: boolean; logoutError?: string | null; realtimeRevision?: number }) {
  const [view, setView] = useState<AccountView>('profile');
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError(null);
    const [profileResult, payslipResult] = await Promise.allSettled([getMyProfile(apiBase), getMyPayslips(apiBase)]);
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
    if (payslipResult.status === 'fulfilled') setPayslips(payslipResult.value || []);
    const failure = profileResult.status === 'rejected' ? profileResult.reason : payslipResult.status === 'rejected' ? payslipResult.reason : null;
    if (failure) setError(friendlyEmployeeError(failure));
    setLoading(false); setRefreshing(false);
  }, [apiBase, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);
  const initials = user.fullName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();
  const openPayslip = async (item: Payslip) => { setExpanded(expanded === item._id ? null : item._id); if (item.status === 'RELEASED') { try { await markPayslipViewed(apiBase, item._id); setPayslips(rows => rows.map(row => row._id === item._id ? { ...row, status: 'VIEWED' } : row)); } catch { /* Reading still works when the audit call is unavailable. */ } } };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    {view === 'profile' ? <>
      <ScreenHeader eyebrow="TÀI KHOẢN" title="Hồ sơ cá nhân" description="Thông tin công việc và bảo mật tài khoản." />
      {error ? <ErrorBanner message={error} /> : null}{logoutError ? <ErrorBanner message={logoutError} /> : null}{loading ? <LoadingBlock /> : <>
        <View style={styles.hero}><View style={styles.avatar}><Text style={styles.avatarText}>{initials || 'NV'}</Text></View><Text style={styles.name}>{profile?.fullName || user.fullName}</Text><Text style={styles.code}>{profile?.employeeCode || user.employeeCode || 'Chưa có mã nhân viên'}</Text><StatusBadge status={profile?.employmentStatus || user.status} label={employmentStatus(profile?.employmentStatus || user.status)} /></View>
        <Card style={styles.infoCard}><InfoRow label="Phòng ban" value={profile?.departmentName || 'Chưa cập nhật'} /><Divider /><InfoRow label="Chức danh" value={profile?.positionName || 'Chưa cập nhật'} /><Divider /><InfoRow label="Quản lý trực tiếp" value={profile?.managerName || 'Chưa cập nhật'} /><Divider /><InfoRow label="Nơi làm việc" value={profile?.workplaceName || 'Chưa cập nhật'} /><Divider /><InfoRow label="Ngày vào làm" value={formatDate(profile?.joinDate)} /></Card>
        <Text style={styles.sectionTitle}>Tiện ích cá nhân</Text>
        <MenuRow icon="wallet-outline" title="Phiếu lương" description={`${payslips.length} kỳ lương đã phát hành`} badge={payslips.filter(item => item.status === 'RELEASED').length} onPress={onOpenPayslips} />
        <MenuRow icon="lock-closed-outline" title="Đổi mật khẩu" description="Cập nhật thông tin bảo mật" onPress={onChangePassword} />
        <Card style={styles.contactCard}><Text style={styles.contactTitle}>Thông tin liên hệ</Text><InfoRow label="Email" value={profile?.email || user.email} /><Divider /><InfoRow label="Số điện thoại" value={profile?.phone || 'Chưa cập nhật'} /><Divider /><InfoRow label="Địa chỉ" value={profile?.address || 'Chưa cập nhật'} /></Card>
        <AppButton label="Đăng xuất" variant="danger" loading={logoutBusy} onPress={onLogout} />
      </>}
    </> : <>
      <View style={styles.backHeader}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại hồ sơ" onPress={() => setView('profile')} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Text style={styles.backText}>‹</Text></Pressable><ScreenHeader eyebrow="THU NHẬP" title="Phiếu lương" description="Chi tiết các kỳ lương đã phát hành." /></View>
      {!payslips.length ? <EmptyState icon="wallet-outline" title="Chưa có phiếu lương" description="Phiếu lương sẽ xuất hiện khi HR phát hành kỳ lương." /> : payslips.map(item => { const isExpanded = expanded === item._id; return <Pressable key={item._id} accessibilityRole="button" accessibilityState={{ expanded: isExpanded }} accessibilityLabel={`Phiếu lương kỳ ${item.periodLabel}`} onPress={() => void openPayslip(item)} style={({ pressed }) => pressed && styles.pressed}><Card style={styles.payslipCard}><View style={styles.payslipTop}><View><Text style={styles.period}>Kỳ {item.periodLabel}</Text><Text style={styles.released}>{item.releasedAt ? `Phát hành ${formatDate(item.releasedAt)}` : 'Chưa phát hành'}</Text></View><StatusBadge status={item.status} label={payslipStatus(item.status)} /></View><View style={styles.netRow}><Text style={styles.netLabel}>Thực nhận</Text><Text style={styles.netValue}>{formatMoney(item.netSalary)}</Text></View>{isExpanded ? <View style={styles.breakdown}><MoneyRow label="Tổng thu nhập" value={item.grossEarnings} /><MoneyRow label="Bảo hiểm" value={-(item.socialInsurance + item.healthInsurance + item.unemploymentInsurance)} /><MoneyRow label="Thuế TNCN" value={-item.pitAmount} /><MoneyRow label="Khấu trừ khác" value={-item.otherDeductions} /><View style={styles.breakDivider} /><MoneyRow label="Thực nhận" value={item.netSalary} strong /></View> : <Text style={styles.expandHint}>Chạm để xem chi tiết</Text>}</Card></Pressable>; })}
    </>}
  </ScrollView>;
}

function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function Divider() { return <View style={styles.divider} />; }
function MenuRow({ icon, title, description, badge, onPress }: { icon: AppIconName; title: string; description: string; badge?: number; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}><View style={styles.menuIcon}><AppIcon name={icon} size={20} color={colors.primaryDark} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuDescription}>{description}</Text></View>{badge ? <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{badge}</Text></View> : null}<AppIcon name="chevron-forward" size={20} color={colors.faint} /></Pressable>; }
function MoneyRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <View style={styles.moneyRow}><Text style={[styles.moneyLabel, strong && styles.strong]}>{label}</Text><Text style={[styles.moneyValue, value < 0 && styles.negative, strong && styles.strong]}>{formatMoney(value)}</Text></View>; }
function employmentStatus(status?: string) { return ({ ACTIVE: 'Đang làm việc', PROBATION: 'Thử việc', ON_LEAVE: 'Đang nghỉ phép', RESIGNED: 'Đã nghỉ việc', TERMINATED: 'Đã chấm dứt' } as Record<string, string>)[status || ''] || 'Đang hoạt động'; }
function payslipStatus(status: Payslip['status']) { return ({ GENERATED: 'Đang xử lý', RELEASED: 'Mới', VIEWED: 'Đã xem' } as Record<Payslip['status'], string>)[status]; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.huge, gap: spacing.md }, hero: { alignItems: 'center', paddingVertical: spacing.sm, gap: 5 }, avatar: { width: 78, height: 78, borderRadius: 25, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs }, avatarText: { color: colors.primaryDark, fontSize: 25, fontWeight: '800' }, name: { color: colors.ink, fontSize: 21, fontWeight: '800' }, code: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs }, infoCard: { paddingHorizontal: spacing.md, paddingVertical: 0 }, infoRow: { paddingVertical: 13 }, infoLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginBottom: 4 }, infoValue: { color: colors.ink, fontSize: 13, fontWeight: '700' }, divider: { height: 1, backgroundColor: colors.divider }, sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 4 },
  menu: { minHeight: 72, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, menuIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, menuCopy: { flex: 1 }, menuTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' }, menuDescription: { color: colors.muted, fontSize: 11, marginTop: 3 }, menuBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, menuBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' }, pressed: { opacity: 0.75 }, contactCard: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs }, contactTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', paddingTop: spacing.sm },
  backHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.ink, fontSize: 27, lineHeight: 30 }, payslipCard: { gap: spacing.md }, payslipTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, period: { color: colors.ink, fontSize: 16, fontWeight: '800' }, released: { color: colors.muted, fontSize: 10, marginTop: 4 }, netRow: { padding: spacing.md, backgroundColor: colors.navy, borderRadius: radius.md }, netLabel: { color: colors.navySoft, fontSize: 10, fontWeight: '800' }, netValue: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 5 }, expandHint: { color: colors.primary, fontSize: 11, fontWeight: '700', textAlign: 'center' }, breakdown: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }, moneyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }, moneyLabel: { color: colors.muted, fontSize: 12 }, moneyValue: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' }, negative: { color: colors.dangerText }, strong: { color: colors.ink, fontWeight: '800' }, breakDivider: { height: 1, backgroundColor: colors.divider },
});
