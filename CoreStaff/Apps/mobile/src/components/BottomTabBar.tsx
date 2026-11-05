import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';

export type BottomTabKey = 'overview' | 'requests' | 'attendance' | 'payslips' | 'account' | 'approvals' | 'team' | 'employees' | 'leaves' | 'contracts';

interface BottomTabItem {
  key: BottomTabKey;
  label: string;
  icon: AppIconName;
  activeIcon: AppIconName;
  primary?: boolean;
}

interface BottomTabBarProps {
  activeTab: BottomTabKey;
  onTabPress: (tab: BottomTabKey) => void;
  /** Chấm đỏ nhỏ trên tab (vd. số đơn chờ duyệt). */
  badges?: Partial<Record<BottomTabKey, number>>;
  /** Quản lý phòng ban có bộ tab riêng nhưng vẫn giữ 5 tab và tab Chấm công ở giữa. */
  manager?: boolean;
  /** HR: tab giữa là Nghỉ phép. */
  hr?: boolean;
}

/** 5 tab (số lẻ): tab giữa là hành động cốt lõi — Chấm công — nổi lên trên thanh. */
export const EMPLOYEE_TABS: BottomTabItem[] = [
  { key: 'overview', label: 'Tổng quan', icon: 'home-outline', activeIcon: 'home' },
  { key: 'requests', label: 'Đơn từ', icon: 'document-text-outline', activeIcon: 'document-text' },
  { key: 'attendance', label: 'Chấm công', icon: 'finger-print', activeIcon: 'finger-print', primary: true },
  { key: 'payslips', label: 'Phiếu lương', icon: 'wallet-outline', activeIcon: 'wallet' },
  { key: 'account', label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
];

/** Quản lý: Duyệt đơn và Phòng ban thay cho Đơn từ và Phiếu lương (hai mục này nằm trong Duyệt đơn / Tài khoản). */
export const MANAGER_TABS: BottomTabItem[] = [
  { key: 'overview', label: 'Tổng quan', icon: 'home-outline', activeIcon: 'home' },
  { key: 'approvals', label: 'Duyệt đơn', icon: 'checkmark-done-outline', activeIcon: 'checkmark-done' },
  { key: 'attendance', label: 'Chấm công', icon: 'finger-print', activeIcon: 'finger-print', primary: true },
  { key: 'team', label: 'Phòng ban', icon: 'people-outline', activeIcon: 'people' },
  { key: 'account', label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
];

/** HR: tab giữa là Nghỉ phép, việc HR phải xử lý thường xuyên nhất (áp dụng đơn). */
export const HR_TABS: BottomTabItem[] = [
  { key: 'overview', label: 'Tổng quan', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'employees', label: 'Nhân viên', icon: 'people-outline', activeIcon: 'people' },
  { key: 'leaves', label: 'Nghỉ phép', icon: 'calendar-outline', activeIcon: 'calendar', primary: true },
  { key: 'contracts', label: 'Hợp đồng', icon: 'document-text-outline', activeIcon: 'document-text' },
  { key: 'account', label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
];

const BAR_HEIGHT = 68;
const LIFT = 26; // phần nút giữa nhô lên khỏi thanh
const BUTTON = 66;

export function BottomTabBar({ activeTab, onTabPress, badges, manager = false, hr = false }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabs = hr ? HR_TABS : manager ? MANAGER_TABS : EMPLOYEE_TABS;
  return (
    <View accessibilityRole="tablist" style={{ height: BAR_HEIGHT + LIFT + insets.bottom }}>
      <View style={[styles.bar, { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
        {tabs.map(tab => {
          const active = tab.key === activeTab;
          const badge = badges?.[tab.key] || 0;
          const color = active ? colors.primaryDark : colors.muted;
          if (tab.primary) {
            return <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={badge ? `${tab.label}, ${badge} mới` : tab.label} accessibilityState={{ selected: active }} testID={`tab-${tab.key}`} onPress={() => onTabPress(tab.key)} style={styles.slot}>
              <Text numberOfLines={1} style={[styles.primaryLabel, { color: active ? colors.primaryDark : colors.inkSoft }]}>{tab.label}</Text>
            </Pressable>;
          }
          return <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={badge ? `${tab.label}, ${badge} mới` : tab.label} accessibilityState={{ selected: active }} testID={`tab-${tab.key}`} onPress={() => onTabPress(tab.key)} style={styles.tab}>
            <View style={styles.iconWrap}>
              {/* View riêng, mount mới khi chọn tab: Android làm mất bo góc nếu chỉ đổi màu nền. */}
              {active ? <View key="pill" style={styles.pill} /> : null}
              <AppIcon name={active ? tab.activeIcon : tab.icon} size={22} color={color} />
              {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
            </View>
            <Text numberOfLines={1} style={[styles.label, { color, fontWeight: active ? '800' : '700' }]}>{tab.label}</Text>
          </Pressable>;
        })}
      </View>
      {/* Nút giữa đứng độc lập phía trên thanh để bắt chạm chính xác. */}
      <View pointerEvents="box-none" style={styles.floatRow}>
        {tabs.map(tab => {
          if (!tab.primary) return <View key={tab.key} pointerEvents="none" style={styles.floatCell} />;
          const active = tab.key === activeTab;
          const badge = badges?.[tab.key] || 0;
          return <View key={tab.key} pointerEvents="box-none" style={styles.floatCell}>
            <Pressable accessibilityRole="button" accessibilityLabel={tab.label} onPress={() => onTabPress(tab.key)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: active ? colors.primaryDark : colors.primary, shadowOpacity: active ? 0.55 : 0.38, shadowRadius: active ? 22 : 16 }, pressed && styles.primaryPressed]}>
              <View style={styles.primaryGlow} />
              <AppIcon name={tab.activeIcon} size={32} color={colors.surface} />
              {badge ? <View style={styles.primaryBadge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
            </Pressable>
          </View>;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderTopColor: colors.border,
    shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  tab: { flex: 1, height: BAR_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  slot: { flex: 1, height: BAR_HEIGHT, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 9 },
  iconWrap: { width: 44, height: 28, borderRadius: 14, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, backgroundColor: colors.primarySoft },
  label: { fontSize: 10.5, lineHeight: 14, marginTop: 3 },
  primaryLabel: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  badge: { position: 'absolute', top: -4, right: 0, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.surface, fontSize: 9, fontWeight: '800' },
  floatRow: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row' },
  floatCell: { flex: 1, alignItems: 'center' },
  primaryButton: {
    width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 5, borderColor: colors.surface,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    overflow: 'visible',
  },
  primaryPressed: { transform: [{ scale: 0.95 }] },
  // Không có expo-linear-gradient: một mảng sáng góc trên-trái mô phỏng dải chuyển màu.
  primaryGlow: { position: 'absolute', top: 0, left: 0, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, opacity: 0.14 },
  primaryBadge: { position: 'absolute', top: -7, right: -7, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
});
