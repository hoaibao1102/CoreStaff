import { useState, type ReactNode } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';

export function ScreenHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <View style={styles.headerRow}><View style={styles.headerCopy}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text accessibilityRole="header" style={styles.title}>{title}</Text>{description ? <Text style={styles.description}>{description}</Text> : null}</View>{action}</View>;
}

export function Card({ children, dark = false, style }: { children: ReactNode; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, dark && styles.cardDark, style]}>{children}</View>;
}

export function AppButton({ label, onPress, loading, disabled, variant = 'primary' }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger' | 'accent' }) {
  return <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, variant === 'primary' ? styles.buttonPrimary : variant === 'accent' ? styles.buttonAccent : variant === 'danger' ? styles.buttonDanger : styles.buttonSecondary, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.inkSoft} /> : <Text style={[styles.buttonText, variant === 'primary' ? styles.buttonTextPrimary : variant === 'accent' ? styles.buttonTextAccent : variant === 'danger' ? styles.buttonTextDanger : styles.buttonTextSecondary]}>{label}</Text>}</Pressable>;
}

export function Field({ label, error, required, multiline, style, ...props }: TextInputProps & { label: string; error?: string; required?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text><TextInput accessibilityLabel={props.accessibilityLabel || label} placeholderTextColor={colors.faint} multiline={multiline} style={[styles.input, multiline && styles.textarea, error && styles.inputError, style]} {...props} />{error ? <Text accessibilityRole="alert" style={styles.fieldError}>{error}</Text> : null}</View>;
}


const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Chọn ngày/giờ bằng picker native; giá trị vẫn là chuỗi 'YYYY-MM-DD' / 'HH:mm'
 * nên toàn bộ validation phía form giữ nguyên.
 */
export function DateTimeField({ label, mode, value, onChange, required, disabled, error }: { label: string; mode: 'date' | 'time'; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  const current = (() => {
    const base = new Date();
    if (mode === 'date') { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); }
    else { const m = /^(\d{2}):(\d{2})$/.exec(value); if (m) { base.setHours(Number(m[1]), Number(m[2]), 0, 0); } }
    return base;
  })();
  const handle = (event: DateTimePickerEvent, picked?: Date) => {
    setOpen(Platform.OS === 'ios');
    if (event.type !== 'set' || !picked) return;
    onChange(mode === 'date' ? `${picked.getFullYear()}-${pad(picked.getMonth() + 1)}-${pad(picked.getDate())}` : `${pad(picked.getHours())}:${pad(picked.getMinutes())}`);
  };
  const display = mode === 'date' ? formatDate(value) : value || '--:--';
  return <View style={styles.field}>
    <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${display}`} disabled={disabled} onPress={() => setOpen(true)} style={({ pressed }) => [styles.input, styles.pickerInput, error && styles.inputError, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={styles.pickerText}>{display}</Text>
      <AppIcon name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={19} color={colors.muted} />
    </Pressable>
    {error ? <Text accessibilityRole="alert" style={styles.fieldError}>{error}</Text> : null}
    {open ? <DateTimePicker value={current} mode={mode} is24Hour display={mode === 'date' ? 'default' : 'default'} onChange={handle} /> : null}
  </View>;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <View accessibilityRole="tablist" style={styles.segmented}>{options.map(option => <Pressable accessibilityRole="tab" accessibilityState={{ selected: value === option.value }} key={option.value} onPress={() => onChange(option.value)} style={({ pressed }) => [styles.segment, value === option.value && styles.segmentActive, pressed && styles.pressed]}><Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text></Pressable>)}</View>;
}

export function StatusBadge({ status, label, tone: forced }: { status: string; label?: string; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }) {
  const tone = forced ?? (status.includes('REJECT') || status.includes('TERMINAT') ? 'danger' : status.includes('PENDING') || status.includes('CLARIFICATION') || status === 'GENERATED' ? 'warning' : status === 'CHECKED_IN' || status === 'RELEASED' ? 'info' : status === 'ACTIVE' || status === 'COMPLETED' || status.includes('APPROVED') || status.includes('APPLIED') || status === 'VIEWED' ? 'success' : 'neutral');
  return <View style={[styles.badge, tone === 'info' && styles.badgeInfo, tone === 'success' && styles.badgeSuccess, tone === 'warning' && styles.badgeWarning, tone === 'danger' && styles.badgeDanger]}><Text style={[styles.badgeText, tone === 'info' && styles.badgeTextInfo, tone === 'success' && styles.badgeTextSuccess, tone === 'warning' && styles.badgeTextWarning, tone === 'danger' && styles.badgeTextDanger]}>{label || status}</Text></View>;
}

export function ErrorBanner({ message }: { message: string }) { return <View accessibilityRole="alert" style={[styles.error, styles.bannerRow]}><AppIcon name="alert-circle-outline" size={18} color={colors.dangerText} /><Text style={[styles.errorText, styles.bannerText]}>{message}</Text></View>; }
export function SuccessBanner({ message }: { message: string }) { return <View accessibilityRole="alert" style={[styles.success, styles.bannerRow]}><AppIcon name="checkmark-circle-outline" size={18} color={colors.successText} /><Text style={[styles.successText, styles.bannerText]}>{message}</Text></View>; }
/** Thông báo tiến trình (không phải lỗi), vd. "Đang kiểm tra vị trí GPS…". */
export function NoticeBanner({ message }: { message: string }) { return <View accessibilityRole="alert" style={[styles.notice, styles.bannerRow]}><AppIcon name="information-circle-outline" size={18} color={colors.info} /><Text style={[styles.noticeText, styles.bannerText]}>{message}</Text></View>; }
export function SectionTitle({ children }: { children: ReactNode }) { return <Text accessibilityRole="header" style={styles.sectionTitle}>{children}</Text>; }
export function LoadingBlock({ label = 'Đang tải dữ liệu…' }: { label?: string }) { return <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>{label}</Text></View>; }
export function EmptyState({ icon, title, description }: { icon: AppIconName; title: string; description: string }) { return <Card style={styles.empty}><View style={styles.emptySymbol}><AppIcon name={icon} size={26} color={colors.primaryDark} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDescription}>{description}</Text></Card>; }
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <Card style={styles.empty}><View style={[styles.emptySymbol, styles.errorSymbol]}><Text style={styles.errorSymbolText}>!</Text></View><Text style={styles.emptyTitle}>Chưa tải được dữ liệu</Text><Text style={styles.emptyDescription}>{message}</Text><AppButton label="Thử lại" variant="secondary" onPress={onRetry} /></Card>; }
export function formatTime(value?: string | null) { if (!value) return '--:--'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }); }
export function formatDate(value?: string | null) { if (!value) return '-'; const raw = value.slice(0, 10); const parts = raw.split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value; }
/** 125 -> "2 giờ 5 phút", 40 -> "40 phút", 120 -> "2 giờ", null -> "-". */
export function formatMinutes(value?: number | null) { if (value == null) return '-'; const total = Math.max(0, Math.round(value)); const hours = Math.floor(total / 60); const minutes = total % 60; if (!hours) return `${minutes} phút`; return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`; }
/** "2026-09" -> "09/2026"; giá trị khác định dạng giữ nguyên. */
export function formatPeriod(value?: string | null) { const m = /^(\d{4})-(\d{2})$/.exec(value || ''); return m ? `${m[2]}/${m[1]}` : value || '-'; }
/** "Ca hành chính (08:00 - 17:00)" -> "Ca hành chính" (giờ đã có dòng riêng). */
export function shiftTitle(name?: string | null, fallback = '') { const t = (name || '').replace(/\s*\(.*\)\s*$/, '').trim(); return t || fallback; }
export function formatDateTime(value?: string | null) { return value ? `${formatTime(value)} ${formatDate(new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }))}` : '-'; }
export function todayKey() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); }
export function initialsOf(fullName?: string | null) { const parts = (fullName || '').trim().split(/\s+/).filter(p => /^\p{L}/u.test(p)); if (!parts.length) return 'NV'; if (parts.length === 1) return parts[0][0].toUpperCase(); return parts.slice(-2).map(p => p[0].toUpperCase()).join(''); }
export function formatMoney(value?: number | null) { const v = Math.round(value || 0); return `${v < 0 ? '-' : ''}${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`; }

const styles = StyleSheet.create({
  bannerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, bannerText: { flex: 1, fontWeight: '600' }, notice: { borderWidth: 1, borderColor: colors.infoBorder, backgroundColor: colors.infoSoft, borderRadius: radius.md, padding: spacing.sm }, noticeText: { color: colors.info, fontSize: 13, lineHeight: 19 }, sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, headerCopy: { flex: 1 }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 7 }, title: { color: colors.ink, fontSize: 26, lineHeight: 33, fontWeight: '800' }, description: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }, cardDark: { backgroundColor: colors.navy, borderColor: colors.navy },
  button: { minHeight: 50, borderRadius: radius.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, buttonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary }, buttonAccent: { backgroundColor: colors.accent, borderColor: colors.accent }, buttonTextAccent: { color: colors.ink }, buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.borderLight }, buttonDanger: { backgroundColor: colors.surface, borderColor: colors.borderDanger }, buttonText: { fontSize: 14, fontWeight: '800' }, buttonTextPrimary: { color: '#fff' }, buttonTextSecondary: { color: colors.inkSoft }, buttonTextDanger: { color: colors.danger }, disabled: { opacity: 0.52 }, pressed: { opacity: 0.76 },
  field: { flex: 1, gap: 7 }, label: { color: colors.inkSoft, fontSize: 13, fontWeight: '700' }, required: { color: colors.danger }, input: { minHeight: 50, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.surface, color: colors.ink, fontSize: 15 }, inputError: { borderColor: colors.danger }, pickerInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pickerText: { color: colors.ink, fontSize: 15, fontWeight: '600' }, textarea: { minHeight: 96, paddingTop: 13, textAlignVertical: 'top' }, fieldError: { color: colors.dangerText, fontSize: 12, lineHeight: 16 },
  segmented: { flexDirection: 'row', gap: 3, padding: 3, backgroundColor: '#e8edf5', borderRadius: radius.md }, segment: { flex: 1, minHeight: 44, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, segmentActive: { backgroundColor: colors.surface, ...shadow }, segmentText: { color: colors.muted, fontSize: 13, fontWeight: '700' }, segmentTextActive: { color: colors.primaryDark },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.surfaceMuted }, badgeInfo: { backgroundColor: colors.infoSoft }, badgeSuccess: { backgroundColor: colors.successSoft }, badgeWarning: { backgroundColor: colors.warningSoft }, badgeDanger: { backgroundColor: colors.dangerSoft }, badgeText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, badgeTextInfo: { color: colors.info }, badgeTextSuccess: { color: colors.successText }, badgeTextWarning: { color: colors.warningText }, badgeTextDanger: { color: colors.dangerText },
  error: { borderWidth: 1, borderColor: colors.borderDanger, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.sm }, errorText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 }, success: { borderWidth: 1, borderColor: colors.successBorder, backgroundColor: colors.successSoft, borderRadius: radius.md, padding: spacing.sm }, successText: { color: colors.successText, fontSize: 13, lineHeight: 19 },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, loadingText: { color: colors.muted, fontSize: 13 }, empty: { minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 24 }, emptySymbol: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, errorSymbol: { backgroundColor: colors.dangerSoft }, errorSymbolText: { color: colors.danger, fontSize: 22, fontWeight: '800' }, emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' }, emptyDescription: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md, maxWidth: 280 },
});
