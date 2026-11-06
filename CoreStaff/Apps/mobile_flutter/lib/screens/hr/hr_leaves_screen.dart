import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../services/employee_api.dart';
import '../../services/hr_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/cards.dart';
import '../../widgets/feature_screen.dart';
import '../manager/manager_team_screen.dart' show initialsOf;
import '../requests/requests_tab.dart' show requestStatusLabel, requestStatusTone, durationLabel, minutesText;

/// Đơn nghỉ phép HR cần xử lý: quản lý đã duyệt, HR áp dụng vào bảng công.
class HrLeavesScreen extends StatefulWidget {
  final int realtimeRevision;
  const HrLeavesScreen({super.key, this.realtimeRevision = 0});

  @override
  State<HrLeavesScreen> createState() => _HrLeavesScreenState();
}

class _HrLeavesScreenState extends State<HrLeavesScreen> {
  List<Map> _leaves = [];
  // Đơn nghỉ lưu userId của nhân viên nên ghép tên qua danh bạ.
  final Map<String, Map> _byUserId = {};
  String _filter = 'APPROVED';
  String? _applyingId;
  bool _loading = true;
  String? _error;
  String? _success;

  static const _filters = [
    ('APPROVED', 'Chờ áp dụng'),
    ('HR_APPLIED', 'Đã áp dụng'),
    ('ALL', 'Tất cả'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant HrLeavesScreen old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final results = await Future.wait<List<dynamic>>([HrApi.instance.leaves(), HrApi.instance.employees()]);
      if (!mounted) return;
      _byUserId
        ..clear()
        ..addEntries(results[1].whereType<Map>().where((e) => e['userId'] != null).map((e) => MapEntry('${e['userId']}', e)));
      setState(() {
        _leaves = results[0].whereType<Map>().toList()
          ..sort((a, b) => '${b['createdAt'] ?? ''}'.compareTo('${a['createdAt'] ?? ''}'));
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyEmployeeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _apply(Map leave) async {
    final name = '${_byUserId['${leave['employeeId']}']?['fullName'] ?? 'nhân viên'}';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Áp dụng đơn nghỉ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        content: Text('Áp dụng đơn nghỉ ${formatDate(leave['startDate'] as String?)} - ${formatDate(leave['endDate'] as String?)} của $name vào bảng công? Thao tác này không hoàn tác được.',
            style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy', style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w700))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Áp dụng', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() { _applyingId = '${leave['_id']}'; _error = null; _success = null; });
    try {
      await HrApi.instance.applyLeave('${leave['_id']}');
      if (mounted) setState(() => _success = 'Đã áp dụng đơn nghỉ của $name.');
      await _load(silent: true);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyEmployeeError(e));
    } finally {
      if (mounted) setState(() => _applyingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filter == 'ALL' ? _leaves : _leaves.where((l) => l['status'] == _filter).toList();
    final waiting = _leaves.where((l) => l['status'] == 'APPROVED').length;

    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const ScreenHeader(eyebrow: 'NGHỈ PHÉP', title: 'Đơn nghỉ phép', description: 'Áp dụng đơn đã được quản lý duyệt vào bảng công.'),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_success != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(color: AppColors.successBg, borderRadius: BorderRadius.circular(12)),
              child: Text(_success!, style: const TextStyle(color: AppColors.successText, fontWeight: FontWeight.w700, fontSize: 13)),
            ),
            const SizedBox(height: 12),
          ],
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _filters.map((f) {
                final selected = _filter == f.$1;
                final label = f.$1 == 'APPROVED' && waiting > 0 ? '${f.$2} ($waiting)' : f.$2;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: selected ? Colors.white : AppColors.textSecondary)),
                    selected: selected,
                    showCheckmark: false,
                    selectedColor: AppColors.primary,
                    backgroundColor: AppColors.bgSurface,
                    side: BorderSide(color: selected ? AppColors.primary : AppColors.borderLight),
                    onSelected: (_) => setState(() => _filter = f.$1),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 14),
          if (_loading)
            const LoadingBlock()
          else if (filtered.isEmpty)
            EmptyCard(_filter == 'APPROVED' ? 'Không có đơn nào đang chờ áp dụng.' : 'Chưa có đơn nghỉ phép nào.')
          else
            ...filtered.map((l) => Padding(padding: const EdgeInsets.only(bottom: 10), child: _card(l))),
        ],
      ),
    );
  }

  Widget _card(Map l) {
    final emp = _byUserId['${l['employeeId']}'];
    final name = '${emp?['fullName'] ?? 'Nhân viên'}';
    final status = '${l['status']}';
    final applying = _applyingId == '${l['_id']}';
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text(initialsOf(name), style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
              Text('${emp?['employeeCode'] ?? ''}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ]),
          ),
          StatusBadge(label: requestStatusLabel(status), tone: requestStatusTone(status)),
        ]),
        const SizedBox(height: 12),
        Text(l['leaveType'] == 'PAID_LEAVE' ? 'Nghỉ phép có lương' : 'Nghỉ không lương',
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text('${formatDate(l['startDate'] as String?)} - ${formatDate(l['endDate'] as String?)}',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        Text('${durationLabel(l['durationType'] as String?)}${l['requestedStart'] != null && l['requestedEnd'] != null ? ' · ${l['requestedStart']}–${l['requestedEnd']}' : ''}',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
        if (l['calculatedMinutes'] is num) ...[
          const SizedBox(height: 6),
          Text('${minutesText(l['calculatedMinutes'] as num)} · ${((l['leaveEquivalent'] as num?) ?? 0).toStringAsFixed(2)} ngày phép',
              style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w700)),
        ],
        if ('${l['reason'] ?? ''}'.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('${l['reason']}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.35)),
        ],
        if (status == 'APPROVED') ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 0),
              onPressed: _applyingId != null ? null : () => _apply(l),
              child: applying
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Áp dụng vào bảng công', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ]),
    );
  }
}
