import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_logo.dart';
import '../../../auth/data/models/auth_user_dto.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';

class UnauthorizedRoleScreen extends StatelessWidget {
  final AuthUser user;

  const UnauthorizedRoleScreen({
    super.key,
    required this.user,
  });

  @override
  Widget build(BuildContext context) {
    final roleName = user.role == 'SYSTEM_ADMIN'
        ? 'Quản trị viên hệ thống'
        : user.role == 'HR'
            ? 'Nhân sự (HR)'
            : user.role;

    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const AppLogo(large: true),
                const SizedBox(height: 32),
                AppCard(
                  child: Column(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          color: AppColors.warningBg,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.warningBorder, width: 2),
                        ),
                        child: const Icon(
                          Icons.warning_amber_rounded,
                          color: AppColors.warningText,
                          size: 36,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Vai trò không khả dụng',
                        style: AppTypography.titleMedium.copyWith(color: AppColors.textPrimary),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.bgDefault,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          '$roleName • ${user.email}',
                          style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Ứng dụng di động CoreStaff hiện tại chỉ hỗ trợ các tác vụ của Nhân viên (Employee) và Quản lý phòng ban (Department Manager) như Chấm công, Gửi đơn và Tra cứu bảng lương.\n\nVui lòng sử dụng phiên bản Web trên máy tính để truy cập đầy đủ các phân hệ quản trị.',
                        style: AppTypography.body.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      AppButton(
                        label: 'Đăng xuất tài khoản',
                        variant: AppButtonVariant.secondary,
                        onPress: () {
                          context.read<AuthBloc>().add(const AuthLogoutRequested());
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
