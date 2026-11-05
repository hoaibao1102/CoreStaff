/// Định dạng ngày giờ theo múi giờ Việt Nam (UTC+7), khớp với `mobile/src/components/ui.tsx`.
const _vnOffset = Duration(hours: 7);

DateTime? _parse(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final d = DateTime.tryParse(iso);
  return d?.toUtc().add(_vnOffset);
}

String _two(int v) => v.toString().padLeft(2, '0');

String formatTime(String? iso) {
  final d = _parse(iso);
  return d == null ? '--:--' : '${_two(d.hour)}:${_two(d.minute)}';
}

String formatDate(String? iso) {
  final d = _parse(iso);
  return d == null ? '-' : '${_two(d.day)}/${_two(d.month)}/${d.year}';
}

String formatDateTime(String? iso) {
  final d = _parse(iso);
  return d == null ? '-' : '${formatTime(iso)} ${formatDate(iso)}';
}

/// 125 -> "2 giờ 5 phút", 40 -> "40 phút", 120 -> "2 giờ", null -> "-".
String formatMinutes(num? minutes) {
  if (minutes == null) return '-';
  final m = minutes.round();
  if (m <= 0) return '0 phút';
  final h = m ~/ 60;
  final r = m % 60;
  if (h == 0) return '$r phút';
  return r == 0 ? '$h giờ' : '$h giờ $r phút';
}

/// "2026-09" -> "09/2026"; giá trị khác định dạng giữ nguyên.
String formatPeriod(Object? key) {
  final m = RegExp(r'^(\d{4})-(\d{2})$').firstMatch('${key ?? ''}');
  return m == null ? '${key ?? '-'}' : '${m.group(2)}/${m.group(1)}';
}

/// "Ca hành chính (08:00 - 17:00)" -> "Ca hành chính" (giờ đã có dòng riêng).
String shiftTitle(Object? name, [String fallback = '']) {
  final t = '${name ?? ''}'.replaceAll(RegExp(r'\s*\(.*\)\s*$'), '').trim();
  return t.isEmpty ? fallback : t;
}

String formatMoney(num? value) {
  final v = (value ?? 0).round();
  final s = v.abs().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
    buf.write(s[i]);
  }
  return '${v < 0 ? '-' : ''}$buf đ';
}

/// Tháng hiện tại theo giờ VN, dạng yyyy-MM.
String currentMonthKey() {
  final d = DateTime.now().toUtc().add(_vnOffset);
  return '${d.year}-${_two(d.month)}';
}

/// yyyy-MM-dd theo giờ VN.
String todayKey() {
  final d = DateTime.now().toUtc().add(_vnOffset);
  return '${d.year}-${_two(d.month)}-${_two(d.day)}';
}

String shiftMonth(String key, int offset) {
  final p = key.split('-').map(int.parse).toList();
  final d = DateTime(p[0], p[1] + offset, 1);
  return '${d.year}-${_two(d.month)}';
}
