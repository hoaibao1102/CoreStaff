import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/error/app_exception.dart';
import 'package:corestaff_mobile/features/account/data/account_repository.dart';
import 'package:corestaff_mobile/features/account/data/models/employee_profile_dto.dart';
import 'package:corestaff_mobile/features/account/presentation/bloc/account_bloc.dart';

class MockAccountRepository extends Mock implements AccountRepository {}

void main() {
  late MockAccountRepository mockRepository;

  const testProfile = EmployeeProfileDto(
    id: 'emp_01',
    fullName: 'Hoàng Nam',
    employeeCode: 'EMP100',
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
    departmentName: 'Phòng Phát Triển Sản Phẩm',
  );

  setUp(() {
    mockRepository = MockAccountRepository();
  });

  group('AccountBloc Tests', () {
    test('initial state is AccountInitial', () {
      final bloc = AccountBloc(accountRepository: mockRepository);
      expect(bloc.state, isA<AccountInitial>());
    });

    blocTest<AccountBloc, AccountState>(
      'emits [AccountLoading, AccountLoaded] on successful AccountProfileRequested',
      build: () {
        when(() => mockRepository.getMyProfile()).thenAnswer((_) async => testProfile);
        return AccountBloc(accountRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const AccountProfileRequested()),
      expect: () => [
        isA<AccountLoading>(),
        isA<AccountLoaded>().having((s) => s.profile.fullName, 'fullName', 'Hoàng Nam'),
      ],
    );

    blocTest<AccountBloc, AccountState>(
      'emits [AccountLoaded] directly without loading state when isRefresh is true',
      build: () {
        when(() => mockRepository.getMyProfile()).thenAnswer((_) async => testProfile);
        return AccountBloc(accountRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const AccountProfileRequested(isRefresh: true)),
      expect: () => [
        isA<AccountLoaded>().having((s) => s.profile.employeeCode, 'code', 'EMP100'),
      ],
    );

    blocTest<AccountBloc, AccountState>(
      'emits [AccountLoading, AccountError] when repository throws ApiException',
      build: () {
        when(() => mockRepository.getMyProfile()).thenThrow(
          const ApiException(
            message: 'Hồ sơ nhân viên không tồn tại',
            code: 'EMPLOYEE_PROFILE_NOT_FOUND',
            statusCode: 404,
          ),
        );
        return AccountBloc(accountRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const AccountProfileRequested()),
      expect: () => [
        isA<AccountLoading>(),
        isA<AccountError>().having(
          (s) => s.message,
          'message',
          'Chưa tìm thấy hồ sơ nhân viên. Vui lòng liên hệ HR.',
        ),
      ],
    );

    blocTest<AccountBloc, AccountState>(
      'emits [AccountLoading, AccountError] when repository throws NetworkException',
      build: () {
        when(() => mockRepository.getMyProfile()).thenThrow(
          const NetworkException(),
        );
        return AccountBloc(accountRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const AccountProfileRequested()),
      expect: () => [
        isA<AccountLoading>(),
        isA<AccountError>().having(
          (s) => s.message,
          'message',
          contains('kết nối'),
        ),
      ],
    );
  });
}

