import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/banners.dart';
import '../../../../shared/widgets/states.dart';
import '../../data/models/payslip_dto.dart';
import '../bloc/payslip_bloc.dart';
import '../widgets/payslip_card.dart';

class PayslipsScreen extends StatelessWidget {
  const PayslipsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    try {
      context.read<PayslipBloc>();
      return const _PayslipsView();
    } catch (_) {
      return BlocProvider<PayslipBloc>(
        create: (context) => sl<PayslipBloc>()..add(const PayslipsRequested()),
        child: const _PayslipsView(),
      );
    }
  }
}

class _PayslipsView extends StatelessWidget {
  const _PayslipsView();

  String _formatCurrency(num value) {
    final formatter = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
    return formatter.format(value).trim();
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return 'Chưa phát hành';
    try {
      final dt = DateTime.parse(raw);
      return DateFormat('dd/MM/yyyy').format(dt);
    } catch (_) {
      return raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            context.read<PayslipBloc>().add(const PayslipsRequested(isRefresh: true));
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: BlocBuilder<PayslipBloc, PayslipState>(
              builder: (context, state) {
                List<PayslipDto> payslips = [];
                String? expandedId;
                String? errorMessage;
                bool isLoading = false;

                if (state is PayslipLoading) {
                  isLoading = true;
                } else if (state is PayslipError) {
                  errorMessage = state.message;
                } else if (state is PayslipLoaded) {
                  payslips = state.payslips;
                  expandedId = state.expandedId;
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
                      _buildSummaryCard(payslips),
                      const SizedBox(height: 20),
                      _buildSectionHeader(payslips.length),
                      const SizedBox(height: 12),
                      if (payslips.isEmpty)
                        const EmptyState(
                          icon: Icons.account_balance_wallet_outlined,
                          title: 'Chưa có phiếu lương',
                          description: 'Phiếu lương sẽ xuất hiện khi HR phát hành kỳ lương.',
                        )
                      else
                        ...payslips.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: PayslipCard(
                              item: item,
                              isExpanded: expandedId == item.id,
                              onTap: () {
                                context.read<PayslipBloc>().add(
                                      PayslipToggleExpanded(id: item.id),
                                    );
                              },
                            ),
                          ),
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
          'THU NHẬP',
          style: AppTypography.eyebrow,
        ),
        const SizedBox(height: 4),
        Text(
          'Phiếu lương',
          style: AppTypography.titleLarge,
        ),
        const SizedBox(height: 4),
        Text(
          'Theo dõi thu nhập và các khoản khấu trừ của bạn.',
          style: AppTypography.bodySmall,
        ),
      ],
    );
  }

  Widget _buildSummaryCard(List<PayslipDto> payslips) {
    final newest = payslips.isNotEmpty ? payslips.first : null;
    final unreadCount = payslips.where((p) => p.isUnread).length;

    return AppCard.dark(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'KỲ GẦN NHẤT',
                    style: TextStyle(
                      color: AppColors.primarySoft,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    newest != null ? 'Tháng ${newest.periodLabel}' : 'Chưa phát hành',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              if (unreadCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$unreadCount mới',
                    style: const TextStyle(
                      color: AppColors.primaryDark,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'Thực nhận',
            style: TextStyle(
              color: AppColors.textOnDark,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            newest != null ? _formatCurrency(newest.netSalary) : '—',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            newest?.releasedAt != null
                ? 'Phát hành ${_formatDate(newest!.releasedAt)}'
                : 'Phiếu lương mới sẽ xuất hiện tại đây.',
            style: TextStyle(
              color: AppColors.textOnDark,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(int count) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Lịch sử phiếu lương',
          style: AppTypography.titleSmall.copyWith(
            fontSize: 16,
            color: AppColors.textPrimary,
          ),
        ),
        Text(
          '$count kỳ',
          style: AppTypography.caption.copyWith(
            color: AppColors.textMuted,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

