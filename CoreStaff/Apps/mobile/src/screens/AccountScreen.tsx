import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AuthUser } from '../auth';
import { friendlyEmployeeError, getMyPayslips, getMyProfile, type EmployeeProfile } from '../employee-api';
import { AppButton, Card, ErrorBanner, LoadingBlock, ScreenHeader, StatusBadge, formatDate } from '../components/ui';
import { colors, radius, spacing } from '../theme';
import { AppIcon, type AppIconName } from '../components/AppIcon';

interface AccountScreenProps {
  user: AuthUser;
  apiBase: string;
  onOpenPayslips: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  logoutBusy: boolean;
  logoutError?: string | null;
  realtimeRevision?: number;
}

export function AccountScreen({ user, apiBase, onOpenPayslips, onChangePassword, onLogout, logoutBusy, logoutError, realtimeRevision = 0 }: AccountScreenProps) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError(null);
    const [profileResult, payslipResult] = await Promise.allSettled([getMyProfile(apiBase), getMyPayslips(apiBase)]);
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
    if (payslipResult.status === 'fulfilled') setUnread((payslipResult.value || []).filter(item => item.status === 'RELEASED').length);
    const failure = profileResult.status === 'rejected' ? profileResult.reason : payslipResult.status === 'rejected' ? payslipResult.reason : null;
    if (failure) setError(friendlyEmployeeError(failure));
    setLoading(false); setRefreshing(false);
  }, [apiBase, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);

  const initials = user.fullName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <ScreenHeader title="Tài khoản" />
    {error ? <ErrorBanner message={error} /> : null}
    {logoutError ? <ErrorBanner message={logoutError} /> : null}
    {loading ? <LoadingBlock /> : <>
      <View style={styles.hero}>
        <View accessibilityLabel={`Ảnh đại diện ${user.fullName}`} style={styles.avatar}><Text style={styles.avatarText}>{initials || 'NV'}</Text></View>
        <Text style={styles.name}>{profile?.fullName || user.fullName}</Text>
        <Text style={styles.code}>{profile?.employeeCode || user.employeeCode || 'Chưa có mã nhân viên'}</Text>
        <View><StatusBadge status={profile?.employmentStatus || user.status} label={employmentStatus(profile?.employmentStatus || user.status)} /></View>
      </View>

      <Text style={styles.sectionTitle}>Công việc</Text>
      <Card style={styles.group}>
        <InfoRow icon="business-outline" label="Phòng ban" value={profile?.departmentName || 'Chưa cập nhật'} />
        <InfoRow icon="briefcase-outline" label="Chức danh" value={profile?.positionName || 'Chưa cập nhật'} />
        <InfoRow icon="people-outline" label="Quản lý trực tiếp" value={profile?.managerName || 'Chưa cập nhật'} />
        <InfoRow icon="location-outline" label="Nơi làm việc" value={profile?.workplaceName || 'Chưa cập nhật'} />
        <InfoRow icon="calendar-outline" label="Ngày vào làm" value={formatDate(profile?.joinDate)} last />
      </Card>

      <Text style={styles.sectionTitle}>Liên hệ</Text>
      <Card style={styles.group}>
        <InfoRow icon="mail-outline" label="Email" value={profile?.email || user.email} />
        <InfoRow icon="call-outline" label="Số điện thoại" value={profile?.phone || 'Chưa cập nhật'} />
        <InfoRow icon="home-outline" label="Địa chỉ" value={profile?.address || 'Chưa cập nhật'} last />
      </Card>

      <Text style={styles.sectionTitle}>Tiện ích</Text>
      <View style={styles.menuGroup}>
        <MenuRow icon="wallet-outline" title="Phiếu lương" description="Xem các kỳ lương đã phát hành" badge={unread} onPress={onOpenPayslips} />
        <MenuRow icon="lock-closed-outline" title="Đổi mật khẩu" description="Cập nhật thông tin bảo mật" onPress={onChangePassword} last />
      </View>

      <AppButton label="Đăng xuất" variant="danger" loading={logoutBusy} onPress={onLogout} />
    </>}
  </ScrollView>;
}

function InfoRow({ icon, label, value, last }: { icon: AppIconName; label: string; value: string; last?: boolean }) {
  return <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
    <AppIcon name={icon} size={18} color={colors.muted} />
    <View style={styles.infoCopy}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>
  </View>;
}

function MenuRow({ icon, title, description, badge, onPress, last }: { icon: AppIconName; title: string; description: string; badge?: number; onPress: () => void; last?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menu, !last && styles.menuBorder, pressed && styles.pressed]}>
    <View style={styles.menuIcon}><AppIcon name={icon} size={20} color={colors.primary} /></View>
    <View style={styles.menuCopy}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuDescription}>{description}</Text></View>
    {badge ? <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{badge}</Text></View> : null}
    <AppIcon name="chevron-forward" size={18} color={colors.faint} />
  </Pressable>;
}

function employmentStatus(status?: string) { return ({ ACTIVE: 'Đang làm việc', PROBATION: 'Thử việc', ON_LEAVE: 'Đang nghỉ phép', RESIGNED: 'Đã nghỉ việc', TERMINATED: 'Đã chấm dứt' } as Record<string, string>)[status || ''] || 'Đang hoạt động'; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.huge + 16, gap: spacing.md },
  hero: { alignItems: 'center', paddingVertical: spacing.sm, gap: 6 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  avatarText: { color: colors.primary, fontSize: 28, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  code: { color: colors.muted, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: spacing.xs },
  group: { paddingHorizontal: spacing.md, paddingVertical: 0 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoCopy: { flex: 1 },
  infoLabel: { color: colors.muted, fontSize: 12, marginBottom: 2 },
  infoValue: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  menuGroup: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
  menu: { minHeight: 64, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1 },
  menuTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  menuDescription: { color: colors.muted, fontSize: 12, marginTop: 2 },
  menuBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  menuBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
