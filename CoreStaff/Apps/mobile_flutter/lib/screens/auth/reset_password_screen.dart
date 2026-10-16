import 'package:flutter/material.dart';
import '../../core/network/api_exception.dart';
import '../../services/auth_service.dart';
import '../../widgets/auth_layout.dart';
import '../../widgets/banners.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';

class ResetPasswordScreen extends StatefulWidget {
  final VoidCallback onBack;

  const ResetPasswordScreen({super.key, required this.onBack});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _tokenController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _loading = false;
  bool _done = false;
  String? _errorMessage;

  @override
  void dispose() {
    _tokenController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final token = _tokenController.text.trim();
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    if (token.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Vui lòng nhập mã đặt lại và mật khẩu mới.';
      });
      return;
    }

    if (password != confirm) {
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
      await AuthService.instance.resetPassword(token, password);
      setState(() {
        _done = true;
      });
    } catch (err) {
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
      eyebrow: 'Bảo mật tài khoản',
      title: 'Đặt lại mật khẩu',
      description: 'Nhập mã trong email và tạo mật khẩu mới cho tài khoản.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_errorMessage != null) ...[
            ErrorBanner(message: _errorMessage!),
            const SizedBox(height: 16),
          ],
          if (_done) ...[
            const SuccessBanner(
              message: 'Mật khẩu đã được cập nhật. Bạn có thể đăng nhập lại.',
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              label: 'Về trang đăng nhập',
              onPress: widget.onBack,
            ),
          ] else ...[
            AppTextField(
              label: 'Mã đặt lại mật khẩu',
              placeholder: 'Dán mã từ email',
              controller: _tokenController,
              enabled: !_loading,
            ),
            const SizedBox(height: 16),
            AppTextField(
              label: 'Mật khẩu mới',
              placeholder: 'Ít nhất 8 ký tự, gồm chữ và số',
              controller: _passwordController,
              secureTextEntry: true,
              enabled: !_loading,
            ),
            const SizedBox(height: 16),
            AppTextField(
              label: 'Xác nhận mật khẩu',
              placeholder: 'Nhập lại mật khẩu mới',
              controller: _confirmController,
              secureTextEntry: true,
              enabled: !_loading,
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              label: 'Đặt lại mật khẩu',
              loading: _loading,
              onPress: _submit,
            ),
            const SizedBox(height: 12),
            SecondaryButton(
              label: 'Hủy và quay lại',
              disabled: _loading,
              onPress: widget.onBack,
            ),
          ],
        ],
      ),
    );
  }
}
