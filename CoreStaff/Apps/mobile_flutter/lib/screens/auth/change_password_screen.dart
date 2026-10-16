import 'package:flutter/material.dart';
import '../../core/network/api_exception.dart';
import '../../services/auth_service.dart';
import '../../widgets/auth_layout.dart';
import '../../widgets/banners.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';

class ChangePasswordScreen extends StatefulWidget {
  final bool forced;
  final VoidCallback? onCancel;
  final VoidCallback onChanged;
  final VoidCallback onSessionExpired;

  const ChangePasswordScreen({
    super.key,
    required this.forced,
    this.onCancel,
    required this.onChanged,
    required this.onSessionExpired,
  });

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _loading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final current = _currentController.text;
    final next = _newController.text;
    final confirm = _confirmController.text;

    if (current.isEmpty || next.isEmpty || confirm.isEmpty) {
      setState(() {
        _errorMessage = 'Vui lòng nhập đầy đủ các trường mật khẩu.';
      });
      return;
    }

    if (next != confirm) {
      setState(() {
        _errorMessage = 'Mật khẩu xác nhận chưa khớp.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      await AuthService.instance.changePassword(
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      );
      widget.onChanged();
    } catch (err) {
      if (err is AuthApiException && err.statusCode == 401) {
        widget.onSessionExpired();
        return;
      }
      setState(() {
        _errorMessage = AuthApiException.friendlyMessage(err);
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      eyebrow: widget.forced ? 'Yêu cầu bảo mật' : 'Tài khoản',
      title: 'Đổi mật khẩu',
      description: widget.forced
          ? 'Bạn cần đổi mật khẩu tạm thời trước khi tiếp tục.'
          : 'Cập nhật mật khẩu để bảo vệ tài khoản.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.forced) ...[
            const NoticeBanner(
              message: 'Đây là mật khẩu tạm thời do quản trị viên cấp.',
            ),
            const SizedBox(height: 16),
          ],
          if (_errorMessage != null) ...[
            ErrorBanner(message: _errorMessage!),
            const SizedBox(height: 16),
          ],
          AppTextField(
            label: 'Mật khẩu hiện tại',
            placeholder: 'Nhập mật khẩu hiện tại',
            controller: _currentController,
            secureTextEntry: true,
            enabled: !_loading,
          ),
          const SizedBox(height: 16),
          AppTextField(
            label: 'Mật khẩu mới',
            placeholder: 'Ít nhất 8 ký tự, gồm chữ và số',
            controller: _newController,
            secureTextEntry: true,
            enabled: !_loading,
          ),
          const SizedBox(height: 16),
          AppTextField(
            label: 'Xác nhận mật khẩu mới',
            placeholder: 'Nhập lại mật khẩu mới',
            controller: _confirmController,
            secureTextEntry: true,
            enabled: !_loading,
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 20),
          PrimaryButton(
            label: 'Cập nhật mật khẩu',
            loading: _loading,
            onPress: _submit,
          ),
          if (widget.onCancel != null) ...[
            const SizedBox(height: 12),
            SecondaryButton(
              label: 'Để sau',
              disabled: _loading,
              onPress: widget.onCancel,
            ),
          ],
        ],
      ),
    );
  }
}
