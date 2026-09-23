import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { resolveApiBase } from './src/config';
import { changePassword, forgotPassword, friendlyAuthError, getCurrentUser, login, logout, resetPassword, setSignedOutHandler, type AuthUser } from './src/auth';
import { BottomTabBar, type BottomTabKey } from './src/components/BottomTabBar';

type Screen = 'login' | 'forgot' | 'reset' | 'change-password' | 'home';

export default function App() {
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [forcedPasswordChange, setForcedPasswordChange] = useState(false);

  const bootstrap = useCallback(async () => {
    setConnecting(true); setConnectionError(null);
    try {
      const resolved = await resolveApiBase();
      setApiBase(resolved.base);
      try {
        const current = await getCurrentUser(resolved.base);
        setUser(current);
        setForcedPasswordChange(!!current.mustChangePassword);
        setScreen(current.mustChangePassword ? 'change-password' : 'home');
      } catch { setUser(null); setScreen('login'); }
    } catch (error) { setConnectionError(error instanceof Error ? error.message : 'Không thể kết nối máy chủ.'); }
    finally { setConnecting(false); }
  }, []);
  useEffect(() => { void bootstrap(); }, [bootstrap]);

  // src/auth.ts renews the short-lived session cookie silently (SRS §4.4).
  // This is what's left when renewal itself fails — the refresh token expired
  // too, so the only honest move is the login screen.
  useEffect(() => {
    setSignedOutHandler(() => { setUser(null); setForcedPasswordChange(false); setScreen('login'); });
    return () => setSignedOutHandler(null);
  }, []);

  if (connecting) return <LoadingScreen />;
  if (!apiBase || connectionError) return <ConnectionError message={connectionError || 'Không tìm thấy API.'} onRetry={bootstrap} />;
  const clearSession = () => { setUser(null); setForcedPasswordChange(false); setScreen('login'); };

  return <SafeAreaView style={styles.safeArea}>
    <StatusBar style="dark" />
    {screen === 'login' && <LoginScreen apiBase={apiBase} onAuthenticated={(nextUser, forced) => { setUser(nextUser); setForcedPasswordChange(forced); setScreen(forced ? 'change-password' : 'home'); }} onForgot={() => setScreen('forgot')} onReset={() => setScreen('reset')} />}
    {screen === 'forgot' && <ForgotScreen apiBase={apiBase} onBack={() => setScreen('login')} onReset={() => setScreen('reset')} />}
    {screen === 'reset' && <ResetScreen apiBase={apiBase} onBack={() => setScreen('login')} />}
    {screen === 'change-password' && user && <ChangePasswordScreen apiBase={apiBase} forced={forcedPasswordChange} onCancel={forcedPasswordChange ? undefined : () => setScreen('home')} onChanged={() => { setForcedPasswordChange(false); setUser({ ...user, mustChangePassword: false }); setScreen('home'); }} onSessionExpired={clearSession} />}
    {screen === 'home' && user && <EmployeeHome user={user} apiBase={apiBase} onChangePassword={() => setScreen('change-password')} onLogout={clearSession} />}
  </SafeAreaView>;
}

function LoadingScreen() {
  return <SafeAreaView style={styles.center}><Logo large /><ActivityIndicator style={styles.loading} color="#2563eb" size="large" /><Text style={styles.muted}>Đang kết nối hệ thống…</Text><StatusBar style="dark" /></SafeAreaView>;
}

function ConnectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <SafeAreaView style={styles.center}><View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View><Text style={styles.stateTitle}>Không thể kết nối</Text><Text style={styles.stateMessage}>{message}</Text><PrimaryButton label="Thử kết nối lại" onPress={onRetry} /><StatusBar style="dark" /></SafeAreaView>;
}

function Logo({ large = false }: { large?: boolean }) {
  return <View style={styles.logoRow}><View style={[styles.logoMark, large && styles.logoMarkLarge]}><Text style={[styles.logoLetter, large && styles.logoLetterLarge]}>C</Text></View><Text style={[styles.brand, large && styles.brandLarge]}>CoreStaff</Text></View>;
}

function AuthLayout({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled"><Logo /><View style={styles.authHeader}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.authTitle}>{title}</Text><Text style={styles.authDescription}>{description}</Text></View><View style={styles.authCard}>{children}</View><Text style={styles.securityNote}>Phiên đăng nhập được tự động làm mới khi bạn còn dùng; dừng quá 14 ngày thì cần đăng nhập lại.</Text></ScrollView></KeyboardAvoidingView>;
}

function LoginScreen({ apiBase, onAuthenticated, onForgot, onReset }: { apiBase: string; onAuthenticated: (user: AuthUser, forced: boolean) => void; onForgot: () => void; onReset: () => void }) {
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!identifier.trim() || !password) return setError('Vui lòng nhập email/mã nhân viên và mật khẩu.');
    setBusy(true); setError(null);
    try { const result = await login(apiBase, identifier, password); onAuthenticated(result.user, result.mustChangePassword); }
    catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); }
  };
  return <AuthLayout eyebrow="ỨNG DỤNG NHÂN VIÊN" title="Chào mừng trở lại" description="Đăng nhập để theo dõi công việc và tài khoản của bạn.">{error && <ErrorBanner message={error} />}<Field label="Email hoặc mã nhân viên" value={identifier} onChangeText={setIdentifier} placeholder="VD: NV-0248" autoCapitalize="none" editable={!busy} /><Field label="Mật khẩu" value={password} onChangeText={setPassword} placeholder="Nhập mật khẩu" secureTextEntry={!visible} editable={!busy} action={visible ? 'Ẩn' : 'Hiện'} onAction={() => setVisible(value => !value)} /><Pressable onPress={onForgot} disabled={busy}><Text style={styles.linkRight}>Quên mật khẩu?</Text></Pressable><PrimaryButton label="Đăng nhập" loading={busy} disabled={busy} onPress={submit} /><Pressable onPress={onReset} disabled={busy}><Text style={styles.linkCenter}>Bạn đã có mã đặt lại mật khẩu?</Text></Pressable></AuthLayout>;
}

function ForgotScreen({ apiBase, onBack, onReset }: { apiBase: string; onBack: () => void; onReset: () => void }) {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [sent, setSent] = useState(false);
  const submit = async () => { if (!email.trim()) return setError('Vui lòng nhập email đăng nhập.'); setBusy(true); setError(null); try { await forgotPassword(apiBase, email); setSent(true); } catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); } };
  return <AuthLayout eyebrow="KHÔI PHỤC TÀI KHOẢN" title="Quên mật khẩu" description="Nếu tài khoản tồn tại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.">{error && <ErrorBanner message={error} />}{sent ? <><SuccessBanner message="Yêu cầu đã được tiếp nhận. Hãy kiểm tra email của bạn." /><PrimaryButton label="Nhập mã đặt lại" onPress={onReset} /></> : <><Field label="Email đăng nhập" value={email} onChangeText={setEmail} placeholder="ten@congty.vn" keyboardType="email-address" autoCapitalize="none" editable={!busy} /><PrimaryButton label="Gửi hướng dẫn" loading={busy} disabled={busy} onPress={submit} /></>}<SecondaryButton label="Quay lại đăng nhập" onPress={onBack} /></AuthLayout>;
}

function ResetScreen({ apiBase, onBack }: { apiBase: string; onBack: () => void }) {
  const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false);
  const submit = async () => { if (!token.trim() || !password) return setError('Vui lòng nhập mã đặt lại và mật khẩu mới.'); if (password !== confirm) return setError('Mật khẩu xác nhận chưa khớp.'); setBusy(true); setError(null); try { await resetPassword(apiBase, token, password); setDone(true); } catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); } };
  return <AuthLayout eyebrow="BẢO MẬT TÀI KHOẢN" title="Đặt lại mật khẩu" description="Nhập mã trong email và tạo mật khẩu mới cho tài khoản.">{error && <ErrorBanner message={error} />}{done ? <><SuccessBanner message="Mật khẩu đã được cập nhật. Bạn có thể đăng nhập lại." /><PrimaryButton label="Về trang đăng nhập" onPress={onBack} /></> : <><Field label="Mã đặt lại mật khẩu" value={token} onChangeText={setToken} placeholder="Dán mã từ email" autoCapitalize="none" editable={!busy} /><Field label="Mật khẩu mới" value={password} onChangeText={setPassword} placeholder="Ít nhất 8 ký tự, gồm chữ và số" secureTextEntry editable={!busy} /><Field label="Xác nhận mật khẩu" value={confirm} onChangeText={setConfirm} secureTextEntry editable={!busy} /><PrimaryButton label="Đặt lại mật khẩu" loading={busy} disabled={busy} onPress={submit} /><SecondaryButton label="Hủy và quay lại" onPress={onBack} disabled={busy} /></>}</AuthLayout>;
}

function ChangePasswordScreen({ apiBase, forced, onCancel, onChanged, onSessionExpired }: { apiBase: string; forced: boolean; onCancel?: () => void; onChanged: () => void; onSessionExpired: () => void }) {
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async () => { if (!current || !next || !confirm) return setError('Vui lòng nhập đầy đủ các trường mật khẩu.'); if (next !== confirm) return setError('Mật khẩu xác nhận chưa khớp.'); setBusy(true); setError(null); try { await changePassword(apiBase, current, next, confirm); onChanged(); } catch (err: unknown) { setError(friendlyAuthError(err)); if (typeof err === 'object' && err && 'status' in err && err.status === 401) onSessionExpired(); } finally { setBusy(false); } };
  return <AuthLayout eyebrow={forced ? 'YÊU CẦU BẢO MẬT' : 'TÀI KHOẢN'} title="Đổi mật khẩu" description={forced ? 'Bạn cần đổi mật khẩu tạm thời trước khi tiếp tục.' : 'Cập nhật mật khẩu để bảo vệ tài khoản.'}>{forced && <View style={styles.notice}><Text style={styles.noticeText}>Đây là mật khẩu tạm thời do quản trị viên cấp.</Text></View>}{error && <ErrorBanner message={error} />}<Field label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secureTextEntry editable={!busy} /><Field label="Mật khẩu mới" value={next} onChangeText={setNext} placeholder="Ít nhất 8 ký tự, gồm chữ và số" secureTextEntry editable={!busy} /><Field label="Xác nhận mật khẩu mới" value={confirm} onChangeText={setConfirm} secureTextEntry editable={!busy} /><PrimaryButton label="Cập nhật mật khẩu" loading={busy} disabled={busy} onPress={submit} />{onCancel && <SecondaryButton label="Để sau" onPress={onCancel} disabled={busy} />}</AuthLayout>;
}

function EmployeeHome({ user, apiBase, onChangePassword, onLogout }: { user: AuthUser; apiBase: string; onChangePassword: () => void; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<BottomTabKey>('overview');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const signOut = async () => { setBusy(true); setError(null); try { await logout(apiBase); onLogout(); } catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); } };
  if (user.role !== 'EMPLOYEE') return <View style={styles.center}><View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View><Text style={styles.stateTitle}>Ứng dụng dành cho nhân viên</Text><Text style={styles.stateMessage}>Tài khoản {user.role} cần sử dụng cổng quản trị web.</Text>{error && <ErrorBanner message={error} />}<PrimaryButton label="Đăng xuất" loading={busy} disabled={busy} onPress={signOut} /></View>;
  const initials = user.fullName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();
  return <View style={styles.appShell}>
    {activeTab === 'overview' && <ScrollView style={styles.home} contentContainerStyle={styles.homeContent}><View style={styles.homeHeader}><View style={styles.headerCopy}><Text style={styles.homeEyebrow}>CORESTAFF EMPLOYEE</Text><Text style={styles.homeGreeting}>Xin chào,</Text><Text numberOfLines={1} style={styles.homeName}>{user.fullName}</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{initials || 'NV'}</Text></View></View>{error && <ErrorBanner message={error} />}<View style={styles.shiftCard}><Text style={styles.shiftEyebrow}>HÔM NAY</Text><Text style={styles.shiftTitle}>Sẵn sàng cho ngày làm việc</Text><Text style={styles.shiftDescription}>Theo dõi chấm công, đơn từ và lịch làm việc ngay trên điện thoại.</Text><View style={styles.statusPill}><View style={styles.statusDot} /><Text style={styles.statusPillText}>Tài khoản đang hoạt động</Text></View></View><Text style={styles.sectionTitle}>Truy cập nhanh</Text><View style={styles.quickGrid}><QuickAction title="Chấm công" description="Ghi nhận ca làm" onPress={() => setActiveTab('attendance')} /><QuickAction title="Đơn từ" description="Tạo và theo dõi đơn" onPress={() => setActiveTab('requests')} /></View><View style={styles.profileSummary}><View><Text style={styles.infoLabel}>MÃ NHÂN VIÊN</Text><Text style={styles.profileName}>{user.employeeCode || 'Chưa cập nhật'}</Text></View><Pressable accessibilityRole="button" onPress={() => setActiveTab('account')} style={({ pressed }) => [styles.profileLink, pressed && styles.pressed]}><Text style={styles.profileLinkText}>Xem hồ sơ</Text></Pressable></View></ScrollView>}
    {activeTab === 'attendance' && <FeatureScreen eyebrow="CHẤM CÔNG" title="Ngày làm việc của bạn" description="Tính năng ghi nhận vào ca, ra ca và lịch sử chấm công đang được hoàn thiện." action="Quay về tổng quan" onAction={() => setActiveTab('overview')} />}
    {activeTab === 'requests' && <FeatureScreen eyebrow="ĐƠN TỪ" title="Yêu cầu của tôi" description="Tạo và theo dõi đơn nghỉ phép, tăng ca tại một nơi thuận tiện." action="Quay về tổng quan" onAction={() => setActiveTab('overview')} />}
    {activeTab === 'account' && <ScrollView style={styles.home} contentContainerStyle={styles.homeContent}><ScreenHeader eyebrow="TÀI KHOẢN" title="Hồ sơ cá nhân" description="Quản lý thông tin và bảo mật tài khoản." />{error && <ErrorBanner message={error} />}<View style={styles.accountHero}><View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{initials || 'NV'}</Text></View><Text style={styles.accountName}>{user.fullName}</Text><Text style={styles.accountCode}>{user.employeeCode || 'Chưa có mã nhân viên'}</Text></View><View style={styles.profileCard}><InfoRow label="Email" value={user.email} /><View style={styles.divider} /><InfoRow label="Vai trò" value="Nhân viên" /></View><Pressable accessibilityRole="button" style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]} onPress={onChangePassword}><View><Text style={styles.menuTitle}>Đổi mật khẩu</Text><Text style={styles.menuDescription}>Cập nhật thông tin bảo mật</Text></View><Text style={styles.chevron}>›</Text></Pressable><SecondaryButton label="Đăng xuất" loading={busy} disabled={busy} onPress={signOut} danger /><Text style={styles.version}>CoreStaff Mobile · Phiên bản 0.1.0</Text></ScrollView>}
    <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
  </View>;
}

function ScreenHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <View style={styles.screenHeader}><Text style={styles.homeEyebrow}>{eyebrow}</Text><Text style={styles.screenTitle}>{title}</Text><Text style={styles.screenDescription}>{description}</Text></View>; }
function QuickAction({ title, description, onPress }: { title: string; description: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><View style={styles.quickIcon}><Text style={styles.quickIconText}>{title.slice(0, 1)}</Text></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickDescription}>{description}</Text><Text style={styles.quickLink}>Mở tính năng  →</Text></Pressable>; }
function FeatureScreen({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action: string; onAction: () => void }) { return <ScrollView style={styles.home} contentContainerStyle={styles.featureContent}><ScreenHeader eyebrow={eyebrow} title={title} description={description} /><View style={styles.emptyCard}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>C</Text></View><Text style={styles.emptyTitle}>Sắp ra mắt</Text><Text style={styles.emptyDescription}>Đội ngũ CoreStaff đang chuẩn bị trải nghiệm này cho phiên bản tiếp theo.</Text><PrimaryButton label={action} onPress={onAction} /></View></ScrollView>; }

function Field({ label, action, onAction, ...inputProps }: React.ComponentProps<typeof TextInput> & { label: string; action?: string; onAction?: () => void }) { return <View style={styles.field}><View style={styles.fieldHeader}><Text style={styles.label}>{label}</Text>{action && <Pressable onPress={onAction}><Text style={styles.fieldAction}>{action}</Text></Pressable>}</View><TextInput style={styles.input} placeholderTextColor="#94a3b8" {...inputProps} /></View>; }
function PrimaryButton({ label, loading, disabled, onPress }: ButtonProps) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{label}</Text>}</Pressable>; }
function SecondaryButton({ label, loading, disabled, danger, onPress }: ButtonProps & { danger?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, danger && styles.dangerButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>{loading ? <ActivityIndicator color={danger ? '#dc2626' : '#334155'} /> : <Text style={[styles.secondaryButtonText, danger && styles.dangerText]}>{label}</Text>}</Pressable>; }
interface ButtonProps { label: string; loading?: boolean; disabled?: boolean; onPress: () => void; }
function ErrorBanner({ message }: { message: string }) { return <View accessibilityRole="alert" style={styles.errorBanner}><Text style={styles.errorBannerText}>{message}</Text></View>; }
function SuccessBanner({ message }: { message: string }) { return <View style={styles.successBanner}><Text style={styles.successBannerText}>{message}</Text></View>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: '#f6f8fc' }, center: { flex: 1, backgroundColor: '#f6f8fc', alignItems: 'center', justifyContent: 'center', padding: 28 }, muted: { color: '#64748b', fontSize: 14 }, loading: { marginTop: 34, marginBottom: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 34 }, logoMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }, logoMarkLarge: { width: 64, height: 64, borderRadius: 20 }, logoLetter: { color: '#fff', fontSize: 18, fontWeight: '800' }, logoLetterLarge: { fontSize: 32 }, brand: { color: '#0f172a', fontSize: 20, fontWeight: '800' }, brandLarge: { fontSize: 28 },
  errorIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, errorIconText: { color: '#dc2626', fontSize: 28, fontWeight: '800' }, stateTitle: { color: '#0f172a', fontSize: 22, fontWeight: '800', textAlign: 'center' }, stateMessage: { color: '#64748b', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 24, maxWidth: 340 },
  authScroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 42, paddingBottom: 32, justifyContent: 'center' }, authHeader: { marginBottom: 22 }, eyebrow: { color: '#2563eb', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 }, authTitle: { color: '#0f172a', fontSize: 30, lineHeight: 36, fontWeight: '800' }, authDescription: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 8 }, authCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, padding: 20, gap: 16, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 }, securityNote: { color: '#94a3b8', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 20, paddingHorizontal: 20 },
  field: { gap: 7 }, fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, label: { color: '#334155', fontSize: 13, fontWeight: '700' }, fieldAction: { color: '#2563eb', fontSize: 12, fontWeight: '700' }, input: { height: 50, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#fff', color: '#0f172a', fontSize: 15 },
  primaryButton: { minHeight: 50, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' }, secondaryButton: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, secondaryButtonText: { color: '#334155', fontSize: 14, fontWeight: '700' }, dangerButton: { borderColor: '#fecaca' }, dangerText: { color: '#dc2626' }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78 },
  linkRight: { color: '#2563eb', fontSize: 13, fontWeight: '700', textAlign: 'right' }, linkCenter: { color: '#475569', fontSize: 13, fontWeight: '600', textAlign: 'center' }, errorBanner: { borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', borderRadius: 12, padding: 12 }, errorBannerText: { color: '#b91c1c', fontSize: 13, lineHeight: 19 }, successBanner: { borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12 }, successBannerText: { color: '#166534', fontSize: 13, lineHeight: 19 }, notice: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 12, padding: 12 }, noticeText: { color: '#1e40af', fontSize: 13, lineHeight: 19 },
  appShell: { flex: 1, backgroundColor: '#f6f8fc' }, home: { flex: 1, backgroundColor: '#f6f8fc' }, homeContent: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 32, gap: 16 }, homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 16 }, headerCopy: { flex: 1 }, homeEyebrow: { color: '#2563eb', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, homeGreeting: { color: '#64748b', fontSize: 14, marginTop: 8 }, homeName: { color: '#0f172a', fontSize: 24, lineHeight: 30, fontWeight: '800' }, avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#1d4ed8', fontSize: 17, fontWeight: '800' },
  shiftCard: { backgroundColor: '#172554', borderRadius: 20, padding: 20 }, shiftEyebrow: { color: '#93c5fd', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, shiftTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 8 }, shiftDescription: { color: '#cbd5e1', fontSize: 13, lineHeight: 20, marginTop: 7 }, statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginTop: 16 }, statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' }, statusPillText: { color: '#e2e8f0', fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginTop: 4 }, profileCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 16 }, infoRow: { paddingVertical: 14 }, infoLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', marginBottom: 4 }, infoValue: { color: '#0f172a', fontSize: 14, fontWeight: '600' }, divider: { height: 1, backgroundColor: '#f1f5f9' }, menuRow: { minHeight: 68, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, menuTitle: { color: '#0f172a', fontSize: 14, fontWeight: '700' }, menuDescription: { color: '#64748b', fontSize: 12, marginTop: 3 }, chevron: { color: '#94a3b8', fontSize: 28, fontWeight: '300' }, version: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 4 },
  quickGrid: { flexDirection: 'row', gap: 12 }, quickAction: { flex: 1, minHeight: 156, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16 }, quickIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, quickIconText: { color: '#1d4ed8', fontSize: 15, fontWeight: '800' }, quickTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' }, quickDescription: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 4 }, quickLink: { color: '#2563eb', fontSize: 11, fontWeight: '700', marginTop: 12 },
  profileSummary: { minHeight: 72, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, profileName: { color: '#0f172a', fontSize: 15, fontWeight: '800' }, profileLink: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, profileLinkText: { color: '#2563eb', fontSize: 12, fontWeight: '800' },
  screenHeader: { gap: 7, marginBottom: 6 }, screenTitle: { color: '#0f172a', fontSize: 26, lineHeight: 32, fontWeight: '800' }, screenDescription: { color: '#64748b', fontSize: 14, lineHeight: 21 }, featureContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 32 }, emptyCard: { flex: 1, minHeight: 360, marginTop: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center' }, emptyIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, emptyIconText: { color: '#1d4ed8', fontSize: 24, fontWeight: '800' }, emptyTitle: { color: '#0f172a', fontSize: 20, fontWeight: '800' }, emptyDescription: { color: '#64748b', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  accountHero: { alignItems: 'center', paddingVertical: 8 }, avatarLarge: { width: 76, height: 76, borderRadius: 24, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }, avatarLargeText: { color: '#1d4ed8', fontSize: 24, fontWeight: '800' }, accountName: { color: '#0f172a', fontSize: 20, fontWeight: '800', marginTop: 12 }, accountCode: { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 4 },
});
