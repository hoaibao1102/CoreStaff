import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/error/app_exception.dart';
import 'package:corestaff_mobile/core/network/api_client.dart';
import 'package:corestaff_mobile/features/auth/data/auth_repository.dart';
import 'package:corestaff_mobile/features/auth/data/models/auth_user_dto.dart';
import 'package:corestaff_mobile/features/auth/presentation/bloc/auth_bloc.dart';

class MockAuthRepository extends Mock implements AuthRepository {}
class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockAuthRepository mockAuthRepository;
  late MockApiClient mockApiClient;

  final testUser = AuthUser(
    id: 'user_123',
    email: 'employee@test.com',
    fullName: 'Nguyen Van A',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    employeeCode: 'EMP001',
    mustChangePassword: false,
  );

  final testUserMustChange = AuthUser(
    id: 'user_456',
    email: 'newuser@test.com',
    fullName: 'Le Thi B',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    mustChangePassword: true,
  );

  setUp(() {
    mockAuthRepository = MockAuthRepository();
    mockApiClient = MockApiClient();
  });

  group('AuthBloc', () {
    test('initial state is AuthInitial', () {
      final bloc = AuthBloc(authRepository: mockAuthRepository, apiClient: mockApiClient);
      expect(bloc.state, isA<AuthInitial>());
    });

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, AuthAuthenticated] when session exists and getCurrentUser succeeds',
      build: () {
        when(() => mockAuthRepository.hasSavedSession()).thenAnswer((_) async => true);
        when(() => mockAuthRepository.getCurrentUser()).thenAnswer((_) async => testUser);
        return AuthBloc(authRepository: mockAuthRepository, apiClient: mockApiClient);
      },
      act: (bloc) => bloc.add(const AuthCheckRequested()),
      expect: () => [
        isA<AuthLoading>(),
        isA<AuthAuthenticated>()
            .having((s) => s.user.id, 'user.id', 'user_123')
            .having((s) => s.forcedPasswordChange, 'forcedPasswordChange', false),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, AuthUnauthenticated] when no session is saved',
      build: () {
        when(() => mockAuthRepository.hasSavedSession()).thenAnswer((_) async => false);
        return AuthBloc(authRepository: mockAuthRepository, apiClient: mockApiClient);
      },
      act: (bloc) => bloc.add(const AuthCheckRequested()),
      expect: () => [
        isA<AuthLoading>(),
        isA<AuthUnauthenticated>(),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, AuthAuthenticated] on successful login with forced password change',
      build: () {
        when(() => mockAuthRepository.login(
              identifier: 'newuser@test.com',
              password: 'InitialPassword123',
            )).thenAnswer((_) async => LoginResult(
              user: testUserMustChange,
              mustChangePassword: true,
            ));
        return AuthBloc(authRepository: mockAuthRepository, apiClient: mockApiClient);
      },
      act: (bloc) => bloc.add(const AuthLoginRequested(
        identifier: 'newuser@test.com',
        password: 'InitialPassword123',
      )),
      expect: () => [
        isA<AuthLoading>(),
        isA<AuthAuthenticated>()
            .having((s) => s.user.email, 'email', 'newuser@test.com')
            .having((s) => s.forcedPasswordChange, 'forcedPasswordChange', true),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, AuthFailure] when login fails with invalid credentials',
      build: () {
        when(() => mockAuthRepository.login(
              identifier: 'wrong@test.com',
              password: 'bad',
            )).thenThrow(
          const ApiException(
            message: 'Tài khoản hoặc mật khẩu không chính xác',
            code: 'AUTH_INVALID_CREDENTIALS',
            statusCode: 401,
          ),
        );
        return AuthBloc(authRepository: mockAuthRepository, apiClient: mockApiClient);
      },
      act: (bloc) => bloc.add(const AuthLoginRequested(
        identifier: 'wrong@test.com',
        password: 'bad',
      )),
      expect: () => [
        isA<AuthLoading>(),
        isA<AuthFailure>().having(
          (s) => s.message,
          'message',
          'Tài khoản hoặc mật khẩu không chính xác.',
        ),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, AuthUnauthenticated] on logout',
      build: () {
        when(() => mockAuthRepository.logout()).thenAnswer((_) async {});
        return AuthBloc(authRepository: mockAuthRepository, apiClient: mockApiClient);
      },
      act: (bloc) => bloc.add(const AuthLogoutRequested()),
      expect: () => [
        isA<AuthLoading>(),
        isA<AuthUnauthenticated>(),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthUnauthenticated] with expiration message on AuthSessionExpired',
      build: () {
        when(() => mockAuthRepository.logout()).thenAnswer((_) async {});
        return AuthBloc(authRepository: mockAuthRepository, apiClient: mockApiClient);
      },
      act: (bloc) => bloc.add(const AuthSessionExpired()),
      expect: () => [
        isA<AuthUnauthenticated>().having(
          (s) => s.message,
          'message',
          contains('hết hạn'),
        ),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'clears forcedPasswordChange on AuthPasswordChanged',
      build: () {
        return AuthBloc(authRepository: mockAuthRepository, apiClient: mockApiClient);
      },
      seed: () => AuthAuthenticated(user: testUserMustChange, forcedPasswordChange: true),
      act: (bloc) => bloc.add(const AuthPasswordChanged()),
      expect: () => [
        isA<AuthAuthenticated>()
            .having((s) => s.forcedPasswordChange, 'forcedPasswordChange', false)
            .having((s) => s.user.mustChangePassword, 'user.mustChangePassword', false),
      ],
    );
  });
}

