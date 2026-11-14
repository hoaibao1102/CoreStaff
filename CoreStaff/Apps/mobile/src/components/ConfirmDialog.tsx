import { useCallback, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';
import { AppButton } from './ui';
import { AppIcon, type AppIconName } from './AppIcon';

export type ConfirmTone = 'primary' | 'danger' | 'warning';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Nhãn nút xác nhận. Bỏ qua `cancelLabel` để chỉ hiện một nút (hộp thông báo). */
  confirmLabel?: string;
  cancelLabel?: string | null;
  tone?: ConfirmTone;
  icon?: AppIconName;
  onConfirm?: () => void | Promise<void>;
}

const TONE: Record<ConfirmTone, { bg: string; fg: string; icon: AppIconName; button: 'primary' | 'danger' }> = {
  primary: { bg: colors.primarySoft, fg: colors.primaryDark, icon: 'help-circle-outline', button: 'primary' },
  danger: { bg: colors.dangerSoft, fg: colors.dangerText, icon: 'alert-circle-outline', button: 'danger' },
  warning: { bg: colors.warningSoft, fg: colors.warningText, icon: 'alert-circle-outline', button: 'primary' },
};

/** Hộp xác nhận theo giao diện app, thay cho Alert.alert mặc định của hệ điều hành. */
export function ConfirmDialog({ visible, title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', tone = 'primary', icon, loading, onConfirm, onCancel, children }: {
  visible: boolean; title: string; message: string; confirmLabel?: string; cancelLabel?: string | null; tone?: ConfirmTone; icon?: AppIconName;
  loading?: boolean; onConfirm: () => void; onCancel: () => void; children?: ReactNode;
}) {
  const look = TONE[tone];
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!loading) onCancel(); }}>
    <View style={styles.backdrop}>
      <Pressable accessibilityLabel="Đóng" style={StyleSheet.absoluteFill} disabled={loading} onPress={onCancel} />
      <View accessibilityViewIsModal style={styles.dialog}>
        <View style={[styles.iconWrap, { backgroundColor: look.bg }]}><AppIcon name={icon ?? look.icon} size={26} color={look.fg} /></View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {children}
        <View style={styles.actions}>
          {cancelLabel ? <View style={styles.flex}><AppButton label={cancelLabel} variant="secondary" disabled={loading} onPress={onCancel} /></View> : null}
          <View style={styles.flex}><AppButton label={confirmLabel} variant={look.button} loading={loading} onPress={onConfirm} /></View>
        </View>
      </View>
    </View>
  </Modal>;
}

/**
 * `const { confirm, dialog } = useConfirmDialog();` rồi render `{dialog}` trong màn;
 * `confirm({ title, message, onConfirm })` mở hộp. Hộp tự đóng khi xử lý xong và
 * giữ nút ở trạng thái "đang xử lý" nếu `onConfirm` trả về Promise.
 */
export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => { setOptions(null); setBusy(false); }, []);
  const confirm = useCallback((next: ConfirmOptions) => setOptions(next), []);
  const run = async () => {
    if (!options) return;
    if (!options.onConfirm) return close();
    setBusy(true);
    try { await options.onConfirm(); } finally { close(); }
  };
  const dialog = <ConfirmDialog
    visible={!!options}
    title={options?.title ?? ''}
    message={options?.message ?? ''}
    confirmLabel={options?.confirmLabel}
    cancelLabel={options?.cancelLabel === undefined ? 'Hủy' : options.cancelLabel}
    tone={options?.tone}
    icon={options?.icon}
    loading={busy}
    onConfirm={() => void run()}
    onCancel={close}
  />;
  return { confirm, dialog };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, alignItems: 'center', ...shadow },
  iconWrap: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: spacing.micro },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.xs, alignSelf: 'stretch', marginTop: spacing.xs },
  flex: { flex: 1 },
});
