import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';
import 'models/auth_user_dto.dart';

abstract class AuthRepository {
  Future<LoginResult> login({
    required String identifier,
    required String password,
  });

  Future<AuthUser> getCurrentUser();

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  });

  Future<void> forgotPassword(String email);

  Future<void> resetPassword({
    required String token,
    required String newPassword,
  });

  Future<void> logout();

  Future<bool> hasSavedSession();
}

class AuthRepositoryImpl implements AuthRepository {
  final ApiClient apiClient;

  AuthRepositoryImpl({required this.apiClient});

  @override
  Future<LoginResult> login({
    required String identifier,
    required String password,
  }) async {
    final data = await apiClient.post<Map<String, dynamic>>(
      '/api/auth/login',
      data: {
        'identifier': identifier.trim(),
        'password': password,
      },
    );

    final userJson = data['user'] as Map<String, dynamic>;
    final mustChange = data['mustChangePassword'] == true;
    final user = AuthUser.fromJson(userJson);

    return LoginResult(user: user, mustChangePassword: mustChange);
  }

  @override
  Future<AuthUser> getCurrentUser() async {
    final data = await apiClient.get<Map<String, dynamic>>('/api/auth/me');
    return AuthUser.fromJson(data);
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await apiClient.post<dynamic>(
      '/api/auth/change-password',
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
      },
    );
  }

  @override
  Future<void> forgotPassword(String email) async {
    await apiClient.post<dynamic>(
      '/api/auth/forgot-password',
      data: {
        'email': email.trim(),
      },
    );
  }

  @override
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    await apiClient.post<dynamic>(
      '/api/auth/reset-password',
      data: {
        'token': token.trim(),
        'newPassword': newPassword,
      },
    );
  }

  @override
  Future<void> logout() async {
    try {
      await apiClient.post<dynamic>('/api/auth/logout');
    } finally {
      await apiClient.clearCookies();
    }
  }

  @override
  Future<bool> hasSavedSession() async {
    if (kIsWeb) {
      try {
        await getCurrentUser();
        return true;
      } catch (_) {
        return false;
      }
    }
    await apiClient.cookieManager.init();
    return apiClient.cookieManager.hasSession;
  }
}
