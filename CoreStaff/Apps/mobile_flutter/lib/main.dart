import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'core/config/api_config.dart';
import 'core/network/api_client.dart';
import 'core/theme/app_theme.dart';
import 'models/auth_user.dart';
import 'screens/auth/change_password_screen.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/reset_password_screen.dart';
import 'screens/main_shell_screen.dart';
import 'screens/splash/splash_screen.dart';
import 'services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await initializeDateFormatting('vi', null);
  } catch (_) {}
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const CoreStaffApp());
}

enum AppScreen { login, forgot, reset, changePassword, home }

class CoreStaffApp extends StatefulWidget {
  const CoreStaffApp({super.key});

  @override
  State<CoreStaffApp> createState() => _CoreStaffAppState();
}

class _CoreStaffAppState extends State<CoreStaffApp> {
  bool _connecting = true;
  String? _connectionError;
  AppScreen _currentScreen = AppScreen.login;
  AuthUser? _currentUser;
  bool _forcedPasswordChange = false;

  @override
  void initState() {
    super.initState();
    _setupSignedOutHandler();
    _bootstrap();
  }

  void _setupSignedOutHandler() {
    ApiClient.instance.onSignedOut = () {
      if (mounted) {
        setState(() {
          _currentUser = null;
          _forcedPasswordChange = false;
          _currentScreen = AppScreen.login;
        });
      }
    };
  }

  Future<void> _bootstrap() async {
    setState(() {
      _connecting = true;
      _connectionError = null;
    });

    try {
      await ApiConfig.resolveApiBase();
      try {
        final user = await AuthService.instance.getCurrentUser();
        if (mounted) {
          setState(() {
            _currentUser = user;
            _forcedPasswordChange = user.mustChangePassword;
            _currentScreen = user.mustChangePassword ? AppScreen.changePassword : AppScreen.home;
          });
        }
      } catch (_) {
        if (mounted) {
          setState(() {
            _currentUser = null;
            _currentScreen = AppScreen.login;
          });
        }
      }
    } catch (err) {
      if (mounted) {
        setState(() {
          _connectionError = err.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _connecting = false;
        });
      }
    }
  }

  void _clearSession() {
    setState(() {
      _currentUser = null;
      _forcedPasswordChange = false;
      _currentScreen = AppScreen.login;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CoreStaff Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: _buildCurrentScreen(),
    );
  }

  Widget _buildCurrentScreen() {
    if (_connecting) {
      return const SplashScreen();
    }

    if (_connectionError != null) {
      return ConnectionErrorScreen(
        message: _connectionError!,
        onRetry: _bootstrap,
        onSkipToDemo: () {
          setState(() {
            _connectionError = null;
            _currentScreen = AppScreen.login;
          });
        },
      );
    }

    switch (_currentScreen) {
      case AppScreen.login:
        return LoginScreen(
          onAuthenticated: (user, forced) {
            setState(() {
              _currentUser = user;
              _forcedPasswordChange = forced;
              _currentScreen = forced ? AppScreen.changePassword : AppScreen.home;
            });
          },
          onForgot: () => setState(() => _currentScreen = AppScreen.forgot),
          onReset: () => setState(() => _currentScreen = AppScreen.reset),
        );

      case AppScreen.forgot:
        return ForgotPasswordScreen(
          onBack: () => setState(() => _currentScreen = AppScreen.login),
          onReset: () => setState(() => _currentScreen = AppScreen.reset),
        );

      case AppScreen.reset:
        return ResetPasswordScreen(
          onBack: () => setState(() => _currentScreen = AppScreen.login),
        );

      case AppScreen.changePassword:
        return ChangePasswordScreen(
          forced: _forcedPasswordChange,
          onCancel: _forcedPasswordChange ? null : () => setState(() => _currentScreen = AppScreen.home),
          onChanged: () {
            setState(() {
              _forcedPasswordChange = false;
              if (_currentUser != null) {
                _currentUser = _currentUser!.copyWith(mustChangePassword: false);
              }
              _currentScreen = AppScreen.home;
            });
          },
          onSessionExpired: _clearSession,
        );

      case AppScreen.home:
        if (_currentUser == null) {
          return LoginScreen(
            onAuthenticated: (user, forced) {
              setState(() {
                _currentUser = user;
                _forcedPasswordChange = forced;
                _currentScreen = forced ? AppScreen.changePassword : AppScreen.home;
              });
            },
            onForgot: () => setState(() => _currentScreen = AppScreen.forgot),
            onReset: () => setState(() => _currentScreen = AppScreen.reset),
          );
        }
        return MainShellScreen(
          user: _currentUser!,
          onChangePassword: () => setState(() => _currentScreen = AppScreen.changePassword),
          onLogout: _clearSession,
        );
    }
  }
}
