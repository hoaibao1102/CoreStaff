import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { changePassword, forgotPassword, friendlyAuthError, login, resetPassword, type AuthUser } from '../auth';
import { AppButton, ErrorBanner, NoticeBanner, SuccessBanner } from '../components/ui';
import { colors, radius, spacing } from '../theme';

/** Logo CoreStaff: ô vuông xanh chữ "C" + tên thương hiệu (khớp widgets/app_logo.dart). */
export function Logo({ large = false }: { large?: boolean }) {
  return <View style={styles.logoRow}>
    <View style={[styles.logoMark, large && styles.logoMarkLarge]}><Text style={[styles.logoLetter, large && styles.logoLetterLarge]}>C</Text></View>
    <Text style={[styles.brand, large && styles.brandLarge]}>CoreStaff</Text>
  </View>;
}

function AuthLayout({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.logoWrap}><Logo /></View>
        <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.card}>{children}</View>
        <Text style={styles.note}>Phiên đăng nhập được tự động làm mới khi bạn còn dùng; dừng quá 14 ngày thì cần đăng nhập lại.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** Ô nhập khớp widgets/fields.dart: nhãn bên trái, nút "Hiện/Ẩn" bên phải nhãn, ô cao 50. */
function AuthField({ label, secure, ...props }: TextInputProps & { label: string; secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  const enabled = props.editable !== false;
  return <View>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {secure ? <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'} disabled={!enabled} hitSlop={8} onPress={() => setHidden(value => !value)} style={styles.action}><Text style={styles.actionText}>{hidden ? 'Hiện' : 'Ẩn'}</Text></Pressable> : null}
    </View>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.faint} style={[styles.input, !enabled && styles.inputDisabled]} secureTextEntry={secure ? hidden : false} {...props} />
  </View>;
}

export function LoginScreen({ apiBase, onAuthenticated, onForgot, onReset }: { apiBase: string; onAuthenticated: (user: AuthUser, forced: boolean) => void; onForgot: () => void; onReset: () => void }) {
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!identifier.trim() || !password) return setError('Vui lòng nhập email/mã nhân viên và mật khẩu.');
    setBusy(true); setError(null);
    try { const result = await login(apiBase, identifier.trim(), password); onAuthenticated(result.user, result.mustChangePassword); }
    catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); }
  };
  return <AuthLayout eyebrow="Ứng dụng nhân viên" title="Chào mừng trở lại" description="Đăng nhập để theo dõi công việc và tài khoản của bạn.">
    {error ? <ErrorBanner message={error} /> : null}
    <AuthField label="Email hoặc mã nhân viên" value={identifier} onChangeText={setIdentifier} placeholder="VD: NV-0248" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} returnKeyType="next" />
    <AuthField label="Mật khẩu" secure value={password} onChangeText={setPassword} placeholder="Nhập mật khẩu" editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} />
    <Pressable accessibilityRole="button" disabled={busy} onPress={onForgot} style={styles.forgot}><Text style={styles.forgotText}>Quên mật khẩu?</Text></Pressable>
    <View style={styles.gapTop}><AppButton label="Đăng nhập" loading={busy} disabled={busy} onPress={() => void submit()} /></View>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onReset} style={styles.resetLink}><Text style={styles.resetText}>Bạn đã có mã đặt lại mật khẩu?</Text></Pressable>
  </AuthLayout>;
}

export function ForgotScreen({ apiBase, onBack, onReset }: { apiBase: string; onBack: () => void; onReset: () => void }) {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [sent, setSent] = useState(false);
  const submit = async () => { if (!email.trim()) return setError('Vui lòng nhập email đăng nhập.'); setBusy(true); setError(null); try { await forgotPassword(apiBase, email.trim()); setSent(true); } catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); } };
  return <AuthLayout eyebrow="Khôi phục tài khoản" title="Quên mật khẩu" description="Nếu tài khoản tồn tại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.">
    {error ? <ErrorBanner message={error} /> : null}
    {sent ? <>
      <SuccessBanner message="Yêu cầu đã được tiếp nhận. Hãy kiểm tra email của bạn." />
      <View style={styles.gapTop}><AppButton label="Nhập mã đặt lại" onPress={onReset} /></View>
    </> : <>
      <AuthField label="Email đăng nhập" value={email} onChangeText={setEmail} placeholder="ten@congty.vn" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} />
      <View style={styles.gapTop}><AppButton label="Gửi hướng dẫn" loading={busy} disabled={busy} onPress={() => void submit()} /></View>
    </>}
    <AppButton label="Quay lại đăng nhập" variant="secondary" disabled={busy} onPress={onBack} />
  </AuthLayout>;
}

export function ResetScreen({ apiBase, onBack }: { apiBase: string; onBack: () => void }) {
  const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false);
  const submit = async () => { if (!token.trim() || !password) return setError('Vui lòng nhập mã đặt lại và mật khẩu mới.'); if (password !== confirm) return setError('Mật khẩu xác nhận chưa khớp.'); setBusy(true); setError(null); try { await resetPassword(apiBase, token.trim(), password); setDone(true); } catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); } };
  return <AuthLayout eyebrow="Bảo mật tài khoản" title="Đặt lại mật khẩu" description="Nhập mã trong email và tạo mật khẩu mới cho tài khoản.">
    {error ? <ErrorBanner message={error} /> : null}
    {done ? <>
      <SuccessBanner message="Mật khẩu đã được cập nhật. Bạn có thể đăng nhập lại." />
      <View style={styles.gapTop}><AppButton label="Về trang đăng nhập" onPress={onBack} /></View>
    </> : <>
      <AuthField label="Mã đặt lại mật khẩu" value={token} onChangeText={setToken} placeholder="Dán mã từ email" autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <AuthField label="Mật khẩu mới" secure value={password} onChangeText={setPassword} placeholder="Ít nhất 8 ký tự, gồm chữ và số" editable={!busy} />
      <AuthField label="Xác nhận mật khẩu" secure value={confirm} onChangeText={setConfirm} placeholder="Nhập lại mật khẩu mới" editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} />
      <View style={styles.gapTop}><AppButton label="Đặt lại mật khẩu" loading={busy} disabled={busy} onPress={() => void submit()} /></View>
      <AppButton label="Hủy và quay lại" variant="secondary" disabled={busy} onPress={onBack} />
    </>}
  </AuthLayout>;
}

export function ChangePasswordScreen({ apiBase, forced, onCancel, onChanged, onSessionExpired }: { apiBase: string; forced: boolean; onCancel?: () => void; onChanged: () => void; onSessionExpired: () => void }) {
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!current || !next || !confirm) return setError('Vui lòng nhập đầy đủ các trường mật khẩu.');
    if (next !== confirm) return setError('Mật khẩu xác nhận chưa khớp.');
    setBusy(true); setError(null);
    try { await changePassword(apiBase, current, next, confirm); onChanged(); }
    catch (err: unknown) {
      // Giống Flutter: 401 -> phiên hết hạn, không hiện lỗi.
      if (typeof err === 'object' && err && 'status' in err && err.status === 401) { onSessionExpired(); return; }
      setError(friendlyAuthError(err));
    } finally { setBusy(false); }
  };
  return <AuthLayout eyebrow={forced ? 'Yêu cầu bảo mật' : 'Tài khoản'} title="Đổi mật khẩu" description={forced ? 'Bạn cần đổi mật khẩu tạm thời trước khi tiếp tục.' : 'Cập nhật mật khẩu để bảo vệ tài khoản.'}>
    {forced ? <NoticeBanner message="Đây là mật khẩu tạm thời do quản trị viên cấp." /> : null}
    {error ? <ErrorBanner message={error} /> : null}
    <AuthField label="Mật khẩu hiện tại" secure value={current} onChangeText={setCurrent} placeholder="Nhập mật khẩu hiện tại" editable={!busy} />
    <AuthField label="Mật khẩu mới" secure value={next} onChangeText={setNext} placeholder="Ít nhất 8 ký tự, gồm chữ và số" editable={!busy} />
    <AuthField label="Xác nhận mật khẩu mới" secure value={confirm} onChangeText={setConfirm} placeholder="Nhập lại mật khẩu mới" editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} />
    <View style={styles.gapTop}><AppButton label="Cập nhật mật khẩu" loading={busy} disabled={busy} onPress={() => void submit()} /></View>
    {onCancel ? <AppButton label="Để sau" variant="secondary" disabled={busy} onPress={onCancel} /> : null}
  </AuthLayout>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  logoMark: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  logoMarkLarge: { width: 56, height: 56, borderRadius: 16 },
  logoLetter: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  logoLetterLarge: { fontSize: 28 },
  brand: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  brandLarge: { fontSize: 30 },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingVertical: 32 },
  logoWrap: { alignItems: 'center', marginTop: 10, marginBottom: 24 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
  title: { color: colors.ink, fontSize: 28, lineHeight: 35, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center', marginTop: 8, marginBottom: 22 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, shadowColor: colors.ink, shadowOpacity: 0.04, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  note: { color: colors.faint, fontSize: 11.5, lineHeight: 17, fontWeight: '500', textAlign: 'center', marginTop: 20, paddingHorizontal: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  action: { paddingVertical: 2, paddingHorizontal: 4 },
  actionText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  input: { height: 50, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.ink, fontSize: 14, fontWeight: '600' },
  inputDisabled: { backgroundColor: colors.background, borderColor: colors.border },
  forgot: { alignSelf: 'flex-end', paddingVertical: 4, marginTop: -4 },
  forgotText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  gapTop: { marginTop: 4 },
  resetLink: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: spacing.xs },
  resetText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
