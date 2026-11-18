import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createAttendanceConfirmation, friendlyEmployeeError, getAttendanceConfirmationPreview, newRequestKey, type AttendanceConfirmationPreview } from '../employee-api';
import { AppButton, DateTimeField, ErrorBanner, Field, LoadingBlock, formatTime, todayKey } from './ui';
import { AppIcon } from './AppIcon';
import { colors, radius, spacing } from '../theme';

/** Cùng luật hiển thị với web (AttendanceConfirmationForm): các mã này không phải lỗi chặn. */
const SILENT_BLOCKS = ['ATTENDANCE_CONFIRMATION_PAST_DATE_REQUIRED', 'NO_WORK_OBLIGATION', 'ALREADY_COMPLETE'];
const DISCLAIMER = 'Giờ bổ sung theo lịch, chỉ hiệu lực sau quản lý duyệt; không xác nhận thời gian OT.';
const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** `HH:mm` (giờ VN) của một mốc ISO, hoặc '' khi thiếu. */
const clockOf = (value?: string | null) => { const t = formatTime(value); return t === '--:--' ? '' : t; };
const stepClock = (value?: string | null) => (value && CLOCK.test(value) ? value : value ? formatTime(value) : 'Chưa có');
const blockMessage = (reason: string | { code: string }) => friendlyEmployeeError(new Error(typeof reason === 'string' ? reason : reason.code));

export function AttendanceConfirmationModal({ visible, apiBase, onClose, onCreated }: { visible: boolean; apiBase: string; onClose: () => void; onCreated: (message: string) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [workDate, setWorkDate] = useState(todayKey());
  const [reason, setReason] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [result, setResult] = useState<{ date: string; preview?: AttendanceConfirmationPreview; disabled?: boolean; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => { if (error) scrollRef.current?.scrollTo({ y: 0, animated: true }); }, [error]);

  useEffect(() => { if (visible) { setWorkDate(todayKey()); setReason(''); setError(null); setStale(false); attempt.current = null; } }, [visible]);

  // Xem trước theo ngày đã chọn: server quyết định có được gửi hay không (hạn mức, kỳ công, ngày đã đủ công…).
  useEffect(() => {
    if (!visible) return;
    if (workDate > todayKey()) { setResult({ date: workDate, error: 'Không thể gửi xác nhận công cho ngày tương lai. Vui lòng chọn từ hôm nay trở về trước.' }); return; }
    let live = true;
    setResult(null); setStale(false);
    getAttendanceConfirmationPreview(apiBase, workDate).then(p => {
      if (!live) return;
      setResult(p.enabled === false ? { date: workDate, disabled: true }
        : p.enabled !== true ? { date: workDate, error: 'Chưa xác định chế độ xác nhận công từ máy chủ. Vui lòng liên hệ HR hoặc tải lại.' }
          : p.workDate === workDate ? { date: workDate, preview: p } : { date: workDate, error: 'Ngày xem trước không khớp. Vui lòng tải lại.' });
    }).catch(e => { if (live) setResult({ date: workDate, error: friendlyEmployeeError(e) }); });
    return () => { live = false; };
  }, [apiBase, visible, workDate, revision]);

  const preview = result?.date === workDate ? result.preview : undefined;
  // Mặc định theo đề xuất theo ca → giờ đã chấm → ca chuẩn, không cứng 17:00.
  useEffect(() => {
    if (!preview) return;
    setCheckIn(clockOf(preview.proposedChanges?.checkInAt) || clockOf(preview.existingPunches?.checkInAt) || '08:00');
    setCheckOut(clockOf(preview.proposedChanges?.checkOutAt) || clockOf(preview.existingPunches?.checkOutAt) || '17:00');
  }, [preview]);

  const timeOrderOk = !checkIn || !checkOut || checkIn < checkOut;
  const trimmed = reason.trim();
  const canSubmit = Boolean(preview) && !busy && !stale && timeOrderOk && preview!.canSubmit && preview!.period?.canMutate !== false && (preview!.quota?.remaining ?? 1) > 0 && trimmed.length >= 10 && trimmed.length <= 1000;

  const submit = async () => {
    if (!canSubmit || !preview) return;
    const hash = preview.previewHash;
    if (!hash) return setError('Thiếu mã xác thực xem trước. Vui lòng tải lại xem trước.');
    const iso = (time: string) => `${workDate}T${time}:00+07:00`;
    const payload = { workDate, reason: trimmed, previewHash: hash, ...(checkIn ? { customCheckInTime: iso(checkIn) } : {}), ...(checkOut ? { customCheckOutTime: iso(checkOut) } : {}) };
    // Cùng nội dung gửi lại (vd. mất mạng) dùng lại khóa idempotency để không tạo đơn trùng.
    const serialized = JSON.stringify(payload);
    if (attempt.current?.payload !== serialized) attempt.current = { payload: serialized, key: newRequestKey() };
    setBusy(true); setError(null);
    try {
      await createAttendanceConfirmation(apiBase, payload, attempt.current.key);
      await onCreated('Đã gửi yêu cầu xác nhận công.');
    } catch (err) {
      setError(friendlyEmployeeError(err));
      if ((err as { code?: string })?.code === 'ATTENDANCE_CONFIRMATION_STALE') setStale(true);
    } finally { setBusy(false); }
  };

  const blocks = (preview?.blockedReasons ?? []).filter(r => !SILENT_BLOCKS.includes(typeof r === 'string' ? r : r.code));
  const hasIn = Boolean(preview?.existingPunches?.checkInAt);
  const hasOut = Boolean(preview?.existingPunches?.checkOutAt);

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ height: insets.top, backgroundColor: colors.background }} />
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingTop: spacing.md, paddingBottom: spacing.huge + insets.bottom }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.body}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng biểu mẫu" disabled={busy} onPress={onClose} style={({ pressed }) => [styles.close, pressed && !busy && styles.pressed]}><AppIcon name="close" size={23} color={colors.inkSoft} /></Pressable>
            <Text accessibilityRole="header" style={styles.title}>Xác nhận công</Text>
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          <DateTimeField label="Ngày" mode="date" required value={workDate} onChange={setWorkDate} disabled={busy} />

          {!result ? <LoadingBlock label="Đang tải xem trước…" />
            : result.disabled ? <View style={styles.notice}><Text style={styles.noticeText}>Tính năng xác nhận công hiện chưa được bật. Vui lòng liên hệ HR.</Text></View>
              : !preview ? <ErrorBanner message={result.error || 'Không thể tải xem trước.'} />
                : <>
                  <View style={styles.summary}>
                    <View style={styles.summaryTop}>
                      <View style={styles.flex}>
                        <Text style={styles.kicker}>CA LÀM VIỆC</Text>
                        <Text style={styles.shift}>{preview.obligation?.shiftLabel ?? 'Ca hành chính (08:00 – 17:00)'}</Text>
                        {preview.obligation?.requiredWorkingIntervals?.length ? <Text style={styles.sub}>Khung giờ: {preview.obligation.requiredWorkingIntervals.map(i => `${stepClock(i.from)} → ${stepClock(i.to)}`).join(', ')}</Text> : null}
                      </View>
                      {preview.quota ? <View style={styles.quota}><Text style={styles.quotaText}>Tháng {preview.quota.monthKey}: còn <Text style={styles.strong}>{preview.quota.remaining}/{preview.quota.limit}</Text> lượt</Text></View> : null}
                    </View>
                    <View style={styles.punchRow}>
                      <Punch label="Giờ vào" done={hasIn} fallback="Chưa có" value={checkIn || stepClock(preview.proposedChanges?.checkInAt)} caption={hasIn ? 'Đã chấm' : 'Đề xuất theo ca'} />
                      <Punch label="Giờ ra" done={hasOut} fallback="Bổ sung theo ca" value={checkOut || stepClock(preview.proposedChanges?.checkOutAt)} caption={hasOut ? 'Đã chấm' : 'Giờ tan ca'} />
                    </View>
                    <Text style={styles.sub}>Làm việc dự kiến: <Text style={styles.strong}>{preview.workingMinutes ? `${preview.workingMinutes} phút (${Math.round(preview.workingMinutes / 60)} giờ)` : '8 giờ'}</Text>{preview.lateMinutes ? ` · Muộn: ${preview.lateMinutes}p` : ''}{preview.earlyMinutes ? ` · Về sớm: ${preview.earlyMinutes}p` : ''} · Nghỉ trưa: {preview.obligation?.breakMinutes ?? 60} phút</Text>
                    {blocks.map((r, i) => <Text key={i} accessibilityRole="alert" style={styles.block}>{blockMessage(r)}</Text>)}
                    <Text style={styles.disclaimer}>💡 {DISCLAIMER}</Text>
                  </View>

                  <View style={styles.summary}>
                    <Text style={styles.shift}>Giờ vào / ra thực tế</Text>
                    <Text style={styles.sub}>Mặc định theo ca. Nếu bạn vào muộn, về muộn hoặc làm thêm giờ, hãy sửa lại giờ thực tế để quản lý duyệt đúng công.</Text>
                    <View style={styles.twoFields}>
                      <DateTimeField label="Giờ vào thực tế" mode="time" value={checkIn} onChange={setCheckIn} disabled={busy || !preview.canSubmit} />
                      <DateTimeField label="Giờ ra thực tế" mode="time" value={checkOut} onChange={setCheckOut} disabled={busy || !preview.canSubmit} />
                    </View>
                    {!timeOrderOk ? <Text style={styles.block}>Giờ vào thực tế phải trước giờ ra thực tế.</Text> : null}
                  </View>

                  <Field label="Lý do xác nhận công" required value={reason} onChangeText={setReason} multiline maxLength={1000} editable={!busy && preview.canSubmit} placeholder="Ví dụ: Tôi đã làm việc cả ngày nhưng quên bấm chấm công (ít nhất 10 ký tự)" />
                  <Text style={[styles.counter, reason.length > 0 && trimmed.length < 10 && styles.counterError]}>{reason.length}/1000 ký tự (tối thiểu 10)</Text>
                </>}

          <AppButton label="Gửi xác nhận công" loading={busy} disabled={!canSubmit} onPress={() => void submit()} />
          <AppButton label="Tải lại xem trước" variant="secondary" disabled={busy} onPress={() => { setStale(false); setRevision(r => r + 1); }} />
          <AppButton label="Hủy" variant="secondary" disabled={busy} onPress={onClose} />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

function Punch({ label, done, fallback, value, caption }: { label: string; done: boolean; fallback: string; value: string; caption: string }) {
  return <View style={styles.punch}>
    <View style={styles.punchHead}><Text style={styles.punchLabel}>{label}</Text><Text style={[styles.punchState, done ? styles.stateOk : styles.stateTodo]}>{done ? '✓ Đã chấm' : fallback}</Text></View>
    <Text style={styles.punchValue}>{value}</Text>
    <Text style={styles.sub}>{caption}</Text>
  </View>;
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: 22 }, body: { gap: spacing.md }, flex: { flex: 1 }, pressed: { opacity: 0.74 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, title: { flex: 1, color: colors.ink, fontSize: 18, fontWeight: '800' }, close: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  summary: { backgroundColor: colors.infoSoft, borderWidth: 1, borderColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' },
  kicker: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }, shift: { color: colors.ink, fontSize: 14, fontWeight: '800' }, sub: { color: colors.muted, fontSize: 11, lineHeight: 17 }, strong: { color: colors.ink, fontWeight: '800' },
  quota: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 4 }, quotaText: { color: colors.info, fontSize: 11, fontWeight: '600' },
  punchRow: { flexDirection: 'row', gap: spacing.xs }, punch: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  punchHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 }, punchLabel: { color: colors.ink, fontSize: 11, fontWeight: '700' }, punchState: { fontSize: 10, fontWeight: '700' }, stateOk: { color: colors.successText }, stateTodo: { color: colors.primary }, punchValue: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  block: { color: colors.dangerText, fontSize: 12, fontWeight: '600', backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.xs, overflow: 'hidden' },
  disclaimer: { color: colors.muted, fontSize: 11, fontStyle: 'italic' }, twoFields: { flexDirection: 'row', gap: spacing.sm },
  notice: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: radius.md, padding: spacing.sm }, noticeText: { color: colors.warningText, fontSize: 12, lineHeight: 18 },
  counter: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: -spacing.xs }, counterError: { color: colors.danger },
});
