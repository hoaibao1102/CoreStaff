import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/banners.dart';
import '../../../../shared/widgets/states.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../auth/data/models/auth_user_dto.dart';
import '../../data/models/employee_profile_dto.dart';
import '../bloc/account_bloc.dart';

class AccountScreen extends StatelessWidget {
  final AuthUser user;
  final VoidCallback onChangePassword;
  final VoidCallback? onOpenPayslips;
  final VoidCallback onLogout;

  const AccountScreen({
    super.key,
    required this.user,
    required this.onChangePassword,
    this.onOpenPayslips,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    try {
      context.read<AccountBloc>();
      return _AccountView(
        user: user,
        onChangePassword: onChangePassword,
        onOpenPayslips: onOpenPayslips,
        onLogout: onLogout,
      );
    } catch (_) {
      return BlocProvider<AccountBloc>(
        create: (context) => sl<AccountBloc>()..add(const AccountProfileRequested()),
        child: _AccountView(
          user: user,
          onChangePassword: onChangePassword,
          onOpenPayslips: onOpenPayslips,
          onLogout: onLogout,
        ),
      );
    }
  }
}

class _AccountView extends StatelessWidget {
  final AuthUser user;
  final VoidCallback onChangePassword;
  final VoidCallback? onOpenPayslips;
  final VoidCallback onLogout;

  const _AccountView({
    required this.user,
    required this.onChangePassword,
    this.onOpenPayslips,
    required this.onLogout,
  });

  String _formatJoinDate(String? rawDate) {
    if (rawDate == null || rawDate.isEmpty) return 'Chưa cập nhật';
    try {
      final dt = DateTime.parse(rawDate);
      return DateFormat('dd/MM/yyyy').format(dt);
    } catch (_) {
      return rawDate;
    }
  }

  void _showLogoutConfirmation(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Đăng xuất tài khoản'),
        content: const Text('Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(dialogCtx).pop();
              onLogout();
            },
            style: TextButton.styleFrom(
              foregroundColor: AppColors.dangerText,
            ),
            child: const Text(
              'Đăng xuất',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            context.read<AccountBloc>().add(const AccountProfileRequested(isRefresh: true));
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: BlocBuilder<AccountBloc, AccountState>(
              builder: (context, state) {
                EmployeeProfileDto? profile;
                String? errorMessage;
                bool isLoading = false;

                if (state is AccountLoading) {
                  isLoading = true;
                } else if (state is AccountError) {
                  errorMessage = state.message;
                } else if (state is AccountLoaded) {
                  profile = state.profile;
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 16),
                    if (errorMessage != null) ...[
                      ErrorBanner(message: errorMessage),
                      const SizedBox(height: 16),
                    ],
                    if (isLoading)
                      const LoadingBlock()
                    else ...[
                      _buildHero(profile),
                      const SizedBox(height: 16),
                      _buildWorkDetailsCard(profile),
                      const SizedBox(height: 20),
                      Text(
                        'Tiện ích cá nhân',
                        style: AppTypography.titleSmall.copyWith(
                          color: AppColors.textPrimary,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (onOpenPayslips != null) ...[
                        _buildMenuRow(
                          icon: Icons.account_balance_wallet_outlined,
                          title: 'Phiếu lương',
                          description: 'Tra cứu bảng lương và thu nhập hàng tháng',
                          onTap: onOpenPayslips!,
                        ),
                        const SizedBox(height: 8),
                      ],
                      _buildMenuRow(
                        icon: Icons.lock_outline_rounded,
                        title: 'Đổi mật khẩu',
                        description: 'Cập nhật thông tin bảo mật tài khoản',
                        onTap: onChangePassword,
                      ),
                      const SizedBox(height: 16),
                      _buildContactCard(profile),
                      const SizedBox(height: 24),
                      AppButton.danger(
                        label: 'Đăng xuất',
                        onPress: () => _showLogoutConfirmation(context),
                      ),
                      const SizedBox(height: 32),
                    ],
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'TÀI KHOẢN',
          style: AppTypography.eyebrow,
        ),
        const SizedBox(height: 4),
        Text(
          'Hồ sơ cá nhân',
          style: AppTypography.titleLarge,
        ),
        const SizedBox(height: 4),
        Text(
          'Thông tin công việc và bảo mật tài khoản.',
          style: AppTypography.bodySmall,
        ),
      ],
    );
  }

  Widget _buildHero(EmployeeProfileDto? profile) {
    final displayName = profile?.fullName ?? user.fullName;
    final displayCode = profile?.employeeCode.isNotEmpty == true
        ? profile!.employeeCode
        : user.employeeCode ?? 'Chưa có mã nhân viên';
    final initials = profile?.initials ?? user.initials;
    final status = profile?.employmentStatus ?? user.status;

    return Center(
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
              initials,
              style: const TextStyle(
                color: AppColors.primaryDark,
                fontSize: 26,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            displayName,
            style: AppTypography.titleMedium.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            displayCode,
            style: AppTypography.caption.copyWith(
              color: AppColors.textMuted,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          StatusBadge(status: status),
        ],
      ),
    );
  }

  Widget _buildWorkDetailsCard(EmployeeProfileDto? profile) {
    return AppCard(
      child: Column(
        children: [
          _buildInfoRow('Phòng ban', profile?.departmentName ?? 'Chưa cập nhật'),
          const Divider(height: 1, color: AppColors.divider),
          _buildInfoRow('Chức danh', profile?.positionName ?? 'Chưa cập nhật'),
          const Divider(height: 1, color: AppColors.divider),
          _buildInfoRow('Quản lý trực tiếp', profile?.managerName ?? 'Chưa cập nhật'),
          const Divider(height: 1, color: AppColors.divider),
          _buildInfoRow('Nơi làm việc', profile?.workplaceName ?? 'Chưa cập nhật'),
          const Divider(height: 1, color: AppColors.divider),
          _buildInfoRow('Ngày vào làm', _formatJoinDate(profile?.joinDate)),
        ],
      ),
    );
  }

  Widget _buildContactCard(EmployeeProfileDto? profile) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Thông tin liên hệ',
            style: AppTypography.titleSmall.copyWith(
              fontSize: 14,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          _buildInfoRow('Email', profile?.email ?? user.email),
          const Divider(height: 1, color: AppColors.divider),
          _buildInfoRow('Số điện thoại', profile?.phone ?? 'Chưa cập nhật'),
          const Divider(height: 1, color: AppColors.divider),
          _buildInfoRow('Địa chỉ', profile?.address ?? 'Chưa cập nhật'),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: AppTypography.caption.copyWith(
                color: AppColors.textMuted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuRow({
    required IconData icon,
    required String title,
    required String description,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 20, color: AppColors.primaryDark),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textQuaternary),
          ],
        ),
      ),
    );
  }
}

