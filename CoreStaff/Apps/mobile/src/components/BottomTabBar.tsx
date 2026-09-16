import { Pressable, StyleSheet, Text, View } from 'react-native';

export type BottomTabKey = 'overview' | 'attendance' | 'requests' | 'account';

interface BottomTabItem {
  key: BottomTabKey;
  label: string;
  icon: string;
}

interface BottomTabBarProps {
  activeTab: BottomTabKey;
  onTabPress: (tab: BottomTabKey) => void;
}

const TABS: BottomTabItem[] = [
  { key: 'overview', label: 'Tổng quan', icon: '⌂' },
  { key: 'attendance', label: 'Chấm công', icon: '◷' },
  { key: 'requests', label: 'Đơn từ', icon: '▤' },
  { key: 'account', label: 'Tài khoản', icon: '○' },
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
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 68,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 5,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    shadowColor: '#0f172a',
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
  iconWrap: {
    width: 32,
    height: 25,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: '#dbeafe' },
  icon: { color: '#64748b', fontSize: 20, lineHeight: 22, fontWeight: '700' },
  iconActive: { color: '#2563eb' },
  label: { color: '#64748b', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  labelActive: { color: '#1d4ed8', fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
