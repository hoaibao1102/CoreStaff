import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/banners.dart';
import '../../../../shared/widgets/screen_header.dart';
import '../../../../shared/widgets/segmented_control.dart';
import '../../../../shared/widgets/states.dart';
import '../bloc/request_form_cubit.dart';
import '../bloc/request_form_state.dart';
import '../bloc/requests_bloc.dart';
import '../bloc/requests_event.dart';
import '../bloc/requests_state.dart';
import '../widgets/action_card.dart';
import '../widgets/leave_card.dart';
import '../widgets/overtime_card.dart';
import '../widgets/request_creation_modal.dart';

class RequestsScreen extends StatelessWidget {
  const RequestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    try {
      context.read<RequestsBloc>();
      return const _RequestsView();
    } catch (_) {
      return BlocProvider<RequestsBloc>(
        create: (context) => sl<RequestsBloc>()..add(const RequestsLoadStarted()),
        child: const _RequestsView(),
      );
    }
  }
}

class _RequestsView extends StatelessWidget {
  const _RequestsView();

  void _openCreationModal(BuildContext context, RequestFormType type) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (sheetContext) => BlocProvider<RequestFormCubit>(
        create: (_) => sl<RequestFormCubit>()..initialize(type),
        child: RequestCreationModal(
          onSuccess: (message) {
            Navigator.pop(sheetContext);
            context.read<RequestsBloc>().add(RequestsRefreshed(successMessage: message));
          },
        ),
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
            context.read<RequestsBloc>().add(const RequestsRefreshed());
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: BlocBuilder<RequestsBloc, RequestsState>(
              builder: (context, state) {
                String? bannerError;
                String? bannerSuccess;
                List<RequestFeedItem> items = [];
                RequestsFilter currentFilter = RequestsFilter.all;
                bool isLoading = false;
                String? errorMessage;

                if (state is RequestsLoading) {
                  isLoading = true;
                } else if (state is RequestsError) {
                  errorMessage = state.message;
                } else if (state is RequestsLoaded) {
                  bannerError = state.bannerError;
                  bannerSuccess = state.bannerSuccess;
                  items = state.filteredItems;
                  currentFilter = state.filter;
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ScreenHeader(
                      eyebrow: 'ĐƠN TỪ',
                      title: 'Yêu cầu của tôi',
                      description: 'Tạo và theo dõi phê duyệt nghỉ phép, tăng ca.',
                      action: Semantics(
                        button: true,
                        label: 'Tạo đơn nghỉ phép',
                        child: Material(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(15),
                          child: InkWell(
                            onTap: () => _openCreationModal(context, RequestFormType.leave),
                            borderRadius: BorderRadius.circular(15),
                            child: const SizedBox(
                              width: 46,
                              height: 46,
                              child: Icon(
                                Icons.add_rounded,
                                size: 26,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (bannerError != null) ...[
                      ErrorBanner(message: bannerError),
                      const SizedBox(height: 16),
                    ],
                    if (bannerSuccess != null) ...[
                      SuccessBanner(message: bannerSuccess),
                      const SizedBox(height: 16),
                    ],
                    Row(
                      children: [
                        ActionCard(
                          icon: Icons.calendar_month_outlined,
                          title: 'Xin nghỉ phép',
                          description: 'Có lương hoặc không lương',
                          onPress: () => _openCreationModal(context, RequestFormType.leave),
                        ),
                        const SizedBox(width: 12),
                        ActionCard(
                          icon: Icons.access_time_rounded,
                          title: 'Đăng ký tăng ca',
                          description: 'Hệ thống tự phân loại OT',
                          onPress: () => _openCreationModal(context, RequestFormType.overtime),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SegmentedControl<RequestsFilter>(
                      selectedValue: currentFilter,
                      options: const [
                        SegmentOption(value: RequestsFilter.all, label: 'Tất cả'),
                        SegmentOption(value: RequestsFilter.leave, label: 'Nghỉ phép'),
                        SegmentOption(value: RequestsFilter.overtime, label: 'Tăng ca'),
                      ],
                      onChanged: (filter) {
                        context.read<RequestsBloc>().add(RequestsFilterChanged(filter));
                      },
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Hoạt động gần đây',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          '${items.length} yêu cầu',
                          style: const TextStyle(
                            color: AppColors.textQuaternary,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (isLoading)
                      const LoadingBlock()
                    else if (errorMessage != null && items.isEmpty)
                      ErrorState(
                        message: errorMessage,
                        onRetry: () {
                          context.read<RequestsBloc>().add(const RequestsLoadStarted());
                        },
                      )
                    else if (items.isEmpty)
                      const EmptyState(
                        icon: Icons.done_all_rounded,
                        title: 'Chưa có yêu cầu',
                        description: 'Đơn nghỉ phép và đăng ký tăng ca sẽ xuất hiện tại đây.',
                      )
                    else
                      ...items.map(
                        (feedItem) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: switch (feedItem) {
                            LeaveFeedItem(leave: final l) => LeaveCard(
                                item: l,
                                onCancel: () {
                                  context.read<RequestsBloc>().add(RequestsCancelRequested(l.id));
                                },
                              ),
                            OvertimeFeedItem(overtime: final o) => OvertimeCard(
                                item: o,
                              ),
                          },
                        ),
                      ),
                    const SizedBox(height: 32),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
