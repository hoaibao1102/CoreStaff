import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/banners.dart';
import '../../../../shared/widgets/segmented_control.dart';
import '../bloc/request_form_cubit.dart';
import '../bloc/request_form_state.dart';
import 'shift_preview_box.dart';

class RequestCreationModal extends StatefulWidget {
  final ValueChanged<String> onSuccess;

  const RequestCreationModal({
    super.key,
    required this.onSuccess,
  });

  @override
  State<RequestCreationModal> createState() => _RequestCreationModalState();
}

class _RequestCreationModalState extends State<RequestCreationModal> {
  late final TextEditingController _startDateController;
  late final TextEditingController _endDateController;
  late final TextEditingController _startTimeController;
  late final TextEditingController _endTimeController;
  late final TextEditingController _reasonController;
  late final TextEditingController _workDescriptionController;
  late final TextEditingController _retroactiveReasonController;

  @override
  void initState() {
    super.initState();
    final cubit = context.read<RequestFormCubit>();
    _startDateController = TextEditingController(text: cubit.state.startDate);
    _endDateController = TextEditingController(text: cubit.state.endDate);
    _startTimeController = TextEditingController(text: cubit.state.startTime);
    _endTimeController = TextEditingController(text: cubit.state.endTime);
    _reasonController = TextEditingController(text: cubit.state.reason);
    _workDescriptionController = TextEditingController(text: cubit.state.workDescription);
    _retroactiveReasonController = TextEditingController(text: cubit.state.retroactiveReason);
  }

  @override
  void dispose() {
    _startDateController.dispose();
    _endDateController.dispose();
    _startTimeController.dispose();
    _endTimeController.dispose();
    _reasonController.dispose();
    _workDescriptionController.dispose();
    _retroactiveReasonController.dispose();
    super.dispose();
  }

  Widget _buildDurationGrid(RequestFormCubit cubit, RequestFormState state) {
    const durations = [
      ('FULL_DAY', 'Cả ngày'),
      ('MORNING_HALF', 'Buổi sáng'),
      ('AFTERNOON_HALF', 'Buổi chiều'),
      ('CUSTOM_HOURS', 'Theo giờ'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Thời lượng nghỉ',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: durations.map((item) {
            final isSelected = state.durationType == item.$1;
            return SizedBox(
              width: (MediaQuery.of(context).size.width - 48) / 2,
              child: Material(
                color: isSelected ? AppColors.primary : AppColors.bgSurface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: isSelected ? AppColors.primary : AppColors.border,
                    width: 1,
                  ),
                ),
                child: InkWell(
                  onTap: state.isSubmitting
                      ? null
                      : () {
                          cubit.setDurationType(item.$1);
                        },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 44),
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    child: Text(
                      item.$2,
                      style: TextStyle(
                        color: isSelected ? Colors.white : AppColors.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<RequestFormCubit, RequestFormState>(
      listener: (context, state) {
        if (state.submissionStatus == FormSubmissionStatus.success) {
          widget.onSuccess(state.successMessage ?? 'Thành công');
        }

        if (_startDateController.text != state.startDate) {
          _startDateController.text = state.startDate;
        }
        if (_endDateController.text != state.endDate) {
          _endDateController.text = state.endDate;
        }
        if (_startTimeController.text != state.startTime) {
          _startTimeController.text = state.startTime;
        }
        if (_endTimeController.text != state.endTime) {
          _endTimeController.text = state.endTime;
        }
      },
      builder: (context, state) {
        final cubit = context.read<RequestFormCubit>();
        final isLeave = state.formType == RequestFormType.leave;

        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.90,
          ),
          decoration: const BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: 8),
                  Container(
                    width: 42,
                    height: 5,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Flexible(
                    child: SingleChildScrollView(
                      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'TẠO YÊU CẦU',
                                      style: AppTypography.eyebrow,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      isLeave ? 'Đơn nghỉ phép' : 'Đăng ký tăng ca',
                                      style: AppTypography.titleLarge,
                                    ),
                                  ],
                                ),
                              ),
                              Semantics(
                                button: true,
                                label: 'Đóng biểu mẫu',
                                child: IconButton(
                                  onPressed: state.isSubmitting
                                      ? null
                                      : () => Navigator.pop(context),
                                  icon: const Icon(Icons.close_rounded, size: 24),
                                  style: IconButton.styleFrom(
                                    backgroundColor: AppColors.bgSurface,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(15),
                                      side: const BorderSide(color: AppColors.border),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          if (state.errorMessage != null) ...[
                            ErrorBanner(message: state.errorMessage!),
                            const SizedBox(height: 16),
                          ],
                          if (isLeave) ...[
                            SegmentedControl<String>(
                              selectedValue: state.leaveType,
                              options: const [
                                SegmentOption(value: 'PAID_LEAVE', label: 'Có lương'),
                                SegmentOption(value: 'UNPAID_LEAVE', label: 'Không lương'),
                              ],
                              onChanged: state.isSubmitting
                                  ? (_) {}
                                  : (type) => cubit.setLeaveType(type),
                            ),
                            const SizedBox(height: 16),
                            _buildDurationGrid(cubit, state),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: AppTextField(
                                    label: 'Từ ngày',
                                    requiredField: true,
                                    controller: _startDateController,
                                    placeholder: 'YYYY-MM-DD',
                                    editable: !state.isSubmitting,
                                    onChanged: (val) => cubit.setStartDate(val),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: AppTextField(
                                    label: 'Đến ngày',
                                    requiredField: true,
                                    controller: _endDateController,
                                    placeholder: 'YYYY-MM-DD',
                                    editable: !state.isSubmitting &&
                                        state.durationType == 'FULL_DAY',
                                    onChanged: (val) => cubit.setEndDate(val),
                                  ),
                                ),
                              ],
                            ),
                            if (state.durationType == 'CUSTOM_HOURS') ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: AppTextField(
                                      label: 'Từ giờ',
                                      requiredField: true,
                                      controller: _startTimeController,
                                      placeholder: '18:00',
                                      editable: !state.isSubmitting,
                                      onChanged: (val) => cubit.setStartTime(val),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: AppTextField(
                                      label: 'Đến giờ',
                                      requiredField: true,
                                      controller: _endTimeController,
                                      placeholder: '20:00',
                                      editable: !state.isSubmitting,
                                      onChanged: (val) => cubit.setEndTime(val),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 14),
                            ShiftPreviewBox(
                              preview: state.preview,
                              isPreviewing: state.isPreviewing,
                            ),
                          ] else ...[
                            AppTextField(
                              label: 'Ngày tăng ca',
                              requiredField: true,
                              controller: _startDateController,
                              placeholder: 'YYYY-MM-DD',
                              editable: !state.isSubmitting,
                              onChanged: (val) => cubit.setStartDate(val),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: AppTextField(
                                    label: 'Bắt đầu',
                                    requiredField: true,
                                    controller: _startTimeController,
                                    placeholder: '18:00',
                                    editable: !state.isSubmitting,
                                    onChanged: (val) => cubit.setStartTime(val),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: AppTextField(
                                    label: 'Kết thúc',
                                    requiredField: true,
                                    controller: _endTimeController,
                                    placeholder: '20:00',
                                    editable: !state.isSubmitting,
                                    onChanged: (val) => cubit.setEndTime(val),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            AppTextField(
                              label: 'Mô tả công việc',
                              controller: _workDescriptionController,
                              placeholder: 'Công việc dự kiến thực hiện',
                              maxLines: 2,
                              editable: !state.isSubmitting,
                              onChanged: (val) => cubit.setWorkDescription(val),
                            ),
                            const SizedBox(height: 12),
                            AppTextField(
                              label: 'Lý do khai báo muộn',
                              controller: _retroactiveReasonController,
                              placeholder: 'Chỉ cần nhập nếu đăng ký sau thời hạn',
                              maxLines: 2,
                              editable: !state.isSubmitting,
                              onChanged: (val) => cubit.setRetroactiveReason(val),
                            ),
                          ],
                          const SizedBox(height: 14),
                          AppTextField(
                            label: 'Lý do',
                            requiredField: true,
                            controller: _reasonController,
                            placeholder: 'Nhập tối thiểu 10 ký tự',
                            maxLines: 3,
                            editable: !state.isSubmitting,
                            onChanged: (val) => cubit.setReason(val),
                          ),
                          const SizedBox(height: 14),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.infoBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.infoBorder),
                            ),
                            child: Text(
                              isLeave
                                  ? 'Đơn sẽ được gửi đến quản lý phòng ban, sau đó HR áp dụng vào bảng công.'
                                  : 'Loại OT và số phút hợp lệ được hệ thống tự tính từ lịch làm việc và chấm công thực tế.',
                              style: const TextStyle(
                                color: AppColors.infoText,
                                fontSize: 11,
                                height: 1.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          AppButton(
                            label: isLeave ? 'Gửi đơn nghỉ phép' : 'Gửi đăng ký tăng ca',
                            loading: state.isSubmitting,
                            disabled: state.isSubmitting,
                            onPress: () => cubit.submit(),
                          ),
                          const SizedBox(height: 10),
                          AppButton.secondary(
                            label: 'Hủy',
                            disabled: state.isSubmitting,
                            onPress: () => Navigator.pop(context),
                          ),
                          const SizedBox(height: 16),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
