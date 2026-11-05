import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AuthUser } from '../auth';
import { getMyProfile, type EmployeeProfile } from '../employee-api';
import { AppButton, ErrorBanner, ScreenHeader, formatDate, initialsOf } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
import { colors, radius } from '../theme';

interface AccountScreenProps {
  user: AuthUser;
  apiBase: string;
  /** Quản lý không có tab Phiếu lương riêng nên mở từ Tài khoản. */
  onOpenPayslips?: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  logoutBusy: boolean;
  logoutError?: string | null;
  realtimeRevision?: number;
}

const roleLabel = (role: string) => role === 'DEPARTMENT_MANAGER' ? 'Quản lý phòng ban' : role === 'EMPLOYEE' ? 'Nhân viên' : role === 'HR' ? 'Nhân sự (HR)' : role;
const employmentTypeLabel = (t?: string | null) => ({ FULL_TIME: 'Toàn thời gian', PART_TIME: 'Bán thời gian', INTERN: 'Thực tập', CONTRACTOR: 'Cộng tác viên' } as Record<string, string>)[t || ''] || t || '';

export function AccountScreen({ user, apiBase, onOpenPayslips, onChangePassword, onLogout, logoutBusy, logoutError }: AccountScreenProps) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  // Hồ sơ nhân sự là thông tin phụ: lỗi thì chỉ ẩn các dòng bổ sung.
  useEffect(() => { let off = false; getMyProfile(apiBase).then(p => { if (!off) setProfile(p); }).catch(() => undefined); return () => { off = true; }; }, [apiBase]);

  const rows: Array<[string, string]> = [['Email', user.email], ['Vai trò', roleLabel(user.role)]];
  if (profile) {
    for (const row of [
      ['Phòng ban', profile.departmentName || ''],
      ['Chức danh', profile.positionName || ''],
      ['Quản lý trực tiếp', profile.managerName || ''],
      ['Loại hình', employmentTypeLabel(profile.employmentType)],
      ['Ngày vào làm', profile.joinDate ? formatDate(profile.joinDate) : ''],
      ['Số điện thoại', profile.phone || ''],
    ] as Array<[string, string]>) if (row[1]) rows.push(row);
  }
  const confirmLogout = () => Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng CoreStaff?', [{ text: 'Hủy', style: 'cancel' }, { text: 'Đăng xuất', style: 'destructive', onPress: onLogout }]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <ScreenHeader eyebrow="TÀI KHOẢN" title="Hồ sơ cá nhân" description="Quản lý thông tin và bảo mật tài khoản." />
    {logoutError ? <ErrorBanner message={logoutError} /> : null}
    <View style={styles.hero}>
      <View accessibilityLabel={`Ảnh đại diện ${user.fullName}`} style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(user.fullName)}</Text></View>
      <Text style={styles.name}>{user.fullName}</Text>
      <Text style={styles.code}>{user.employeeCode || 'Chưa có mã nhân viên'}</Text>
    </View>
    <View style={styles.card}>
      {rows.map(([label, value], index) => <View key={label} style={[styles.infoRow, index > 0 && styles.infoBorder]}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>)}
    </View>
    {onOpenPayslips && user.role === 'DEPARTMENT_MANAGER' ? <Pressable accessibilityRole="button" onPress={onOpenPayslips} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}><Text style={styles.menuTitle}>Phiếu lương</Text><AppIcon name="chevron-forward" size={20} color={colors.faint} /></Pressable> : null}
    <Pressable accessibilityRole="button" onPress={onChangePassword} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}><View><Text style={styles.menuTitle}>Đổi mật khẩu</Text><Text style={styles.menuDesc}>Cập nhật thông tin bảo mật</Text></View><AppIcon name="chevron-forward" size={20} color={colors.faint} /></Pressable>
    <AppButton label="Đăng xuất" variant="danger" loading={logoutBusy} onPress={confirmLogout} />
    <Text style={styles.version}>CoreStaff Mobile · Phiên bản 0.1.0</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 56, gap: 16 },
  hero: { alignItems: 'center', paddingVertical: 8 },
  avatar: { width: 76, height: 76, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontSize: 24, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  code: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  infoBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  infoValue: { flexShrink: 1, color: colors.ink, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  menu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  menuTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' }, menuDesc: { color: colors.muted, fontSize: 12, marginTop: 3 },
  version: { color: colors.faint, fontSize: 11, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
