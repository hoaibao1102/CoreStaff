import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme/app_colors.dart';
import '../../services/employee_api.dart';
import '../../services/hr_api.dart';
import '../../widgets/banners.dart';
import '../../widgets/cards.dart';
import '../../widgets/feature_screen.dart';
import '../manager/manager_team_screen.dart' show initialsOf;

/// Danh bạ nhân sự (chỉ đọc), khớp `web/src/screens/EmployeeDirectory`.
class HrEmployeesScreen extends StatefulWidget {
  final int realtimeRevision;
  const HrEmployeesScreen({super.key, this.realtimeRevision = 0});

  @override
  State<HrEmployeesScreen> createState() => _HrEmployeesScreenState();
}

class _HrEmployeesScreenState extends State<HrEmployeesScreen> {
  List<Map> _employees = [];
  String _query = '';
  String _status = 'ALL';
  bool _loading = true;
  String? _error;

  static const _filters = [
    ('ALL', 'Tất cả'),
    ('ACTIVE', 'Đang làm'),
    ('PROBATION', 'Thử việc'),
    ('OFF', 'Đã nghỉ'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant HrEmployeesScreen old) {
    super.didUpdateWidget(old);
    if (old.realtimeRevision != widget.realtimeRevision) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final data = await HrApi.instance.employees();
      if (mounted) setState(() { _employees = data.whereType<Map>().toList(); _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyEmployeeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _matchesStatus(Map e) {
    final s = e['employmentStatus'];
    return switch (_status) {
      'ALL' => true,
      'OFF' => s == 'RESIGNED' || s == 'TERMINATED',
      _ => s == _status,
    };
  }

  /// API chỉ trả `directManagerId` (mã hồ sơ) nên ghép tên từ danh bạ đã tải.
  String? _managerNameOf(Map e) {
    final given = '${e['managerName'] ?? ''}';
    if (given.isNotEmpty) return given;
    final id = e['directManagerId'];
    if (id == null) return null;
    for (final m in _employees) {
      if ('${m['_id']}' == '$id') return '${m['fullName'] ?? ''}';
    }
    return null;
  }

  void _openDetail(Map e) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _EmployeeDetail(employee: e, managerName: _managerNameOf(e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final needle = _query.trim().toLowerCase();
    final filtered = _employees.where((e) {
      if (!_matchesStatus(e)) return false;
      if (needle.isEmpty) return true;
      return '${e['fullName'] ?? ''} ${e['employeeCode'] ?? ''} ${e['email'] ?? ''}'.toLowerCase().contains(needle);
    }).toList();

    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          const ScreenHeader(eyebrow: 'NHÂN SỰ', title: 'Nhân viên', description: 'Tra cứu hồ sơ nhân viên trong tổ chức.'),
          const SizedBox(height: 16),
          if (_error != null && (_loading || _employees.isNotEmpty)) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          TextField(
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: 'Tìm theo tên, mã hoặc email',
              prefixIcon: const Icon(Icons.search, color: AppColors.textMuted, size: 20),
              filled: true,
              fillColor: AppColors.bgSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.borderLight)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.borderLight)),
            ),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _filters
                  .map((f) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(f.$2, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: _status == f.$1 ? Colors.white : AppColors.textSecondary)),
                          selected: _status == f.$1,
                          showCheckmark: false,
                          selectedColor: AppColors.primary,
                          backgroundColor: AppColors.bgSurface,
                          side: BorderSide(color: _status == f.$1 ? AppColors.primary : AppColors.borderLight),
                          onSelected: (_) => setState(() => _status = f.$1),
                        ),
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(height: 14),
          if (_loading)
            const LoadingBlock()
          else if (_error != null && _employees.isEmpty)
            ErrorState(message: _error!, onRetry: _load)
          else ...[
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const SectionTitle('Danh sách'),
              Text('${filtered.length}/${_employees.length}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 12),
            if (filtered.isEmpty)
              const EmptyCard('Không tìm thấy nhân viên phù hợp.')
            else
              ...filtered.map((e) => Padding(padding: const EdgeInsets.only(bottom: 10), child: _row(e))),
          ],
        ],
      ),
    );
  }

  Widget _row(Map e) {
    final name = '${e['fullName'] ?? e['employeeCode'] ?? ''}';
    return GestureDetector(
      onTap: () => _openDetail(e),
      child: AppCard(
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
                Expanded(child: Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w800))),
                const SizedBox(width: 8),
                StatusBadge(label: employmentStatusLabel('${e['employmentStatus']}'), tone: employmentStatusTone('${e['employmentStatus']}')),
              ]),
              const SizedBox(height: 3),
              Text('${e['employeeCode'] ?? ''}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
              if ('${e['departmentName'] ?? ''}'.isNotEmpty || '${e['positionName'] ?? ''}'.isNotEmpty)
                Text([e['departmentName'], e['positionName']].where((v) => v != null && '$v'.isNotEmpty).join(' · '),
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.35)),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _EmployeeDetail extends StatelessWidget {
  final Map employee;
  final String? managerName;
  const _EmployeeDetail({required this.employee, this.managerName});

  Widget _line(String label, Object? value) {
    final text = value == null || '$value'.isEmpty ? '-' : '$value';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 120, child: Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 13))),
        Expanded(child: Text(text, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700))),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final e = employee;
    final name = '${e['fullName'] ?? e['employeeCode'] ?? ''}';
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(22, 14, 22, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 18),
          Row(children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(18)),
              alignment: Alignment.center,
              child: Text(initialsOf(name), style: const TextStyle(color: AppColors.primary, fontSize: 18, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                StatusBadge(label: employmentStatusLabel('${e['employmentStatus']}'), tone: employmentStatusTone('${e['employmentStatus']}')),
              ]),
            ),
          ]),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.borderLight),
          _line('Mã nhân viên', e['employeeCode']),
          _line('Email', e['email']),
          _line('Phòng ban', e['departmentName']),
          _line('Chức danh', e['positionName']),
          _line('Quản lý trực tiếp', managerName),
          _line('Loại hình', employmentTypeLabel('${e['employmentType']}')),
          _line('Ngày vào làm', formatDate(e['joinDate'] as String?)),
          _line('Người phụ thuộc', '${(e['dependents'] as List?)?.length ?? 0}'),
        ]),
      ),
    );
  }
}
