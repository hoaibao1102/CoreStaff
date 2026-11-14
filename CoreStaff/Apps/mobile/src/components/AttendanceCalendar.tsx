import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AttendanceDay } from '../employee-api';
import { dayHistoryStatus, isPartialLeaveDay, type HistoryStatus } from '../day-credit';
import { colors, radius, spacing } from '../theme';
import { todayKey } from './ui';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Đơn nghỉ đã gửi/đã duyệt nhưng HR chưa áp dụng vào bảng công. */
export interface LeaveMark { tag: string; stage: 'PENDING' | 'APPROVED' }

interface Look { bg: string; fg: string; border: string; label: string }

/** Màu ô lịch theo trạng thái ngày (cùng phân loại với DayDetailSheet). */
const LOOKS: Record<HistoryStatus, Look> = {
  ATTENDED: { bg: colors.successSoft, fg: colors.successText, border: colors.successBorder, label: 'Đủ công' },
  LATE: { bg: colors.warningSoft, fg: colors.warningText, border: colors.warningBorder, label: 'Đi muộn' },
  EARLY_LEAVE: { bg: colors.dangerSoft, fg: colors.dangerText, border: colors.borderDanger, label: 'Về sớm' },
  FORGOTTEN: { bg: colors.warningSoft, fg: colors.warningText, border: colors.warningBorder, label: 'Quên chấm' },
  FORFEITED: { bg: colors.dangerSoft, fg: colors.dangerText, border: colors.borderDanger, label: 'Mất công' },
  DAY_OFF: { bg: colors.infoSoft, fg: colors.info, border: colors.infoBorder, label: 'Nghỉ' },
  NONE: { bg: colors.surface, fg: colors.muted, border: colors.border, label: '' },
};
const LEGEND: HistoryStatus[] = ['ATTENDED', 'LATE', 'EARLY_LEAVE', 'FORGOTTEN', 'FORFEITED', 'DAY_OFF'];
const OT_COLOR = '#4f46e5';

/** Ngày nghỉ tuần mà vẫn có chấm công thì tính là ngày làm (server cũng tính vào ngày công). */
function statusOf(d: AttendanceDay): HistoryStatus {
  const s = dayHistoryStatus(d);
  // Nghỉ nửa buổi/theo giờ HR đã áp dụng cho ngày chưa có chấm công: vẫn phải thấy ngày đó là có nghỉ.
  if (s === 'NONE' && isPartialLeaveDay(d)) return 'DAY_OFF';
  if (s !== 'NONE' || d.workdayType !== 'WEEKLY_OFF' || !(d.checkIn || d.checkOut)) return s;
  const worked = dayHistoryStatus({ ...d, workdayType: undefined });
  return worked === 'NONE' ? 'ATTENDED' : worked;
}

const two = (n: number) => String(n).padStart(2, '0');

/** Nhãn nghỉ một phần ngày đã được HR áp dụng (½S, ½C, 2h) lấy từ chính bản ghi ngày công. */
function appliedLeaveTag(d?: AttendanceDay): string | null {
  if (!d || !isPartialLeaveDay(d)) return null;
  const types = d.attendanceRequirements?.durationTypes ?? [];
  if (types.includes('MORNING_HALF')) return '½S';
  if (types.includes('AFTERNOON_HALF')) return '½C';
  const hours = (d.attendanceRequirements?.approvedLeaveMinutes ?? 0) / 60;
  return hours > 0 ? `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h` : 'Nghỉ';
}

/** Lịch tháng (tuần bắt đầu Thứ 2). `month` dạng "YYYY-MM". */
export function AttendanceCalendar({ month, items, leaveMarks, onSelect }: { month: string; items: AttendanceDay[]; leaveMarks?: Map<string, LeaveMark>; onSelect: (day: AttendanceDay) => void }) {
  const today = todayKey();
  const cells = useMemo(() => {
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const lead = (new Date(year, mon - 1, 1).getDay() + 6) % 7; // Thứ 2 = 0
    const byDate = new Map(items.map(d => [d.workDate.slice(0, 10), d]));
    const list: Array<{ key: string; day: number; record?: AttendanceDay } | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${two(mon)}-${two(d)}`;
      list.push({ key, day: d, record: byDate.get(key) });
    }
    while (list.length % 7) list.push(null);
    return list;
  }, [month, items]);

  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return <View style={styles.wrap}>
    <View style={styles.weekRow}>{WEEKDAYS.map((w, i) => <Text key={w} style={[styles.weekday, i === 6 && styles.sunday]}>{w}</Text>)}</View>
    {rows.map((row, r) => <View key={r} style={styles.weekRow}>
      {row.map((cell, c) => {
        if (!cell) return <View key={c} style={styles.cell} />;
        const status = cell.record ? statusOf(cell.record) : 'NONE';
        const look = LOOKS[status];
        const isToday = cell.key === today;
        const hasOt = !!cell.record?.overtime;
        const tappable = !!cell.record && (status !== 'NONE' || hasOt);
        const mark = leaveMarks?.get(cell.key);
        const appliedTag = !mark ? appliedLeaveTag(cell.record) : null;
        // Về sớm hiện thêm một chấm riêng ngay cả khi ô đang là "Đi muộn" (giống web).
        const earlyExtra = (cell.record?.earlyMinutes ?? 0) > 0 && status !== 'EARLY_LEAVE';
        const hasMarks = status !== 'NONE' || earlyExtra || !!appliedTag || !!mark || hasOt;
        const body = <View style={[styles.box, { backgroundColor: look.bg, borderColor: isToday ? colors.primary : look.border }, isToday && styles.today]}>
          <Text style={[styles.dayNum, { color: status === 'NONE' ? (c === 6 ? colors.danger : colors.inkSoft) : look.fg }]}>{cell.day}</Text>
          {hasMarks ? <View style={styles.markRow}>
            {status !== 'NONE' ? <View style={[styles.dot, { backgroundColor: look.fg }]} /> : null}
            {earlyExtra ? <View style={[styles.dot, { backgroundColor: colors.dangerText }]} /> : null}
            {appliedTag ? <Text style={[styles.markTag, styles.markApplied]}>{appliedTag}</Text> : mark ? <Text style={[styles.markTag, mark.stage === 'PENDING' ? styles.markPending : styles.markApproved]}>{mark.tag}</Text> : null}
            {hasOt ? <Text style={[styles.markTag, styles.markOt]}>OT</Text> : null}
          </View> : <View style={styles.dotSpace} />}
        </View>;
        return <View key={c} style={styles.cell}>
          {tappable
            ? <Pressable accessibilityRole="button" accessibilityLabel={`Ngày ${cell.day}, ${look.label}${hasOt ? ', có tăng ca' : ''}${mark ? `, đơn nghỉ ${mark.tag} ${mark.stage === 'PENDING' ? 'chờ quản lý duyệt' : 'chờ HR áp dụng'}` : ''}`} onPress={() => onSelect(cell.record!)} style={({ pressed }) => [styles.fill, pressed && styles.pressed]}>{body}</Pressable>
            : body}
        </View>;
      })}
    </View>)}
    <View style={styles.legend}>
      {leaveMarks?.size || items.some(isPartialLeaveDay) ? <><View style={styles.legendItem}><Text style={[styles.markTag, styles.markApplied]}>½S</Text><Text style={styles.legendText}>Nghỉ một phần ngày (HR đã áp dụng)</Text></View></> : null}
      {leaveMarks?.size ? <><View style={styles.legendItem}><Text style={[styles.markTag, styles.markPending]}>½S</Text><Text style={styles.legendText}>Đơn nghỉ chờ duyệt</Text></View><View style={styles.legendItem}><Text style={[styles.markTag, styles.markApproved]}>½S</Text><Text style={styles.legendText}>Đã duyệt, chờ HR áp dụng</Text></View></> : null}
      {items.some(d => d.overtime) ? <View style={styles.legendItem}><Text style={[styles.markTag, styles.markOt]}>OT</Text><Text style={styles.legendText}>Có OT được duyệt</Text></View> : null}
      {LEGEND.map(s => <View key={s} style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: LOOKS[s].bg, borderColor: LOOKS[s].border }]} /><Text style={styles.legendText}>{LOOKS[s].label}</Text></View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: 6 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '800', paddingVertical: 4 },
  sunday: { color: colors.danger },
  cell: { flex: 1, aspectRatio: 0.82, padding: 2 },
  box: { flex: 1, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  today: { borderWidth: 2 },
  dayNum: { fontSize: 14, fontWeight: '800' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotSpace: { width: 6, height: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1 },
  legendText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  markRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2 }, markTag: { fontSize: 9, fontWeight: '900', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden', lineHeight: 13, color: '#fff' }, markPending: { backgroundColor: '#f59e0b' }, markApproved: { backgroundColor: '#2563eb' }, markApplied: { backgroundColor: '#0d9488' }, markOt: { backgroundColor: '#4f46e5' },
  fill: { flex: 1 },
  pressed: { opacity: 0.7 },
});
