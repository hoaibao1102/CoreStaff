import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import '../../services/employee_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/bottom_tab_bar.dart';
import '../../widgets/cards.dart';

String _greeting() {
  final h = DateTime.now().toUtc().add(const Duration(hours: 7)).hour;
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

String _todayLabel() {
  const days = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
  final d = DateTime.now().toUtc().add(const Duration(hours: 7));
  return '${days[d.weekday - 1]}, ${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';
}

class OverviewTab extends StatefulWidget {
  final AuthUser user;
  final ValueChanged<BottomTabKey> onNavigateTab;
  final int realtimeRevision;

  /// Khác null nghĩa là quản lý: hiện banner số đơn chờ duyệt.
  final int? pendingApprovals;

  const OverviewTab({
    super.key,
    required this.user,
    required this.onNavigateTab,
    this.realtimeRevision = 0,
    this.pendingApprovals,
  });

  @override
  State<OverviewTab> createState() => _OverviewTabState();
}

class _OverviewTabState extends State<OverviewTab> {
  final _api = EmployeeApi.instance;
  Json? _today;
  int _requestCount = 0;
  int _newPayslips = 0;
  bool _loading = true;
  String? _error;

  bool get _isManager => widget.pendingApprovals != null;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant OverviewTab old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    final r = await Future.wait([
      _api.today().then<Object>((v) => v).catchError((Object e) => e),
      _api.myLeaves().then<Object>((v) => v).catchError((Object e) => e),
      _api.myOvertime().then<Object>((v) => v).catchError((Object e) => e),
      _api.myPayslips().then<Object>((v) => v).catchError((Object e) => e),
    ]);
    if (!mounted) return;
    setState(() {
      if (r[0] is Map<String, dynamic>) _today = r[0] as Json;
      final leaves = r[1] is List ? (r[1] as List).where((i) => i['status'] == 'PENDING_MANAGER').length : 0;
      final ot = r[2] is List ? (r[2] as List).where((i) => i['status'] == 'PENDING' || i['status'] == 'CLARIFICATION_REQUESTED').length : 0;
      _requestCount = leaves + ot;
      _newPayslips = r[3] is List ? (r[3] as List).where((i) => i['status'] == 'RELEASED').length : 0;
      final failure = r.whereType<Exception>().firstOrNull;
      _error = failure == null ? null : friendlyEmployeeError(failure);
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          _header(user),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_loading) const LoadingBlock() else _todayCard(),
          if (_isManager) ...[const SizedBox(height: 14), _approvalBanner()],
          const SizedBox(height: 18),
          const SectionTitle('Cần bạn chú ý'),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: _metric(Icons.description_outlined, _requestCount, 'Đơn đang chờ duyệt',
                  _requestCount > 0 ? AppColors.warningText : AppColors.textMuted, () => widget.onNavigateTab(BottomTabKey.requests)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _metric(Icons.account_balance_wallet_outlined, _newPayslips, 'Phiếu lương mới',
                  _newPayslips > 0 ? AppColors.primary : AppColors.textMuted, () => widget.onNavigateTab(BottomTabKey.payslips)),
            ),
          ]),
          const SizedBox(height: 18),
          const SectionTitle('Truy cập nhanh'),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.9,
            children: _isManager
                ? [
                    _tile(Icons.done_all, 'Duyệt đơn', BottomTabKey.approvals),
                    _tile(Icons.people_outline, 'Phòng ban', BottomTabKey.team),
                    _tile(Icons.list_alt_outlined, 'Lịch sử công', BottomTabKey.attendance),
                    _tile(Icons.description_outlined, 'Đơn của tôi', BottomTabKey.requests),
                  ]
                : [
                    _tile(Icons.calendar_today_outlined, 'Xin nghỉ phép', BottomTabKey.requests),
                    _tile(Icons.schedule, 'Đăng ký tăng ca', BottomTabKey.requests),
                    _tile(Icons.list_alt_outlined, 'Lịch sử công', BottomTabKey.attendance),
                    _tile(Icons.payments_outlined, 'Phiếu lương', BottomTabKey.payslips),
                  ],
          ),
        ],
      ),
    );
  }

  Widget _header(AuthUser user) => Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_todayLabel(), style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
            const SizedBox(height: 8),
            Text('${_greeting()},', style: const TextStyle(color: AppColors.textMuted, fontSize: 14)),
            const SizedBox(height: 2),
            Text(user.fullName,
                maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 24, height: 1.25, fontWeight: FontWeight.w800)),
          ]),
        ),
        const SizedBox(width: 16),
        InkWell(
          onTap: () => widget.onNavigateTab(BottomTabKey.account),
          borderRadius: BorderRadius.circular(18),
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(18)),
            alignment: Alignment.center,
            child: Text(user.initials, style: const TextStyle(color: AppColors.primaryDark, fontSize: 17, fontWeight: FontWeight.w800)),
          ),
        ),
      ]);

  Widget _todayCard() {
    final t = _today;
    final a = (t?['assignment'] as Map?) ?? const {};
    final status = t?['attendanceStatus'] as String?;
    final action = t?['availableAction'] as String?;
    final idle = action == null || action == 'NONE';
    final statusLabel = switch (status) {
      'CHECKED_IN' => 'Đang trong ca',
      'COMPLETED' => 'Đã hoàn thành',
      'DAY_OFF' => 'Ngày nghỉ',
      _ => 'Chưa vào ca',
    };
    final tone = switch (status) {
      'CHECKED_IN' => BadgeTone.info,
      'COMPLETED' => BadgeTone.success,
      _ => BadgeTone.neutral,
    };
    final cta = action == 'CHECK_OUT' ? 'Ra ca ngay' : action == 'CHECK_IN' ? 'Vào ca ngay' : 'Xem ngày công';

    Widget cell(String label, String value) => Expanded(
          child: Column(children: [
            Text(label, style: const TextStyle(color: Color(0xFF93C5FD), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
          ]),
        );

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(20)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('CA LÀM HÔM NAY', style: TextStyle(color: Color(0xFF93C5FD), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
              const SizedBox(height: 8),
              Text(shiftTitle(a['shiftName'], 'Chưa có ca làm'),
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
            ]),
          ),
          StatusBadge(label: statusLabel, tone: tone),
        ]),
        const SizedBox(height: 8),
        Text(t != null ? '${a['shiftHours'] ?? '-'} · ${a['workplaceName'] ?? ''}' : 'Liên hệ HR để được phân ca',
            style: const TextStyle(color: AppColors.textOnDark, fontSize: 13, height: 1.5)),
        const SizedBox(height: 16),
        Row(children: [
          cell('VÀO CA', formatTime((t?['checkIn'] as Map?)?['recordedAt'] as String?)),
          Container(width: 1, height: 32, color: Colors.white24),
          cell('RA CA', formatTime((t?['checkOut'] as Map?)?['recordedAt'] as String?)),
        ]),
        const SizedBox(height: 16),
        Material(
          color: idle ? Colors.white.withValues(alpha: 0.12) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: () => widget.onNavigateTab(BottomTabKey.attendance),
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.fingerprint, size: 20, color: idle ? Colors.white : AppColors.textPrimary),
                const SizedBox(width: 8),
                Text(cta, style: TextStyle(color: idle ? Colors.white : AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
              ]),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _approvalBanner() {
    final n = widget.pendingApprovals ?? 0;
    return InkWell(
      onTap: () => widget.onNavigateTab(BottomTabKey.approvals),
      borderRadius: BorderRadius.circular(16),
      child: AppCard(
        color: n > 0 ? AppColors.warningBg : AppColors.infoBg,
        borderColor: n > 0 ? AppColors.warningBorder : AppColors.infoBorder,
        child: Row(children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
            child: Icon(Icons.done_all, color: n > 0 ? AppColors.warningText : AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(n > 0 ? '$n đơn đang chờ bạn duyệt' : 'Không có đơn chờ duyệt',
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(n > 0 ? 'Chạm để xem và xử lý' : 'Bạn đã xử lý hết đơn của nhân viên',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ]),
          ),
          const Icon(Icons.chevron_right, color: AppColors.textQuaternary),
        ]),
      ),
    );
  }

  Widget _metric(IconData icon, int value, String label, Color color, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(height: 10),
            Text('$value', style: const TextStyle(color: AppColors.textPrimary, fontSize: 26, fontWeight: FontWeight.w800, height: 1.1)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ]),
        ),
      );

  Widget _tile(IconData icon, String title, BottomTabKey target) => Material(
        color: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AppColors.border)),
        child: InkWell(
          onTap: () => widget.onNavigateTab(target),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, size: 19, color: AppColors.primaryDark),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w800))),
            ]),
          ),
        ),
      );
}
