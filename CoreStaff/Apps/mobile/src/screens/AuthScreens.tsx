import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { changePassword, forgotPassword, friendlyAuthError, login, resetPassword, type AuthUser } from '../auth';
import { AppButton, ErrorBanner, SuccessBanner } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
import { colors, radius, shadow, spacing } from '../theme';

export function Logo({ large = false }: { large?: boolean }) {
  return <View style={styles.logoRow}>
    <View style={[styles.logoMark, large && styles.logoMarkLarge]}><Text style={[styles.logoLetter, large && styles.logoLetterLarge]}>C</Text></View>
    <Text style={[styles.brand, large && styles.brandLarge]}>CoreStaff</Text>
  </View>;
}

function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Logo />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.card}>{children}</View>
      <Text style={styles.note}>Phiên đăng nhập tự gia hạn khi bạn còn sử dụng; không dùng quá 14 ngày sẽ cần đăng nhập lại.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function AuthField({ label, secure, ...props }: TextInputProps & { label: string; secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrap}>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.faint} style={styles.input} secureTextEntry={secure ? hidden : false} {...props} />
      {secure ? <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'} hitSlop={8} onPress={() => setHidden(value => !value)} style={styles.eye}><AppIcon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} /></Pressable> : null}
    </View>
  </View>;
}

function LinkButton({ label, onPress, disabled, align = 'center' }: { label: string; onPress: () => void; disabled?: boolean; align?: 'center' | 'right' }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.link, align === 'right' && styles.linkRight, pressed && styles.pressed]}><Text style={styles.linkText}>{label}</Text></Pressable>;
}

export function LoginScreen({ apiBase, onAuthenticated, onForgot, onReset }: { apiBase: string; onAuthenticated: (user: AuthUser, forced: boolean) => void; onForgot: () => void; onReset: () => void }) {
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!identifier.trim() || !password) return setError('Vui lòng nhập email/mã nhân viên và mật khẩu.');
    setBusy(true); setError(null);
    try { const result = await login(apiBase, identifier, password); onAuthenticated(result.user, result.mustChangePassword); }
    catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); }
  };
  return <AuthLayout title="Chào mừng trở lại" description="Đăng nhập để chấm công và theo dõi công việc của bạn.">
    {error ? <ErrorBanner message={error} /> : null}
    <AuthField label="Email hoặc mã nhân viên" value={identifier} onChangeText={setIdentifier} placeholder="VD: NV-0248" autoCapitalize="none" autoCorrect={false} editable={!busy} returnKeyType="next" />
    <AuthField label="Mật khẩu" secure value={password} onChangeText={setPassword} placeholder="Nhập mật khẩu" editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} />
    <LinkButton label="Quên mật khẩu?" align="right" onPress={onForgot} disabled={busy} />
    <AppButton label="Đăng nhập" loading={busy} disabled={busy} onPress={() => void submit()} />
    <LinkButton label="Bạn đã có mã đặt lại mật khẩu?" onPress={onReset} disabled={busy} />
  </AuthLayout>;
}

export function ForgotScreen({ apiBase, onBack, onReset }: { apiBase: string; onBack: () => void; onReset: () => void }) {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [sent, setSent] = useState(false);
  const submit = async () => { if (!email.trim()) return setError('Vui lòng nhập email đăng nhập.'); setBusy(true); setError(null); try { await forgotPassword(apiBase, email); setSent(true); } catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); } };
  return <AuthLayout title="Quên mật khẩu" description="Nếu tài khoản tồn tại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.">
    {error ? <ErrorBanner message={error} /> : null}
    {sent ? <><SuccessBanner message="Yêu cầu đã được tiếp nhận. Hãy kiểm tra email của bạn." /><AppButton label="Nhập mã đặt lại" onPress={onReset} /></> : <>
      <AuthField label="Email đăng nhập" value={email} onChangeText={setEmail} placeholder="ten@congty.vn" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <AppButton label="Gửi hướng dẫn" loading={busy} disabled={busy} onPress={() => void submit()} />
    </>}
    <AppButton label="Quay lại đăng nhập" variant="secondary" disabled={busy} onPress={onBack} />
  </AuthLayout>;
}

export function ResetScreen({ apiBase, onBack }: { apiBase: string; onBack: () => void }) {
  const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false);
  const submit = async () => { if (!token.trim() || !password) return setError('Vui lòng nhập mã đặt lại và mật khẩu mới.'); if (password !== confirm) return setError('Mật khẩu xác nhận chưa khớp.'); setBusy(true); setError(null); try { await resetPassword(apiBase, token, password); setDone(true); } catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); } };
  return <AuthLayout title="Đặt lại mật khẩu" description="Nhập mã trong email và tạo mật khẩu mới cho tài khoản.">
    {error ? <ErrorBanner message={error} /> : null}
    {done ? <><SuccessBanner message="Mật khẩu đã được cập nhật. Bạn có thể đăng nhập lại." /><AppButton label="Về trang đăng nhập" onPress={onBack} /></> : <>
      <AuthField label="Mã đặt lại mật khẩu" value={token} onChangeText={setToken} placeholder="Dán mã từ email" autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <AuthField label="Mật khẩu mới" secure value={password} onChangeText={setPassword} placeholder="Ít nhất 8 ký tự, gồm chữ và số" editable={!busy} />
      <AuthField label="Xác nhận mật khẩu" secure value={confirm} onChangeText={setConfirm} editable={!busy} />
      <AppButton label="Đặt lại mật khẩu" loading={busy} disabled={busy} onPress={() => void submit()} />
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
    catch (err: unknown) { setError(friendlyAuthError(err)); if (typeof err === 'object' && err && 'status' in err && err.status === 401) onSessionExpired(); }
    finally { setBusy(false); }
  };
  return <AuthLayout title="Đổi mật khẩu" description={forced ? 'Bạn cần đổi mật khẩu tạm thời trước khi tiếp tục.' : 'Cập nhật mật khẩu để bảo vệ tài khoản.'}>
    {forced ? <View style={styles.notice}><Text style={styles.noticeText}>Đây là mật khẩu tạm thời do quản trị viên cấp.</Text></View> : null}
    {error ? <ErrorBanner message={error} /> : null}
    <AuthField label="Mật khẩu hiện tại" secure value={current} onChangeText={setCurrent} editable={!busy} />
    <AuthField label="Mật khẩu mới" secure value={next} onChangeText={setNext} placeholder="Ít nhất 8 ký tự, gồm chữ và số" editable={!busy} />
    <AuthField label="Xác nhận mật khẩu mới" secure value={confirm} onChangeText={setConfirm} editable={!busy} />
    <AppButton label="Cập nhật mật khẩu" loading={busy} disabled={busy} onPress={() => void submit()} />
    {onCancel ? <AppButton label="Để sau" variant="secondary" disabled={busy} onPress={onCancel} /> : null}
  </AuthLayout>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoMark: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.accent },
  logoMarkLarge: { width: 68, height: 68, borderRadius: 22 },
  logoLetter: { color: colors.accent, fontSize: 19, fontWeight: '800' },
  logoLetterLarge: { fontSize: 34 },
  brand: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  brandLarge: { fontSize: 28 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl, justifyContent: 'center' },
  header: { marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, ...shadow },
  note: { color: colors.faint, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },
  field: { gap: 7 },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: radius.md, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 50, paddingHorizontal: 14, color: colors.ink, fontSize: 15 },
  eye: { width: 48, height: 50, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  linkRight: { alignItems: 'flex-end', marginTop: -spacing.xs },
  linkText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  notice: { borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.sm },
  noticeText: { color: colors.primaryDark, fontSize: 13, lineHeight: 19 },
});
