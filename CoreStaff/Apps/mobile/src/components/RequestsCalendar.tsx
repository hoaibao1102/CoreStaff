import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AttendanceConfirmationRequest, LeaveRequest, OvertimeRequest } from '../employee-api';
import { colors, radius, spacing } from '../theme';
import { todayKey } from './ui';

export type RequestEntry = { type: 'leave'; value: LeaveRequest } | { type: 'overtime'; value: OvertimeRequest } | { type: 'attendance'; value: AttendanceConfirmationRequest };

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const two = (n: number) => String(n).padStart(2, '0');

const LEAVE = { bg: '#ccfbf1', border: '#0d9488', fg: '#134e4a' };
const OT = { bg: '#e0e7ff', border: '#4f46e5', fg: '#312e81' };
const ATT = { bg: '#fef3c7', border: '#d97706', fg: '#78350f' };

/** Màu chấm trạng thái duyệt — đơn chờ xử lý được ưu tiên hiển thị. */
export const REQUEST_STATUS_DOT = { PENDING: '#f59e0b', APPROVED: '#16a34a', REJECTED: '#dc2626', CANCELLED: '#94a3b8' } as const;
type StatusGroup = keyof typeof REQUEST_STATUS_DOT;
export const requestStatusGroup = (status: string): StatusGroup =>
  status === 'PENDING' || status === 'PENDING_MANAGER' || status === 'CLARIFICATION_REQUESTED' ? 'PENDING'
    : status === 'APPROVED' || status === 'HR_APPLIED' ? 'APPROVED'
      : status === 'REJECTED' ? 'REJECTED' : 'CANCELLED';
const PRIORITY: StatusGroup[] = ['PENDING', 'REJECTED', 'APPROVED', 'CANCELLED'];

/** Danh sách ngày YYYY-MM-DD từ start đến end (giới hạn 62 ngày để tránh đơn lỗi). */
function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = start.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = end.slice(0, 10).split('-').map(Number);
  if (!sy || !ey) return out;
  const last = Date.UTC(ey, em - 1, ed);
  for (let t = Date.UTC(sy, sm - 1, sd), n = 0; t <= last && n < 62; t += 86400000, n++) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`);
  }
  return out;
}

/** Gom đơn theo ngày: đơn nghỉ trải đều trên mọi ngày trong khoảng, tăng ca theo ngày làm. */
export function groupRequestsByDay(leaves: LeaveRequest[], overtime: OvertimeRequest[], attendance: AttendanceConfirmationRequest[] = []): Map<string, RequestEntry[]> {
  const map = new Map<string, RequestEntry[]>();
  const add = (day: string, entry: RequestEntry) => { const list = map.get(day); if (list) list.push(entry); else map.set(day, [entry]); };
  for (const value of leaves) for (const day of daysBetween(value.startDate, value.endDate || value.startDate)) add(day, { type: 'leave', value });
  for (const value of overtime) add(value.workDate.slice(0, 10), { type: 'overtime', value });
  for (const value of attendance) add(value.workDate.slice(0, 10), { type: 'attendance', value });
  return map;
}

/** Ký hiệu của một đơn nghỉ: P = cả ngày, ½S/½C = nửa buổi sáng/chiều, 2h = nghỉ theo giờ. */
export function leaveShortTag(live: LeaveRequest): string {
  if (live.durationType === 'MORNING_HALF') return '½S';
  if (live.durationType === 'AFTERNOON_HALF') return '½C';
  if (live.durationType === 'CUSTOM_HOURS') {
    const h = (live.calculatedMinutes ?? 0) / 60;
    return h > 0 ? `${Number.isInteger(h) ? h : h.toFixed(1)}h` : 'Giờ';
  }
  return 'P';
}

function leaveTag(leaves: LeaveRequest[]): string {
  return leaveShortTag(leaves.find(l => requestStatusGroup(l.status) !== 'CANCELLED') ?? leaves[0]);
}

/** Lịch tháng của đơn từ (tuần bắt đầu Thứ 2). `month` dạng "YYYY-MM". */
export function RequestsCalendar({ month, byDay, onSelect }: { month: string; byDay: Map<string, RequestEntry[]>; onSelect: (day: string) => void }) {
  const today = todayKey();
  const cells = useMemo(() => {
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const lead = (new Date(year, mon - 1, 1).getDay() + 6) % 7;
    const list: Array<{ key: string; day: number } | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) list.push({ key: `${year}-${two(mon)}-${two(d)}`, day: d });
    while (list.length % 7) list.push(null);
    return list;
  }, [month]);
  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return <View style={styles.wrap}>
    <View style={styles.weekRow}>{WEEKDAYS.map((w, i) => <Text key={w} style={[styles.weekday, i === 6 && styles.sunday]}>{w}</Text>)}</View>
    {rows.map((row, r) => <View key={r} style={styles.weekRow}>
      {row.map((cell, c) => {
        if (!cell) return <View key={c} style={styles.cell} />;
        const entries = byDay.get(cell.key) ?? [];
        const leaves = entries.flatMap(e => e.type === 'leave' ? [e.value] : []);
        const hasLeave = leaves.length > 0;
        const hasOt = entries.some(e => e.type === 'overtime');
        const hasAtt = entries.some(e => e.type === 'attendance');
        const groups = new Set(entries.map(e => requestStatusGroup(e.value.status)));
        const dot = PRIORITY.find(g => groups.has(g));
        const look = hasLeave ? LEAVE : hasOt ? OT : hasAtt ? ATT : null;
        const isToday = cell.key === today;
        const body = <View style={[styles.box, look && { backgroundColor: look.bg, borderColor: look.border }, isToday && styles.today]}>
          <Text style={[styles.dayNum, { color: look ? look.fg : c === 6 ? colors.danger : colors.inkSoft }]}>{cell.day}</Text>
          <View style={styles.markRow}>
            {hasLeave ? <Text style={[styles.tag, { backgroundColor: LEAVE.border }]}>{leaveTag(leaves)}</Text> : null}
            {hasOt ? <Text style={[styles.tag, { backgroundColor: OT.border }]}>OT</Text> : null}
            {hasAtt ? <Text style={[styles.tag, { backgroundColor: ATT.border }]}>CC</Text> : null}
            {dot ? <View style={[styles.dot, { backgroundColor: REQUEST_STATUS_DOT[dot] }]} /> : <View style={styles.dotSpace} />}
          </View>
        </View>;
        return <View key={c} style={styles.cell}>
          {entries.length
            ? <Pressable accessibilityRole="button" accessibilityLabel={`Ngày ${cell.day}, ${entries.length} đơn${hasLeave ? `, nghỉ phép ${leaveTag(leaves)}` : ''}${hasOt ? ', tăng ca' : ''}${hasAtt ? ', xác nhận công' : ''}`} onPress={() => onSelect(cell.key)} style={({ pressed }) => [styles.fill, pressed && styles.pressed]}>{body}</Pressable>
            : body}
        </View>;
      })}
    </View>)}
    <View style={styles.legend}>
      <View style={styles.legendItem}><Text style={[styles.tag, { backgroundColor: LEAVE.border }]}>P</Text><Text style={styles.legendText}>Nghỉ cả ngày</Text></View>
      <View style={styles.legendItem}><Text style={[styles.tag, { backgroundColor: LEAVE.border }]}>½S</Text><Text style={styles.legendText}>Nửa ngày sáng</Text></View>
      <View style={styles.legendItem}><Text style={[styles.tag, { backgroundColor: LEAVE.border }]}>½C</Text><Text style={styles.legendText}>Nửa ngày chiều</Text></View>
      <View style={styles.legendItem}><Text style={[styles.tag, { backgroundColor: OT.border }]}>OT</Text><Text style={styles.legendText}>Tăng ca</Text></View>
      <View style={styles.legendItem}><Text style={[styles.tag, { backgroundColor: ATT.border }]}>CC</Text><Text style={styles.legendText}>Xác nhận công</Text></View>
      <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: REQUEST_STATUS_DOT.PENDING }]} /><Text style={styles.legendText}>Chờ duyệt</Text></View>
      <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: REQUEST_STATUS_DOT.APPROVED }]} /><Text style={styles.legendText}>Đã duyệt</Text></View>
      <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: REQUEST_STATUS_DOT.REJECTED }]} /><Text style={styles.legendText}>Từ chối</Text></View>
      <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: REQUEST_STATUS_DOT.CANCELLED }]} /><Text style={styles.legendText}>Đã hủy</Text></View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: 6 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '800', paddingVertical: 4 },
  sunday: { color: colors.danger },
  cell: { flex: 1, aspectRatio: 0.82, padding: 2 },
  fill: { flex: 1 },
  pressed: { opacity: 0.7 },
  box: { flex: 1, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 },
  today: { borderColor: colors.ink, borderWidth: 2 },
  dayNum: { fontSize: 14, fontWeight: '800' },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 12 },
  tag: { fontSize: 8, fontWeight: '900', color: '#fff', paddingHorizontal: 3, borderRadius: 4, overflow: 'hidden', lineHeight: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotSpace: { width: 7, height: 7 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5 },
  legendText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
});
