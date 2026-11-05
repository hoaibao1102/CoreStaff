import 'package:intl/intl.dart';
import '../../data/models/attendance_requirements_dto.dart';

class AttendanceFormatters {
  AttendanceFormatters._();

  /// Current time in Vietnam timezone (UTC+07:00 / Asia/Ho_Chi_Minh)
  static DateTime get nowVn => DateTime.now().toUtc().add(const Duration(hours: 7));

  /// Generates the YYYY-MM string for current Vietnam month.
  static String currentMonthKey() {
    final vn = nowVn;
    return '${vn.year}-${vn.month.toString().padLeft(2, '0')}';
  }

  /// Navigates month by offset (-1 or +1), guarding against future months.
  static String shiftMonth(String currentMonthKey, int offset) {
    try {
      final parts = currentMonthKey.split('-').map(int.parse).toList();
      final year = parts[0];
      final month = parts[1];
      final shifted = DateTime.utc(year, month + offset, 1);
      final shiftedKey = '${shifted.year}-${shifted.month.toString().padLeft(2, '0')}';

      final maxKey = AttendanceFormatters.currentMonthKey();
      if (shiftedKey.compareTo(maxKey) > 0) return maxKey;
      return shiftedKey;
    } catch (_) {
      return currentMonthKey;
    }
  }

  /// Determines whether moving to next month is permitted (< current Vietnam month).
  static bool canMoveNext(String monthKey) {
    final maxKey = currentMonthKey();
    return monthKey.compareTo(maxKey) < 0;
  }

  /// Formats YYYY-MM into 'Tháng M/YYYY' (e.g. 'Tháng 11/2026')
  static String formatMonthLabel(String monthKey) {
    final parts = monthKey.split('-');
    if (parts.length != 2) return monthKey;
    final m = int.tryParse(parts[1]) ?? parts[1];
    return 'Tháng $m/${parts[0]}';
  }

  /// Formats UTC ISO timestamp into HH:mm in Vietnam timezone (+07:00), or fallback '--:--'
  static String formatTime(String? raw) {
    if (raw == null || raw.isEmpty) return '--:--';
    try {
      final dt = DateTime.parse(raw);
      final vn = dt.toUtc().add(const Duration(hours: 7));
      return DateFormat('HH:mm').format(vn);
    } catch (_) {
      return '--:--';
    }
  }

  /// Formats YYYY-MM-DD or ISO timestamp into dd/MM/yyyy, or fallback '-'
  static String formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return '-';
    try {
      final dt = DateTime.parse(raw);
      final vn = dt.toUtc().add(const Duration(hours: 7));
      return DateFormat('dd/MM/yyyy').format(vn);
    } catch (_) {
      final clean = raw.length >= 10 ? raw.substring(0, 10) : raw;
      final parts = clean.split('-');
      if (parts.length == 3) {
        return '${parts[2]}/${parts[1]}/${parts[0]}';
      }
      return raw;
    }
  }

  /// Formats minutes into '8g 15p' or '30 phút' or '0 phút'
  static String formatMinutes(int? value) {
    final total = value == null || value < 0 ? 0 : value;
    final hours = total ~/ 60;
    final minutes = total % 60;
    if (hours > 0) {
      return '${hours}g ${minutes.toString().padLeft(2, '0')}p';
    }
    return '$minutes phút';
  }

  /// Formats time intervals, e.g., '08:00–12:00, 13:00–17:00'
  static String intervalText(List<TimeIntervalDto> items) {
    if (items.isEmpty) return 'Không có';
    return items.map((i) => '${i.from}–${i.to}').join(', ');
  }

  /// Formats pending leave description
  static String pendingLeaveText(String durationType, String? start, String? end) {
    switch (durationType) {
      case 'MORNING_HALF':
        return 'Nghỉ buổi sáng';
      case 'AFTERNOON_HALF':
        return 'Nghỉ buổi chiều';
      case 'CUSTOM_HOURS':
        return 'Nghỉ theo giờ${start != null && end != null ? ' ($start–$end)' : ''}';
      default:
        return 'Nghỉ cả ngày';
    }
  }
}

