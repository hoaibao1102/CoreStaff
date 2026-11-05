import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AttendanceDay, AttendanceEvent, WorkCreditPolicy } from '../employee-api';
import { calculateDayCredit, dayHistoryStatus, type HistoryStatus } from '../day-credit';
import { AppIcon, type AppIconName } from './AppIcon';
import { StatusBadge, formatDate, formatMinutes, formatTime, shiftTitle } from './ui';
import { colors, radius, spacing } from '../theme';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const creditColor = (c: number) => (c >= 1 ? colors.successText : c >= 0.5 ? colors.info : colors.warningText);

function statusBadge(hs: HistoryStatus, d: AttendanceDay): { label: string; tone: Tone } {
  switch (hs) {
    case 'FORFEITED': return { label: 'Mất ngày công', tone: 'danger' };
    case 'FORGOTTEN': return { label: 'Quên chấm công', tone: 'warning' };
    case 'LATE': return { label: 'Đi muộn', tone: 'warning' };
    case 'EARLY_LEAVE': return { label: 'Về sớm', tone: 'danger' };
    case 'DAY_OFF': return { label: 'Nghỉ', tone: 'neutral' };
    case 'ATTENDED': return (d.attendanceStatus ?? d.status) === 'CHECKED_IN' ? { label: 'Đang trong ca', tone: 'info' } : { label: 'Hoàn thành', tone: 'success' };
    default: return { label: 'Chưa có dữ liệu', tone: 'neutral' };
  }
}

function workedText(d: AttendanceDay, hs: HistoryStatus) {
  if (hs === 'FORFEITED') return '0 phút';
  const mins = d.totalWorkingMinutes ?? d.workingMinutes;
  if (mins != null && mins > 0) return formatMinutes(mins);
  if (d.checkIn?.recordedAt && d.checkOut?.recordedAt) {
    const ms = new Date(d.checkOut.recordedAt).getTime() - new Date(d.checkIn.recordedAt).getTime();
    const m = Math.floor(ms / 60000);
    return m > 0 ? formatMinutes(m) : `${Math.max(0, Math.floor(ms / 1000))} giây`;
  }
  return 'Chưa chốt';
}

export function DayDetailSheet({ day, policy, apiBase, onClose }: { day: AttendanceDay | null; policy?: WorkCreditPolicy | null; apiBase: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [showCredit, setShowCredit] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  if (!day) return null;
  const hs = dayHistoryStatus(day);
  const credit = calculateDayCredit(day, hs, policy);
  const badge = statusBadge(hs, day);
  const late = day.lateMinutes ?? 0, early = day.earlyMinutes ?? 0;
  const cc = creditColor(credit.credit);
  const shift = shiftTitle(day.shiftName);

  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <Pressable accessibilityLabel="Đóng chi tiết" style={styles.backdrop} onPress={onClose} />
    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.grabber} />
      <View style={styles.header}>
        <View style={styles.headerIcon}><AppIcon name="calendar-outline" size={20} color={colors.primary} /></View>
        <View style={styles.flex}><Text style={styles.title}>Chi tiết ngày {formatDate(day.workDate)}</Text>{shift ? <Text style={styles.sub}>{shift}</Text> : null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={onClose} hitSlop={10} style={styles.close}><AppIcon name="close" size={22} color={colors.muted} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.stats}>
          <Stat label="Trạng thái"><View style={styles.badges}><StatusBadge status={badge.label} label={badge.label} tone={badge.tone} />{hs === 'LATE' && early > 0 ? <StatusBadge status="Về sớm" tone="danger" /> : null}</View></Stat>
          <Stat label="Tổng thời gian"><Text style={styles.statValue}>{workedText(day, hs)}</Text></Stat>
          <Stat label="Ngày công"><Text style={[styles.statValue, { color: cc }]}>{credit.label}</Text>{credit.provisional ? <Text style={styles.provisional}>Tạm tính</Text> : null}</Stat>
        </View>
        {late > 0 || early > 0 ? <View style={styles.lateRow}>{late > 0 ? <Text style={styles.late}>Đi muộn {formatMinutes(late)}</Text> : null}{early > 0 ? <Text style={styles.early}>Về sớm {formatMinutes(early)}</Text> : null}</View> : null}

        <View style={styles.panel}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCredit }} onPress={() => setShowCredit(v => !v)} style={styles.panelHead}>
            <AppIcon name="calculator-outline" size={18} color={colors.primary} />
            <Text style={styles.panelTitle}>Chi tiết quy đổi công</Text>
            <View style={[styles.creditPill, { backgroundColor: `${cc}1f` }]}><Text style={[styles.creditPillText, { color: cc }]}>{credit.label}</Text></View>
            <AppIcon name={showCredit ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
          </Pressable>
          {showCredit ? <View style={styles.panelBody}>
            <View style={styles.rule} />
            <View style={styles.ratioRow}><Text style={styles.small}>Hoàn thành ca ({credit.ratioPercent}%)</Text><Text style={styles.small}>{formatMinutes(credit.worked)} / {formatMinutes(credit.obligation)}</Text></View>
            <View style={styles.track}><View style={[styles.fill, { backgroundColor: cc, width: `${credit.credit > 0 ? Math.max(10, credit.ratioPercent) : credit.ratioPercent}%` }]} /></View>
            <Text style={styles.explain}>{credit.explanation}</Text>
            <Text style={styles.small}>• 1.0 công: từ {credit.fullPct} ca ({formatMinutes(credit.fullMin)})</Text>
            <Text style={styles.small}>• 0.5 công: từ {credit.halfPct} ca ({formatMinutes(credit.halfMin)})</Text>
            {hs === 'FORGOTTEN' ? <View style={styles.hint}><Text style={styles.hintText}>Ngày này thiếu mốc chấm công. Hãy gửi đơn Xác nhận công ở mục Đơn từ để Quản lý duyệt và ghi nhận đủ công.</Text></View> : null}
          </View> : null}
        </View>

        {hs === 'FORFEITED' && day.resolution ? <View style={styles.forfeit}><Text style={styles.forfeitTitle}>Ngày này đã được xác nhận vắng và không tính công.</Text>{day.resolution.reason ? <Text style={styles.forfeitText}>Lý do: {day.resolution.reason}</Text> : null}</View> : null}

        <EventCard title="Giờ vào" event={day.checkIn} apiBase={apiBase} onPhoto={setPhoto} />
        <EventCard title="Giờ ra" event={day.checkOut} apiBase={apiBase} onPhoto={setPhoto} />

        {day.overtime ? <View style={styles.ot}>
          <View style={styles.otHead}><AppIcon name="time-outline" size={16} color={colors.info} /><Text style={styles.otTitle}>Tăng ca được duyệt</Text><StatusBadge status="APPROVED" label="Đã duyệt" /></View>
          <Text style={styles.otTime}>{formatTime(day.overtime.approvedStart ?? day.overtime.requestedStart)} → {formatTime(day.overtime.approvedEnd ?? day.overtime.requestedEnd)}{day.overtime.otMinutes ? ` (${formatMinutes(day.overtime.otMinutes)})` : ''}</Text>
          {day.overtime.reason ? <Text style={styles.otText}>Lý do: {day.overtime.reason}</Text> : null}
          {day.overtime.reviewComment ? <Text style={[styles.otText, styles.italic]}>Ý kiến quản lý: "{day.overtime.reviewComment}"</Text> : null}
        </View> : null}

        <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}><Text style={styles.closeBtnText}>Đóng</Text></Pressable>
      </ScrollView>
    </View>
    {photo ? <Modal visible transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
      <Pressable accessibilityLabel="Đóng ảnh" style={styles.lightbox} onPress={() => setPhoto(null)}><Image source={{ uri: photo }} resizeMode="contain" style={styles.lightboxImg} /></Pressable>
    </Modal> : null}
  </Modal>;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><View style={styles.statBody}>{children}</View></View>;
}

function EventCard({ title, event, apiBase, onPhoto }: { title: string; event: AttendanceEvent | null; apiBase: string; onPhoto: (url: string) => void }) {
  return <View style={styles.event}>
    <View style={styles.eventHead}><View style={[styles.dot, !event && styles.dotOff]} /><Text style={[styles.eventTitle, styles.flex]}>{title}</Text><Text style={styles.eventTime}>{formatTime(event?.recordedAt)}</Text></View>
    {event ? <Evidence event={event} apiBase={apiBase} onPhoto={onPhoto} /> : <Text style={styles.none}>Chưa ghi nhận</Text>}
  </View>;
}

function Evidence({ event, apiBase, onPhoto }: { event: AttendanceEvent; apiBase: string; onPhoto: (url: string) => void }) {
  const [failed, setFailed] = useState(false);
  const address = event.address || event.location?.address || event.workplaceName;
  const acc = event.accuracyMeters ?? event.location?.accuracyMeters;
  const [icon, text]: [AppIconName, string] = event.method === 'SELFIE' ? ['camera-outline', 'Ảnh selfie'] : event.method === 'GPS' ? ['locate-outline', 'Xác thực vị trí GPS'] : event.method === 'NETWORK' ? ['wifi', 'Xác thực Wi-Fi công ty'] : ['shield-checkmark-outline', 'Đã ghi nhận'];
  const url = event.method === 'SELFIE' && event.evidenceUrl ? (event.evidenceUrl.startsWith('http') ? event.evidenceUrl : `${apiBase.replace(/\/$/, '')}${event.evidenceUrl}`) : null;
  return <View style={styles.evidence}>
    {url ? <Pressable accessibilityRole="imagebutton" accessibilityLabel="Xem ảnh selfie" onPress={() => !failed && onPhoto(url)} style={styles.thumb}>{failed ? <AppIcon name="image-outline" size={22} color={colors.muted} /> : <Image source={{ uri: url }} onError={() => setFailed(true)} style={styles.thumbImg} />}</Pressable> : null}
    <View style={styles.flex}>
      <View style={styles.evRow}><AppIcon name={icon} size={15} color={colors.primary} /><Text style={styles.evTitle}>{text}</Text></View>
      {address ? <Line icon="location-outline" text={address} /> : null}
      {event.distanceMeters != null ? <Line icon="resize-outline" text={`Khoảng cách: ${Math.round(event.distanceMeters)} m`} /> : null}
      {acc != null ? <Line icon="navigate-circle-outline" text={`Độ chính xác GPS: ±${Math.round(acc)} m`} /> : null}
    </View>
  </View>;
}

function Line({ icon, text }: { icon: AppIconName; text: string }) {
  return <View style={styles.line}><AppIcon name={icon} size={14} color={colors.muted} /><Text style={styles.lineText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, pressed: { opacity: 0.75 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { maxHeight: '90%', backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 4, backgroundColor: colors.borderLight, marginTop: 10, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800' }, sub: { color: colors.muted, fontSize: 12 }, close: { padding: 6 },
  body: { padding: 20, gap: 12 },
  stats: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  stat: { flex: 1, minHeight: 72, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 10 },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' }, statBody: { marginTop: 6 }, statValue: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, provisional: { color: colors.warningText, fontSize: 10, fontWeight: '700' },
  lateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, late: { color: colors.warningText, fontSize: 12, fontWeight: '700' }, early: { color: colors.dangerText, fontSize: 12, fontWeight: '700' },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }, panelTitle: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '800' },
  creditPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }, creditPillText: { fontSize: 11, fontWeight: '800' },
  panelBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 }, rule: { height: 1, backgroundColor: colors.divider, marginBottom: 6 },
  ratioRow: { flexDirection: 'row', justifyContent: 'space-between' }, small: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  track: { height: 8, borderRadius: 6, backgroundColor: colors.divider, overflow: 'hidden' }, fill: { height: 8, borderRadius: 6 },
  explain: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '600', marginTop: 4 },
  hint: { marginTop: 6, padding: 10, borderRadius: 10, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warningBorder }, hintText: { color: colors.warningText, fontSize: 11, lineHeight: 17 },
  forfeit: { padding: 12, borderRadius: radius.md, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.borderDanger, gap: 4 }, forfeitTitle: { color: colors.dangerText, fontSize: 12, fontWeight: '800' }, forfeitText: { color: colors.dangerText, fontSize: 11, lineHeight: 16 },
  event: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.successDot }, dotOff: { backgroundColor: colors.borderLight },
  eventTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, eventTime: { color: colors.ink, fontSize: 14, fontWeight: '800' }, none: { color: colors.muted, fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  evidence: { flexDirection: 'row', gap: 10, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colors.primarySoft },
  thumb: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' }, thumbImg: { width: 64, height: 64 },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, evTitle: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 }, lineText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 15 },
  ot: { padding: 12, borderRadius: 14, backgroundColor: colors.infoSoft, borderWidth: 1, borderColor: colors.infoBorder, gap: 4 },
  otHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }, otTitle: { flex: 1, color: colors.info, fontSize: 13, fontWeight: '800' }, otTime: { color: colors.ink, fontSize: 12, fontWeight: '700' }, otText: { color: colors.inkSoft, fontSize: 11, lineHeight: 16 }, italic: { fontStyle: 'italic' },
  closeBtn: { height: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, closeBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  lightbox: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }, lightboxImg: { width: '100%', height: '80%' },
});
