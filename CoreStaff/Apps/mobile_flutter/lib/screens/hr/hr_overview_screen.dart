import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import '../../services/employee_api.dart';
import '../../services/hr_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/bottom_tab_bar.dart';
import '../../widgets/cards.dart';
import '../manager/manager_team_screen.dart' show initialsOf;

/// Tổng quan nhân sự, khớp `web/src/screens/HrOverview`: số liệu nhân sự, hợp đồng, đơn nghỉ chờ áp dụng, kỳ công.
class HrOverviewScreen extends StatefulWidget {
  final AuthUser user;
  final int realtimeRevision;
  final ValueChanged<BottomTabKey> onNavigateTab;

  const HrOverviewScreen({super.key, required this.user, required this.onNavigateTab, this.realtimeRevision = 0});

  @override
  State<HrOverviewScreen> createState() => _HrOverviewScreenState();
}

class _HrOverviewScreenState extends State<HrOverviewScreen> {
  List<Map> _employees = [];
  List<Map> _departments = [];
  List<Map> _contracts = [];
  List<Map> _findings = [];
  List<Map> _leaves = [];
  List<Map> _periods = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant HrOverviewScreen old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  List<Map> _list(Object? v) => v is List ? v.whereType<Map>().toList() : <Map>[];

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    final api = HrApi.instance;
    // Mỗi nguồn dữ liệu lỗi độc lập: một API chậm không làm trắng cả màn hình.
    final results = await Future.wait<Object?>([
      api.employees().then<Object?>((v) => v).catchError((Object e) => e),
      api.departments().then<Object?>((v) => v).catchError((Object e) => e),
      api.contracts().then<Object?>((v) => v).catchError((Object e) => e),
      api.compliance().then<Object?>((v) => v).catchError((Object e) => e),
      api.leaves().then<Object?>((v) => v).catchError((Object e) => e),
      api.timesheetPeriods().then<Object?>((v) => v).catchError((Object e) => e),
    ]);
    if (!mounted) return;
    final failed = results.where((r) => r is Exception || r is Error).toList();
    setState(() {
      _employees = _list(results[0]);
      _departments = _list(results[1]);
      _contracts = _list(results[2]);
      _findings = results[3] is Map ? _list((results[3] as Map)['findings']) : [];
      _leaves = _list(results[4]);
      _periods = _list(results[5]);
      _error = failed.length == results.length ? friendlyEmployeeError(failed.first as Object) : null;
      _loading = false;
    });
  }

  Widget _metric(String label, String value, IconData icon, Color bg, Color fg, {String? hint, VoidCallback? onTap}) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AppCard(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: fg, size: 19),
            ),
            const SizedBox(height: 10),
            Text(value, style: const TextStyle(color: AppColors.textPrimary, fontSize: 24, fontWeight: FontWeight.w800, height: 1.1)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
            if (hint != null) ...[
              const SizedBox(height: 4),
              Text(hint, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ],
          ]),
        ),
      ),
    );
  }

  Map? get _activePeriod {
    const open = {'OPEN', 'REVIEWING', 'READY_TO_CLOSE'};
    for (final p in _periods) {
      if (open.contains(p['status'])) return p;
    }
    return _periods.isEmpty ? null : _periods.first;
  }

  @override
  Widget build(BuildContext context) {
    final active = _employees.where((e) => e['employmentStatus'] == 'ACTIVE').length;
    final probation = _employees.where((e) => e['employmentStatus'] == 'PROBATION').length;
    final activeContracts = _contracts.where((c) => c['status'] == 'ACTIVE').length;
    final expiring = _contracts.where((c) {
      final days = c['expiryWarningDays'];
      return c['isExpiringSoon'] == true || (days is num && days <= 30 && c['isExpired'] != true);
    }).length;
    final waitingApply = _leaves.where((l) => l['status'] == 'APPROVED').length;
    final actionCount = waitingApply + expiring + _findings.length;
    final period = _activePeriod;

    final deptCount = <String, int>{};
    for (final e in _employees) {
      final id = '${e['departmentId'] ?? ''}';
      deptCount[id] = (deptCount[id] ?? 0) + 1;
    }
    final deptRows = _departments
        .map((d) => (name: '${d['name']}', count: deptCount['${d['_id']}'] ?? 0))
        .toList()
      ..sort((a, b) => b.count.compareTo(a.count));
    final unassigned = _employees.length - deptRows.fold<int>(0, (s, r) => s + r.count);

    final recent = [..._employees]
      ..sort((a, b) => '${b['createdAt'] ?? b['joinDate'] ?? ''}'.compareTo('${a['createdAt'] ?? a['joinDate'] ?? ''}'));

    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('QUẢN TRỊ NHÂN SỰ', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1)),
                const SizedBox(height: 6),
                const Text('Tổng quan nhân sự', style: TextStyle(color: AppColors.textPrimary, fontSize: 26, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('Xin chào, ${widget.user.fullName}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
              ]),
            ),
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(16)),
              alignment: Alignment.center,
              child: Text(initialsOf(widget.user.fullName), style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800)),
            ),
          ]),
          const SizedBox(height: 18),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_loading)
            const LoadingBlock()
          else ...[
            if (actionCount > 0)
              AppCard(
                color: AppColors.warningBg,
                borderColor: AppColors.warningText.withValues(alpha: 0.25),
                child: Row(children: [
                  const Icon(Icons.priority_high_rounded, color: AppColors.warningText),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('$actionCount việc cần xử lý: $waitingApply đơn nghỉ chờ áp dụng, $expiring hợp đồng sắp hết hạn, ${_findings.length} cảnh báo tuân thủ',
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700, height: 1.35)),
                  ),
                ]),
              ),
            if (actionCount > 0) const SizedBox(height: 14),
            Row(children: [
              _metric('Nhân viên', '${_employees.length}', Icons.groups_outlined, AppColors.infoBg, AppColors.infoText,
                  hint: '$active đang làm · $probation thử việc', onTap: () => widget.onNavigateTab(BottomTabKey.employees)),
              const SizedBox(width: 12),
              _metric('Phòng ban', '${_departments.length}', Icons.apartment_outlined, AppColors.successBg, AppColors.successText,
                  hint: '${_departments.where((d) => d['active'] != false).length} đang hoạt động'),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              _metric('Hợp đồng hiệu lực', '$activeContracts', Icons.description_outlined, AppColors.primarySoft, AppColors.primary,
                  hint: '$expiring sắp hết hạn', onTap: () => widget.onNavigateTab(BottomTabKey.contracts)),
              const SizedBox(width: 12),
              _metric('Đơn nghỉ chờ áp dụng', '$waitingApply', Icons.event_available_outlined, AppColors.warningBg, AppColors.warningText,
                  hint: 'Quản lý đã duyệt', onTap: () => widget.onNavigateTab(BottomTabKey.leaves)),
            ]),
            if (period != null) ...[
              const SizedBox(height: 22),
              const SectionTitle('Kỳ công hiện tại'),
              const SizedBox(height: 10),
              AppCard(
                child: Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: AppColors.infoBg, borderRadius: BorderRadius.circular(14)),
                    child: const Icon(Icons.calendar_month_outlined, color: AppColors.infoText),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Tháng ${formatPeriod(period['period'])}', style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text('${formatDate(period['startDate'] as String?)} - ${formatDate(period['endDate'] as String?)}',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    ]),
                  ),
                  StatusBadge(label: periodStatusLabel('${period['status']}'), tone: period['status'] == 'OPEN' ? BadgeTone.success : BadgeTone.info),
                ]),
              ),
            ],
            if (_findings.isNotEmpty) ...[
              const SizedBox(height: 22),
              const SectionTitle('Cảnh báo tuân thủ hợp đồng'),
              const SizedBox(height: 10),
              ..._findings.take(5).map((f) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(children: [
                        const Icon(Icons.warning_amber_rounded, color: AppColors.warningText, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${f['employeeFullName'] ?? f['employeeCode']}', style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w800)),
                            Text(complianceLabel('${f['code']}'), style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                          ]),
                        ),
                      ]),
                    ),
                  )),
              if (_findings.length > 5)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text('và ${_findings.length - 5} cảnh báo khác, xem đầy đủ trên web',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                ),
            ],
            if (_employees.isNotEmpty) ...[
              const SizedBox(height: 22),
              const SectionTitle('Nhân sự theo phòng ban'),
              const SizedBox(height: 10),
              AppCard(
                child: Column(children: [
                  ...deptRows.map((r) => _bar(r.name, r.count, _employees.length)),
                  if (unassigned > 0) _bar('Chưa phân bổ', unassigned, _employees.length),
                ]),
              ),
              const SizedBox(height: 22),
              const SectionTitle('Nhân viên mới'),
              const SizedBox(height: 10),
              ...recent.take(5).map((e) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: const BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle),
                          alignment: Alignment.center,
                          child: Text(initialsOf('${e['fullName'] ?? ''}'), style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${e['fullName'] ?? e['employeeCode']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
                            Text('${e['employeeCode']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                            Text('Vào làm ${formatDate(e['joinDate'] as String?)}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                          ]),
                        ),
                        StatusBadge(label: employmentStatusLabel('${e['employmentStatus']}'), tone: employmentStatusTone('${e['employmentStatus']}')),
                      ]),
                    ),
                  )),
            ],
          ],
        ],
      ),
    );
  }

  Widget _bar(String name, int count, int total) {
    final pct = total == 0 ? 0.0 : count / total;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Expanded(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700))),
          Text('$count · ${(pct * 100).round()}%', style: const TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(value: pct, minHeight: 6, backgroundColor: AppColors.bgDefault, color: AppColors.primary),
        ),
      ]),
    );
  }
}
