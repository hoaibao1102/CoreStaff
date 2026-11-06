import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { friendlyEmployeeError } from '../employee-api';
import { contractStatusLabel, contractStatusTone, contractTypeLabel, getHrCompliance, getHrContracts, type ComplianceFinding, type HrContract } from '../hr-api';
import { Card, EmptyState, ErrorBanner, ErrorState, LoadingBlock, ScreenHeader, formatDate } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
import { FilterChips, hrStyles, SearchBox, ToneBadge } from '../components/HrParts';
import { colors, radius } from '../theme';

type Filter = 'ALL' | 'EXPIRING' | 'ACTIVE' | 'EXPIRED';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'ALL', label: 'Tất cả' }, { value: 'EXPIRING', label: 'Sắp hết hạn' }, { value: 'ACTIVE', label: 'Hiệu lực' }, { value: 'EXPIRED', label: 'Hết hạn' },
];

const isExpiring = (c: HrContract) => c.isExpiringSoon === true || (typeof c.expiryWarningDays === 'number' && c.expiryWarningDays <= 30 && c.isExpired !== true && c.status === 'ACTIVE');
const isExpired = (c: HrContract) => c.isExpired === true || c.status === 'EXPIRED';

/** Hợp đồng lao động (chỉ đọc), khớp web/src/screens/Contracts: nổi bật hợp đồng sắp hết hạn và cảnh báo tuân thủ. */
export function HrContractsScreen({ apiBase, realtimeRevision = 0 }: { apiBase: string; realtimeRevision?: number }) {
  const [contracts, setContracts] = useState<HrContract[]>([]);
  const [findings, setFindings] = useState<ComplianceFinding[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = (await getHrContracts(apiBase)) || [];
      // Cảnh báo tuân thủ là phần phụ: danh sách hợp đồng vẫn hiển thị khi nó lỗi.
      let found: ComplianceFinding[] = [];
      try { found = (await getHrCompliance(apiBase))?.findings || []; } catch { /* bỏ qua */ }
      setContracts(data); setFindings(found); setError(null);
    } catch (reason) { setError(friendlyEmployeeError(reason)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [apiBase, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contracts.filter(c => {
      const ok = filter === 'EXPIRING' ? isExpiring(c) : filter === 'ACTIVE' ? c.status === 'ACTIVE' : filter === 'EXPIRED' ? isExpired(c) : true;
      return ok && (!needle || `${c.employeeFullName || ''} ${c.employeeCode || ''}`.toLowerCase().includes(needle));
    });
  }, [contracts, query, filter]);

  return <ScrollView style={hrStyles.screen} contentContainerStyle={hrStyles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <ScreenHeader eyebrow="HỢP ĐỒNG" title="Hợp đồng lao động" description="Theo dõi hiệu lực và thời hạn hợp đồng." />
    {error && (loading || contracts.length > 0) ? <ErrorBanner message={error} /> : null}
    {!loading && findings.length ? <View style={styles.alert}>
      <AppIcon name="warning-outline" size={22} color={colors.warningText} />
      <Text style={styles.alertText}>{findings.length} cảnh báo tuân thủ: nhân viên chưa có hợp đồng hoặc hợp đồng đã quá hạn.</Text>
    </View> : null}
    <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tên hoặc mã nhân viên" />
    <FilterChips value={filter} options={FILTERS} onChange={setFilter} />
    {loading ? <LoadingBlock /> : error && !contracts.length ? <ErrorState message={error} onRetry={() => void load()} /> : !filtered.length ? <EmptyState icon="document-text-outline" title="Không có hợp đồng" description="Không có hợp đồng phù hợp." /> : filtered.map(c => <ContractCard key={c._id} contract={c} />)}
  </ScrollView>;
}

function ContractCard({ contract: c }: { contract: HrContract }) {
  const expiring = isExpiring(c);
  const expired = isExpired(c);
  return <Card style={expiring ? styles.expiringCard : undefined}>
    <View style={styles.top}>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.name}>{c.employeeFullName || c.employeeCode}</Text>
        <Text style={styles.meta}>{c.employeeCode} · {contractTypeLabel(c.contractType)}</Text>
      </View>
      <ToneBadge label={contractStatusLabel(c.status)} tone={contractStatusTone(c.status)} />
    </View>
    <View style={styles.dates}>
      <AppIcon name="calendar-outline" size={16} color={colors.muted} />
      <Text style={styles.dateText}>{formatDate(c.effectiveDate)} - {c.expiryDate ? formatDate(c.expiryDate) : 'Không thời hạn'}</Text>
    </View>
    {expiring && typeof c.expiryWarningDays === 'number' ? <View style={styles.tag}><ToneBadge label={`Còn ${Math.round(c.expiryWarningDays)} ngày hết hạn`} tone="warning" /></View> : expired ? <View style={styles.tag}><ToneBadge label="Đã hết hạn" tone="danger" /></View> : null}
  </Card>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningSoft },
  alertText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  expiringCard: { borderColor: colors.warning },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  dates: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  dateText: { flex: 1, color: colors.inkSoft, fontSize: 13 },
  tag: { marginTop: 8 },
});
