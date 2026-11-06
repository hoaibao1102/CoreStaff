import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AuthUser } from '../auth';
import { friendlyEmployeeError } from '../employee-api';
import { complianceLabel, employmentStatusLabel, employmentStatusTone, getHrCompliance, getHrContracts, getHrDepartments, getHrEmployees, getHrLeaves, getTimesheetPeriods, periodStatusLabel, type ComplianceFinding, type HrContract, type HrDepartment, type HrEmployee, type HrLeave, type TimesheetPeriod } from '../hr-api';
import { Card, ErrorBanner, LoadingBlock, formatDate, formatPeriod, initialsOf } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
import { Avatar, hrStyles, MetricTile, SectionTitle, ToneBadge } from '../components/HrParts';
import type { BottomTabKey } from '../components/BottomTabBar';
import { colors, radius } from '../theme';

const list = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);

/** Tổng quan nhân sự, khớp web/src/screens/HrOverview: số liệu nhân sự, hợp đồng, đơn nghỉ chờ áp dụng, kỳ công. */
export function HrOverviewScreen({ user, apiBase, onNavigate, realtimeRevision = 0 }: { user: AuthUser; apiBase: string; onNavigate: (tab: BottomTabKey) => void; realtimeRevision?: number }) {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [contracts, setContracts] = useState<HrContract[]>([]);
  const [findings, setFindings] = useState<ComplianceFinding[]>([]);
  const [leaves, setLeaves] = useState<HrLeave[]>([]);
  const [periods, setPeriods] = useState<TimesheetPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    // Mỗi nguồn dữ liệu lỗi độc lập: một API chậm không làm trắng cả màn hình.
    const r = await Promise.allSettled([getHrEmployees(apiBase), getHrDepartments(apiBase), getHrContracts(apiBase), getHrCompliance(apiBase), getHrLeaves(apiBase), getTimesheetPeriods(apiBase)]);
    setEmployees(list(r[0] as PromiseSettledResult<HrEmployee[]>));
    setDepartments(list(r[1] as PromiseSettledResult<HrDepartment[]>));
    setContracts(list(r[2] as PromiseSettledResult<HrContract[]>));
    setFindings(r[3].status === 'fulfilled' && Array.isArray(r[3].value?.findings) ? r[3].value.findings : []);
    setLeaves(list(r[4] as PromiseSettledResult<HrLeave[]>));
    setPeriods(list(r[5] as PromiseSettledResult<TimesheetPeriod[]>));
    const failed = r.filter(x => x.status === 'rejected') as PromiseRejectedResult[];
    setError(failed.length === r.length ? friendlyEmployeeError(failed[0].reason) : null);
    setLoading(false); setRefreshing(false);
  }, [apiBase, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);

  const d = useMemo(() => {
    const active = employees.filter(e => e.employmentStatus === 'ACTIVE').length;
    const probation = employees.filter(e => e.employmentStatus === 'PROBATION').length;
    const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
    const expiring = contracts.filter(c => c.isExpiringSoon === true || (typeof c.expiryWarningDays === 'number' && c.expiryWarningDays <= 30 && c.isExpired !== true)).length;
    const waitingApply = leaves.filter(l => l.status === 'APPROVED').length;
    const counts = new Map<string, number>();
    employees.forEach(e => counts.set(e.departmentId || '', (counts.get(e.departmentId || '') || 0) + 1));
    const deptRows = departments.map(x => ({ name: x.name, count: counts.get(x._id) || 0 })).sort((a, b) => b.count - a.count);
    const unassigned = employees.length - deptRows.reduce((s, r) => s + r.count, 0);
    const recent = [...employees].sort((a, b) => (b.createdAt || b.joinDate || '').localeCompare(a.createdAt || a.joinDate || '')).slice(0, 5);
    const open = ['OPEN', 'REVIEWING', 'READY_TO_CLOSE'];
    const period = periods.find(p => open.includes(p.status)) || periods[0];
    return { active, probation, activeContracts, expiring, waitingApply, deptRows, unassigned, recent, period };
  }, [employees, departments, contracts, leaves, periods]);

  const actionCount = d.waitingApply + d.expiring + findings.length;

  return <ScrollView style={hrStyles.screen} contentContainerStyle={hrStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>QUẢN TRỊ NHÂN SỰ</Text>
        <Text accessibilityRole="header" style={styles.title}>Tổng quan nhân sự</Text>
        <Text style={styles.greeting}>Xin chào, {user.fullName}</Text>
      </View>
      <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>{initialsOf(user.fullName)}</Text></View>
    </View>
    {error ? <ErrorBanner message={error} /> : null}
    {loading ? <LoadingBlock /> : <>
      {actionCount > 0 ? <View style={styles.alert}>
        <AppIcon name="alert-circle-outline" size={22} color={colors.warningText} />
        <Text style={styles.alertText}>{actionCount} việc cần xử lý: {d.waitingApply} đơn nghỉ chờ áp dụng, {d.expiring} hợp đồng sắp hết hạn, {findings.length} cảnh báo tuân thủ</Text>
      </View> : null}
      <View style={styles.row}>
        <MetricTile label="Nhân viên" value={String(employees.length)} icon="people-outline" bg={colors.infoSoft} fg={colors.info} hint={`${d.active} đang làm · ${d.probation} thử việc`} onPress={() => onNavigate('employees')} />
        <MetricTile label="Phòng ban" value={String(departments.length)} icon="business-outline" bg={colors.successSoft} fg={colors.successText} hint={`${departments.filter(x => x.active !== false).length} đang hoạt động`} />
      </View>
      <View style={styles.row}>
        <MetricTile label="Hợp đồng hiệu lực" value={String(d.activeContracts)} icon="document-text-outline" bg={colors.primarySoft} fg={colors.primary} hint={`${d.expiring} sắp hết hạn`} onPress={() => onNavigate('contracts')} />
        <MetricTile label="Đơn nghỉ chờ áp dụng" value={String(d.waitingApply)} icon="calendar-outline" bg={colors.warningSoft} fg={colors.warningText} hint="Quản lý đã duyệt" onPress={() => onNavigate('leaves')} />
      </View>
      {d.period ? <>
        <View style={styles.gapTop}><SectionTitle>Kỳ công hiện tại</SectionTitle></View>
        <Card style={styles.periodCard}>
          <View style={styles.periodIcon}><AppIcon name="calendar-outline" size={22} color={colors.info} /></View>
          <View style={styles.flex}>
            <Text style={styles.periodTitle}>Tháng {formatPeriod(d.period.period)}</Text>
            <Text style={styles.muted}>{formatDate(d.period.startDate)} - {formatDate(d.period.endDate)}</Text>
          </View>
          <ToneBadge label={periodStatusLabel(d.period.status)} tone={d.period.status === 'OPEN' ? 'success' : 'info'} />
        </Card>
      </> : null}
      {findings.length ? <>
        <View style={styles.gapTop}><SectionTitle>Cảnh báo tuân thủ hợp đồng</SectionTitle></View>
        {findings.slice(0, 5).map((f, i) => <Card key={`${f.employeeCode}-${i}`} style={styles.finding}>
          <AppIcon name="warning-outline" size={20} color={colors.warningText} />
          <View style={styles.flex}>
            <Text style={styles.itemName}>{f.employeeFullName || f.employeeCode}</Text>
            <Text style={styles.muted}>{complianceLabel(f.code)}</Text>
          </View>
        </Card>)}
        {findings.length > 5 ? <Text style={styles.muted}>và {findings.length - 5} cảnh báo khác, xem đầy đủ trên web</Text> : null}
      </> : null}
      {employees.length ? <>
        <View style={styles.gapTop}><SectionTitle>Nhân sự theo phòng ban</SectionTitle></View>
        <Card>
          {d.deptRows.map(r => <Bar key={r.name} name={r.name} count={r.count} total={employees.length} />)}
          {d.unassigned > 0 ? <Bar name="Chưa phân bổ" count={d.unassigned} total={employees.length} /> : null}
        </Card>
        <View style={styles.gapTop}><SectionTitle>Nhân viên mới</SectionTitle></View>
        {d.recent.map(e => <Card key={e._id} style={styles.recent}>
          <Avatar name={e.fullName || ''} size={38} />
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.itemName}>{e.fullName || e.employeeCode}</Text>
            <Text style={styles.muted}>{e.employeeCode}</Text>
            <Text style={styles.muted}>Vào làm {formatDate(e.joinDate)}</Text>
          </View>
          <ToneBadge label={employmentStatusLabel(e.employmentStatus)} tone={employmentStatusTone(e.employmentStatus)} />
        </Card>)}
      </> : null}
    </>}
  </ScrollView>;
}

function Bar({ name, count, total }: { name: string; count: number; total: number }) {
  const pct = total ? count / total : 0;
  return <View style={styles.bar}>
    <View style={styles.barTop}><Text numberOfLines={1} style={styles.barName}>{name}</Text><Text style={styles.barCount}>{count} · {Math.round(pct * 100)}%</Text></View>
    <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct * 100}%` }]} /></View>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: 6 },
  greeting: { color: colors.inkSoft, fontSize: 14, marginTop: 4 },
  headerAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: colors.primary, fontWeight: '800' },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningSoft },
  alertText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  gapTop: { marginTop: 10 },
  periodCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  periodIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' },
  periodTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  finding: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  itemName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  bar: { paddingVertical: 6 },
  barTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  barName: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' },
  barCount: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  barTrack: { height: 6, borderRadius: 4, backgroundColor: colors.background, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 4, backgroundColor: colors.primary },
});
