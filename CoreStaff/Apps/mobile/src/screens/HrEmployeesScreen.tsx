import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { friendlyEmployeeError } from '../employee-api';
import { employmentStatusLabel, employmentStatusTone, employmentTypeLabel, getHrEmployees, type HrEmployee } from '../hr-api';
import { Card, EmptyState, ErrorBanner, ErrorState, LoadingBlock, ScreenHeader, formatDate } from '../components/ui';
import { Avatar, FilterChips, hrStyles, SearchBox, SectionTitle, ToneBadge } from '../components/HrParts';
import { colors, radius } from '../theme';

type StatusFilter = 'ALL' | 'ACTIVE' | 'PROBATION' | 'OFF';
const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả' }, { value: 'ACTIVE', label: 'Đang làm' }, { value: 'PROBATION', label: 'Thử việc' }, { value: 'OFF', label: 'Đã nghỉ' },
];

const matches = (e: HrEmployee, f: StatusFilter) => f === 'ALL' ? true : f === 'OFF' ? e.employmentStatus === 'RESIGNED' || e.employmentStatus === 'TERMINATED' : e.employmentStatus === f;

/** Danh bạ nhân sự (chỉ đọc), khớp web/src/screens/EmployeeDirectory. */
export function HrEmployeesScreen({ apiBase, realtimeRevision = 0 }: { apiBase: string; realtimeRevision?: number }) {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [selected, setSelected] = useState<HrEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try { setEmployees((await getHrEmployees(apiBase)) || []); setError(null); }
    catch (reason) { setError(friendlyEmployeeError(reason)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [apiBase, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);

  /** API chỉ trả directManagerId (mã hồ sơ) nên ghép tên từ danh bạ đã tải. */
  const managerNameOf = (e: HrEmployee) => {
    if (e.managerName) return e.managerName;
    if (!e.directManagerId) return null;
    return employees.find(m => m._id === e.directManagerId)?.fullName || null;
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter(e => matches(e, status) && (!needle || `${e.fullName || ''} ${e.employeeCode || ''} ${e.email || ''}`.toLowerCase().includes(needle)));
  }, [employees, query, status]);

  return <>
    <ScrollView style={hrStyles.screen} contentContainerStyle={hrStyles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
      <ScreenHeader eyebrow="NHÂN SỰ" title="Nhân viên" description="Tra cứu hồ sơ nhân viên trong tổ chức." />
      {error && (loading || employees.length > 0) ? <ErrorBanner message={error} /> : null}
      <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tên, mã hoặc email" />
      <FilterChips value={status} options={FILTERS} onChange={setStatus} />
      {loading ? <LoadingBlock /> : error && !employees.length ? <ErrorState message={error} onRetry={() => void load()} /> : <>
        <SectionTitle right={`${filtered.length}/${employees.length}`}>Danh sách</SectionTitle>
        {!filtered.length ? <EmptyState icon="people-outline" title="Không tìm thấy nhân viên" description="Không tìm thấy nhân viên phù hợp." /> : filtered.map(e => <EmployeeRow key={e._id} employee={e} onPress={() => setSelected(e)} />)}
      </>}
    </ScrollView>
    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
      <Pressable style={styles.backdrop} onPress={() => setSelected(null)} accessibilityLabel="Đóng chi tiết" />
      {selected ? <EmployeeDetail employee={selected} managerName={managerNameOf(selected)} /> : null}
    </Modal>
  </>;
}

function EmployeeRow({ employee: e, onPress }: { employee: HrEmployee; onPress: () => void }) {
  const name = e.fullName || e.employeeCode || '';
  const sub = [e.departmentName, e.positionName].filter(Boolean).join(' · ');
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
    <Card style={styles.row}>
      <Avatar name={name} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTop}>
          <Text style={styles.name}>{name}</Text>
          <ToneBadge label={employmentStatusLabel(e.employmentStatus)} tone={employmentStatusTone(e.employmentStatus)} />
        </View>
        <Text style={styles.meta}>{e.employeeCode}</Text>
        {sub ? <Text style={styles.meta}>{sub}</Text> : null}
      </View>
    </Card>
  </Pressable>;
}

function EmployeeDetail({ employee: e, managerName }: { employee: HrEmployee; managerName: string | null }) {
  const name = e.fullName || e.employeeCode || '';
  const line = (label: string, value?: string | null) => <View key={label} style={styles.line}><Text style={styles.lineLabel}>{label}</Text><Text style={styles.lineValue}>{value || '-'}</Text></View>;
  return <View style={styles.sheet}>
    <View style={styles.handle} />
    <ScrollView contentContainerStyle={styles.sheetContent}>
      <View style={styles.sheetHead}>
        <Avatar name={name} size={54} />
        <View style={styles.rowCopy}>
          <Text style={styles.sheetName}>{name}</Text>
          <ToneBadge label={employmentStatusLabel(e.employmentStatus)} tone={employmentStatusTone(e.employmentStatus)} />
        </View>
      </View>
      <View style={styles.divider} />
      {line('Mã nhân viên', e.employeeCode)}
      {line('Email', e.email)}
      {line('Phòng ban', e.departmentName)}
      {line('Chức danh', e.positionName)}
      {line('Quản lý trực tiếp', managerName)}
      {line('Loại hình', employmentTypeLabel(e.employmentType))}
      {line('Ngày vào làm', formatDate(e.joinDate))}
      {line('Người phụ thuộc', String(e.dependents?.length ?? 0))}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCopy: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  backdrop: { flex: 1, backgroundColor: colors.ink, opacity: 0.45 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetContent: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 32 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetName: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 14 },
  line: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9 },
  lineLabel: { width: 120, color: colors.muted, fontSize: 13 },
  lineValue: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' },
});
