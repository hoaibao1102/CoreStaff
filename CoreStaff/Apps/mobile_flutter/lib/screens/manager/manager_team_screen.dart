import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../services/employee_api.dart';
import '../../services/manager_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/cards.dart';
import '../../widgets/feature_screen.dart';

String initialsOf(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((s) => RegExp(r'^\p{L}', unicode: true).hasMatch(s)).toList();
  if (parts.isEmpty) return 'NV';
  final last = parts.length > 2 ? parts.sublist(parts.length - 2) : parts;
  return last.map((p) => p[0]).join().toUpperCase();
}

/// Tổng quan phòng ban: ai đang trong ca, ai chưa vào ca, ai đã hoàn thành hôm nay.
class ManagerTeamScreen extends StatefulWidget {
  final int realtimeRevision;
  const ManagerTeamScreen({super.key, this.realtimeRevision = 0});

  @override
  State<ManagerTeamScreen> createState() => _ManagerTeamScreenState();
}

class _ManagerTeamScreenState extends State<ManagerTeamScreen> {
  List<Map> _team = [];
  String _query = '';
  bool _loading = true;
  String? _error;

  static const _labels = {
    'CHECKED_IN': 'Đang trong ca',
    'COMPLETED': 'Hoàn thành',
    'DAY_OFF': 'Ngày nghỉ',
    'LOCKED': 'Đã khóa',
    'NOT_CHECKED_IN': 'Chưa vào ca',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ManagerTeamScreen old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final data = await ManagerApi.instance.team();
      if (mounted) setState(() { _team = data.cast<Map>(); _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyEmployeeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _status(Map m) => ((m['todayAttendance'] as Map?)?['attendanceStatus'] as String?) ?? 'NOT_CHECKED_IN';

  BadgeTone _tone(String s) => switch (s) {
        'COMPLETED' => BadgeTone.success,
        'CHECKED_IN' => BadgeTone.info,
        'LOCKED' => BadgeTone.warning,
        _ => BadgeTone.neutral,
      };

  Widget _stat(int value, String label, Color bg, Color fg) => Expanded(
        child: Container(
          height: 84,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('$value', style: TextStyle(color: fg, fontSize: 26, fontWeight: FontWeight.w800, height: 1.2)),
            Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final needle = _query.trim().toLowerCase();
    final filtered = needle.isEmpty
        ? _team
        : _team.where((m) => '${m['fullName'] ?? ''} ${m['employeeCode'] ?? ''}'.toLowerCase().contains(needle)).toList();
    int count(String s) => _team.where((m) => _status(m) == s).length;

    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          const ScreenHeader(eyebrow: 'PHÒNG BAN', title: 'Phòng ban', description: 'Tình hình chấm công của nhân viên hôm nay.'),
          const SizedBox(height: 16),
          if (_error != null && (_loading || _team.isNotEmpty)) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_loading)
            const LoadingBlock()
          else if (_error != null && _team.isEmpty)
            ErrorState(message: _error!, onRetry: _load)
          else ...[
            Row(children: [
              _stat(count('CHECKED_IN'), 'Đang làm', AppColors.infoBg, AppColors.infoText),
              const SizedBox(width: 8),
              _stat(count('COMPLETED'), 'Hoàn thành', AppColors.successBg, AppColors.successText),
              const SizedBox(width: 8),
              _stat(count('NOT_CHECKED_IN'), 'Chưa vào ca', AppColors.warningBg, AppColors.warningText),
            ]),
            const SizedBox(height: 14),
            TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: 'Tìm theo tên hoặc mã nhân viên',
                prefixIcon: const Icon(Icons.search, color: AppColors.textMuted, size: 20),
                filled: true,
                fillColor: AppColors.bgSurface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.borderLight)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.borderLight)),
              ),
            ),
            const SizedBox(height: 14),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const SectionTitle('Nhân viên'),
              Text('${filtered.length}/${_team.length}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 12),
            if (filtered.isEmpty)
              EmptyCard(_team.isNotEmpty ? 'Không tìm thấy nhân viên. Thử tìm bằng tên hoặc mã khác.' : 'Phòng ban của bạn chưa có nhân viên nào.')
            else
              ...filtered.map((m) => Padding(padding: const EdgeInsets.only(bottom: 10), child: _member(m))),
          ],
        ],
      ),
    );
  }

  Widget _member(Map m) {
    final status = _status(m);
    final att = m['todayAttendance'] as Map?;
    final name = (m['fullName'] ?? m['employeeCode'] ?? '').toString();
    final workplace = (m['workplaceName'] ?? '').toString();
    return AppCard(
      child: Row(children: [
        Container(
          width: 42,
          height: 42,
          decoration: const BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: Text(initialsOf(name), style: const TextStyle(color: AppColors.primary, fontSize: 14, fontWeight: FontWeight.w800)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
              ),
              const SizedBox(width: 8),
              StatusBadge(label: _labels[status] ?? 'Chưa có dữ liệu', tone: _tone(status)),
            ]),
            const SizedBox(height: 3),
            Text('${m['employeeCode'] ?? ''}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            if (workplace.isNotEmpty) Text(workplace, style: const TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.35)),
            if (att?['checkInAt'] != null) ...[
              const SizedBox(height: 4),
              Text('Vào ${formatTime(att!['checkInAt'] as String?)} · Ra ${formatTime(att['checkOutAt'] as String?)}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
            ],
          ]),
        ),
      ]),
    );
  }
}
