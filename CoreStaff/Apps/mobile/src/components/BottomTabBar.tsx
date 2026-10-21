import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';

export type BottomTabKey = 'overview' | 'requests' | 'attendance' | 'payslips' | 'account';

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
}

const TABS: BottomTabItem[] = [
  { key: 'overview', label: 'Tổng quan', icon: 'home-outline', activeIcon: 'home' },
  { key: 'requests', label: 'Đơn từ', icon: 'document-text-outline', activeIcon: 'document-text' },
  { key: 'attendance', label: 'Chấm công', icon: 'finger-print-outline', activeIcon: 'finger-print', primary: true },
  { key: 'payslips', label: 'Phiếu lương', icon: 'wallet-outline', activeIcon: 'wallet' },
  { key: 'account', label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
];

/** Thanh điều hướng chính, dùng bên trong SafeAreaView của khu vực đã đăng nhập. */
export function BottomTabBar({ activeTab, onTabPress }: BottomTabBarProps) {
  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {TABS.map(tab => {
        const active = tab.key === activeTab;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            hitSlop={4}
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            style={({ pressed }) => [styles.tab, tab.primary && styles.primaryTab, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, tab.primary && styles.primaryIconWrap, active && styles.iconWrapActive, tab.primary && active && styles.primaryIconWrapActive]}>
              <AppIcon
                name={active ? tab.activeIcon : tab.icon}
                size={tab.primary ? 27 : 22}
                color={tab.primary ? '#fff' : active ? colors.primary : colors.muted}
              />
            </View>
            <Text numberOfLines={1} style={[styles.label, tab.primary && styles.primaryLabel, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 76,
    paddingHorizontal: spacing.xs,
    paddingTop: 9,
    paddingBottom: 5,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  primaryTab: { overflow: 'visible' },
  iconWrap: {
    width: 32,
    height: 25,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  primaryIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginTop: -26,
    backgroundColor: colors.navy,
    borderWidth: 5,
    borderColor: colors.surface,
    shadowColor: colors.navy,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  primaryIconWrapActive: { backgroundColor: colors.primary },
  label: { color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  primaryLabel: { marginTop: -2, color: colors.inkSoft, fontWeight: '800' },
  labelActive: { color: colors.primaryDark, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
