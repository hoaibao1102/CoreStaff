import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cancelMyLeaveRequest, createLeaveRequest, createOvertimeRequest, friendlyEmployeeError, getMyLeaveRequests, getMyOvertimeRequests, previewLeaveRequest, type LeaveDurationType, type LeavePreview, type LeaveRequest, type OvertimeRequest } from '../employee-api';
import { AppButton, Card, DateTimeField, EmptyState, ErrorBanner, ErrorState, Field, LoadingBlock, ScreenHeader, SegmentedControl, StatusBadge, SuccessBanner, formatDate, formatMinutes, formatTime, todayKey } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { REQUEST_STATUS_DOT, RequestsCalendar, groupRequestsByDay, requestStatusGroup } from '../components/RequestsCalendar';
import { useConfirmDialog } from '../components/ConfirmDialog';

type Filter = 'all' | 'leave' | 'overtime';
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type ViewMode = 'calendar' | 'list';
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' }, { value: 'PENDING', label: 'Chờ duyệt' }, { value: 'APPROVED', label: 'Đã duyệt' }, { value: 'REJECTED', label: 'Từ chối' }, { value: 'CANCELLED', label: 'Đã hủy' },
];
const monthOf = (date: string) => date.slice(0, 7);
const shiftMonth = (month: string, offset: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + offset, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
type FormType = 'leave' | 'overtime';

export function RequestsScreen({ apiBase, realtimeRevision = 0, embedded = false }: { apiBase: string; realtimeRevision?: number; embedded?: boolean }) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [overtime, setOvertime] = useState<OvertimeRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('calendar');
  const [month, setMonth] = useState(() => monthOf(todayKey()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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

  const matchesStatus = useCallback((status: string) => statusFilter === 'all' || requestStatusGroup(status) === statusFilter, [statusFilter]);
  const shownLeaves = useMemo(() => (filter === 'overtime' ? [] : leaves.filter(l => matchesStatus(l.status))), [filter, leaves, matchesStatus]);
  const shownOvertime = useMemo(() => (filter === 'leave' ? [] : overtime.filter(o => matchesStatus(o.status))), [filter, overtime, matchesStatus]);
  const rows = useMemo(() => [
    ...shownLeaves.map(value => ({ type: 'leave' as const, value, date: value.createdAt || value.startDate })),
    ...shownOvertime.map(value => ({ type: 'overtime' as const, value, date: value.createdAt || value.workDate })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [shownLeaves, shownOvertime]);
  const byDay = useMemo(() => groupRequestsByDay(shownLeaves, shownOvertime), [shownLeaves, shownOvertime]);
  const monthEntries = useMemo(() => [...byDay.entries()].filter(([day]) => monthOf(day) === month), [byDay, month]);
  const monthPending = useMemo(() => new Set(monthEntries.flatMap(([, list]) => list.filter(e => requestStatusGroup(e.value.status) === 'PENDING').map(e => `${e.type}-${e.value._id}`))).size, [monthEntries]);
  const monthTotal = useMemo(() => new Set(monthEntries.flatMap(([, list]) => list.map(e => `${e.type}-${e.value._id}`))).size, [monthEntries]);
  const dayEntries = selectedDay ? byDay.get(selectedDay) ?? [] : [];
  // Đổi tháng/bộ lọc thì ngày đang chọn không còn ý nghĩa.
  useEffect(() => { setSelectedDay(null); }, [month, filter, statusFilter]);
  const statusCounts = useMemo(() => {
    const all = [...(filter === 'overtime' ? [] : leaves), ...(filter === 'leave' ? [] : overtime)];
    const out: Record<StatusFilter, number> = { all: all.length, PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
    for (const r of all) out[requestStatusGroup(r.status)] += 1;
    return out;
  }, [filter, leaves, overtime]);

  const { confirm, dialog } = useConfirmDialog();
  const confirmCancel = (id: string) => confirm({
    title: 'Hủy đơn nghỉ phép', message: 'Bạn chắc chắn muốn hủy đơn này?', confirmLabel: 'Hủy đơn', cancelLabel: 'Không', tone: 'danger', icon: 'trash-outline',
    onConfirm: async () => { try { await cancelMyLeaveRequest(apiBase, id); setSuccess('Đã hủy đơn nghỉ phép.'); await load(true); } catch (err) { setError(friendlyEmployeeError(err)); } },
  });

  return <>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
      {embedded ? null : <ScreenHeader eyebrow="ĐƠN TỪ" title="Đơn từ" description="Tạo và theo dõi nghỉ phép, tăng ca." />}
      {error && (loading || rows.length > 0) ? <ErrorBanner message={error} /> : null}{success ? <SuccessBanner message={success} /> : null}
      <View style={styles.actionRow}><ActionCard icon="calendar-outline" title="Xin nghỉ phép" description="Có lương hoặc không lương" onPress={() => { setSuccess(null); setForm('leave'); }} /><ActionCard icon="time-outline" title="Đăng ký tăng ca" description="Hệ thống tự phân loại OT" onPress={() => { setSuccess(null); setForm('overtime'); }} /></View>
      <SegmentedControl value={view} onChange={setView} options={[{ value: 'calendar', label: 'Lịch' }, { value: 'list', label: 'Danh sách' }]} />
      <SegmentedControl value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tất cả' }, { value: 'leave', label: 'Nghỉ phép' }, { value: 'overtime', label: 'Tăng ca' }]} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityRole="tablist">
        {STATUS_OPTIONS.map(option => {
          const active = statusFilter === option.value;
          const dot = option.value === 'all' ? null : REQUEST_STATUS_DOT[option.value];
          return <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setStatusFilter(option.value)} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
            {dot ? <View style={[styles.chipDot, { backgroundColor: dot }]} /> : null}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            <Text style={[styles.chipCount, active && styles.chipTextActive]}>{statusCounts[option.value]}</Text>
          </Pressable>;
        })}
      </ScrollView>
      {loading ? <LoadingBlock /> : error && !leaves.length && !overtime.length ? <ErrorState message={error} onRetry={() => void load()} /> : view === 'calendar' ? <>
        <View style={styles.monthBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Tháng trước" onPress={() => setMonth(m => shiftMonth(m, -1))} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}><AppIcon name="chevron-back" size={20} color={colors.primary} /></Pressable>
          <View style={styles.monthCopy}><Text accessibilityRole="header" style={styles.monthTitle}>Tháng {Number(month.slice(5))}/{month.slice(0, 4)}</Text><Text style={styles.monthSub}>{monthTotal ? `${monthTotal} đơn${monthPending ? ` · ${monthPending} chờ duyệt` : ''}` : 'Không có đơn'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Tháng sau" onPress={() => setMonth(m => shiftMonth(m, 1))} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}><AppIcon name="chevron-forward" size={20} color={colors.primary} /></Pressable>
        </View>
        <RequestsCalendar month={month} byDay={byDay} onSelect={setSelectedDay} />
        {selectedDay ? <>
          <View style={styles.listHeading}><Text style={styles.sectionTitle}>Ngày {formatDate(selectedDay)}</Text><Text style={styles.count}>{dayEntries.length} đơn</Text></View>
          {dayEntries.map(entry => entry.type === 'leave' ? <LeaveCard key={`leave-${entry.value._id}`} item={entry.value} onCancel={() => confirmCancel(entry.value._id)} /> : <OvertimeCard key={`ot-${entry.value._id}`} item={entry.value} />)}
        </> : <Text style={styles.hint}>Chạm vào ngày có nhãn để xem chi tiết đơn của ngày đó.</Text>}
      </> : <>
        <View style={styles.listHeading}><Text style={styles.sectionTitle}>Hoạt động gần đây</Text><Text style={styles.count}>{rows.length} yêu cầu</Text></View>
        {!rows.length ? <EmptyState icon="checkmark-done-outline" title="Không có yêu cầu" description={leaves.length || overtime.length ? 'Không có đơn nào khớp bộ lọc hiện tại.' : 'Đơn nghỉ phép và đăng ký tăng ca sẽ xuất hiện tại đây.'} /> : rows.map(row => row.type === 'leave' ? <LeaveCard key={`leave-${row.value._id}`} item={row.value} onCancel={() => confirmCancel(row.value._id)} /> : <OvertimeCard key={`ot-${row.value._id}`} item={row.value} />)}
      </>}
    </ScrollView>
    {dialog}
    <RequestModal type={form} apiBase={apiBase} onClose={() => setForm(null)} onCreated={async message => { setForm(null); setSuccess(message); setFilter('all'); setStatusFilter('all'); await load(true); }} />
  </>;
}

function ActionCard({ icon, title, description, onPress }: { icon: AppIconName; title: string; description: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}><View style={styles.actionIcon}><AppIcon name={icon} size={21} color={colors.primaryDark} /></View><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDescription}>{description}</Text></Pressable>; }
function LeaveCard({ item, onCancel }: { item: LeaveRequest; onCancel: () => void }) { return <Card style={styles.requestCard}><View style={styles.requestTop}><View style={styles.requestType}><AppIcon name="calendar-outline" size={19} color={colors.successText} /></View><View style={styles.requestCopy}><Text style={styles.requestTitle}>{item.leaveType === 'PAID_LEAVE' ? 'Nghỉ phép có lương' : 'Nghỉ không lương'}</Text><Text style={styles.requestDate}>{formatDate(item.startDate)} - {formatDate(item.endDate)}</Text><Text style={styles.requestDate}>{durationLabel(item.durationType)}{item.requestedStart && item.requestedEnd ? ` · ${item.requestedStart}–${item.requestedEnd}` : ''}</Text></View><StatusBadge status={item.status} tone={item.status === 'APPROVED' ? 'info' : statusTone(item.status)} label={item.status === 'APPROVED' ? 'Chờ HR áp dụng' : statusLabel(item.status)} /></View>{item.calculatedMinutes != null ? <Text style={styles.result}>{formatMinutes(item.calculatedMinutes)} · {(item.leaveEquivalent || 0).toFixed(2)} ngày phép</Text> : null}<Text numberOfLines={2} style={styles.reason}>{item.reason}</Text>{item.reviewComment ? <Text style={styles.comment}>Phản hồi: {item.reviewComment}</Text> : null}{item.status === 'PENDING_MANAGER' ? <AppButton label="Hủy đơn" variant="danger" onPress={onCancel} /> : null}</Card>; }
function OvertimeCard({ item }: { item: OvertimeRequest }) { return <Card style={styles.requestCard}><View style={styles.requestTop}><View style={[styles.requestType, styles.requestTypeOt]}><AppIcon name="time-outline" size={20} color={colors.primaryDark} /></View><View style={styles.requestCopy}><Text style={styles.requestTitle}>Tăng ca ngày {formatDate(item.workDate)}</Text><Text style={styles.requestDate}>{formatTime(item.requestedStart)} - {formatTime(item.requestedEnd)}</Text></View><StatusBadge status={item.status} tone={statusTone(item.status)} label={statusLabel(item.status)} /></View><Text numberOfLines={2} style={styles.reason}>{item.reason}</Text>{item.overtimeResult?.eligibleMinutes != null ? <Text style={styles.result}>Đủ điều kiện: {formatMinutes(item.overtimeResult.eligibleMinutes)}</Text> : null}{item.reviewComment ? <Text style={styles.comment}>Phản hồi: {item.reviewComment}</Text> : null}</Card>; }

function RequestModal({ type, apiBase, onClose, onCreated }: { type: FormType | null; apiBase: string; onClose: () => void; onCreated: (message: string) => Promise<void> }) {
  const today = todayKey();
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
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  // Banner lỗi nằm đầu form; nút Gửi nằm cuối, nên phải đưa lỗi vào tầm nhìn.
  useEffect(() => { if (error) scrollRef.current?.scrollTo({ y: 0, animated: true }); }, [error]);

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
    if (!isValidDateKey(startDate) || (type === 'leave' && !isValidDateKey(endDate))) return setError('Ngày cần hợp lệ.');
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
      
      <View style={{ height: insets.top, backgroundColor: colors.background }} />
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.modalContent, { paddingTop: spacing.md, paddingBottom: spacing.huge + insets.bottom }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.modalBody}>
        <View style={styles.modalHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng biểu mẫu" disabled={busy} onPress={onClose} style={({ pressed }) => [styles.closeButton, busy && styles.disabled, pressed && !busy && styles.pressed]}><AppIcon name="close" size={23} color={colors.inkSoft} /></Pressable>
          <Text accessibilityRole="header" style={styles.modalTitle}>{type === 'leave' ? 'Đơn nghỉ phép' : 'Đăng ký tăng ca'}</Text>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
        {type === 'leave' ? <>
          <SegmentedControl value={leaveType} onChange={setLeaveType} options={[{ value: 'PAID_LEAVE', label: 'Có lương' }, { value: 'UNPAID_LEAVE', label: 'Không lương' }]} />
          <Text style={styles.fieldHeading}>Thời lượng nghỉ</Text>
          <View style={styles.durationGrid}>{(['FULL_DAY', 'MORNING_HALF', 'AFTERNOON_HALF', 'CUSTOM_HOURS'] as LeaveDurationType[]).map(value => <Pressable key={value} disabled={busy} onPress={() => { setDurationType(value); if (value !== 'FULL_DAY') setEndDate(startDate); }} style={[styles.durationButton, durationType === value && styles.durationButtonActive]}><Text style={[styles.durationText, durationType === value && styles.durationTextActive]}>{durationLabel(value)}</Text></Pressable>)}</View>
          <View style={styles.twoFields}>
            <DateTimeField label="Từ ngày" mode="date" required value={startDate} onChange={v => { setStartDate(v); if (durationType !== 'FULL_DAY' || endDate < v) setEndDate(v); }} disabled={busy} />
            <DateTimeField label="Đến ngày" mode="date" required value={endDate} onChange={setEndDate} disabled={busy} />
          </View>
          {durationType === 'CUSTOM_HOURS' ? <View style={styles.twoFields}><DateTimeField label="Từ giờ" mode="time" required value={startTime} onChange={setStartTime} disabled={busy} /><DateTimeField label="Đến giờ" mode="time" required value={endTime} onChange={setEndTime} disabled={busy} /></View> : null}
          <View style={styles.previewBox}>{previewing ? <Text style={styles.previewText}>Đang tính theo ca làm việc…</Text> : preview ? <><Text style={styles.previewTitle}>Kết quả từ lịch làm việc</Text><Text style={styles.previewText}>Ca: {preview.days[0]?.shiftStart}–{preview.days[0]?.shiftEnd} · Nghỉ trưa: {preview.days[0]?.breakStart}–{preview.days[0]?.breakEnd}</Text><Text style={styles.previewText}>Xin nghỉ: {preview.days[0]?.approvedLeaveIntervals.map(x => `${x.from}–${x.to}`).join(', ') || '—'}</Text><Text style={styles.previewText}>Tổng: {formatMinutes(preview.calculatedMinutes)} · {preview.leaveEquivalent.toFixed(2)} ngày phép</Text><Text style={styles.previewText}>Còn phải làm: {preview.days[0]?.requiredWorkingIntervals.map(x => `${x.from}–${x.to}`).join(', ') || 'Không có'}</Text></> : <Text style={styles.previewText}>Chọn ngày hợp lệ để xem số giờ nghỉ được tính từ lịch làm việc.</Text>}</View>
        </> : <>
          <DateTimeField label="Ngày tăng ca" mode="date" required value={startDate} onChange={setStartDate} disabled={busy} />
          <View style={styles.twoFields}>
            <DateTimeField label="Bắt đầu" mode="time" required value={startTime} onChange={setStartTime} disabled={busy} />
            <DateTimeField label="Kết thúc" mode="time" required value={endTime} onChange={setEndTime} disabled={busy} />
          </View>
          <Field label="Mô tả công việc" value={description} onChangeText={setDescription} multiline placeholder="Công việc dự kiến thực hiện" editable={!busy} />
          <Field label="Lý do khai báo muộn" value={retroactiveReason} onChangeText={setRetroactiveReason} multiline placeholder="Chỉ cần nhập nếu đăng ký sau thời hạn" editable={!busy} />
        </>}
        <Field label="Lý do" required value={reason} onChangeText={setReason} multiline placeholder="Nhập tối thiểu 10 ký tự" editable={!busy} />
        <View style={styles.infoBox}><Text style={styles.infoText}>{type === 'leave' ? 'Đơn sẽ được gửi đến quản lý phòng ban, sau đó HR áp dụng vào bảng công.' : 'Loại OT và số phút hợp lệ được hệ thống tự tính từ lịch làm việc và chấm công thực tế.'}</Text></View>
        <AppButton label={type === 'leave' ? 'Gửi đơn nghỉ phép' : 'Gửi đăng ký tăng ca'} loading={busy} disabled={busy} onPress={() => void submit()} />
        <AppButton label="Hủy" variant="secondary" disabled={busy} onPress={onClose} />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

function statusLabel(status: string) { return ({ PENDING: 'Chờ duyệt', PENDING_MANAGER: 'Chờ quản lý', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy', HR_APPLIED: 'Đã áp dụng', CLARIFICATION_REQUESTED: 'Cần bổ sung' } as Record<string, string>)[status] || status; }
function durationLabel(value?: LeaveDurationType) { return ({ FULL_DAY: 'Cả ngày', MORNING_HALF: 'Buổi sáng', AFTERNOON_HALF: 'Buổi chiều', CUSTOM_HOURS: 'Theo giờ' } as Record<string, string>)[value || 'FULL_DAY']; }
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' { return status === 'APPROVED' || status === 'HR_APPLIED' ? 'success' : status === 'PENDING' || status === 'PENDING_MANAGER' || status === 'CLARIFICATION_REQUESTED' ? 'warning' : status === 'REJECTED' ? 'danger' : 'neutral'; }
function isValidDateKey(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match) return false; const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day; }
function isValidTime(value: string) { const match = /^(\d{2}):(\d{2})$/.exec(value); return !!match && Number(match[1]) < 24 && Number(match[2]) < 60; }
function timeMinutes(value: string) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: spacing.huge + 16, gap: spacing.md }, actionRow: { flexDirection: 'row', gap: spacing.sm }, actionCard: { flex: 1, minHeight: 112, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }, actionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, actionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: spacing.sm }, actionDescription: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 4 }, pressed: { opacity: 0.74 },
  chipRow: { gap: spacing.xs, paddingVertical: 2 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, chipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, chipDot: { width: 8, height: 8, borderRadius: 4 }, chipText: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: '#fff' }, chipCount: { color: colors.faint, fontSize: 11, fontWeight: '800' },
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, monthButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, monthCopy: { flex: 1, alignItems: 'center' }, monthTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, monthSub: { color: colors.muted, fontSize: 11, marginTop: 2 }, hint: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: spacing.xs },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }, sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, count: { color: colors.faint, fontSize: 11, fontWeight: '700' }, requestCard: { gap: spacing.sm }, requestTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, requestType: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }, requestTypeOt: { backgroundColor: colors.primarySoft }, typeCode: { color: colors.primaryDark, fontSize: 11, fontWeight: '900' }, requestCopy: { flex: 1 }, requestTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, requestDate: { color: colors.muted, fontSize: 11, marginTop: 4 }, reason: { color: colors.inkSoft, fontSize: 12, lineHeight: 18, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }, comment: { color: colors.warningText, fontSize: 11, lineHeight: 17, backgroundColor: colors.warningSoft, padding: spacing.xs, borderRadius: 9 }, result: { color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: colors.background }, modalContent: { paddingHorizontal: 22 }, modalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, modalBody: { gap: spacing.md }, modalTitle: { flex: 1, color: colors.ink, fontSize: 18, fontWeight: '800' }, closeButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, twoFields: { flexDirection: 'row', gap: spacing.sm }, infoBox: { backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successBorder, borderRadius: radius.md, padding: spacing.sm }, infoText: { color: colors.successText, fontSize: 12, lineHeight: 18 }, disabled: { opacity: 0.52 },
  fieldHeading: { color: colors.ink, fontSize: 12, fontWeight: '800' }, durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, durationButton: { width: '48%', minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.xs }, durationButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary }, durationText: { color: colors.inkSoft, fontSize: 11, fontWeight: '700' }, durationTextActive: { color: '#fff' }, previewBox: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, gap: 4 }, previewTitle: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' }, previewText: { color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
});
