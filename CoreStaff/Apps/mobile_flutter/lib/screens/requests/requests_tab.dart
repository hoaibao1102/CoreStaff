import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../services/employee_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/buttons.dart';
import '../../widgets/cards.dart';
import '../../widgets/feature_screen.dart';
import 'request_form_screen.dart';

String requestStatusLabel(String? s) => const {
      'PENDING': 'Chờ duyệt',
      'PENDING_MANAGER': 'Chờ quản lý',
      'APPROVED': 'Đã duyệt',
      'REJECTED': 'Từ chối',
      'CANCELLED': 'Đã hủy',
      'HR_APPLIED': 'Đã áp dụng',
      'CLARIFICATION_REQUESTED': 'Cần bổ sung',
    }[s] ??
    (s ?? '-');

BadgeTone requestStatusTone(String? s) => switch (s) {
      'APPROVED' || 'HR_APPLIED' => BadgeTone.success,
      'PENDING' || 'PENDING_MANAGER' || 'CLARIFICATION_REQUESTED' => BadgeTone.warning,
      'REJECTED' => BadgeTone.danger,
      _ => BadgeTone.neutral,
    };

String durationLabel(String? v) =>
    const {'FULL_DAY': 'Cả ngày', 'MORNING_HALF': 'Buổi sáng', 'AFTERNOON_HALF': 'Buổi chiều', 'CUSTOM_HOURS': 'Theo giờ'}[v ?? 'FULL_DAY'] ??
    'Cả ngày';

String minutesText(num v) => formatMinutes(v);

class RequestsTab extends StatefulWidget {
  final VoidCallback onBackToOverview;
  final int realtimeRevision;

  /// Nhúng trong màn khác (đã có tiêu đề riêng) thì bỏ tiêu đề và đệm đầu.
  final bool embedded;
  const RequestsTab({super.key, required this.onBackToOverview, this.realtimeRevision = 0, this.embedded = false});

  @override
  State<RequestsTab> createState() => _RequestsTabState();
}

class _RequestsTabState extends State<RequestsTab> {
  final _api = EmployeeApi.instance;
  List<Map> _leaves = [];
  List<Map> _overtime = [];
  String _filter = 'all';
  bool _loading = true;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant RequestsTab old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    _error = null;
    final r = await Future.wait([
      _api.myLeaves().then<Object>((v) => v).catchError((Object e) => e),
      _api.myOvertime().then<Object>((v) => v).catchError((Object e) => e),
    ]);
    if (!mounted) return;
    setState(() {
      if (r[0] is List) _leaves = (r[0] as List).cast<Map>();
      if (r[1] is List) _overtime = (r[1] as List).cast<Map>();
      final failure = r.whereType<Exception>().firstOrNull;
      if (failure != null) _error = friendlyEmployeeError(failure);
      _loading = false;
    });
  }

  Future<void> _open(String type) async {
    setState(() => _success = null);
    final message = await Navigator.of(context).push<String>(
      MaterialPageRoute(fullscreenDialog: true, builder: (_) => RequestFormScreen(type: type)),
    );
    if (message != null && mounted) {
      setState(() { _success = message; _filter = 'all'; });
      await _load(silent: true);
    }
  }

  List<({String type, Map value, String date})> get _rows {
    final rows = [
      if (_filter != 'overtime')
        for (final v in _leaves) (type: 'leave', value: v, date: '${v['createdAt'] ?? v['startDate'] ?? ''}'),
      if (_filter != 'leave')
        for (final v in _overtime) (type: 'overtime', value: v, date: '${v['createdAt'] ?? v['workDate'] ?? ''}'),
    ];
    rows.sort((a, b) => b.date.compareTo(a.date));
    return rows;
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows;
    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(
        padding: EdgeInsets.fromLTRB(22, widget.embedded ? 8 : 28, 22, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (!widget.embedded) ...[
            const ScreenHeader(
              eyebrow: 'ĐƠN TỪ',
              title: 'Đơn từ',
              description: 'Tạo và theo dõi nghỉ phép, tăng ca.',
            ),
            const SizedBox(height: 16),
          ],
          if (_error != null && (_loading || rows.isNotEmpty)) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_success != null) ...[SuccessBanner(message: _success!), const SizedBox(height: 12)],
          Row(children: [
            Expanded(child: _actionCard(Icons.calendar_today_outlined, 'Xin nghỉ phép', 'Có lương hoặc không lương', () => _open('leave'))),
            const SizedBox(width: 12),
            Expanded(child: _actionCard(Icons.schedule, 'Đăng ký tăng ca', 'Hệ thống tự phân loại OT', () => _open('overtime'))),
          ]),
          const SizedBox(height: 14),
          _segmented(),
          const SizedBox(height: 14),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const SectionTitle('Hoạt động gần đây'),
            Text('${rows.length} yêu cầu', style: const TextStyle(color: AppColors.textQuaternary, fontSize: 11, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 12),
          if (_loading)
            const LoadingBlock()
          else if (_error != null && rows.isEmpty)
            ErrorState(message: _error!, onRetry: _load)
          else if (rows.isEmpty)
            const EmptyCard('Chưa có yêu cầu. Đơn nghỉ phép và đăng ký tăng ca sẽ xuất hiện tại đây.')
          else
            ...rows.map((r) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: r.type == 'leave' ? _leaveCard(r.value) : _overtimeCard(r.value),
                )),
        ],
      ),
    );
  }

  Widget _segmented() {
    const opts = [('all', 'Tất cả'), ('leave', 'Nghỉ phép'), ('overtime', 'Tăng ca')];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: opts.map((o) {
          final on = _filter == o.$1;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _filter = o.$1),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(color: on ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(11)),
                alignment: Alignment.center,
                child: Text(o.$2,
                    style: TextStyle(
                        color: on ? AppColors.primaryDark : AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w800)),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _actionCard(IconData icon, String title, String desc, VoidCallback onTap) => Material(
        color: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AppColors.border)),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, size: 21, color: AppColors.primaryDark),
              ),
              const SizedBox(height: 10),
              Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(desc, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.35)),
            ]),
          ),
        ),
      );

  Widget _leaveCard(Map v) {
    final canCancel = v['status'] == 'PENDING_MANAGER';
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _typeIcon(Icons.calendar_today_outlined, AppColors.successBg, AppColors.successText),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(v['leaveType'] == 'PAID_LEAVE' ? 'Nghỉ phép có lương' : 'Nghỉ không lương',
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('${formatDate(v['startDate'] as String?)} - ${formatDate(v['endDate'] as String?)}',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              Text(
                  '${durationLabel(v['durationType'] as String?)}${v['requestedStart'] != null && v['requestedEnd'] != null ? ' · ${v['requestedStart']}–${v['requestedEnd']}' : ''}',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ]),
          ),
          StatusBadge(label: requestStatusLabel(v['status'] as String?), tone: requestStatusTone(v['status'] as String?)),
        ]),
        if (v['calculatedMinutes'] != null) ...[
          const SizedBox(height: 8),
          Text('${minutesText(v['calculatedMinutes'] as num)} · ${((v['leaveEquivalent'] as num?) ?? 0).toStringAsFixed(2)} ngày phép',
              style: const TextStyle(color: AppColors.primaryDark, fontSize: 11, fontWeight: FontWeight.w700)),
        ],
        const SizedBox(height: 8),
        Text('${v['reason'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.5)),
        if ((v['reviewComment'] ?? '').toString().isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('Phản hồi: ${v['reviewComment']}', style: const TextStyle(color: AppColors.warningText, fontSize: 11, height: 1.45)),
        ],
        if (canCancel) ...[
          const SizedBox(height: 10),
          SecondaryButton(label: 'Hủy đơn', danger: true, onPress: () => _cancel(v['_id'] as String)),
        ],
      ]),
    );
  }

  Future<void> _cancel(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Hủy đơn nghỉ phép', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        content: const Text('Bạn chắc chắn muốn hủy đơn này?', style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Không', style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w700))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.dangerText, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Hủy đơn', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.cancelLeave(id);
      if (mounted) setState(() => _success = 'Đã hủy đơn nghỉ phép.');
      await _load(silent: true);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyEmployeeError(e));
    }
  }

  Widget _typeIcon(IconData icon, Color bg, Color fg) => Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(11)),
        child: Icon(icon, size: 19, color: fg),
      );

  Widget _overtimeCard(Map v) {
    final eligible = (v['overtimeResult'] as Map?)?['eligibleMinutes'];
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _typeIcon(Icons.schedule, AppColors.primarySoft, AppColors.primaryDark),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Tăng ca ngày ${formatDate(v['workDate'] as String?)}',
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('${formatTime(v['requestedStart'] as String?)} - ${formatTime(v['requestedEnd'] as String?)}',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ]),
          ),
          StatusBadge(label: requestStatusLabel(v['status'] as String?), tone: requestStatusTone(v['status'] as String?)),
        ]),
        const SizedBox(height: 8),
        Text('${v['reason'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.5)),
        if (eligible != null) ...[
          const SizedBox(height: 6),
          Text('Đủ điều kiện: $eligible phút', style: const TextStyle(color: AppColors.primaryDark, fontSize: 11, fontWeight: FontWeight.w700)),
        ],
        if ((v['reviewComment'] ?? '').toString().isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('Phản hồi: ${v['reviewComment']}', style: const TextStyle(color: AppColors.warningText, fontSize: 11, height: 1.45)),
        ],
      ]),
    );
  }
}
