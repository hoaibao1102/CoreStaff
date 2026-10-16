import 'package:flutter/material.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import '../../services/auth_service.dart';
import '../../widgets/auth_layout.dart';
import '../../widgets/banners.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';

class LoginScreen extends StatefulWidget {
  final void Function(AuthUser user, bool forcedPasswordChange) onAuthenticated;
  final VoidCallback onForgot;
  final VoidCallback onReset;

  const LoginScreen({
    super.key,
    required this.onAuthenticated,
    required this.onForgot,
    required this.onReset,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _loading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;

    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Vui lòng nhập email/mã nhân viên và mật khẩu.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final result = await AuthService.instance.login(identifier, password);
      widget.onAuthenticated(result.user, result.mustChangePassword);
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
      eyebrow: 'Ứng dụng nhân viên',
      title: 'Chào mừng trở lại',
      description: 'Đăng nhập để theo dõi công việc và tài khoản của bạn.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_errorMessage != null) ...[
            ErrorBanner(message: _errorMessage!),
            const SizedBox(height: 16),
          ],
          AppTextField(
            label: 'Email hoặc mã nhân viên',
            placeholder: 'VD: NV-0248',
            controller: _identifierController,
            enabled: !_loading,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 16),
          AppTextField(
            label: 'Mật khẩu',
            placeholder: 'Nhập mật khẩu',
            controller: _passwordController,
            secureTextEntry: _obscurePassword,
            enabled: !_loading,
            action: _obscurePassword ? 'Hiện' : 'Ẩn',
            onAction: () {
              setState(() {
                _obscurePassword = !_obscurePassword;
              });
            },
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: GestureDetector(
              onTap: _loading ? null : widget.onForgot,
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  'Quên mật khẩu?',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          PrimaryButton(
            label: 'Đăng nhập',
            loading: _loading,
            onPress: _submit,
          ),
          const SizedBox(height: 16),
          Center(
            child: GestureDetector(
              onTap: _loading ? null : widget.onReset,
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                child: Text(
                  'Bạn đã có mã đặt lại mật khẩu?',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SecondaryButton(
            label: 'Đăng nhập tài khoản mẫu (Demo NV-0248)',
            onPress: () {
              widget.onAuthenticated(
                AuthUser(
                  id: 'usr_demo_0248',
                  fullName: 'Nguyễn Văn An',
                  employeeCode: 'NV-0248',
                  email: 'an.nguyen@corestaff.vn',
                  role: 'EMPLOYEE',
                  status: 'ACTIVE',
                  mustChangePassword: false,
                ),
                false,
              );
            },
          ),
        ],
      ),
    );
  }
}
