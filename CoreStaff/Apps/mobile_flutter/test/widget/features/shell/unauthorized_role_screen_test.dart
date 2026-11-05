import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/features/auth/data/models/auth_user_dto.dart';
import 'package:corestaff_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:corestaff_mobile/features/shell/presentation/screens/unauthorized_role_screen.dart';

class MockAuthBloc extends Mock implements AuthBloc {}

void main() {
  late MockAuthBloc mockAuthBloc;

  setUp(() {
    mockAuthBloc = MockAuthBloc();
    when(() => mockAuthBloc.stream).thenAnswer((_) => const Stream.empty());
  });

  group('UnauthorizedRoleScreen Widget Tests', () {
    testWidgets('renders warning and role information for HR account', (tester) async {
      final hrUser = AuthUser(
        id: 'admin_1',
        email: 'hr.manager@corestaff.vn',
        fullName: 'Nguyen Thi HR',
        role: 'HR',
        status: 'ACTIVE',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider<AuthBloc>.value(
            value: mockAuthBloc,
            child: UnauthorizedRoleScreen(user: hrUser),
          ),
        ),
      );

      expect(find.text('Vai trò không khả dụng'), findsOneWidget);
      expect(find.textContaining('hr.manager@corestaff.vn'), findsOneWidget);
      expect(find.textContaining('Nhân sự (HR)'), findsOneWidget);
      expect(find.text('Đăng xuất tài khoản'), findsOneWidget);

      await tester.tap(find.text('Đăng xuất tài khoản'));
      await tester.pump();

      verify(() => mockAuthBloc.add(const AuthLogoutRequested())).called(1);
    });
  });
}

