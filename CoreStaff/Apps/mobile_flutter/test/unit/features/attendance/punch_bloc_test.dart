import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_result_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/domain/services/punch_coordinator.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/punch_bloc.dart';

class MockPunchCoordinator extends Mock implements PunchCoordinator {}

void main() {
  late MockPunchCoordinator mockCoordinator;

  const sampleToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T12:00:00.000Z',
    attendanceStatus: 'NOT_CHECKED_IN',
    availableAction: 'CHECK_IN',
    assignment: AttendanceAssignmentDto(
      shiftName: 'Ca hành chính',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      workplaceName: 'Bitexco',
      address: '2 Hai Trieu, Ben Nghe, Q1, TP.HCM',
    ),
  );

  const sampleResult = PunchResultDto(
    workDate: '2026-11-04',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
  );

  setUpAll(() {
    registerFallbackValue(sampleToday);
  });

  setUp(() {
    mockCoordinator = MockPunchCoordinator();
  });

  group('PunchBloc Unit Tests', () {
    test('initial state is PunchInitial', () {
      final bloc = PunchBloc(punchCoordinator: mockCoordinator);
      expect(bloc.state, const PunchInitial());
    });

    blocTest<PunchBloc, PunchState>(
      'PunchReset resets state to PunchInitial',
      build: () => PunchBloc(punchCoordinator: mockCoordinator),
      seed: () => const PunchFailure(message: 'Error'),
      act: (bloc) => bloc.add(const PunchReset()),
      expect: () => [const PunchInitial()],
    );

    blocTest<PunchBloc, PunchState>(
      'PunchSubmitted emits [PunchDetectingEnvironment, PunchMethodDecided, PunchSuccess] on successful punch',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenAnswer((_) async => const PunchCoordinatorSuccess(
              result: sampleResult,
              method: 'NETWORK',
            ));
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleToday)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchMethodDecided(
          method: 'NETWORK',
          details: 'Xác thực thành công qua NETWORK',
        ),
        const PunchSuccess(
          action: 'CHECK_IN',
          message: 'Đã ghi nhận thời gian vào ca.',
          method: 'NETWORK',
          result: sampleResult,
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'PunchSubmitted emits [PunchDetectingEnvironment, PunchInitial] when user cancels camera',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenAnswer((_) async => const PunchCoordinatorCancelled());
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleToday)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchInitial(),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'PunchSubmitted emits [PunchDetectingEnvironment, PunchFailure] on coordinator failure with resolved message',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenAnswer((_) async => const PunchCoordinatorFailure(
              message: 'Already checked in',
              errorCode: 'ALREADY_CHECKED_IN',
            ));
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleToday)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchFailure(
          message: 'Bạn đã điểm danh vào ca hôm nay rồi.',
          errorCode: 'ALREADY_CHECKED_IN',
          isPermissionDenied: false,
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'PunchSubmitted emits [PunchDetectingEnvironment, PunchFailure] with isPermissionDenied true when camera permission is denied',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenAnswer((_) async => const PunchCoordinatorFailure(
              message: 'Cần quyền camera để chụp ảnh chấm công. Hãy bật trong Cài đặt.',
              errorCode: 'CAMERA_PERMISSION_DENIED',
              isPermissionDenied: true,
            ));
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleToday)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchFailure(
          message: 'Cần quyền camera để chụp ảnh chấm công. Hãy bật trong Cài đặt.',
          errorCode: 'CAMERA_PERMISSION_DENIED',
          isPermissionDenied: true,
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'PunchSubmitted emits [PunchDetectingEnvironment, PunchFailure] gracefully when coordinator throws unexpected exception',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(Exception('Hardware channel disconnected'));
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleToday)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchFailure(
          message: 'Hardware channel disconnected',
          errorCode: null,
          isPermissionDenied: false,
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'PunchSubmitted emits [PunchDetectingEnvironment, PunchFailure] when coordinator throws unhandled ApiException',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(const ApiException(
              code: 'CAMERA_PERMISSION_DENIED',
              message: 'Cần quyền camera để chụp ảnh chấm công.',
              statusCode: 403,
            ));
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleToday)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchFailure(
          message: 'Cần quyền camera để chụp ảnh chấm công.',
          errorCode: 'CAMERA_PERMISSION_DENIED',
          isPermissionDenied: true,
        ),
      ],
    );
  });
}
