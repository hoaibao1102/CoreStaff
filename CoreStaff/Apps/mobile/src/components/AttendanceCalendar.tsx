import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AttendanceDay } from '../employee-api';
import { dayHistoryStatus, type HistoryStatus } from '../day-credit';
import { colors, radius, spacing } from '../theme';
import { todayKey } from './ui';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

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
const LEGEND: HistoryStatus[] = ['ATTENDED', 'LATE', 'EARLY_LEAVE', 'FORGOTTEN', 'DAY_OFF'];

/** Ngày nghỉ tuần mà vẫn có chấm công thì tính là ngày làm (server cũng tính vào ngày công). */
function statusOf(d: AttendanceDay): HistoryStatus {
  const s = dayHistoryStatus(d);
  if (s !== 'NONE' || d.workdayType !== 'WEEKLY_OFF' || !(d.checkIn || d.checkOut)) return s;
  const worked = dayHistoryStatus({ ...d, workdayType: undefined });
  return worked === 'NONE' ? 'ATTENDED' : worked;
}

const two = (n: number) => String(n).padStart(2, '0');

/** Lịch tháng (tuần bắt đầu Thứ 2). `month` dạng "YYYY-MM". */
export function AttendanceCalendar({ month, items, onSelect }: { month: string; items: AttendanceDay[]; onSelect: (day: AttendanceDay) => void }) {
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
        const tappable = !!cell.record && status !== 'NONE';
        const body = <View style={[styles.box, { backgroundColor: look.bg, borderColor: isToday ? colors.primary : look.border }, isToday && styles.today]}>
          <Text style={[styles.dayNum, { color: status === 'NONE' ? (c === 6 ? colors.danger : colors.inkSoft) : look.fg }]}>{cell.day}</Text>
          {status !== 'NONE' ? <View style={[styles.dot, { backgroundColor: look.fg }]} /> : <View style={styles.dotSpace} />}
        </View>;
        return <View key={c} style={styles.cell}>
          {tappable
            ? <Pressable accessibilityRole="button" accessibilityLabel={`Ngày ${cell.day}, ${look.label}`} onPress={() => onSelect(cell.record!)} style={({ pressed }) => [styles.fill, pressed && styles.pressed]}>{body}</Pressable>
            : body}
        </View>;
      })}
    </View>)}
    <View style={styles.legend}>
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
  fill: { flex: 1 },
  pressed: { opacity: 0.7 },
});
