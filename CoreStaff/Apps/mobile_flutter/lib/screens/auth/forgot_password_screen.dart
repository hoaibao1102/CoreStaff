import 'package:flutter/material.dart';
import '../../core/network/api_exception.dart';
import '../../services/auth_service.dart';
import '../../widgets/auth_layout.dart';
import '../../widgets/banners.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';

class ForgotPasswordScreen extends StatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onReset;

  const ForgotPasswordScreen({
    super.key,
    required this.onBack,
    required this.onReset,
  });

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() {
        _errorMessage = 'Vui lòng nhập email đăng nhập.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      await AuthService.instance.forgotPassword(email);
      setState(() {
        _sent = true;
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
      eyebrow: 'Khôi phục tài khoản',
      title: 'Quên mật khẩu',
      description: 'Nếu tài khoản tồn tại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_errorMessage != null) ...[
            ErrorBanner(message: _errorMessage!),
            const SizedBox(height: 16),
          ],
          if (_sent) ...[
            const SuccessBanner(
              message: 'Yêu cầu đã được tiếp nhận. Hãy kiểm tra email của bạn.',
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              label: 'Nhập mã đặt lại',
              onPress: widget.onReset,
            ),
          ] else ...[
            AppTextField(
              label: 'Email đăng nhập',
              placeholder: 'ten@congty.vn',
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              enabled: !_loading,
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              label: 'Gửi hướng dẫn',
              loading: _loading,
              onPress: _submit,
            ),
          ],
          const SizedBox(height: 12),
          SecondaryButton(
            label: 'Quay lại đăng nhập',
            disabled: _loading,
            onPress: widget.onBack,
          ),
        ],
      ),
    );
  }
}
