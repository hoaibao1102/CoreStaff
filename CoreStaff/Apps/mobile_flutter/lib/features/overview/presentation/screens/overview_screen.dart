import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/banners.dart';
import '../../../../shared/widgets/states.dart';
import '../../../auth/data/models/auth_user_dto.dart';
import '../../../shell/presentation/widgets/custom_bottom_nav_bar.dart';
import '../bloc/overview_bloc.dart';
import '../bloc/overview_event.dart';
import '../bloc/overview_state.dart';
import '../widgets/attention_metric_card.dart';
import '../widgets/overview_header.dart';
import '../widgets/overview_shift_card.dart';
import '../widgets/quick_access_row.dart';

class OverviewScreen extends StatelessWidget {
  final AuthUser user;
  final ValueChanged<ShellTab> onNavigate;

  const OverviewScreen({
    super.key,
    required this.user,
    required this.onNavigate,
  });

  @override
  Widget build(BuildContext context) {
    try {
      context.read<OverviewBloc>();
      return _OverviewView(user: user, onNavigate: onNavigate);
    } catch (_) {
      return BlocProvider<OverviewBloc>(
        create: (context) => sl<OverviewBloc>()..add(const LoadOverview()),
        child: _OverviewView(user: user, onNavigate: onNavigate),
      );
    }
  }
}

class _OverviewView extends StatelessWidget {
  final AuthUser user;
  final ValueChanged<ShellTab> onNavigate;

  const _OverviewView({
    required this.user,
    required this.onNavigate,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        child: BlocConsumer<OverviewBloc, OverviewState>(
          listener: (context, state) {},
          builder: (context, state) {
            return RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                context.read<OverviewBloc>().add(const RefreshOverview());
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    OverviewHeader(user: user),
                    const SizedBox(height: 16),
                    if (state is OverviewLoaded && state.partialError != null) ...[
                      ErrorBanner(message: state.partialError!),
                      const SizedBox(height: 16),
                    ],
                    if (state is OverviewLoading || state is OverviewInitial)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: LoadingBlock(),
                      )
                    else if (state is OverviewError)
                      Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: ErrorState(
                          message: state.message,
                          onRetry: () {
                            context.read<OverviewBloc>().add(const LoadOverview());
                          },
                        ),
                      )
                    else if (state is OverviewLoaded) ...[
                      OverviewShiftCard(
                        today: state.todayAttendance,
                        onNavigateAttendance: () => onNavigate(ShellTab.attendance),
                      ),
                      const SizedBox(height: 22),
                      const Text(
                        'Cần bạn chú ý',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: AttentionMetricCard(
                              count: state.pendingRequestsCount,
                              label: 'Đơn đang chờ',
                              tone: state.pendingRequestsCount > 0
                                  ? AttentionTone.warning
                                  : AttentionTone.defaultTone,
                              onTap: () => onNavigate(ShellTab.requests),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: AttentionMetricCard(
                              count: state.newPayslipsCount,
                              label: 'Phiếu lương mới',
                              tone: state.newPayslipsCount > 0
                                  ? AttentionTone.blue
                                  : AttentionTone.defaultTone,
                              onTap: () => onNavigate(ShellTab.payslips),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 22),
                      const Text(
                        'Truy cập nhanh',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      QuickAccessRow(
                        icon: Icons.fingerprint_rounded,
                        title: 'Chấm công & lịch sử',
                        description: 'Vào ca, ra ca và theo dõi ngày công',
                        onTap: () => onNavigate(ShellTab.attendance),
                      ),
                      const SizedBox(height: 10),
                      QuickAccessRow(
                        icon: Icons.calendar_month_outlined,
                        title: 'Nghỉ phép & tăng ca',
                        description: 'Tạo mới và xem trạng thái phê duyệt',
                        onTap: () => onNavigate(ShellTab.requests),
                      ),
                      const SizedBox(height: 10),
                      QuickAccessRow(
                        icon: Icons.account_balance_wallet_outlined,
                        title: 'Phiếu lương & thu nhập',
                        description: 'Xem chi tiết các kỳ lương đã phát hành',
                        onTap: () => onNavigate(ShellTab.payslips),
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
