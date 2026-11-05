import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../services/employee_api.dart';
import '../../services/hr_api.dart' show employmentTypeLabel;
import '../../core/network/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import '../../services/auth_service.dart';
import '../../widgets/banners.dart';
import '../../widgets/buttons.dart';
import '../../widgets/feature_screen.dart';

class AccountTab extends StatefulWidget {
  final AuthUser user;
  final VoidCallback onChangePassword;
  final VoidCallback onLogout;
  /// Quản lý không có tab Phiếu lương riêng nên mở từ Tài khoản.
  final VoidCallback? onOpenPayslips;

  const AccountTab({
    super.key,
    required this.user,
    required this.onChangePassword,
    required this.onLogout,
    this.onOpenPayslips,
  });

  @override
  State<AccountTab> createState() => _AccountTabState();
}

class _AccountTabState extends State<AccountTab> {
  bool _loggingOut = false;
  String? _errorMessage;
  Map? _profile;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  /// Hồ sơ nhân sự là thông tin phụ: lỗi thì chỉ ẩn các dòng bổ sung.
  Future<void> _loadProfile() async {
    try {
      final p = await EmployeeApi.instance.myProfile();
      if (mounted) setState(() => _profile = p);
    } catch (_) {}
  }

  Widget _profileRows() {
    final p = _profile;
    if (p == null) return const SizedBox.shrink();
    final rows = <(String, String)>[
      ('Phòng ban', '${p['departmentName'] ?? ''}'),
      ('Chức danh', '${p['positionName'] ?? ''}'),
      ('Quản lý trực tiếp', '${p['managerName'] ?? ''}'),
      ('Loại hình', p['employmentType'] == null ? '' : employmentTypeLabel('${p['employmentType']}')),
      ('Ngày vào làm', p['joinDate'] == null ? '' : formatDate('${p['joinDate']}')),
      ('Số điện thoại', '${p['phone'] ?? ''}'),
    ].where((r) => r.$2.isNotEmpty).toList();
    return Column(children: [
      for (final r in rows) ...[
        const Divider(color: Color(0xFFF1F5F9), height: 1),
        _InfoRow(label: r.$1, value: r.$2),
      ],
    ]);
  }

  Future<void> _handleSignOut() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Đăng xuất',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
        ),
        content: const Text(
          'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng CoreStaff?',
          style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hủy', style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.dangerText,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Đăng xuất', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() {
      _loggingOut = true;
      _errorMessage = null;
    });

    try {
      await AuthService.instance.logout();
      widget.onLogout();
    } catch (err) {
      setState(() {
        _errorMessage = AuthApiException.friendlyMessage(err);
      });
    } finally {
      if (mounted) {
        setState(() {
          _loggingOut = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const ScreenHeader(
            eyebrow: 'TÀI KHOẢN',
            title: 'Hồ sơ cá nhân',
            description: 'Quản lý thông tin và bảo mật tài khoản.',
          ),
          const SizedBox(height: 16),

          if (_errorMessage != null) ...[
            ErrorBanner(message: _errorMessage!),
            const SizedBox(height: 16),
          ],

          // accountHero
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              children: [
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    widget.user.initials,
                    style: const TextStyle(
                      color: AppColors.primaryDark,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  widget.user.fullName,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.user.employeeCode ?? 'Chưa có mã nhân viên',
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // profileCard
          Container(
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              border: Border.all(color: AppColors.border, width: 1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                _InfoRow(label: 'Email', value: widget.user.email),
                const Divider(color: Color(0xFFF1F5F9), height: 1),
                _InfoRow(
                  label: 'Vai trò',
                  value: widget.user.role == 'DEPARTMENT_MANAGER' ? 'Quản lý phòng ban' : (widget.user.role == 'EMPLOYEE' ? 'Nhân viên' : (widget.user.role == 'HR' ? 'Nhân sự (HR)' : widget.user.role)),
                ),
                _profileRows(),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (widget.onOpenPayslips != null) ...[
            Material(
              color: AppColors.bgSurface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: AppColors.border, width: 1),
              ),
              child: InkWell(
                onTap: widget.onOpenPayslips,
                borderRadius: BorderRadius.circular(16),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Phiếu lương',
                          style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
                      Icon(Icons.chevron_right, color: AppColors.textQuaternary),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // menuRow (Đổi mật khẩu)
          Material(
            color: AppColors.bgSurface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppColors.border, width: 1),
            ),
            child: InkWell(
              onTap: widget.onChangePassword,
              borderRadius: BorderRadius.circular(16),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Đổi mật khẩu',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        SizedBox(height: 3),
                        Text(
                          'Cập nhật thông tin bảo mật',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '›',
                      style: TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 28,
                        fontWeight: FontWeight.w300,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // SecondaryButton logout
          SecondaryButton(
            label: 'Đăng xuất',
            danger: true,
            loading: _loggingOut,
            onPress: _handleSignOut,
          ),
          const SizedBox(height: 16),

          // version
          const Center(
            child: Text(
              'CoreStaff Mobile · Phiên bản 0.1.0',
              style: TextStyle(
                color: Color(0xFF94A3B8),
                fontSize: 11,
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
