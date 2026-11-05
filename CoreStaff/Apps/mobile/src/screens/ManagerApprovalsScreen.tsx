import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { friendlyEmployeeError } from '../employee-api';
import {
  approvalEmployeeKey, approvalLabel, approveLeave, decideApproval, getPendingApprovals, getPendingLeaveRequests, getTeam, isWebOnlyApproval, rejectLeave,
  type ApprovalAction, type ManagerApproval, type ManagerLeaveRequest, type TeamMember,
} from '../manager-api';
import { AppButton, Card, EmptyState, ErrorBanner, ErrorState, Field, LoadingBlock, ScreenHeader, SegmentedControl, SuccessBanner, formatDate, formatTime } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
import { RequestsScreen } from './RequestsScreen';
import { colors, radius, spacing } from '../theme';

type Tab = 'review' | 'mine';

interface Row {
  key: string;
  kind: 'leave' | 'approval';
  name: string;
  code?: string;
  createdAt: string;
  leave?: ManagerLeaveRequest;
  approval?: ManagerApproval;
}

const DURATION: Record<string, string> = { FULL_DAY: 'Cả ngày', MORNING_HALF: 'Buổi sáng', AFTERNOON_HALF: 'Buổi chiều', CUSTOM_HOURS: 'Theo giờ' };
const minutesText = (value?: number) => { const m = Math.max(0, value || 0); const h = Math.floor(m / 60); return h ? `${h} giờ${m % 60 ? ` ${m % 60} phút` : ''}` : `${m} phút`; };

export function ManagerApprovalsScreen({ apiBase, realtimeRevision = 0, onCountChange }: { apiBase: string; realtimeRevision?: number; onCountChange?: (count: number) => void }) {
  const [tab, setTab] = useState<Tab>('review');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [leaves, setLeaves] = useState<ManagerLeaveRequest[]>([]);
  const [approvals, setApprovals] = useState<ManagerApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError(null);
    const [teamResult, leaveResult, approvalResult] = await Promise.allSettled([getTeam(apiBase), getPendingLeaveRequests(apiBase), getPendingApprovals(apiBase)]);
    if (teamResult.status === 'fulfilled') setTeam(teamResult.value || []);
    if (leaveResult.status === 'fulfilled') setLeaves(leaveResult.value || []);
    if (approvalResult.status === 'fulfilled') setApprovals(approvalResult.value || []);
    const failure = [teamResult, leaveResult, approvalResult].find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') setError(friendlyEmployeeError(failure.reason));
    setLoading(false); setRefreshing(false);
  }, [apiBase, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo<Row[]>(() => {
    const names = new Map<string, TeamMember>();
    team.forEach(member => { names.set(member.id, member); names.set(member.userId, member); });
    const nameOf = (key: string) => names.get(key);
    return [
      ...leaves.map<Row>(leave => { const member = nameOf(String(leave.employeeId)); return { key: `leave-${leave._id}`, kind: 'leave', name: member?.fullName || 'Nhân viên', code: member?.employeeCode, createdAt: leave.createdAt || leave.startDate, leave }; }),
      ...approvals.map<Row>(approval => { const member = nameOf(approvalEmployeeKey(approval)); return { key: `approval-${approval._id}`, kind: 'approval', name: member?.fullName || 'Nhân viên', code: member?.employeeCode, createdAt: approval.createdAt || approval.workDate, approval }; }),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [approvals, leaves, team]);

  useEffect(() => { onCountChange?.(rows.length); }, [onCountChange, rows.length]);

  const done = async (message: string, warnings: string[]) => {
    setSelected(null); setSuccess(message);
    await load(true);
    if (warnings.length) Alert.alert('Cảnh báo giới hạn lao động', warnings.join('\n'));
  };

  return <View style={styles.screen}>
    <View style={styles.top}>
      <ScreenHeader title="Duyệt đơn" description="Xử lý đơn của nhân viên và theo dõi đơn của bạn." />
      <SegmentedControl value={tab} onChange={value => { setTab(value); setSuccess(null); }} options={[{ value: 'review', label: `Cần duyệt${rows.length ? ` (${rows.length})` : ''}` }, { value: 'mine', label: 'Đơn của tôi' }]} />
    </View>
    {tab === 'mine' ? <RequestsScreen apiBase={apiBase} realtimeRevision={realtimeRevision} embedded /> :
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
        {success ? <SuccessBanner message={success} /> : null}
        {error && (loading || rows.length > 0) ? <ErrorBanner message={error} /> : null}
        {loading ? <LoadingBlock /> : error && !rows.length ? <ErrorState message={error} onRetry={() => void load()} /> : !rows.length
          ? <EmptyState icon="checkmark-done-outline" title="Không còn đơn chờ duyệt" description="Khi nhân viên gửi đơn nghỉ phép hoặc tăng ca, đơn sẽ xuất hiện ở đây." />
          : rows.map(row => <RequestCard key={row.key} row={row} onPress={() => { setSuccess(null); setSelected(row); }} />)}
      </ScrollView>}
    <DecisionModal row={selected} apiBase={apiBase} onClose={() => setSelected(null)} onDone={done} />
  </View>;
}

function RequestCard({ row, onPress }: { row: Row; onPress: () => void }) {
  const leave = row.leave; const approval = row.approval;
  const title = leave ? 'Nghỉ phép' : approvalLabel(approval!);
  const when = leave ? `${formatDate(leave.startDate)}${leave.endDate !== leave.startDate ? ` - ${formatDate(leave.endDate)}` : ''} · ${DURATION[leave.durationType || 'FULL_DAY']}` : `${formatDate(approval!.workDate)}${approval!.requestedStart ? ` · ${formatTime(approval!.requestedStart)} - ${formatTime(approval!.requestedEnd)}` : ''}`;
  const initials = row.name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title} của ${row.name}`} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials || 'NV'}</Text></View>
        <View style={styles.cardCopy}><Text numberOfLines={1} style={styles.name}>{row.name}</Text><Text style={styles.meta}>{title}</Text></View>
        <AppIcon name="chevron-forward" size={18} color={colors.faint} />
      </View>
      <View style={styles.when}><AppIcon name={leave ? 'calendar-outline' : 'time-outline'} size={16} color={colors.muted} /><Text style={styles.whenText}>{when}</Text></View>
      <Text numberOfLines={2} style={styles.reason}>{(leave?.reason || approval?.reason) ?? ''}</Text>
    </Card>
  </Pressable>;
}

function DecisionModal({ row, apiBase, onClose, onDone }: { row: Row | null; apiBase: string; onClose: () => void; onDone: (message: string, warnings: string[]) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setComment(''); setError(null); }, [row?.key]);
  if (!row) return <Modal visible={false} transparent />;
  const leave = row.leave; const approval = row.approval;
  const webOnly = !!approval && isWebOnlyApproval(approval);

  const run = async (action: ApprovalAction) => {
    if (action !== 'approve' && comment.trim().length < 3) return setError(action === 'reject' ? 'Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự).' : 'Vui lòng nhập nội dung cần nhân viên bổ sung (tối thiểu 3 ký tự).');
    setBusy(true); setError(null);
    try {
      let warnings: string[] = [];
      if (leave) { action === 'approve' ? await approveLeave(apiBase, leave._id) : await rejectLeave(apiBase, leave._id, comment.trim()); }
      else if (approval) { const decided = await decideApproval(apiBase, approval, action, comment.trim()); warnings = (decided.compliance?.violations || []).map(item => item.message); }
      await onDone(action === 'approve' ? `Đã duyệt đơn của ${row.name}.` : action === 'reject' ? `Đã từ chối đơn của ${row.name}.` : `Đã yêu cầu ${row.name} bổ sung giải trình.`, warnings);
    } catch (err) { setError(friendlyEmployeeError(err)); } finally { setBusy(false); }
  };

  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ height: insets.top, backgroundColor: colors.background }} />
      <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: spacing.huge + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.modalHeader}>
          <View style={styles.cardCopy}><Text style={styles.modalEyebrow}>{leave ? 'ĐƠN NGHỈ PHÉP' : approvalLabel(approval!).toUpperCase()}</Text><Text accessibilityRole="header" style={styles.modalTitle}>{row.name}</Text>{row.code ? <Text style={styles.meta}>{row.code}</Text> : null}</View>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng" disabled={busy} onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><AppIcon name="close" size={22} color={colors.inkSoft} /></Pressable>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
        <Card style={styles.detail}>
          {leave ? <>
            <Detail label="Loại nghỉ" value={leave.leaveType === 'PAID_LEAVE' ? 'Có lương' : 'Không lương'} />
            <Detail label="Thời gian" value={`${formatDate(leave.startDate)}${leave.endDate !== leave.startDate ? ` - ${formatDate(leave.endDate)}` : ''}`} />
            <Detail label="Thời lượng" value={`${DURATION[leave.durationType || 'FULL_DAY']}${leave.requestedStart && leave.requestedEnd && leave.durationType === 'CUSTOM_HOURS' ? ` (${leave.requestedStart}–${leave.requestedEnd})` : ''}`} />
            {leave.calculatedMinutes != null ? <Detail label="Quy đổi" value={`${minutesText(leave.calculatedMinutes)} · ${Number((leave.leaveEquivalent || 0).toFixed(3))} ngày phép`} /> : null}
            <Detail label="Lý do" value={leave.reason} last />
          </> : <>
            <Detail label="Ngày làm việc" value={formatDate(approval!.workDate)} />
            {approval!.requestedStart ? <Detail label="Khung giờ" value={`${formatTime(approval!.requestedStart)} - ${formatTime(approval!.requestedEnd)}`} /> : null}
            {approval!.workDescription ? <Detail label="Công việc" value={approval!.workDescription} /> : null}
            {approval!.metadata?.address ? <Detail label="Địa điểm" value={String(approval!.metadata.address)} /> : null}
            {approval!.isRetroactive ? <Detail label="Khai báo muộn" value={approval!.retroactiveReason || 'Có'} /> : null}
            <Detail label="Lý do" value={approval!.reason} last />
          </>}
        </Card>
        {webOnly ? <View style={styles.notice}><Text style={styles.noticeText}>Đơn xác nhận công theo lịch cần kiểm tra kỳ công và ngữ cảnh nên chỉ duyệt được trên web.</Text></View> : <>
          <Field label={leave ? 'Lý do (bắt buộc khi từ chối)' : 'Ý kiến (bắt buộc khi từ chối hoặc yêu cầu bổ sung)'} value={comment} onChangeText={setComment} multiline placeholder="Nhập ý kiến xử lý" editable={!busy} />
          <AppButton label="Duyệt đơn" loading={busy} disabled={busy} onPress={() => void run('approve')} />
          <AppButton label="Từ chối" variant="danger" disabled={busy} onPress={() => void run('reject')} />
          {approval ? <AppButton label="Yêu cầu bổ sung" variant="secondary" disabled={busy} onPress={() => void run('request-clarification')} /> : null}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

function Detail({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.detailRow, !last && styles.detailBorder]}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  content: { padding: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.huge + 16, gap: spacing.md },
  card: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardCopy: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whenText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  reason: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { opacity: 0.75 },
  modal: { flex: 1, backgroundColor: colors.background },
  modalContent: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  modalEyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  modalTitle: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 4 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  detail: { paddingVertical: 0, paddingHorizontal: spacing.md },
  detailRow: { paddingVertical: 12, gap: 3 },
  detailBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  detailLabel: { color: colors.muted, fontSize: 12 },
  detailValue: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  notice: { borderWidth: 1, borderColor: '#fde68a', backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.sm },
  noticeText: { color: colors.warningText, fontSize: 13, lineHeight: 19 },
});
