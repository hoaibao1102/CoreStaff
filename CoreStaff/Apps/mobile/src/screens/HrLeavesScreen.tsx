import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { friendlyEmployeeError } from '../employee-api';
import { applyHrLeave, getHrEmployees, getHrLeaves, leaveDurationLabel, leaveStatusLabel, type HrEmployee, type HrLeave } from '../hr-api';
import { AppButton, Card, EmptyState, ErrorBanner, LoadingBlock, ScreenHeader, SuccessBanner, formatDate, formatMinutes } from '../components/ui';
import { Avatar, FilterChips, hrStyles, ToneBadge, type Tone } from '../components/HrParts';
import { colors } from '../theme';

type Filter = 'APPROVED' | 'HR_APPLIED' | 'ALL';

const statusTone = (s: string): Tone => s === 'APPROVED' || s === 'HR_APPLIED' ? 'success' : s === 'REJECTED' ? 'danger' : s.startsWith('PENDING') || s === 'CLARIFICATION_REQUESTED' ? 'warning' : 'neutral';

/** Đơn nghỉ phép HR cần xử lý: quản lý đã duyệt, HR áp dụng vào bảng công. */
export function HrLeavesScreen({ apiBase, realtimeRevision = 0 }: { apiBase: string; realtimeRevision?: number }) {
  const [leaves, setLeaves] = useState<HrLeave[]>([]);
  // Đơn nghỉ lưu userId của nhân viên nên ghép tên qua danh bạ.
  const [byUserId, setByUserId] = useState<Record<string, HrEmployee>>({});
  const [filter, setFilter] = useState<Filter>('APPROVED');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [items, employees] = await Promise.all([getHrLeaves(apiBase), getHrEmployees(apiBase)]);
      const map: Record<string, HrEmployee> = {};
      (employees || []).forEach(e => { if (e.userId) map[e.userId] = e; });
      setByUserId(map);
      setLeaves([...(items || [])].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      setError(null);
    } catch (reason) { setError(friendlyEmployeeError(reason)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [apiBase, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);

  const waiting = useMemo(() => leaves.filter(l => l.status === 'APPROVED').length, [leaves]);
  const filtered = filter === 'ALL' ? leaves : leaves.filter(l => l.status === filter);
  const options: Array<{ value: Filter; label: string }> = [
    { value: 'APPROVED', label: waiting > 0 ? `Chờ áp dụng (${waiting})` : 'Chờ áp dụng' },
    { value: 'HR_APPLIED', label: 'Đã áp dụng' },
    { value: 'ALL', label: 'Tất cả' },
  ];

  const run = async (leave: HrLeave, name: string) => {
    setApplyingId(leave._id); setError(null); setSuccess(null);
    try { await applyHrLeave(apiBase, leave._id); setSuccess(`Đã áp dụng đơn nghỉ của ${name}.`); await load(true); }
    catch (reason) { setError(friendlyEmployeeError(reason)); }
    finally { setApplyingId(null); }
  };
  const apply = (leave: HrLeave) => {
    const name = byUserId[leave.employeeId]?.fullName || 'nhân viên';
    Alert.alert('Áp dụng đơn nghỉ', `Áp dụng đơn nghỉ ${formatDate(leave.startDate)} - ${formatDate(leave.endDate)} của ${name} vào bảng công? Thao tác này không hoàn tác được.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Áp dụng', onPress: () => void run(leave, name) },
    ]);
  };

  return <ScrollView style={hrStyles.screen} contentContainerStyle={hrStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <ScreenHeader eyebrow="NGHỈ PHÉP" title="Đơn nghỉ phép" description="Áp dụng đơn đã được quản lý duyệt vào bảng công." />
    {error ? <ErrorBanner message={error} /> : null}
    {success ? <SuccessBanner message={success} /> : null}
    <FilterChips value={filter} options={options} onChange={setFilter} />
    {loading ? <LoadingBlock /> : !filtered.length ? <EmptyState icon="calendar-outline" title="Không có đơn" description={filter === 'APPROVED' ? 'Không có đơn nào đang chờ áp dụng.' : 'Chưa có đơn nghỉ phép nào.'} /> : filtered.map(l => {
      const emp = byUserId[l.employeeId];
      const name = emp?.fullName || 'Nhân viên';
      return <Card key={l._id}>
        <View style={styles.top}>
          <Avatar name={name} size={40} />
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.name}>{name}</Text>
            <Text style={styles.meta}>{emp?.employeeCode || ''}</Text>
          </View>
          <ToneBadge label={leaveStatusLabel(l.status)} tone={statusTone(l.status)} />
        </View>
        <Text style={styles.type}>{l.leaveType === 'PAID_LEAVE' ? 'Nghỉ phép có lương' : 'Nghỉ không lương'}</Text>
        <Text style={styles.range}>{formatDate(l.startDate)} - {formatDate(l.endDate)}</Text>
        <Text style={styles.meta}>{leaveDurationLabel(l.durationType)}{l.requestedStart && l.requestedEnd ? ` · ${l.requestedStart}–${l.requestedEnd}` : ''}</Text>
        {typeof l.calculatedMinutes === 'number' ? <Text style={styles.result}>{formatMinutes(l.calculatedMinutes)} · {(l.leaveEquivalent ?? 0).toFixed(2)} ngày phép</Text> : null}
        {l.reason ? <Text style={styles.reason}>{l.reason}</Text> : null}
        {l.status === 'APPROVED' ? <View style={styles.action}><AppButton label="Áp dụng vào bảng công" loading={applyingId === l._id} disabled={applyingId !== null} onPress={() => apply(l)} /></View> : null}
      </Card>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12 },
  type: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 12 },
  range: { color: colors.inkSoft, fontSize: 13, marginTop: 4 },
  result: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 6 },
  reason: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 8 },
  action: { marginTop: 12 },
});
