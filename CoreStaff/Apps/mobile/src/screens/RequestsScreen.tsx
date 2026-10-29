import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createLeaveRequest, createOvertimeRequest, friendlyEmployeeError, getMyLeaveRequests, getMyOvertimeRequests, previewLeaveRequest, type LeaveDurationType, type LeavePreview, type LeaveRequest, type OvertimeRequest } from '../employee-api';
import { AppButton, Card, EmptyState, ErrorBanner, ErrorState, Field, LoadingBlock, ScreenHeader, SegmentedControl, StatusBadge, SuccessBanner, formatDate, formatTime } from '../components/ui';
import { colors, radius, spacing } from '../theme';
import { AppIcon, type AppIconName } from '../components/AppIcon';

type Filter = 'all' | 'leave' | 'overtime';
type FormType = 'leave' | 'overtime';

export function RequestsScreen({ apiBase, realtimeRevision = 0 }: { apiBase: string; realtimeRevision?: number }) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [overtime, setOvertime] = useState<OvertimeRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [form, setForm] = useState<FormType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError(null);
    const [leaveResult, overtimeResult] = await Promise.allSettled([getMyLeaveRequests(apiBase), getMyOvertimeRequests(apiBase)]);
    if (leaveResult.status === 'fulfilled') setLeaves(leaveResult.value || []);
    if (overtimeResult.status === 'fulfilled') setOvertime(overtimeResult.value || []);
    const failure = leaveResult.status === 'rejected' ? leaveResult.reason : overtimeResult.status === 'rejected' ? overtimeResult.reason : null;
    if (failure) setError(friendlyEmployeeError(failure));
    setLoading(false); setRefreshing(false);
  }, [apiBase, realtimeRevision]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => [
    ...(filter !== 'overtime' ? leaves.map(value => ({ type: 'leave' as const, value, date: value.createdAt || value.startDate })) : []),
    ...(filter !== 'leave' ? overtime.map(value => ({ type: 'overtime' as const, value, date: value.createdAt || value.workDate })) : []),
  ].sort((a, b) => b.date.localeCompare(a.date)), [filter, leaves, overtime]);

  return <>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
      <ScreenHeader eyebrow="ĐƠN TỪ" title="Yêu cầu của tôi" description="Tạo và theo dõi phê duyệt nghỉ phép, tăng ca." action={<Pressable accessibilityRole="button" accessibilityLabel="Tạo đơn nghỉ phép" onPress={() => { setSuccess(null); setForm('leave'); }} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><AppIcon name="add" size={26} color="#fff" /></Pressable>} />
      {error && (loading || rows.length > 0) ? <ErrorBanner message={error} /> : null}{success ? <SuccessBanner message={success} /> : null}
      <View style={styles.actionRow}><ActionCard icon="calendar-outline" title="Xin nghỉ phép" description="Có lương hoặc không lương" onPress={() => { setSuccess(null); setForm('leave'); }} /><ActionCard icon="time-outline" title="Đăng ký tăng ca" description="Hệ thống tự phân loại OT" onPress={() => { setSuccess(null); setForm('overtime'); }} /></View>
      <SegmentedControl value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tất cả' }, { value: 'leave', label: 'Nghỉ phép' }, { value: 'overtime', label: 'Tăng ca' }]} />
      <View style={styles.listHeading}><Text style={styles.sectionTitle}>Hoạt động gần đây</Text><Text style={styles.count}>{rows.length} yêu cầu</Text></View>
      {loading ? <LoadingBlock /> : error && !rows.length ? <ErrorState message={error} onRetry={() => void load()} /> : !rows.length ? <EmptyState icon="checkmark-done-outline" title="Chưa có yêu cầu" description="Đơn nghỉ phép và đăng ký tăng ca sẽ xuất hiện tại đây." /> : rows.map(row => row.type === 'leave' ? <LeaveCard key={`leave-${row.value._id}`} item={row.value} /> : <OvertimeCard key={`ot-${row.value._id}`} item={row.value} />)}
    </ScrollView>
    <RequestModal type={form} apiBase={apiBase} onClose={() => setForm(null)} onCreated={async message => { setForm(null); setSuccess(message); await load(true); }} />
  </>;
}

function ActionCard({ icon, title, description, onPress }: { icon: AppIconName; title: string; description: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}><View style={styles.actionIcon}><AppIcon name={icon} size={21} color={colors.primaryDark} /></View><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDescription}>{description}</Text></Pressable>; }
function LeaveCard({ item }: { item: LeaveRequest }) { return <Card style={styles.requestCard}><View style={styles.requestTop}><View style={styles.requestType}><AppIcon name="calendar-outline" size={19} color={colors.successText} /></View><View style={styles.requestCopy}><Text style={styles.requestTitle}>{item.leaveType === 'PAID_LEAVE' ? 'Nghỉ phép có lương' : 'Nghỉ không lương'}</Text><Text style={styles.requestDate}>{formatDate(item.startDate)} - {formatDate(item.endDate)}</Text><Text style={styles.requestDate}>{durationLabel(item.durationType)}{item.requestedStart && item.requestedEnd ? ` · ${item.requestedStart}–${item.requestedEnd}` : ''}</Text></View><StatusBadge status={item.status} label={statusLabel(item.status)} /></View>{item.calculatedMinutes != null ? <Text style={styles.result}>{formatMinutesValue(item.calculatedMinutes)} · {Number((item.leaveEquivalent || 0).toFixed(3))} ngày phép</Text> : null}<Text numberOfLines={2} style={styles.reason}>{item.reason}</Text>{item.reviewComment ? <Text style={styles.comment}>Phản hồi quản lý: {item.reviewComment}</Text> : null}</Card>; }
function OvertimeCard({ item }: { item: OvertimeRequest }) { return <Card style={styles.requestCard}><View style={styles.requestTop}><View style={[styles.requestType, styles.requestTypeOt]}><AppIcon name="time-outline" size={20} color={colors.primaryDark} /></View><View style={styles.requestCopy}><Text style={styles.requestTitle}>Tăng ca ngày {formatDate(item.workDate)}</Text><Text style={styles.requestDate}>{formatTime(item.requestedStart)} - {formatTime(item.requestedEnd)}</Text></View><StatusBadge status={item.status} label={statusLabel(item.status)} /></View><Text numberOfLines={2} style={styles.reason}>{item.reason}</Text>{item.overtimeResult?.eligibleMinutes != null ? <Text style={styles.result}>Đủ điều kiện: {item.overtimeResult.eligibleMinutes} phút</Text> : null}{item.reviewComment ? <Text style={styles.comment}>Phản hồi: {item.reviewComment}</Text> : null}</Card>; }

function RequestModal({ type, apiBase, onClose, onCreated }: { type: FormType | null; apiBase: string; onClose: () => void; onCreated: (message: string) => Promise<void> }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveType, setLeaveType] = useState<'PAID_LEAVE' | 'UNPAID_LEAVE'>('PAID_LEAVE');
  const [durationType, setDurationType] = useState<LeaveDurationType>('FULL_DAY');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('20:00');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [retroactiveReason, setRetroactiveReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => { if (type) { setStartDate(today); setEndDate(today); setDurationType('FULL_DAY'); setStartTime('18:00'); setEndTime('20:00'); setReason(''); setDescription(''); setRetroactiveReason(''); setPreview(null); setError(null); } }, [today, type]);
  useEffect(() => {
    if (type !== 'leave' || !isValidDateKey(startDate) || !isValidDateKey(endDate) || endDate < startDate || (durationType === 'CUSTOM_HOURS' && (!isValidTime(startTime) || !isValidTime(endTime)))) { setPreview(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      setPreviewing(true);
      previewLeaveRequest(apiBase, { startDate, endDate, durationType, ...(durationType === 'CUSTOM_HOURS' ? { requestedStart: startTime, requestedEnd: endTime } : {}) })
        .then(value => { if (!cancelled) { setPreview(value); setError(null); } })
        .catch(err => { if (!cancelled) { setPreview(null); setError(friendlyEmployeeError(err)); } })
        .finally(() => { if (!cancelled) setPreviewing(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [apiBase, durationType, endDate, endTime, startDate, startTime, type]);

  const submit = async () => {
    if (reason.trim().length < 10) return setError('Lý do cần có ít nhất 10 ký tự.');
    if (!isValidDateKey(startDate) || (type === 'leave' && !isValidDateKey(endDate))) return setError('Ngày cần theo định dạng YYYY-MM-DD và phải hợp lệ.');
    if (type === 'leave' && endDate < startDate) return setError('Ngày kết thúc không được sớm hơn ngày bắt đầu.');
    if (type === 'leave' && durationType !== 'FULL_DAY' && startDate !== endDate) return setError('Đơn nghỉ một phần ngày chỉ áp dụng cho một ngày.');
    if (type === 'leave' && durationType === 'CUSTOM_HOURS' && (!isValidTime(startTime) || !isValidTime(endTime) || timeMinutes(endTime) <= timeMinutes(startTime))) return setError('Khoảng giờ xin nghỉ chưa hợp lệ.');
    if (type === 'leave' && !preview) return setError('Cần có kết quả tính từ lịch làm việc trước khi gửi đơn.');
    if (type === 'overtime' && (!isValidTime(startTime) || !isValidTime(endTime))) return setError('Giờ cần theo định dạng HH:mm và nằm trong 00:00-23:59.');
    if (type === 'overtime' && timeMinutes(endTime) <= timeMinutes(startTime)) return setError('Giờ kết thúc phải muộn hơn giờ bắt đầu.');
    if (type === 'overtime' && description.trim() && description.trim().length < 3) return setError('Mô tả công việc cần ít nhất 3 ký tự hoặc để trống.');
    setBusy(true); setError(null);
    try {
      if (type === 'leave') await createLeaveRequest(apiBase, { startDate, endDate, leaveType, durationType, ...(durationType === 'CUSTOM_HOURS' ? { requestedStart: startTime, requestedEnd: endTime } : {}), reason: reason.trim() });
      if (type === 'overtime') await createOvertimeRequest(apiBase, { workDate: startDate, requestedStart: `${startDate}T${startTime}:00+07:00`, requestedEnd: `${startDate}T${endTime}:00+07:00`, reason: reason.trim(), workDescription: description.trim() || undefined, retroactiveReason: retroactiveReason.trim() || undefined });
      await onCreated(type === 'leave' ? 'Đã gửi đơn nghỉ phép.' : 'Đã gửi đăng ký tăng ca.');
    } catch (err) { setError(friendlyEmployeeError(err)); } finally { setBusy(false); }
  };

  return <Modal visible={!!type} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHandle} />
      <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderCopy}><Text style={styles.modalEyebrow}>TẠO YÊU CẦU</Text><Text style={styles.modalTitle}>{type === 'leave' ? 'Đơn nghỉ phép' : 'Đăng ký tăng ca'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng biểu mẫu" disabled={busy} onPress={onClose} style={({ pressed }) => [styles.closeButton, busy && styles.disabled, pressed && !busy && styles.pressed]}><AppIcon name="close" size={23} color={colors.inkSoft} /></Pressable>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
        {type === 'leave' ? <>
          <SegmentedControl value={leaveType} onChange={setLeaveType} options={[{ value: 'PAID_LEAVE', label: 'Có lương' }, { value: 'UNPAID_LEAVE', label: 'Không lương' }]} />
          <Text style={styles.fieldHeading}>Thời lượng nghỉ</Text>
          <View style={styles.durationGrid}>{(['FULL_DAY', 'MORNING_HALF', 'AFTERNOON_HALF', 'CUSTOM_HOURS'] as LeaveDurationType[]).map(value => <Pressable key={value} disabled={busy} onPress={() => { setDurationType(value); if (value !== 'FULL_DAY') setEndDate(startDate); }} style={[styles.durationButton, durationType === value && styles.durationButtonActive]}><Text style={[styles.durationText, durationType === value && styles.durationTextActive]}>{durationLabel(value)}</Text></Pressable>)}</View>
          <View style={styles.twoFields}>
            <Field label="Từ ngày" required value={startDate} onChangeText={setStartDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!busy} />
            <Field label="Đến ngày" required value={endDate} onChangeText={setEndDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!busy} />
          </View>
          {durationType === 'CUSTOM_HOURS' ? <View style={styles.twoFields}><Field label="Từ giờ" required value={startTime} onChangeText={setStartTime} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!busy} /><Field label="Đến giờ" required value={endTime} onChangeText={setEndTime} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!busy} /></View> : null}
          <View style={styles.previewBox}>{previewing ? <Text style={styles.previewText}>Đang tính theo ca làm việc…</Text> : preview ? <><Text style={styles.previewTitle}>Kết quả từ lịch làm việc</Text><Text style={styles.previewText}>Ca: {preview.days[0]?.shiftStart}–{preview.days[0]?.shiftEnd} · Nghỉ trưa: {preview.days[0]?.breakStart}–{preview.days[0]?.breakEnd}</Text><Text style={styles.previewText}>Xin nghỉ: {preview.days[0]?.approvedLeaveIntervals.map(x => `${x.from}–${x.to}`).join(', ') || '—'}</Text><Text style={styles.previewText}>Tổng: {formatMinutesValue(preview.calculatedMinutes)} · {Number(preview.leaveEquivalent.toFixed(3))} ngày phép</Text><Text style={styles.previewText}>Còn phải làm: {preview.days[0]?.requiredWorkingIntervals.map(x => `${x.from}–${x.to}`).join(', ') || 'Không có'}</Text></> : <Text style={styles.previewText}>Nhập ngày/giờ hợp lệ để hệ thống tính theo ca thực tế.</Text>}</View>
        </> : <>
          <Field label="Ngày tăng ca" required value={startDate} onChangeText={setStartDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!busy} />
          <View style={styles.twoFields}>
            <Field label="Bắt đầu" required value={startTime} onChangeText={setStartTime} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!busy} />
            <Field label="Kết thúc" required value={endTime} onChangeText={setEndTime} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!busy} />
          </View>
          <Field label="Mô tả công việc" value={description} onChangeText={setDescription} multiline placeholder="Công việc dự kiến thực hiện" editable={!busy} />
          <Field label="Lý do khai báo muộn" value={retroactiveReason} onChangeText={setRetroactiveReason} multiline placeholder="Chỉ cần nhập nếu đăng ký sau thời hạn" editable={!busy} />
        </>}
        <Field label="Lý do" required value={reason} onChangeText={setReason} multiline placeholder="Nhập tối thiểu 10 ký tự" editable={!busy} />
        <View style={styles.infoBox}><Text style={styles.infoText}>{type === 'leave' ? 'Đơn sẽ được gửi đến quản lý phòng ban, sau đó HR áp dụng vào bảng công.' : 'Loại OT và số phút hợp lệ được hệ thống tự tính từ lịch làm việc và chấm công thực tế.'}</Text></View>
        <AppButton label={type === 'leave' ? 'Gửi đơn nghỉ phép' : 'Gửi đăng ký tăng ca'} loading={busy} disabled={busy} onPress={() => void submit()} />
        <AppButton label="Hủy" variant="secondary" disabled={busy} onPress={onClose} />
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

function statusLabel(status: string) { return ({ PENDING: 'Chờ duyệt', PENDING_MANAGER: 'Chờ quản lý', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy', HR_APPLIED: 'Đã áp dụng', CLARIFICATION_REQUESTED: 'Cần bổ sung' } as Record<string, string>)[status] || status; }
function durationLabel(value?: LeaveDurationType) { return ({ FULL_DAY: 'Cả ngày', MORNING_HALF: 'Buổi sáng', AFTERNOON_HALF: 'Buổi chiều', CUSTOM_HOURS: 'Theo giờ' } as Record<string, string>)[value || 'FULL_DAY']; }
function formatMinutesValue(value: number) { const hours = Math.floor(value / 60); const minutes = value % 60; return hours ? `${hours} giờ${minutes ? ` ${minutes} phút` : ''}` : `${minutes} phút`; }
function isValidDateKey(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match) return false; const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day; }
function isValidTime(value: string) { const match = /^(\d{2}):(\d{2})$/.exec(value); return !!match && Number(match[1]) < 24 && Number(match[2]) < 60; }
function timeMinutes(value: string) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.huge, gap: spacing.md }, addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, actionRow: { flexDirection: 'row', gap: spacing.sm }, actionCard: { flex: 1, minHeight: 148, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }, actionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, actionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: spacing.sm }, actionDescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, pressed: { opacity: 0.74 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }, sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, count: { color: colors.faint, fontSize: 10, fontWeight: '700' }, requestCard: { gap: spacing.sm }, requestTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, requestType: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }, requestTypeOt: { backgroundColor: colors.primarySoft }, typeCode: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' }, requestCopy: { flex: 1 }, requestTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, requestDate: { color: colors.muted, fontSize: 11, marginTop: 4 }, reason: { color: colors.inkSoft, fontSize: 12, lineHeight: 18, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }, comment: { color: colors.warningText, fontSize: 11, lineHeight: 17, backgroundColor: colors.warningSoft, padding: spacing.xs, borderRadius: 9 }, result: { color: colors.successText, fontSize: 11, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: colors.background }, modalHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#cbd5e1', alignSelf: 'center', marginTop: spacing.xs }, modalContent: { padding: spacing.xl, paddingBottom: spacing.huge, gap: spacing.md }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, modalHeaderCopy: { flex: 1 }, modalEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, modalTitle: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 5 }, closeButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, twoFields: { flexDirection: 'row', gap: spacing.sm }, infoBox: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: radius.md, padding: spacing.sm }, infoText: { color: '#1e40af', fontSize: 11, lineHeight: 17 }, disabled: { opacity: 0.52 },
  fieldHeading: { color: colors.ink, fontSize: 12, fontWeight: '800' }, durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, durationButton: { width: '48%', minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.xs }, durationButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary }, durationText: { color: colors.inkSoft, fontSize: 11, fontWeight: '700' }, durationTextActive: { color: '#fff' }, previewBox: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, gap: 4 }, previewTitle: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' }, previewText: { color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
});
