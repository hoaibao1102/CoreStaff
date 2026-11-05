import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/features/account/data/account_repository.dart';
import 'package:corestaff_mobile/features/account/data/models/employee_profile_dto.dart';
import 'package:corestaff_mobile/features/account/presentation/bloc/account_bloc.dart';
import 'package:corestaff_mobile/features/account/presentation/screens/account_screen.dart';
import 'package:corestaff_mobile/features/auth/data/models/auth_user_dto.dart';

class MockAccountRepository extends Mock implements AccountRepository {}

void main() {
  late MockAccountRepository mockRepository;

  final testUser = AuthUser(
    id: 'user_001',
    email: 'nhanvien@corestaff.vn',
    fullName: 'Trần Văn Nam',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    employeeCode: 'EMP001',
  );

  const testProfile = EmployeeProfileDto(
    id: 'emp_001',
    fullName: 'Trần Văn Nam',
    employeeCode: 'EMP001',
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
    departmentName: 'Phòng Công Nghệ',
    positionName: 'Kỹ Sư Phần Mềm',
    managerName: 'Nguyễn Văn Sếp',
    workplaceName: 'Tòa Nhà FPT',
    phone: '0987654321',
    email: 'nhanvien@corestaff.vn',
    address: 'Hà Nội',
    joinDate: '2023-05-10T00:00:00.000Z',
  );

  setUp(() {
    mockRepository = MockAccountRepository();
    final sl = GetIt.instance;
    if (sl.isRegistered<AccountBloc>()) {
      sl.unregister<AccountBloc>();
    }
    sl.registerFactory<AccountBloc>(() => AccountBloc(accountRepository: mockRepository));
  });

  tearDown(() {
    final sl = GetIt.instance;
    if (sl.isRegistered<AccountBloc>()) {
      sl.unregister<AccountBloc>();
    }
  });

  group('AccountScreen Widget Tests', () {
    testWidgets('renders profile data when loaded successfully', (tester) async {
      when(() => mockRepository.getMyProfile()).thenAnswer((_) async => testProfile);

      await tester.pumpWidget(
        MaterialApp(
          home: AccountScreen(
            user: testUser,
            onChangePassword: () {},
            onLogout: () {},
          ),
        ),
      );

      // Pump frames for BLoC async emission
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Hồ sơ cá nhân'), findsOneWidget);
      expect(find.text('Trần Văn Nam'), findsOneWidget);
      expect(find.text('EMP001'), findsOneWidget);
      expect(find.text('Phòng Công Nghệ'), findsOneWidget);
      expect(find.text('Kỹ Sư Phần Mềm'), findsOneWidget);
      expect(find.text('Nguyễn Văn Sếp'), findsOneWidget);
      expect(find.text('Tòa Nhà FPT'), findsOneWidget);
      expect(find.text('10/05/2023'), findsOneWidget);
      expect(find.text('nhanvien@corestaff.vn'), findsOneWidget);
      expect(find.text('0987654321'), findsOneWidget);
      expect(find.text('Hà Nội'), findsOneWidget);
    });

    testWidgets('displays confirmation dialog on logout press and calls callback on confirm', (tester) async {
      when(() => mockRepository.getMyProfile()).thenAnswer((_) async => testProfile);
      bool loggedOut = false;

      await tester.pumpWidget(
        MaterialApp(
          home: AccountScreen(
            user: testUser,
            onChangePassword: () {},
            onLogout: () => loggedOut = true,
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Scroll to logout button
      final logoutBtnFinder = find.text('Đăng xuất').first;
      await tester.scrollUntilVisible(logoutBtnFinder, 200);
      expect(logoutBtnFinder, findsOneWidget);

      await tester.tap(logoutBtnFinder);
      await tester.pumpAndSettle();

      // Verify dialog appears
      expect(find.text('Đăng xuất tài khoản'), findsOneWidget);
      expect(find.text('Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?'), findsOneWidget);

      // Tap confirm button inside dialog (last 'Đăng xuất' text widget)
      final confirmBtnFinder = find.widgetWithText(TextButton, 'Đăng xuất');
      await tester.tap(confirmBtnFinder);
      await tester.pumpAndSettle();

      expect(loggedOut, isTrue);
    });
  });
}
