import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { resolveApiBase } from './src/config';
import { getCurrentUser, logout, friendlyAuthError, setSignedOutHandler, type AuthUser } from './src/auth';
import { BottomTabBar, type BottomTabKey } from './src/components/BottomTabBar';
import { AppButton, ErrorBanner } from './src/components/ui';
import { AppIcon } from './src/components/AppIcon';
import { ChangePasswordScreen, ForgotScreen, LoginScreen, Logo, ResetScreen } from './src/screens/AuthScreens';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { RequestsScreen } from './src/screens/RequestsScreen';
import { PayslipsScreen } from './src/screens/PayslipsScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { ManagerApprovalsScreen } from './src/screens/ManagerApprovalsScreen';
import { ManagerTeamScreen } from './src/screens/ManagerTeamScreen';
import { HrOverviewScreen } from './src/screens/HrOverviewScreen';
import { HrEmployeesScreen } from './src/screens/HrEmployeesScreen';
import { HrLeavesScreen } from './src/screens/HrLeavesScreen';
import { HrContractsScreen } from './src/screens/HrContractsScreen';
import { getPendingApprovals, getPendingLeaveRequests } from './src/manager-api';
import { subscribeEmployeeRealtime } from './src/realtime';
import { colors } from './src/theme';

type Screen = 'login' | 'forgot' | 'reset' | 'change-password' | 'home';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  return <SafeAreaProvider>{fontsLoaded || fontError ? <AppContent /> : <LoadingScreen />}</SafeAreaProvider>;
}

function AppContent() {
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
  // This is what's left when renewal itself fails: the refresh token expired
  // too, so the only honest move is the login screen.
  useEffect(() => {
    setSignedOutHandler(() => { setUser(null); setForcedPasswordChange(false); setScreen('login'); });
    return () => setSignedOutHandler(null);
  }, []);

  if (connecting) return <LoadingScreen />;
  if (!apiBase || connectionError) return <ConnectionError message={connectionError || 'Không tìm thấy API.'} onRetry={bootstrap} />;
  const clearSession = () => { setUser(null); setForcedPasswordChange(false); setScreen('login'); };

  // Khu vực đã đăng nhập: thanh tab tự xử lý safe-area dưới nên chỉ chừa cạnh trên.
  if (screen === 'home' && user) {
    return <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <EmployeeHome user={user} apiBase={apiBase} onChangePassword={() => setScreen('change-password')} onLogout={clearSession} />
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safeArea}>
    <StatusBar style="dark" />
    {screen === 'login' && <LoginScreen apiBase={apiBase} onAuthenticated={(nextUser, forced) => { setUser(nextUser); setForcedPasswordChange(forced); setScreen(forced ? 'change-password' : 'home'); }} onForgot={() => setScreen('forgot')} onReset={() => setScreen('reset')} />}
    {screen === 'forgot' && <ForgotScreen apiBase={apiBase} onBack={() => setScreen('login')} onReset={() => setScreen('reset')} />}
    {screen === 'reset' && <ResetScreen apiBase={apiBase} onBack={() => setScreen('login')} />}
    {screen === 'change-password' && user && <ChangePasswordScreen apiBase={apiBase} forced={forcedPasswordChange} onCancel={forcedPasswordChange ? undefined : () => setScreen('home')} onChanged={() => { setForcedPasswordChange(false); setUser({ ...user, mustChangePassword: false }); setScreen('home'); }} onSessionExpired={clearSession} />}
  </SafeAreaView>;
}

function LoadingScreen() {
  return <View style={styles.center}><Logo large /><ActivityIndicator style={styles.loading} color={colors.primary} size="large" /><Text style={styles.muted}>Đang kết nối hệ thống…</Text><StatusBar style="dark" /></View>;
}

function ConnectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.center}>
    <View style={styles.errorIcon}><AppIcon name="cloud-offline-outline" size={30} color={colors.danger} /></View>
    <Text accessibilityRole="header" style={styles.stateTitle}>Không thể kết nối</Text>
    <Text style={styles.stateMessage}>{message}</Text>
    <View style={styles.stateAction}><AppButton label="Thử kết nối lại" onPress={onRetry} /></View>
    <StatusBar style="dark" />
  </View>;
}

function EmployeeHome({ user, apiBase, onChangePassword, onLogout }: { user: AuthUser; apiBase: string; onChangePassword: () => void; onLogout: () => void }) {
  const [activeTab, setActiveTabState] = useState<BottomTabKey>('overview');
  const [showPayslips, setShowPayslips] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const isManager = user.role === 'DEPARTMENT_MANAGER';
  const isHr = user.role === 'HR';
  // Quản lý chỉ có 5 tab, nên các đích của nhân viên được ánh xạ sang nơi tương ứng.
  const navigate = (tab: BottomTabKey) => {
    setShowPayslips(false);
    if (isHr && !['overview', 'employees', 'leaves', 'contracts', 'account'].includes(tab)) return;
    if (isManager && tab === 'requests') return setActiveTabState('approvals');
    if (isManager && tab === 'payslips') { setActiveTabState('account'); return setShowPayslips(true); }
    setActiveTabState(tab);
  };
  const [realtimeRevision, setRealtimeRevision] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const signOut = async () => { setBusy(true); setError(null); try { await logout(apiBase); onLogout(); } catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); } };
  // SYSTEM_ADMIN dùng cổng quản trị web; HR dùng bộ màn quản trị nhẹ trên mobile.
  const isBlockedRole = user.role === 'SYSTEM_ADMIN';
  useEffect(() => {
    if (isBlockedRole) return;
    return subscribeEmployeeRealtime(apiBase, () => setRealtimeRevision((value) => value + 1));
  }, [apiBase, isBlockedRole]);
  useEffect(() => {
    if (isBlockedRole) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRealtimeRevision((value) => value + 1);
    });
    return () => subscription.remove();
  }, [isBlockedRole]);
  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    void Promise.allSettled([getPendingApprovals(apiBase), getPendingLeaveRequests(apiBase)]).then(([approvals, leaves]) => {
      if (cancelled) return;
      setPendingApprovals((approvals.status === 'fulfilled' ? approvals.value.length : 0) + (leaves.status === 'fulfilled' ? leaves.value.length : 0));
    });
    return () => { cancelled = true; };
  }, [apiBase, isManager, realtimeRevision]);
  if (isBlockedRole) return <View style={styles.center}>
    <View style={styles.errorIcon}><AppIcon name="desktop-outline" size={30} color={colors.danger} /></View>
    <Text accessibilityRole="header" style={styles.stateTitle}>Cổng quản trị Web</Text>
    <Text style={styles.stateMessage}>Tài khoản vai trò Quản trị hệ thống (System Admin) cần sử dụng cổng quản trị web.</Text>
    {error ? <ErrorBanner message={error} /> : null}
    <View style={styles.stateAction}><AppButton label="Đăng xuất" loading={busy} disabled={busy} onPress={() => void signOut()} /></View>
  </View>;
  return <View style={styles.appShell}>
    <View style={styles.flex}>
      {showPayslips ? <View style={styles.flex}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại tài khoản" onPress={() => setShowPayslips(false)} style={({ pressed }) => [styles.back, pressed && styles.backPressed]}><AppIcon name="chevron-back" size={20} color={colors.primary} /><Text style={styles.backText}>Tài khoản</Text></Pressable>
        <PayslipsScreen apiBase={apiBase} realtimeRevision={realtimeRevision} />
      </View> : <>
        {isHr && activeTab === 'overview' && <HrOverviewScreen user={user} apiBase={apiBase} onNavigate={navigate} realtimeRevision={realtimeRevision} />}
        {isHr && activeTab === 'employees' && <HrEmployeesScreen apiBase={apiBase} realtimeRevision={realtimeRevision} />}
        {isHr && activeTab === 'leaves' && <HrLeavesScreen apiBase={apiBase} realtimeRevision={realtimeRevision} />}
        {isHr && activeTab === 'contracts' && <HrContractsScreen apiBase={apiBase} realtimeRevision={realtimeRevision} />}
        {!isHr && activeTab === 'overview' && <OverviewScreen user={user} apiBase={apiBase} onNavigate={navigate} realtimeRevision={realtimeRevision} pendingApprovals={isManager ? pendingApprovals : undefined} />}
        {!isHr && activeTab === 'attendance' && <AttendanceScreen apiBase={apiBase} realtimeRevision={realtimeRevision} />}
        {!isHr && activeTab === 'requests' && !isManager && <RequestsScreen apiBase={apiBase} realtimeRevision={realtimeRevision} />}
        {!isHr && activeTab === 'payslips' && !isManager && <PayslipsScreen apiBase={apiBase} realtimeRevision={realtimeRevision} />}
        {activeTab === 'approvals' && isManager && <ManagerApprovalsScreen apiBase={apiBase} realtimeRevision={realtimeRevision} onCountChange={setPendingApprovals} />}
        {activeTab === 'team' && isManager && <ManagerTeamScreen apiBase={apiBase} realtimeRevision={realtimeRevision} />}
        {activeTab === 'account' && <AccountScreen user={user} apiBase={apiBase} onOpenPayslips={() => navigate('payslips')} onChangePassword={onChangePassword} onLogout={() => void signOut()} logoutBusy={busy} logoutError={error} realtimeRevision={realtimeRevision} />}
      </>}
    </View>
    <BottomTabBar activeTab={showPayslips ? 'account' : activeTab} onTabPress={navigate} manager={isManager} hr={isHr} badges={isManager ? { approvals: pendingApprovals } : undefined} />
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  appShell: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 28 },
  muted: { color: colors.muted, fontSize: 14 },
  loading: { marginTop: 34, marginBottom: 12 },
  errorIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  stateTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  stateMessage: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 24, maxWidth: 340 },
  stateAction: { alignSelf: 'stretch', maxWidth: 360 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backPressed: { opacity: 0.6 },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
