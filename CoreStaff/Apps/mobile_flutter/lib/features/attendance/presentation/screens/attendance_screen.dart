import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/banners.dart';
import '../../../../shared/widgets/screen_header.dart';
import '../../../../shared/widgets/states.dart';
import '../../../overview/presentation/bloc/overview_bloc.dart';
import '../../../overview/presentation/bloc/overview_event.dart';
import '../../data/models/today_attendance_dto.dart';
import '../bloc/attendance_bloc.dart';
import '../bloc/attendance_event.dart';
import '../bloc/attendance_state.dart';
import '../bloc/punch_bloc.dart';
import '../widgets/attendance_day_card.dart';
import '../widgets/attendance_hero_card.dart';
import '../widgets/leave_interval_card.dart';
import '../widgets/month_selector_bar.dart';
import '../widgets/month_summary_row.dart';
import '../widgets/pending_leave_notice_card.dart';
import '../widgets/today_metric_grid.dart';

class AttendanceScreen extends StatelessWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    Widget child = const _AttendanceView();

    // Provide PunchBloc if registered in DI and not in context
    try {
      context.read<PunchBloc>();
    } catch (_) {
      if (sl.isRegistered<PunchBloc>()) {
        child = BlocProvider<PunchBloc>(
          create: (context) => sl<PunchBloc>(),
          child: child,
        );
      }
    }

    // Provide AttendanceBloc if not in context
    try {
      context.read<AttendanceBloc>();
    } catch (_) {
      if (sl.isRegistered<AttendanceBloc>()) {
        child = BlocProvider<AttendanceBloc>(
          create: (context) =>
              sl<AttendanceBloc>()..add(const AttendanceStarted()),
          child: child,
        );
      }
    }

    return child;
  }
}

class _AttendanceView extends StatelessWidget {
  const _AttendanceView();

  void _showPunchPreviewDialog(BuildContext context, String action) {
    final title = action == 'CHECK_IN'
        ? 'Xác nhận vào ca'
        : (action == 'CHECK_OUT' ? 'Xác nhận ra ca' : 'Thông tin chấm công');

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: const Text(
          'Hệ thống ghi nhận điểm danh phần cứng (GPS, Wi-Fi BSSID, và Selfie) '
          'đang trong chế độ xem trước (Sprint 4) và sẽ được kích hoạt tại Sprint 5.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  void _showPunchConfirmationDialog(
    BuildContext context,
    TodayAttendanceDto today,
    PunchBloc punchBloc,
  ) {
    final checkingIn = today.availableAction == 'CHECK_IN';
    final outOffice = today.assignment.workplaceType == 'OUT_OFFICE';
    final title = checkingIn ? 'Xác nhận vào ca' : 'Xác nhận ra ca';
    final content = checkingIn
        ? 'Ghi nhận vào ca tại ${today.assignment.workplaceName}?'
        : 'Ghi nhận kết thúc ca làm việc hôm nay?';
    final confirmLabel =
        outOffice ? 'Chụp selfie' : (checkingIn ? 'Vào ca' : 'Ra ca');

    showDialog<void>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text(content),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(dialogCtx).pop();
              punchBloc.add(PunchSubmitted(today: today));
            },
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
  }

  Widget _buildAttendanceBody({
    required BuildContext context,
    required PunchBloc? punchBloc,
    required bool isPunching,
    String? punchTransientMessage,
    String? punchError,
    String? punchSuccess,
  }) {
    return BlocConsumer<AttendanceBloc, AttendanceState>(
      listener: (context, state) {},
      builder: (context, state) {
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            context.read<AttendanceBloc>().add(const AttendanceRefreshed());
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ScreenHeader(
                  eyebrow: 'CHẤM CÔNG',
                  title: 'Ngày làm việc',
                  description: 'Ghi nhận thời gian và theo dõi công của bạn.',
                ),
                const SizedBox(height: 16),
                if (punchTransientMessage != null) ...[
                  NoticeBanner(message: punchTransientMessage),
                  const SizedBox(height: 12),
                ],
                if (punchError != null) ...[
                  ErrorBanner(message: punchError),
                  const SizedBox(height: 12),
                ],
                if (punchSuccess != null) ...[
                  SuccessBanner(message: punchSuccess),
                  const SizedBox(height: 12),
                ],
                if (state is AttendanceLoaded && state.bannerError != null) ...[
                  ErrorBanner(message: state.bannerError!),
                  const SizedBox(height: 12),
                ],
                if (state is AttendanceLoaded &&
                    state.bannerSuccess != null) ...[
                  SuccessBanner(message: state.bannerSuccess!),
                  const SizedBox(height: 12),
                ],
                if (state is AttendanceLoading || state is AttendanceInitial)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: LoadingBlock(),
                  )
                else if (state is AttendanceError)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: ErrorState(
                      message: state.message,
                      onRetry: () {
                        context
                            .read<AttendanceBloc>()
                            .add(const AttendanceStarted());
                      },
                    ),
                  )
                else if (state is AttendanceLoaded) ...[
                  // 1. Hero Card
                  AttendanceHeroCard(
                    today: state.today,
                    isSubmitting: isPunching,
                    onPunchConfirm: () {
                      if (punchBloc != null) {
                        _showPunchConfirmationDialog(
                            context, state.today, punchBloc);
                      } else {
                        _showPunchPreviewDialog(
                            context, state.today.availableAction);
                      }
                    },
                  ),
                  const SizedBox(height: 16),

                  // 2. Approved leave or pending leave
                  if (state.today.attendanceRequirements != null) ...[
                    LeaveIntervalCard(
                      requirements: state.today.attendanceRequirements!,
                    ),
                    const SizedBox(height: 16),
                  ] else if (state.today.pendingLeave != null) ...[
                    PendingLeaveNoticeCard(
                      pendingLeave: state.today.pendingLeave!,
                    ),
                    const SizedBox(height: 16),
                  ],

                  // 3. Today 3-column metric grid
                  TodayMetricGrid(
                    workingMinutes: state.today.workingMinutes,
                    lateMinutes: state.today.lateMinutes,
                    earlyMinutes: state.today.earlyMinutes,
                  ),
                  const SizedBox(height: 20),

                  // 4. Month Selector Bar
                  MonthSelectorBar(
                    monthKey: state.currentMonth,
                    canMoveNext: state.canMoveNext,
                    onPrevious: () {
                      context
                          .read<AttendanceBloc>()
                          .add(const MonthChanged(-1));
                    },
                    onNext: () {
                      context
                          .read<AttendanceBloc>()
                          .add(const MonthChanged(1));
                    },
                  ),
                  const SizedBox(height: 12),

                  // 5. Month Summary Row
                  MonthSummaryRow(summary: state.history.summary),
                  const SizedBox(height: 16),

                  // 6. History Daily Cards List
                  if (state.history.items.isEmpty)
                    const AppCard(
                      padding: EdgeInsets.symmetric(
                          vertical: 24, horizontal: 16),
                      child: Center(
                        child: Text(
                          'Chưa có dữ liệu chấm công trong tháng này.',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    )
                  else
                    for (final day in state.history.items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: AttendanceDayCard(day: day),
                      ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    PunchBloc? punchBloc;
    try {
      punchBloc = context.read<PunchBloc>();
    } catch (_) {}

    if (punchBloc == null) {
      return Scaffold(
        backgroundColor: AppColors.bgDefault,
        body: SafeArea(
          child: _buildAttendanceBody(
            context: context,
            punchBloc: null,
            isPunching: false,
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.bgDefault,
      body: SafeArea(
        child: BlocConsumer<PunchBloc, PunchState>(
          bloc: punchBloc,
          listener: (context, punchState) {
            if (punchState is PunchSuccess) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(punchState.message),
                  backgroundColor: AppColors.successText,
                  behavior: SnackBarBehavior.floating,
                ),
              );
              context.read<AttendanceBloc>().add(const AttendanceRefreshed());
              try {
                context.read<OverviewBloc>().add(const RefreshOverview());
              } catch (_) {}
            } else if (punchState is PunchFailure) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(punchState.message),
                  backgroundColor: AppColors.dangerText,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          },
          builder: (context, punchState) {
            final isPunching = punchState is PunchSubmitting ||
                punchState is PunchDetectingEnvironment ||
                punchState is PunchPromptSelfie;

            String? punchTransientMessage;
            if (punchState is PunchDetectingEnvironment) {
              punchTransientMessage = punchState.message;
            } else if (punchState is PunchPromptSelfie) {
              punchTransientMessage = punchState.reason;
            } else if (punchState is PunchSubmitting) {
              punchTransientMessage = punchState.message;
            }

            return _buildAttendanceBody(
              context: context,
              punchBloc: punchBloc,
              isPunching: isPunching,
              punchTransientMessage: punchTransientMessage,
              punchError:
                  punchState is PunchFailure ? punchState.message : null,
              punchSuccess:
                  punchState is PunchSuccess ? punchState.message : null,
            );
          },
        ),
      ),
    );
  }
}
