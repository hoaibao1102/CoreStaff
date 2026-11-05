import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { AppIcon } from './AppIcon';
import { initialsOf } from './ui';

export type Tone = 'success' | 'warning' | 'info' | 'neutral' | 'danger';

const TONES: Record<Tone, [string, string]> = {
  success: [colors.successSoft, colors.successText],
  warning: [colors.warningSoft, colors.warningText],
  info: [colors.infoSoft, colors.info],
  danger: [colors.dangerSoft, colors.dangerText],
  neutral: [colors.surfaceMuted, colors.muted],
};

/** Badge chọn màu theo tone rõ ràng (StatusBadge chung suy ra tone từ mã trạng thái nên không đủ cho nhãn HR). */
export function ToneBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const [bg, fg] = TONES[tone];
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeText, { color: fg }]}>{label}</Text></View>;
}

export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Text style={[styles.avatarText, { fontSize: size * 0.33 }]}>{initialsOf(name)}</Text></View>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <View style={styles.search}>
    <AppIcon name="search-outline" size={18} color={colors.muted} />
    <TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.faint} style={styles.searchInput} autoCapitalize="none" autoCorrect={false} />
  </View>;
}

export function FilterChips<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
    {options.map(o => {
      const selected = o.value === value;
      return <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(o.value)} style={[styles.chip, selected && styles.chipSelected]}>
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

export function SectionTitle({ children, right }: { children: string; right?: string }) {
  return <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{children}</Text>{right ? <Text style={styles.sectionRight}>{right}</Text> : null}</View>;
}

export function MetricTile({ label, value, icon, bg, fg, hint, onPress }: { label: string; value: string; icon: Parameters<typeof AppIcon>[0]['name']; bg: string; fg: string; hint?: string; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.metric, pressed && { opacity: 0.75 }]}>
    <View style={[styles.metricIcon, { backgroundColor: bg }]}><AppIcon name={icon} size={19} color={fg} /></View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
    {hint ? <Text numberOfLines={1} style={styles.metricHint}>{hint}</Text> : null}
  </Pressable>;
}

export const hrStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 32, gap: 12 },
});

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  avatar: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  searchInput: { flex: 1, minHeight: 46, color: colors.ink, fontSize: 15 },
  chips: { gap: spacing.xs, paddingRight: spacing.md },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: colors.surface },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  sectionRight: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  metric: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  metricIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  metricValue: { color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: '800' },
  metricLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: '600', marginTop: 2 },
  metricHint: { color: colors.muted, fontSize: 11, marginTop: 4 },
});
