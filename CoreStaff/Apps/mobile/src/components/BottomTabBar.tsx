import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, TAB_BAR_HEIGHT } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';

export type BottomTabKey = 'overview' | 'requests' | 'attendance' | 'payslips' | 'account' | 'approvals' | 'team';

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

export function BottomTabBar({ activeTab, onTabPress, badges, manager = false }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.container, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      {(manager ? MANAGER_TABS : EMPLOYEE_TABS).map(tab => {
        const active = tab.key === activeTab;
        const badge = badges?.[tab.key] || 0;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={badge ? `${tab.label}, ${badge} mới` : tab.label}
            accessibilityState={{ selected: active }}
            testID={`tab-${tab.key}`}
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            style={styles.tab}
          >
            {({ pressed }) => tab.primary ? (
              <View style={[styles.primaryWrap, pressed && styles.primaryPressed]}>
                <View style={[styles.primaryButton, active && styles.primaryButtonActive]}>
                  <AppIcon name={tab.icon} size={28} color={active ? colors.ink : '#fff'} />
                </View>
                <Text numberOfLines={1} style={[styles.label, styles.primaryLabel, active && styles.labelActive]}>{tab.label}</Text>
              </View>
            ) : (
              <View style={[styles.item, pressed && styles.itemPressed]}>
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                  <AppIcon name={active ? tab.activeIcon : tab.icon} size={22} color={active ? colors.primary : colors.faint} />
                  {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
                </View>
                <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  // Vùng chạm tối thiểu 48dp theo chiều cao cho mọi tab.
  tab: { flex: 1, height: TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  item: { alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 56, paddingVertical: 4 },
  itemPressed: { opacity: 0.6 },
  iconWrap: { width: 44, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  label: { color: colors.faint, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  labelActive: { color: colors.primary, fontWeight: '800' },
  badge: { position: 'absolute', top: -3, right: 2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  primaryWrap: { alignItems: 'center', marginTop: -30 },
  primaryPressed: { transform: [{ scale: 0.94 }] },
  primaryButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: colors.accentDark,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  primaryButtonActive: { backgroundColor: colors.accent },
  primaryLabel: { marginTop: 3, color: colors.inkSoft, fontWeight: '800' },
});
